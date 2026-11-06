-- seed_teste.sql — Cenário de validação da issue 42 (missões, ligas/temporadas, PAC).
--
-- NÃO é uma migration e NÃO é dado de produção. Popula um AMBIENTE DE ENSAIO
-- (local ou Athen-Teste) com um cenário determinístico que exercita as regras
-- implementadas na issue 42. Idempotente (reexecutável). Depende de o seed base
-- (supabase/seed.sql) ter rodado, pois reutiliza as contas/cursos dele.
--
-- Rodar (local):   docker exec -i supabase_db_<proj> psql -U postgres -d postgres -f este_arquivo
--        (remoto): cole no SQL Editor do projeto de ensaio, OU use o runner.
--
-- Contas do seed base (senha "test123!"):
--   ...0002 Ana (educator)  ...0003 Bruno (educator)
--   ...0004 Carla (student) ...0005 Diego (student)
--   ...0006 Elisa (student) ...0007 Felipe (student)
-- Curso A (Lógica, público): aula a101 tem questão multiple_choice base 4;
--   aula a201 tem fill_blank base 6.

-- ===========================================================================
-- 0. Limpeza do cenário de ensaio anterior (não toca em dados fora do ensaio).
--    Remove tentativas/eventos/temporadas criados por execuções anteriores
--    deste seed, para reexecução limpa.
-- ===========================================================================
do $$
begin
  delete from public.season_ops_log where event in ('alert','alert_delivered','alert_delivery_error','tick_start','tick_done','close_ok','close_error','open_error');
  delete from public.season_entries;
  delete from public.season_groups;
  delete from public.seasons;
  delete from public.xp_events;        -- recriados pelas finalizações abaixo
  delete from public.mission_assignments;
  delete from public.mission_occurrences;
  -- tentativas/respostas/conclusões do cenário (dos alunos de teste nas aulas A)
  delete from public.answers a using public.attempts t
   where a.attempt_id = t.id
     and t.user_id in (
       '00000000-0000-4000-a000-000000000004','00000000-0000-4000-a000-000000000005',
       '00000000-0000-4000-a000-000000000006','00000000-0000-4000-a000-000000000007');
  delete from public.completions where user_id in (
       '00000000-0000-4000-a000-000000000004','00000000-0000-4000-a000-000000000005',
       '00000000-0000-4000-a000-000000000006','00000000-0000-4000-a000-000000000007');
  delete from public.attempts where user_id in (
       '00000000-0000-4000-a000-000000000004','00000000-0000-4000-a000-000000000005',
       '00000000-0000-4000-a000-000000000006','00000000-0000-4000-a000-000000000007');
end $$;

-- ===========================================================================
-- 1. XP PROPORCIONAL AO ACERTO (Q112/Q093) — cenário "erra e acerta depois".
--    Carla erra a101 na execução 1 e acerta na execução 2 -> round(4/2)=2 XP.
--    Executado via finalize_attempt para gerar xp_events/level reais.
-- ===========================================================================
do $$
declare
  v_user   uuid := '00000000-0000-4000-a000-000000000004';
  v_lesson uuid := '00000000-0000-4000-e000-00000000a101';
  v_course uuid := '00000000-0000-4000-c000-00000000000a';
  v_q      uuid := '00000000-0000-4000-f000-00000000a101';
  v_a uuid;
begin
  -- Execução 1: resposta errada.
  insert into public.attempts (user_id, lesson_id, course_id) values (v_user, v_lesson, v_course) returning id into v_a;
  insert into public.answers (attempt_id, question_id, submitted) values (v_a, v_q, '{"selected":["b"]}'::jsonb);
  perform public.finalize_attempt(v_a);
  -- Execução 2: resposta certa (primeiro acerto, N=2 -> 2 XP).
  insert into public.attempts (user_id, lesson_id, course_id) values (v_user, v_lesson, v_course) returning id into v_a;
  insert into public.answers (attempt_id, question_id, submitted) values (v_a, v_q, '{"selected":["a"]}'::jsonb);
  perform public.finalize_attempt(v_a);
end $$;

-- Diego acerta a201 (fill_blank base 6) DE PRIMEIRA -> 6 XP cheio; gera atividade recente.
do $$
declare
  v_user uuid := '00000000-0000-4000-a000-000000000005';
  v_a uuid;
