-- 0036_season_alert.sql
-- Disparo do alerta de atraso no fechamento — Camada 1 (Q087/Q134).
--
-- Contexto: 0034 criou a DETECÇÃO (seasons_needing_attention) e a trilha
-- (season_ops_log), e tick_seasons registra tick_start/close_ok/close_error/
-- tick_done. Mas um atraso só aparecia se alguém consultasse. Esta migração
-- fecha o laço: quando uma temporada vence e não fecha dentro da carência
-- (30 min, Q134), registra um evento 'alert' na trilha — auditável e
-- consultável — sem depender de ninguém abrir a página.
--
-- Camada 1 (esta): registrar o alerta na trilha, de forma idempotente (um alerta
-- por episódio de atraso, não a cada varredura). A Camada 2 (enviar o alerta a um
-- humano via webhook/pg_net ou Edge Function) fica para quando houver um destino
-- definido; aqui deixamos o gancho pronto (o evento 'alert' na trilha).

-- ---------------------------------------------------------------------------
-- check_season_alerts(grace_minutes): registra um evento 'alert' para cada
-- temporada vencida há mais de grace_minutes e ainda não fechada, SE ainda não
-- houver um alerta para aquela temporada desde que ela venceu (dedup por
-- episódio: ends_at é a âncora). Retorna quantos alertas novos foram registrados.
-- SECURITY DEFINER; interna (chamada pelo agendador).
-- ---------------------------------------------------------------------------
create or replace function public.check_season_alerts(p_grace_minutes integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     record;
  v_new     integer := 0;
begin
  for v_row in
    select s.id, s.ends_at, s.status,
           floor(extract(epoch from (now() - s.ends_at)) / 60)::integer as minutes_overdue
      from public.seasons s
     where s.status <> 'closed'
       and s.ends_at <= now() - make_interval(mins => greatest(coalesce(p_grace_minutes, 30), 0))
  loop
    -- Dedup por episódio: só registra se nenhum 'alert' foi gravado para esta
    -- temporada desde que ela venceu (ends_at). Assim o alerta não se repete a
    -- cada varredura de 5 min; um novo episódio só geraria novo alerta se a
    -- temporada vencesse de novo (o que não ocorre — ends_at é fixo).
    if not exists (
      select 1 from public.season_ops_log l
       where l.season_id = v_row.id
         and l.event = 'alert'
         and l.created_at >= v_row.ends_at
    ) then
      perform public.log_season_op(
        'alert',
        v_row.id,
        jsonb_build_object(
          'minutes_overdue', v_row.minutes_overdue,
          'status', v_row.status,
          'grace_minutes', greatest(coalesce(p_grace_minutes, 30), 0)
        )
      );
      v_new := v_new + 1;
    end if;
  end loop;

  return v_new;
end;
$$;

comment on function public.check_season_alerts(integer) is
  'Registra um evento alert em season_ops_log para cada temporada vencida há mais de grace_minutes e não fechada, deduplicado por episódio (um alerta por temporada desde seu ends_at). Camada 1 do alerta de 30 min (Q134); a entrega a um humano (Camada 2) consome estes eventos. SECURITY DEFINER, interna.';

revoke execute on function public.check_season_alerts(integer) from authenticated;

-- ---------------------------------------------------------------------------
-- tick_seasons(): redefinição que PRESERVA 0034 (trilha + isolamento de erro por
-- temporada) e ACRESCENTA, ao fim da passada, a checagem de alertas. A checagem
-- roda depois dos fechamentos, então só alerta sobre temporadas que realmente
-- não fecharam dentro da carência.
-- ---------------------------------------------------------------------------
create or replace function public.tick_seasons()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed  integer := 0;
  v_errors  integer := 0;
  v_alerts  integer := 0;
  v_row     record;
  v_errmsg  text;
begin
  perform public.log_season_op('tick_start', null, '{}'::jsonb);

  -- Abre (ou mantém) a temporada da semana corrente, isolando erro.
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
      get stacked diagnostics v_errmsg = message_text;
      v_errors := v_errors + 1;
      perform public.log_season_op('close_error', v_row.id, jsonb_build_object('error', v_errmsg));
    end;
  end loop;

  -- ALERTA (Camada 1): registra alertas das temporadas que seguem vencidas e
  -- não fechadas além da carência de 30 min (Q134). Depois dos fechamentos.
  v_alerts := public.check_season_alerts(30);

  perform public.log_season_op(
    'tick_done', null,
    jsonb_build_object('closed', v_closed, 'errors', v_errors, 'alerts', v_alerts)
  );

  return v_closed;
end;
$$;

comment on function public.tick_seasons() is
  'Uma passada do agendador de temporadas (Q109/Q134) com observabilidade (Q087): abre a semana corrente, fecha as vencidas isolando erros por temporada, e registra alertas (check_season_alerts) das que seguem vencidas além da carência de 30 min. Registra tick_start/open_error/close_ok/close_error/alert/tick_done em season_ops_log. SECURITY DEFINER; não exposta ao cliente.';

revoke execute on function public.tick_seasons() from authenticated;

-- ---------------------------------------------------------------------------
-- Leitura: season_alerts(limit) — últimos alertas registrados, para a operação
-- consultar (admin-only via is_admin no corpo). Base da Camada 2 (entrega).
-- ---------------------------------------------------------------------------
create or replace function public.season_alerts(p_limit integer default 50)
returns table (
  season_id       uuid,
  minutes_overdue integer,
  detail          jsonb,
  created_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select l.season_id,
         (l.detail ->> 'minutes_overdue')::integer as minutes_overdue,
         l.detail,
         l.created_at
    from public.season_ops_log l
   where public.is_admin()
     and l.event = 'alert'
   order by l.created_at desc
   limit greatest(coalesce(p_limit, 50), 1);
$$;

comment on function public.season_alerts(integer) is
  'Últimos alertas de atraso de fechamento registrados (event=alert em season_ops_log). Restrita a admin (is_admin). Base para a entrega do alerta (Camada 2).';

grant execute on function public.season_alerts(integer) to authenticated;
