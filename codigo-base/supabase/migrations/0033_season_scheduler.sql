-- 0033_season_scheduler.sql
-- Agendador das temporadas: abre/fecha automaticamente na virada (Q109/Q134/Q141).
--
-- Contexto: open_season/close_season (0028) sao RPCs idempotentes de autoridade,
-- mas nada as dispara. O questionario pede processamento de fechamento
-- "autorizado e monitorado", no backend existente, com varredura a cada 5
-- minutos e retentativa idempotente, "em vez de depender de alguem abrir a
-- pagina" (Q109/Q134). Esta migracao adiciona:
--   1. tick_seasons(): orquestrador idempotente (abre a semana corrente e fecha
--      as temporadas vencidas);
--   2. um job pg_cron chamando tick_seasons() a cada 5 minutos.
--
-- NOTA sobre 0001: o cabecalho de 0001 dizia "no cron". Aquela nota e do estado
-- PRE-temporadas; as rodadas de temporada do questionario (Q109/Q134/Q141)
-- autorizam explicitamente o processamento programado. Este agendamento e o
-- mecanismo escolhido (opcao A), substituindo a nota antiga para este ramo.
--
-- Robustez: se pg_cron nao estiver disponivel no ambiente, a migracao NAO falha
-- (o agendamento e pulado com aviso); tick_seasons continua utilizavel por
-- chamada manual ou por um agendador externo.

-- ---------------------------------------------------------------------------
-- tick_seasons(): uma passada do agendador. Idempotente.
--   - garante a temporada da semana corrente aberta (open_season);
--   - fecha toda temporada cuja janela ja terminou e que ainda nao esta closed
--     (close_season) — inclui as em 'open'/'closing'/'scheduled' vencidas.
-- Retorna quantas temporadas foram fechadas nesta passada.
-- SECURITY DEFINER: open_season/close_season sao de autoridade (revogadas de
-- authenticated); tick_seasons tambem e revogada do cliente (so cron/admin).
-- ---------------------------------------------------------------------------
create or replace function public.tick_seasons()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed integer := 0;
  v_row    record;
begin
  -- Abre (ou mantem) a temporada da semana corrente. Idempotente.
  perform public.open_season(now());

  -- Fecha as temporadas cuja janela ja terminou e que ainda nao fecharam.
  for v_row in
    select id from public.seasons
     where ends_at <= now() and status <> 'closed'
     order by ends_at asc
  loop
    perform public.close_season(v_row.id, 10);
    v_closed := v_closed + 1;
  end loop;

  return v_closed;
end;
$$;

comment on function public.tick_seasons() is
  'Uma passada do agendador de temporadas (Q109/Q134): abre a temporada da semana corrente e fecha as vencidas. Idempotente; segura para rodar a cada 5 minutos. SECURITY DEFINER; nao exposta ao cliente.';

-- Operacao de autoridade: so o cron/admin dispara.
revoke execute on function public.tick_seasons() from authenticated;

-- ---------------------------------------------------------------------------
-- Agendamento via pg_cron (a cada 5 minutos). Guardado: se a extensao nao
-- existir no ambiente, apenas registra um aviso e segue sem falhar.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    -- Remove um agendamento anterior de mesmo nome (idempotencia da migracao).
    if exists (select 1 from cron.job where jobname = 'tick_seasons_every_5m') then
      perform cron.unschedule('tick_seasons_every_5m');
    end if;

    -- Varredura a cada 5 minutos (Q134).
    perform cron.schedule(
      'tick_seasons_every_5m',
      '*/5 * * * *',
      $cron$ select public.tick_seasons(); $cron$
    );
  else
    raise notice 'pg_cron indisponivel: tick_seasons() nao foi agendada. Dispare-a por um agendador externo ou habilite pg_cron no projeto.';
  end if;
end
$$;
