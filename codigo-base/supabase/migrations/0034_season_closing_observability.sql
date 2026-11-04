-- 0034_season_closing_observability.sql
-- Observabilidade do fechamento de temporadas (Q087/Q109/Q134).
--
-- Contexto: 0033 agenda tick_seasons via pg_cron, mas sem trilha nem deteccao de
-- atraso. O questionario pede acompanhar formacao/fechamento, com alerta a
-- administracao apos 30 minutos sem fechamento consistente (Q134) e logs SEM
-- respostas/dados pessoais desnecessarios (Q087). Inconsistencia mantem o
-- resultado em apuracao ate reconciliacao; uma temporada problematica nao deve
-- impedir o processamento das demais.
--
-- Esta migracao adiciona:
--   1. season_ops_log: trilha append-only de eventos operacionais (sem PII);
--   2. log_season_op(): helper de gravacao;
--   3. tick_seasons() redefinido: registra a passada e isola erros POR temporada
--      (uma falha nao aborta a varredura; a temporada fica em 'closing' e e
--      registrada para reconciliacao);
--   4. seasons_needing_attention(grace): lista as temporadas vencidas ha mais de
--      N minutos ainda nao fechadas — a condicao de alerta de 30 min (Q134).
-- O disparo do alerta (e-mail/painel) e operacao humana; aqui entregamos a
-- deteccao consultavel e a trilha.