begin
  insert into public.attempts (user_id, lesson_id, course_id)
  values (v_user, '00000000-0000-4000-e000-00000000a201', '00000000-0000-4000-c000-00000000000a') returning id into v_a;
  insert into public.answers (attempt_id, question_id, submitted)
  values (v_a, '00000000-0000-4000-f000-00000000a201', '{"text":"if"}'::jsonb);
  perform public.finalize_attempt(v_a);
end $$;

-- ===========================================================================
-- 2. TEMPORADAS — três cenários distintos para cobrir abertura, cortes e zeros.
-- ===========================================================================

-- 2a. Temporada CORRENTE aberta, grupo de Prata com XP variado (inclui um zero)
--     — para validar as leituras da UI (current_season / my_season_group / summary).
do $$
declare v_s uuid; v_g uuid;
begin
  insert into public.seasons (starts_at, ends_at, status)
  values (public.mission_week_start(now()), public.mission_week_start(now()) + interval '7 days', 'open')
  returning id into v_s;
  insert into public.season_groups (season_id, category, group_index, capacity)
  values (v_s, 'silver', 1, 30) returning id into v_g;
  insert into public.season_entries (season_id, user_id, group_id, category, season_xp) values
    (v_s, '00000000-0000-4000-a000-000000000002', v_g, 'silver', 410),
    (v_s, '00000000-0000-4000-a000-000000000003', v_g, 'silver', 305),
    (v_s, '00000000-0000-4000-a000-000000000004', v_g, 'silver', 240),
    (v_s, '00000000-0000-4000-a000-000000000005', v_g, 'silver', 180),
    (v_s, '00000000-0000-4000-a000-000000000006', v_g, 'silver',  60),
    (v_s, '00000000-0000-4000-a000-000000000007', v_g, 'silver',   0);
end $$;

-- 2b. Temporada VENCIDA com XP real na janela (xp_events), pronta para o
--     close_season/tick_seasons consolidar e aplicar cortes (grupo pequeno:
--     positivos conservam a categoria; o zero cai para Bronze — Q143).
do $$
declare
  v_s uuid; v_g uuid;
  v_start timestamptz := public.mission_week_start(now()) - interval '14 days';
  v_mid   timestamptz := public.mission_week_start(now()) - interval '12 days';
begin
  insert into public.seasons (starts_at, ends_at, status)
  values (v_start, v_start + interval '7 days', 'open') returning id into v_s;
  insert into public.season_groups (season_id, category, group_index, capacity)
  values (v_s, 'silver', 1, 30) returning id into v_g;
  insert into public.season_entries (season_id, user_id, group_id, category) values
    (v_s, '00000000-0000-4000-a000-000000000002', v_g, 'silver'),
    (v_s, '00000000-0000-4000-a000-000000000003', v_g, 'silver');
  -- XP competitivo real na janela para a Ana (positivo); Bruno fica zero.
  insert into public.xp_events (user_id, origin, context, amount, idempotency_key, occurred_at)
  values ('00000000-0000-4000-a000-000000000002','learning_base','course',120,'seedteste:'||v_s::text||':ana', v_mid)
  on conflict (idempotency_key) do nothing;
end $$;

-- 2c. Temporada VENCIDA ha 45 min e NAO fechada — condição de ALERTA de atraso.
--     (Deixada propositalmente sem fechar para o teste do alerta; se o cron ou
--     o tester rodar tick_seasons, ela fecha e sai da fila — isso tambem e um
--     caminho valido de teste.)
insert into public.seasons (starts_at, ends_at, status)
values (public.mission_week_start(now()) - interval '28 days', now() - interval '45 minutes', 'open');

-- ===========================================================================
-- 3. ATIVIDADE RECENTE para a abertura automática inscrever (Q138).
--    Marca conclusões na janela [início da semana anterior, virada) para três
--    alunos, de modo que open_season(now()) os inscreva na temporada corrente.
-- ===========================================================================
do $$
declare v_quando timestamptz := public.mission_week_start(now()) - interval '2 days';
begin
  insert into public.completions (user_id, lesson_id, context, completed_at) values
    ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-e000-00000000a102', 'course', v_quando),
    ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-e000-00000000a103', 'course', v_quando),
    ('00000000-0000-4000-a000-000000000006', '00000000-0000-4000-e000-00000000b101', 'course', v_quando)
  on conflict (user_id, lesson_id, context) do update set completed_at = excluded.completed_at;
end $$;

select 'seed_teste da issue 42 aplicado' as status,
       (select count(*) from public.seasons) as temporadas,
       (select count(*) from public.season_entries) as inscritos,
       (select count(*) from public.xp_events) as eventos_xp;
