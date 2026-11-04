-- 0037_season_alert_delivery.sql
-- Entrega do alerta de atraso a um humano — Camada 2 (Q134/Q078).
--
-- Contexto: 0036 (Camada 1) registra um evento 'alert' em season_ops_log quando
-- uma temporada vence e nao fecha dentro da carencia, deduplicado por episodio.
-- Esta migracao ENTREGA esse alerta: faz um POST para um webhook (Discord) via
-- pg_net, lendo a URL do Supabase Vault (secret 'season_alert_webhook'), sem a
-- URL jamais aparecer no codigo/repositorio.
--
-- Robustez (Q078): a entrega NUNCA pode derrubar o agendador. Se pg_net nao
-- estiver instalado, o secret faltar, ou o POST falhar, a funcao captura a
-- excecao e registra 'alert_delivery_error' na trilha — a aprendizagem, o
-- fechamento e o registro do alerta (Camada 1) seguem intactos.
--
-- Idempotencia: a entrega e chamada so quando a Camada 1 registra um alerta NOVO
-- (um por episodio), entao o webhook recebe um aviso por atraso, nao a cada
-- varredura de 5 min.

-- ---------------------------------------------------------------------------
-- deliver_season_alert(season_id, detail): envia o alerta ao webhook. Le a URL
-- do Vault por nome; monta {"content": "..."} e faz POST via pg_net. Tudo via
-- EXECUTE dinamico e guardado por checagens, para que a FUNCAO APLIQUE mesmo sem
-- pg_net instalado (o POST so e tentado se a extensao existir em runtime).
-- SECURITY DEFINER; interna.
-- ---------------------------------------------------------------------------
create or replace function public.deliver_season_alert(
  p_season_id uuid,
  p_detail    jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url      text;
  v_overdue  text := coalesce(p_detail ->> 'minutes_overdue', '?');
  v_content  text;
  v_payload  jsonb;
begin
  -- pg_net instalado? Sem ele, nao ha como entregar; registra e sai sem erro.
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    perform public.log_season_op('alert_delivery_error', p_season_id,
      jsonb_build_object('reason', 'pg_net nao instalado'));
    return;
  end if;

  -- URL do webhook no Vault (nunca em texto no codigo). Sem secret, registra e sai.
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets
     where name = 'season_alert_webhook'
     limit 1;
  exception when others then
    v_url := null;  -- schema vault indisponivel, etc.
  end;

  if v_url is null or length(v_url) = 0 then
    perform public.log_season_op('alert_delivery_error', p_season_id,
      jsonb_build_object('reason', 'secret season_alert_webhook ausente'));
    return;
  end if;

  -- Mensagem para o Discord (campo "content"). Sem dados pessoais (Q087).
  v_content := format(
    'Alerta de temporada: a temporada %s esta vencida ha %s min e ainda nao fechou. Verificar apuracao/reconciliacao.',
    p_season_id::text, v_overdue
  );
  v_payload := jsonb_build_object('content', v_content);

  -- POST via pg_net. EXECUTE dinamico para nao exigir pg_net em tempo de criacao
  -- da funcao. Falha de entrega e registrada, sem propagar excecao.
  begin
    execute
      'select net.http_post(url => $1, headers => $2::jsonb, body => $3::jsonb)'
      using v_url,
            '{"Content-Type": "application/json"}',
            v_payload;

    perform public.log_season_op('alert_delivered', p_season_id,
      jsonb_build_object('minutes_overdue', v_overdue));
  exception when others then
    declare v_err text;
    begin
      get stacked diagnostics v_err = message_text;
      perform public.log_season_op('alert_delivery_error', p_season_id,
        jsonb_build_object('error', v_err));
    end;
  end;
end;
$$;

comment on function public.deliver_season_alert(uuid, jsonb) is
  'Camada 2 do alerta (Q134): envia o alerta de atraso ao webhook (Discord) via pg_net, lendo a URL do Vault (season_alert_webhook). Robusta (Q078): sem pg_net/secret ou com falha de POST, registra alert_delivery_error e nao propaga erro. SECURITY DEFINER, interna.';

revoke execute on function public.deliver_season_alert(uuid, jsonb) from authenticated;

-- ---------------------------------------------------------------------------
-- check_season_alerts(grace): redefinicao que PRESERVA a Camada 1 (registrar o
-- evento 'alert' deduplicado) e, ao registrar um alerta NOVO, dispara a entrega
-- (deliver_season_alert). Assim o webhook recebe um aviso por episodio de atraso.
-- ---------------------------------------------------------------------------
create or replace function public.check_season_alerts(p_grace_minutes integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  record;
  v_new  integer := 0;
begin
  for v_row in
    select s.id, s.ends_at, s.status,
           floor(extract(epoch from (now() - s.ends_at)) / 60)::integer as minutes_overdue
      from public.seasons s
     where s.status <> 'closed'
       and s.ends_at <= now() - make_interval(mins => greatest(coalesce(p_grace_minutes, 30), 0))
  loop
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

      -- CAMADA 2: entrega o alerta recem-registrado (robusta; nunca propaga erro).
      perform public.deliver_season_alert(
        v_row.id,
        jsonb_build_object('minutes_overdue', v_row.minutes_overdue)
      );

      v_new := v_new + 1;
    end if;
  end loop;

  return v_new;
end;
$$;

comment on function public.check_season_alerts(integer) is
  'Registra um evento alert em season_ops_log para cada temporada vencida alem da carencia e nao fechada, deduplicado por episodio; ao registrar um alerta NOVO, dispara a entrega ao webhook (deliver_season_alert, Camada 2). Camada 1 do alerta de 30 min (Q134). SECURITY DEFINER, interna.';

revoke execute on function public.check_season_alerts(integer) from authenticated;