-- ---------------------------------------------------------------------------
-- season_ops_log: eventos operacionais do agendador. Append-only. detail e um
-- jsonb com contadores/ids (NUNCA respostas de aluno ou dados pessoais — Q087).
-- ---------------------------------------------------------------------------
create table if not exists public.season_ops_log (
  id         uuid primary key default gen_random_uuid(),
  event      text not null,                 -- ex.: 'tick_start', 'tick_done', 'close_ok', 'close_error', 'open_error'
  season_id  uuid references public.seasons (id) on delete set null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.season_ops_log is
  'Trilha operacional append-only do agendador de temporadas (Q087). detail traz contadores/ids, nunca respostas de aluno ou dados pessoais. Base da observabilidade de formacao/fechamento.';

create index if not exists season_ops_log_created_idx on public.season_ops_log (created_at desc);
create index if not exists season_ops_log_event_idx   on public.season_ops_log (event, created_at desc);

-- RLS: somente admin le a trilha (operacao). Sem escrita do cliente — gravacao
-- por funcao de autoridade (SECURITY DEFINER).
alter table public.season_ops_log enable row level security;

drop policy if exists season_ops_log_admin_select on public.season_ops_log;
create policy season_ops_log_admin_select on public.season_ops_log
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- log_season_op(event, season, detail): gravacao do evento operacional.
-- SECURITY DEFINER; nao exposta ao cliente.
-- ---------------------------------------------------------------------------
create or replace function public.log_season_op(
  p_event     text,
  p_season_id uuid default null,
  p_detail    jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.season_ops_log (event, season_id, detail)
  values (p_event, p_season_id, coalesce(p_detail, '{}'::jsonb));
$$;

comment on function public.log_season_op(text, uuid, jsonb) is
  'Registra um evento operacional do agendador em season_ops_log (sem PII). SECURITY DEFINER; interna.';

revoke execute on function public.log_season_op(text, uuid, jsonb) from authenticated;

-- ---------------------------------------------------------------------------
-- tick_seasons(): redefinicao que preserva a orquestracao (abre semana corrente,
-- fecha vencidas) e ACRESCENTA observabilidade:
--   - registra 'tick_start' e 'tick_done' (com contadores);
--   - abre a semana corrente isolando erro ('open_error' nao aborta a passada);
--   - fecha cada temporada vencida num bloco proprio: sucesso -> 'close_ok';
--     erro -> 'close_error' (a temporada permanece em 'closing' para
--     reconciliacao e a varredura segue com as demais).
-- Retorna o numero de temporadas fechadas com sucesso nesta passada.
-- ---------------------------------------------------------------------------
create or replace function public.tick_seasons()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed    integer := 0;
  v_errors    integer := 0;
  v_row       record;
  v_errmsg    text;
begin
  perform public.log_season_op('tick_start', null, '{}'::jsonb);

  -- Abre (ou mantem) a temporada da semana corrente, isolando erro.
  begin
    perform public.open_season(now());
  exception when others then
    get stacked diagnostics v_errmsg = message_text;
    perform public.log_season_op('open_error', null, jsonb_build_object('error', v_errmsg));
  end;

  -- Fecha as vencidas, uma por vez, isolando erros.
  for v_row in
    select id from public.seasons
     where ends_at <= now() and status <> 'closed'
     order by ends_at asc
  loop
    begin
      perform public.close_season(v_row.id, 10);
      v_closed := v_closed + 1;
      perform public.log_season_op('close_ok', v_row.id, '{}'::jsonb);
    exception when others then
      -- A temporada permanece como estava (close_season nao marca 'closed' em
      -- erro); registra para reconciliacao e segue com as demais (Q134).
      get stacked diagnostics v_errmsg = message_text;
      v_errors := v_errors + 1;
      perform public.log_season_op('close_error', v_row.id, jsonb_build_object('error', v_errmsg));
    end;
  end loop;

  perform public.log_season_op(
    'tick_done', null,
    jsonb_build_object('closed', v_closed, 'errors', v_errors)
  );

  return v_closed;
end;
$$;

comment on function public.tick_seasons() is
  'Uma passada do agendador de temporadas (Q109/Q134), com observabilidade (Q087): abre a semana corrente e fecha as vencidas, isolando erros por temporada (uma falha nao aborta a varredura; fica para reconciliacao). Registra tick_start/open_error/close_ok/close_error/tick_done em season_ops_log. SECURITY DEFINER; nao exposta ao cliente.';

revoke execute on function public.tick_seasons() from authenticated;

-- ---------------------------------------------------------------------------
-- seasons_needing_attention(grace_minutes): temporadas cuja janela terminou ha
-- mais de grace_minutes e que ainda nao estao 'closed' — a condicao de alerta
-- de 30 min (Q134). Tambem retorna o ultimo erro de fechamento registrado, se
-- houver, para a operacao priorizar. Leitura de admin.
-- ---------------------------------------------------------------------------
create or replace function public.seasons_needing_attention(p_grace_minutes integer default 30)
returns table (
  season_id        uuid,
  status           public.season_status,
  ended_at         timestamptz,
  minutes_overdue  integer,
  last_error       text,
  last_error_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id as season_id,
    s.status,
    s.ends_at as ended_at,
    floor(extract(epoch from (now() - s.ends_at)) / 60)::integer as minutes_overdue,
    le.detail ->> 'error' as last_error,
    le.created_at as last_error_at
  from public.seasons s
  left join lateral (
    select l.detail, l.created_at
      from public.season_ops_log l
     where l.season_id = s.id and l.event = 'close_error'
     order by l.created_at desc
     limit 1
  ) le on true
  where public.is_admin()   -- so administracao enxerga a fila de alerta
    and s.status <> 'closed'
    and s.ends_at <= now() - make_interval(mins => greatest(coalesce(p_grace_minutes, 30), 0))
  order by s.ends_at asc;
$$;

comment on function public.seasons_needing_attention(integer) is
  'Temporadas vencidas ha mais de grace_minutes (padrao 30) ainda nao fechadas — condicao de alerta operacional (Q134). Inclui o ultimo erro de fechamento registrado. Retorna linhas apenas para administradores (is_admin).';

-- SECURITY DEFINER para ler a trilha/seasons; o proprio corpo restringe a
-- administradores (is_admin). Nao-admin recebe conjunto vazio.
grant execute on function public.seasons_needing_attention(integer) to authenticated;
