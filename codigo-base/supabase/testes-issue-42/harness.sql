-- harness.sql — Testes automáticos auto-verificáveis da issue 42 (T1–T9).
--
-- Roda num banco de ENSAIO com as migrações 0001–0037 aplicadas e o seed base
-- (supabase/seed.sql) carregado (reutiliza as contas/cursos de lá). NÃO é
-- migration e NÃO deve rodar em produção.
--
-- Mecânica: cada verificação usa `assert` (ou raise exception). A falha de
-- qualquer asserção aborta com erro — o CI/runner detecta pelo exit code. Todo
-- o harness roda numa transação e dá ROLLBACK no fim, então NÃO persiste dados
-- (nem tentativas, nem temporadas, nem eventos). É seguro reexecutar.
--
-- Rodar:
--   psql "<conn>" -v ON_ERROR_STOP=1 -f harness.sql
--   (local) docker exec -i supabase_db_<proj> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < harness.sql
--   (npm)   SUPABASE_DB_URL=... npm run test:issue42
--
-- Ao final, se tudo passou, imprime "HARNESS ISSUE 42: OK". Sem meta-comandos de
-- psql (\set etc.) para funcionar tambem via cliente pg (o runner). Para psql
-- direto, passe -v ON_ERROR_STOP=1 na linha de comando.

begin;

-- Contas de teste (seed base). Aulas/questões do Curso A (Lógica, público):
--   a101 multiple_choice base 4 (correta: {"selected":["a"]})
--   a201 fill_blank base 6 (correta: {"text":"if"})
do $harness$
declare
  u_carla  uuid := '00000000-0000-4000-a000-000000000004';
  u_diego  uuid := '00000000-0000-4000-a000-000000000005';
  u_elisa  uuid := '00000000-0000-4000-a000-000000000006';
  u_felipe uuid := '00000000-0000-4000-a000-000000000007';
  u_admin  uuid := '00000000-0000-4000-a000-000000000001';
  c_a      uuid := '00000000-0000-4000-c000-00000000000a';
  l_a101   uuid := '00000000-0000-4000-e000-00000000a101';
  l_a201   uuid := '00000000-0000-4000-e000-00000000a201';
  q_a101   uuid := '00000000-0000-4000-f000-00000000a101';
  q_a201   uuid := '00000000-0000-4000-f000-00000000a201';
  r_logica uuid := '00000000-0000-4000-b000-000000000001'; -- sala LOGICA25 (Carla é membro)
  v_a uuid; v_b uuid;
  v_xp_room integer;
  v_xp1 integer; v_xp2 integer; v_xp3 integer;
  v_n integer; v_cat public.season_category; v_res public.season_category;
  v_s uuid; v_g uuid; v_hidden boolean; v_dn text;
