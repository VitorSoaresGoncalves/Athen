-- Regressões de missões sobre o modelo xp_events/season_* (0041+).
-- Somente banco de ENSAIO: fixtures próprias, sem limpar dados existentes.
-- Usa finalize_attempt/complete_empty_lesson com role authenticated e RLS.
-- Integra npm run test:issue42. Sucesso ou desconexão por erro reverte tudo.
begin;

do $missions$
declare
  v_user uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_course uuid := gen_random_uuid();
  v_module uuid := gen_random_uuid();
  v_lesson uuid := gen_random_uuid();
  v_empty uuid := gen_random_uuid();
  v_question uuid := gen_random_uuid();
  v_definition uuid := gen_random_uuid();
  v_two_lessons uuid := gen_random_uuid();
  v_occurrence uuid;
  v_two_occurrence uuid;
  v_tomorrow uuid;
  v_attempt uuid;
  v_assignment uuid;
  v_completed_at timestamptz;
  v_events bigint;
  v_global integer;
  v_count integer;
  v_denied boolean := false;
  v_week timestamptz := public.mission_week_start(now());
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (v_user,v_user || '@example.test',jsonb_build_object('username','missions_' || replace(v_user::text,'-',''))),
    (v_other,v_other || '@example.test',jsonb_build_object('username','missions_' || replace(v_other::text,'-','')));
  insert into public.courses(id,creator_id,title,slug,status,visibility)
  values(v_course,v_user,'Ensaio de missões','missions-' || v_course,'published','public');
  insert into public.modules(id,course_id,title,position) values(v_module,v_course,'Módulo de ensaio',0);
  insert into public.lessons(id,module_id,title,position,status) values
    (v_lesson,v_module,'Aula com questão',0,'published'),(v_empty,v_module,'Aula sem questões',1,'published');
  insert into public.questions(id,lesson_id,type,prompt,position,config,xp_value)
  values(v_question,v_lesson,'multiple_choice','Quanto é 1 + 1?',0,
    '{"options":[{"id":"a","text":"2","correct":true},{"id":"b","text":"3","correct":false}]}',10);
  insert into public.enrollments(user_id,course_id) values(v_user,v_course),(v_other,v_course);
  -- Metas próprias deixam o ensaio independente de alterações no catálogo base.
  insert into public.mission_definitions(id,scope,objective,code,title,target,reward_xp) values
    (v_definition,'global_daily','complete_lessons','test-one-' || v_definition,'Uma aula de ensaio',1,7),
    (v_two_lessons,'global_daily','complete_lessons','test-two-' || v_two_lessons,'Duas aulas de ensaio',2,11);

  -- M1: mesma ocorrência no mesmo dia, outra no próximo período.
  v_occurrence := public.ensure_occurrence(v_definition,null,now());
  assert v_occurrence is not null,'M1: ocorrência não materializada';
  assert public.ensure_occurrence(v_definition,null,now())=v_occurrence,'M1: ocorrência duplicada no mesmo período';
  v_tomorrow := public.ensure_occurrence(v_definition,null,public.mission_day_start(now())+interval '1 day');
  assert v_tomorrow<>v_occurrence,'M1: dias distintos devem ter ocorrências distintas';
  v_two_occurrence := public.ensure_occurrence(v_two_lessons,null,now());

  -- M2: fluxo do estudante, gravando respostas ANTES da finalização.
  perform set_config('request.jwt.claims',json_build_object('sub',v_user)::text,true);
  perform set_config('role','authenticated',true);
  insert into public.attempts(user_id,lesson_id,course_id)
  values(v_user,v_lesson,v_course) returning id into v_attempt;
  insert into public.answers(attempt_id,question_id,submitted)
  values(v_attempt,v_question,'{"selected":["a"]}');
  perform public.finalize_attempt(v_attempt);
  assert exists(select 1 from public.my_missions()
    where occurrence_id=v_occurrence and completed and current_count=1 and progress=100),
    'M2: finalização não avançou a missão exibida na lista';
  assert exists(select 1 from public.my_mission_detail(v_two_occurrence)
    where not completed and current_count=1 and progress=50),'M2: detalhe deve mostrar progresso parcial';

  -- M3: bônus no ledger/global, sem compor o XP competitivo da semana.
  select id,completed_at into strict v_assignment,v_completed_at from public.mission_assignments
    where occurrence_id=v_occurrence and user_id=v_user and granted;
  assert (select count(*) from public.xp_events where user_id=v_user and origin='mission_bonus'
    and idempotency_key='xpbonus:assignment:' || v_assignment)=1,'M3: deve existir um único crédito do bônus';
  assert (select amount from public.xp_events where idempotency_key='xpbonus:assignment:' || v_assignment)=7,
    'M3: valor do bônus deve respeitar a ocorrência';
  assert public.user_season_xp(v_user,v_week,v_week+interval '7 days')=10,'M3: bônus alterou XP competitivo';
  assert (select xp_global from public.profiles where id=v_user)=
    (select sum(amount) from public.xp_events where user_id=v_user and context='course'),
    'M3: saldo global deve refletir aprendizagem e bônus do ledger';

  -- M4: repetir a RPC pública não duplica crédito, saldo nem data da conquista.
  select count(*) into v_events from public.xp_events where user_id=v_user;
  select xp_global into v_global from public.profiles where id=v_user;
  perform public.finalize_attempt(v_attempt);
  assert (select count(*) from public.xp_events where user_id=v_user)=v_events,'M4: repetição duplicou crédito';
  assert (select xp_global from public.profiles where id=v_user)=v_global,'M4: repetição duplicou saldo';
  assert (select completed_at from public.mission_assignments where id=v_assignment)=v_completed_at,
    'M4: repetição alterou a data da conquista';

  -- M5: regressão da 0040, conclusão sem questões conta como aula, sem XP base.
  perform public.complete_empty_lesson(v_empty);
  assert exists(select 1 from public.my_mission_detail(v_two_occurrence)
    where completed and current_count=2 and progress=100),'M5: aula sem questões não contou para missão';
  assert public.user_season_xp(v_user,v_week,v_week+interval '7 days')=10,'M5: aula vazia/bônus gerou XP competitivo';
  select count(*) into v_events from public.xp_events where user_id=v_user;
  select xp_global into v_global from public.profiles where id=v_user;
  perform public.complete_empty_lesson(v_empty);
  assert (select count(*) from public.xp_events where user_id=v_user)=v_events,'M5: repetir conclusão vazia duplicou crédito';
  assert (select xp_global from public.profiles where id=v_user)=v_global,'M5: repetir conclusão vazia duplicou saldo';

  -- M6: outro estudante não lê atribuições/progresso nem finaliza tentativa alheia.
  perform set_config('request.jwt.claims',json_build_object('sub',v_other)::text,true);
  select count(*) into v_count from public.mission_assignments where user_id=v_user;
  assert v_count=0,'M6: RLS expôs atribuição de outro estudante';
  assert exists(select 1 from public.my_mission_detail(v_occurrence)
    where not completed and current_count=0 and progress=0),'M6: detalhe expôs progresso alheio';
  begin
    perform public.finalize_attempt(v_attempt);
  exception when insufficient_privilege then v_denied := true;
  end;
  assert v_denied,'M6: permitiu finalizar tentativa de outro estudante';
  assert not has_function_privilege('authenticated','public.upsert_mission_assignment(uuid,uuid)','EXECUTE'),
    'M6: concessão interna de bônus deve permanecer inacessível ao estudante';
  perform set_config('role','none',true);
  assert public.count_mission_progress(v_tomorrow,v_user)=0,'M1: atividade vazou para outro período';
  assert not exists(select 1 from public.mission_assignments where occurrence_id=v_tomorrow and user_id=v_user),
    'M1: atividade materializou progresso no período futuro';
  raise notice 'MISSIONS: OK (períodos, fluxo autenticado, bônus único, XP competitivo, aula vazia e RLS)';
end;
$missions$;

rollback;