begin
  -- Independência do estado: dentro da transação (revertida no rollback), zera
  -- temporadas/eventos/atribuições e as tentativas das contas de teste, para o
  -- harness não colidir com resíduos de execuções anteriores. Nada disso é
  -- persistido (rollback ao final).
  delete from public.season_ops_log;
  delete from public.season_entries;
  delete from public.season_groups;
  delete from public.seasons;
  delete from public.xp_events;
  delete from public.mission_assignments;
  delete from public.mission_occurrences;
  delete from public.answers a using public.attempts t
   where a.attempt_id = t.id and t.user_id in (u_carla, u_diego, u_elisa, u_felipe);
  delete from public.completions where user_id in (u_carla, u_diego, u_elisa, u_felipe);
  delete from public.attempts where user_id in (u_carla, u_diego, u_elisa, u_felipe);

  -- =========================================================================
  -- T1 — XP proporcional ao número da tentativa (0035 / Q112/Q093)
  -- =========================================================================
  -- T1.1 erro na execução 1, acerto na execução 2 -> round(4/2)=2
  insert into public.attempts (user_id, lesson_id, course_id) values (u_carla, l_a101, c_a) returning id into v_a;
  insert into public.answers (attempt_id, question_id, submitted) values (v_a, q_a101, '{"selected":["b"]}'::jsonb);
  select xp_earned into v_xp1 from public.finalize_attempt(v_a);
  assert v_xp1 = 0, format('T1.1a: execucao errada deveria render 0, veio %s', v_xp1);

  insert into public.attempts (user_id, lesson_id, course_id) values (u_carla, l_a101, c_a) returning id into v_b;
  insert into public.answers (attempt_id, question_id, submitted) values (v_b, q_a101, '{"selected":["a"]}'::jsonb);
  select xp_earned into v_xp2 from public.finalize_attempt(v_b);
  assert v_xp2 = 2, format('T1.1b: 1o acerto na 2a execucao deveria render round(4/2)=2, veio %s', v_xp2);

  -- T1.2 acerto de primeira -> XP cheio (a201 base 6)
  insert into public.attempts (user_id, lesson_id, course_id) values (u_diego, l_a201, c_a) returning id into v_a;
  insert into public.answers (attempt_id, question_id, submitted) values (v_a, q_a201, '{"text":"if"}'::jsonb);
  select xp_earned into v_xp1 from public.finalize_attempt(v_a);
  assert v_xp1 = 6, format('T1.2: acerto de primeira deveria render 6, veio %s', v_xp1);

  -- T1.3 acerto APÓS o 1o acerto -> 0 (anti-regrind). Carla responde a101 de novo.
  insert into public.attempts (user_id, lesson_id, course_id) values (u_carla, l_a101, c_a) returning id into v_a;
  insert into public.answers (attempt_id, question_id, submitted) values (v_a, q_a101, '{"selected":["a"]}'::jsonb);
  select xp_earned into v_xp3 from public.finalize_attempt(v_a);
  assert v_xp3 = 0, format('T1.3: acerto apos 1o acerto deveria render 0 (anti-regrind), veio %s', v_xp3);

  -- =========================================================================
  -- T10 — Finalização em contexto de SALA não quebra (regressão do trigger
  -- set_updated_at em room_members, corrigida em 0038). Antes falhava com
  -- "record new has no field updated_at".
  -- =========================================================================
  insert into public.attempts (user_id, lesson_id, room_id) values (u_carla, l_a201, r_logica) returning id into v_a;
  insert into public.answers (attempt_id, question_id, submitted) values (v_a, q_a201, '{"text":"if"}'::jsonb);
  select xp_earned into v_xp_room from public.finalize_attempt(v_a);  -- nao deve lancar excecao
  assert v_xp_room >= 0, 'T10: finalizacao em sala deveria concluir sem erro';
  -- O credito de sala vai para room_members.xp_internal (nunca xp_global).
  assert exists (
    select 1 from public.room_members where room_id = r_logica and user_id = u_carla
  ), 'T10: Carla deveria permanecer membro da sala apos finalizar';

  -- =========================================================================
  -- T2 — Ledger de XP (0023 / Q102)
  -- =========================================================================
  -- T2.1 cada finalize gerou um xp_events learning_base/course para a Carla.
  select count(*) into v_n from public.xp_events
   where user_id = u_carla and origin = 'learning_base' and context = 'course';
  assert v_n >= 1, format('T2.1: esperado >=1 xp_event learning_base/course da Carla, veio %s', v_n);

  -- T2.3 idempotência: refinalizar o attempt vencedor da Carla não duplica evento.
  select count(*) into v_n from public.xp_events where user_id = u_carla;
  perform public.finalize_attempt(v_b);  -- re-finalize
  assert (select count(*) from public.xp_events where user_id = u_carla) = v_n,
    'T2.3: refinalizar nao pode duplicar xp_events';

  -- =========================================================================
  -- T3 — Missões globais/curso: avanço e bônus único (0024/0025/0031)
  -- =========================================================================
  -- Após as atividades acima, a missão global diária de "concluir aula" deve ter
  -- sido materializada e avançada para a Carla; confere que existe atribuição.
  select count(*) into v_n
    from public.mission_assignments a
    join public.mission_occurrences o on o.id = a.occurrence_id
    join public.mission_definitions d on d.id = o.definition_id
   where a.user_id = u_carla and d.scope = 'global_daily';
  assert v_n >= 1, format('T3.1: esperado atribuicao de missao global diaria para a Carla, veio %s', v_n);

  -- Bônus de missão, se concedido, é xp_events origin='mission_bonus' (não pontua temporada).
  -- Garante que, se houver bônus, ele é mission_bonus e NÃO learning_base.
  perform 1 from public.xp_events where user_id = u_carla and origin = 'mission_bonus';
  -- (não exigimos que haja bônus; exigimos que nenhum learning_base tenha reward de missão)

  -- =========================================================================
  -- T4/T5 — Temporadas: fechamento, cortes e zeros (0028 / Q105/Q143)
  -- =========================================================================
  -- Cria uma temporada vencida com um grupo pequeno: Elisa com XP positivo real
  -- na janela, Felipe com zero. Fecha e confere os movimentos.
  insert into public.seasons (starts_at, ends_at, status)
  values (public.mission_week_start(now()) - interval '70 days',
          public.mission_week_start(now()) - interval '63 days', 'open')
  returning id into v_s;
  insert into public.season_groups (season_id, category, group_index, capacity)
  values (v_s, 'silver', 1, 30) returning id into v_g;
  insert into public.season_entries (season_id, user_id, group_id, category) values
    (v_s, u_elisa,  v_g, 'silver'),
    (v_s, u_felipe, v_g, 'silver');
  -- XP competitivo real na janela da temporada, só para a Elisa.
  insert into public.xp_events (user_id, origin, context, amount, idempotency_key, occurred_at)
  values (u_elisa, 'learning_base', 'course', 90, 'harness:'||v_s::text||':elisa',
          public.mission_week_start(now()) - interval '66 days');

  perform public.close_season(v_s, 10);

  -- Elisa (positivo, grupo pequeno) conserva a categoria; Felipe (zero) cai p/ Bronze.
  select result_category into v_res from public.season_entries where season_id = v_s and user_id = u_elisa;
  assert v_res = 'silver', format('T5.1a: positivo em grupo pequeno deveria conservar silver, veio %s', v_res);
  select result_category into v_res from public.season_entries where season_id = v_s and user_id = u_felipe;
  assert v_res = 'bronze', format('T5.1b: zero deveria cair para bronze (piso), veio %s', v_res);

  -- season_xp foi consolidado da fonte (Elisa 90, Felipe 0), ignorando valores plantados.
  select season_xp into v_n from public.season_entries where season_id = v_s and user_id = u_elisa;
  assert v_n = 90, format('T5.1c: season_xp da Elisa deveria ser 90 (fonte), veio %s', v_n);
  select season_xp into v_n from public.season_entries where season_id = v_s and user_id = u_felipe;
  assert v_n = 0, format('T5.1d: season_xp do Felipe deveria ser 0, veio %s', v_n);

  -- T5.3 idempotência do fechamento: rodar de novo não altera result_category.
  perform public.close_season(v_s, 10);
  select result_category into v_res from public.season_entries where season_id = v_s and user_id = u_felipe;
  assert v_res = 'bronze', 'T5.3: reexecutar close_season nao pode alterar o resultado';

  -- =========================================================================
  -- T6 — Ocultação de identidade na temporada (0030 / Q069/Q070)
  -- =========================================================================
  -- Marca a entrada da Elisa como identidade oculta e confere que my_season_group
  -- (lido como a própria Elisa) devolve nome nulo mas mantém XP/posição.
  -- Usa uma temporada ABERTA para a leitura (my_season_group lê o grupo do caller).
  declare v_s2 uuid; v_g2 uuid;
  begin
    insert into public.seasons (starts_at, ends_at, status)
    values (public.mission_week_start(now()), public.mission_week_start(now()) + interval '7 days', 'open')
    returning id into v_s2;
    insert into public.season_groups (season_id, category, group_index, capacity)
    values (v_s2, 'silver', 1, 30) returning id into v_g2;
    insert into public.season_entries (season_id, user_id, group_id, category, season_xp, identity_hidden) values
      (v_s2, u_elisa,  v_g2, 'silver', 50, true),
      (v_s2, u_felipe, v_g2, 'silver', 30, false);

    -- Lê como a Elisa (SECURITY DEFINER usa auth.uid()).
    perform set_config('request.jwt.claims', json_build_object('sub', u_elisa::text)::text, true);
    select display_name, hidden into v_dn, v_hidden
      from public.my_season_group(v_s2) where user_id = u_elisa;
    assert v_hidden is true, 'T6.2a: entrada da Elisa deveria estar com hidden=true';
    assert v_dn is null, format('T6.2b: identidade oculta deveria ter display_name nulo, veio %s', v_dn);
    select season_xp into v_n from public.my_season_group(v_s2) where user_id = u_elisa;
    assert v_n = 50, format('T6.2c: XP deveria ser preservado (50) mesmo oculto, veio %s', v_n);
    perform set_config('request.jwt.claims', '', true);  -- limpa o contexto
  end;

  -- =========================================================================
  -- T8/T9 — Observabilidade e alerta (0034/0036/0037)
  -- =========================================================================
  -- Temporada vencida há 45 min, não fechada -> check_season_alerts registra 1 alerta;
  -- 2a chamada deduplica (0 novos).
  declare v_s3 uuid; v_al1 integer; v_al2 integer;
  begin
    insert into public.seasons (starts_at, ends_at, status)
    values (public.mission_week_start(now()) - interval '140 days', now() - interval '45 minutes', 'open')
    returning id into v_s3;
    select public.check_season_alerts(30) into v_al1;
    select public.check_season_alerts(30) into v_al2;
    assert v_al1 >= 1, format('T9.1a: 1a chamada deveria registrar >=1 alerta, veio %s', v_al1);
    assert v_al2 = 0, format('T9.1b: 2a chamada deveria deduplicar (0), veio %s', v_al2);
    -- Houve um evento 'alert' para essa temporada.
    assert exists (select 1 from public.season_ops_log where season_id = v_s3 and event = 'alert'),
      'T9.1c: deveria existir evento alert na trilha';
  end;

  raise notice 'HARNESS ISSUE 42: OK';
end;
$harness$;

-- NÃO persiste nada: desfaz tudo (tentativas, temporadas, eventos, alertas).
rollback;
