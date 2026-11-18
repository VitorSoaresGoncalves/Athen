-- Ensaios SQL da issue 47 (contrato revisão 2), sobre seed local.
-- O runner executa todo o arquivo em uma transação e sempre faz ROLLBACK.
-- Concorrência entre conexões é exercida separadamente pelo runner.

do $issue47$
declare
  rpc_signature text;
  rpc_signatures text[] := array[
    'public.course_review_status(uuid)',
    'public.my_current_course_review()',
    'public.my_course_review_occurrence(uuid)',
    'public.start_course_review(uuid,uuid,uuid)',
    'public.my_course_review(uuid)',
    'public.submit_course_review_answer(uuid,uuid,jsonb)',
    'public.finalize_course_review(uuid)',
    'public.tick_course_reviews()'
  ];
  table_name text;
  review_tables text[] := array[
    'course_review_schedules',
    'course_review_occurrences',
    'course_review_sessions',
    'course_review_items'
  ];
  function_oid oid;
begin
  assert current_setting('plpgsql.check_asserts', true) = 'on',
    'Runner deve habilitar plpgsql.check_asserts';

  -- Confirma a superfície pública do contrato; não executa helpers internos.
  foreach rpc_signature in array rpc_signatures loop
    assert to_regprocedure(rpc_signature) is not null,
      format('RPC contratada ausente: %s', rpc_signature);
  end loop;

  -- A ACL de PUBLIC é conferida no catálogo (grantee OID 0), além de verificar
  -- a permissão efetiva dos papéis de API.
  foreach rpc_signature in array rpc_signatures[1:7] loop
    function_oid := to_regprocedure(rpc_signature);
    assert has_function_privilege('authenticated', function_oid, 'EXECUTE'),
      format('authenticated não recebeu EXECUTE em %s', rpc_signature);
    assert not has_function_privilege('anon', function_oid, 'EXECUTE'),
      format('anon recebeu EXECUTE indevido em %s', rpc_signature);
    assert not exists (
      select 1
        from pg_proc p
        cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
       where p.oid = function_oid
         and acl.grantee = 0
         and acl.privilege_type = 'EXECUTE'
    ), format('PUBLIC recebeu EXECUTE indevido em %s', rpc_signature);
  end loop;

  function_oid := to_regprocedure('public.tick_course_reviews()');
  assert not has_function_privilege('anon', function_oid, 'EXECUTE'),
    'anon não pode executar tick_course_reviews()';
  assert not has_function_privilege('authenticated', function_oid, 'EXECUTE'),
    'authenticated não pode executar tick_course_reviews()';
  assert not exists (
    select 1
      from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
     where p.oid = function_oid
       and acl.grantee = 0
       and acl.privilege_type = 'EXECUTE'
  ), 'PUBLIC não pode executar tick_course_reviews()';

  foreach table_name in array review_tables loop
    assert to_regclass(format('public.%I', table_name)) is not null,
      format('Tabela contratada ausente: %s', table_name);
    assert (
      select relrowsecurity
        from pg_class
       where oid = to_regclass(format('public.%I', table_name))
    ), format('RLS desativada em %s', table_name);
    assert has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT'),
      format('authenticated não pode ler sua tabela de revisão %s', table_name);
    assert not has_table_privilege('anon', format('public.%I', table_name), 'SELECT'),
      format('anon pode ler diretamente %s', table_name);
    assert not has_any_column_privilege('authenticated', format('public.%I', table_name), 'INSERT'),
      format('authenticated pode inserir diretamente em %s', table_name);
    assert not has_any_column_privilege('authenticated', format('public.%I', table_name), 'UPDATE'),
      format('authenticated pode atualizar diretamente %s', table_name);
    assert not has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE'),
      format('authenticated pode apagar diretamente %s', table_name);
    assert not has_any_column_privilege('anon', format('public.%I', table_name), 'INSERT'),
      format('anon pode inserir diretamente em %s', table_name);
    assert not has_any_column_privilege('anon', format('public.%I', table_name), 'UPDATE'),
      format('anon pode atualizar diretamente %s', table_name);
    assert not has_table_privilege('anon', format('public.%I', table_name), 'DELETE'),
      format('anon pode apagar diretamente %s', table_name);
  end loop;

  -- Agenda global por usuário/período, idempotência da intenção e múltiplas
  -- sessões por ocorrência sem impor unicidade por ocorrência.
  assert exists (
    select 1
      from pg_indexes
     where schemaname = 'public'
       and tablename = 'course_review_occurrences'
       and indexdef ilike '%unique%user_id%period_index%'
  ), 'Ocorrência deve ser única por user_id/period_index';
  assert exists (
    select 1
      from pg_indexes
     where schemaname = 'public'
       and tablename = 'course_review_sessions'
       and indexdef ilike '%unique%user_id%request_id%'
  ), 'Intenção deve ser única por user_id/request_id';
  assert not exists (
    select 1
      from pg_class tbl
      join pg_namespace ns on ns.oid = tbl.relnamespace
      join pg_index i on i.indrelid = tbl.oid
     where ns.nspname = 'public'
       and tbl.relname = 'course_review_sessions'
       and i.indisunique
       and exists (
         select 1
           from unnest(i.indkey) with ordinality k(attnum, ord)
           join pg_attribute a on a.attrelid = tbl.oid and a.attnum = k.attnum
          where k.ord <= i.indnkeyatts
            and a.attname = 'occurrence_id'
       )
       and not exists (
         select 1
           from unnest(i.indkey) with ordinality k(attnum, ord)
           join pg_attribute a on a.attrelid = tbl.oid and a.attnum = k.attnum
          where k.ord <= i.indnkeyatts
            and a.attname = 'id'
       )
  ), 'Sessões múltiplas por ocorrência devem ser permitidas';

  -- Cliente pode atualizar somente campos de perfil editáveis e estado de
  -- leitura, nunca saldos ou conteúdo do aviso.
  assert has_column_privilege('authenticated', 'public.profiles', 'username', 'UPDATE'),
    'Edição legítima de username deve continuar disponível';
  assert has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE'),
    'Edição legítima de display_name deve continuar disponível';
  assert has_column_privilege('authenticated', 'public.profiles', 'bio', 'UPDATE'),
    'Edição legítima de bio deve continuar disponível';
  assert has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE'),
    'Edição legítima de avatar_url deve continuar disponível';
  assert has_column_privilege('authenticated', 'public.profiles', 'banner_url', 'UPDATE'),
    'Edição legítima de banner_url deve continuar disponível';
  assert has_column_privilege('authenticated', 'public.profiles', 'notification_preferences', 'UPDATE'),
    'Edição legítima de preferências deve continuar disponível';
  assert not has_column_privilege('authenticated', 'public.profiles', 'xp_global', 'UPDATE'),
    'Cliente não pode editar xp_global';
  assert not has_column_privilege('authenticated', 'public.profiles', 'level', 'UPDATE'),
    'Cliente não pode editar level';
  assert not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
    'Cliente não pode editar role';
  assert not has_column_privilege('authenticated', 'public.profiles', 'streak_count', 'UPDATE'),
    'Cliente não pode editar streak_count';
  assert not has_column_privilege('authenticated', 'public.profiles', 'last_study_date', 'UPDATE'),
    'Cliente não pode editar last_study_date';
  assert not has_column_privilege('authenticated', 'public.profiles', 'account_status', 'UPDATE'),
    'Cliente não pode editar account_status';
  assert has_column_privilege('authenticated', 'public.notifications', 'is_read', 'UPDATE'),
    'Marcar notificação como lida deve continuar disponível';
  assert not has_column_privilege('authenticated', 'public.notifications', 'reference_id', 'UPDATE'),
    'Cliente não pode alterar referência/autorização do aviso';
  assert not has_column_privilege('authenticated', 'public.notifications', 'type', 'UPDATE'),
    'Cliente não pode alterar tipo do aviso';

  -- O helper que insere avisos é interno; testar ACL efetiva, incluindo PUBLIC.
  function_oid := to_regprocedure(
    'public.create_notification(uuid,public.notification_type,text,text,uuid)'
  );
  assert function_oid is not null, 'create_notification(...) contratada ausente';
  assert not has_function_privilege('anon', function_oid, 'EXECUTE'),
    'anon ainda pode fabricar notificações pelo helper';
  assert not has_function_privilege('authenticated', function_oid, 'EXECUTE'),
    'authenticated ainda pode fabricar notificações pelo helper';
  assert not exists (
    select 1
      from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
     where p.oid = function_oid
       and acl.grantee = 0
       and acl.privilege_type = 'EXECUTE'
  ), 'PUBLIC ainda pode fabricar notificações pelo helper';

  raise notice 'HARNESS ISSUE 47: contrato/ACL passou';
end;
$issue47$;

-- Fixture transacional: Carla concluiu individualmente o curso público A;
-- também usa o curso D, que não contém questões. Os UPDATEs refletem
-- conclusões oficiais no modelo atual e acionam a observação da agenda.
do $issue47_fixture$
declare
  v_user uuid := '00000000-0000-4000-a000-000000000004';
begin
  -- A fixture cobre k=ceil(20%*n) nos módulos com 1, 4, 10 e 0 questões.
  -- Os quatro tipos de questão aparecem sem alterar o seed após o rollback.
  insert into public.modules(id,course_id,title,description,icon,color,position)
  values ('00000000-0000-4000-d000-00000000a004',
          '00000000-0000-4000-c000-00000000000a',
          'Harness módulo de uma questão','fixture','book','#123456',3),
         ('00000000-0000-4000-d000-00000000a005',
          '00000000-0000-4000-c000-00000000000a',
          'Harness módulo fill blank','fixture','book','#123456',4),
         ('00000000-0000-4000-d000-00000000a006',
          '00000000-0000-4000-c000-00000000000a',
          'Harness módulo sum','fixture','book','#123456',5),
         ('00000000-0000-4000-d000-00000000a007',
          '00000000-0000-4000-c000-00000000000a',
          'Harness módulo match','fixture','book','#123456',6);
  insert into public.lessons(id,module_id,title,content,position,status)
  values ('00000000-0000-4000-e000-00000000a401',
          '00000000-0000-4000-d000-00000000a004',
          'Harness aula MC','fixture',0,'published'),
         ('00000000-0000-4000-e000-00000000a501',
          '00000000-0000-4000-d000-00000000a005',
          'Harness aula fill blank','fixture',0,'published'),
         ('00000000-0000-4000-e000-00000000a601',
          '00000000-0000-4000-d000-00000000a006',
          'Harness aula sum','fixture',0,'published'),
         ('00000000-0000-4000-e000-00000000a701',
          '00000000-0000-4000-d000-00000000a007',
          'Harness aula match','fixture',0,'published');
  insert into public.questions(lesson_id,type,prompt,position,config,explanation)
  values
    ('00000000-0000-4000-e000-00000000a401','multiple_choice','Harness MC module 1',0,
      '{"options":[{"id":"a","text":"certa","correct":true},{"id":"b","text":"errada","correct":false}]}'::jsonb,null),
    ('00000000-0000-4000-e000-00000000a501','fill_blank','Harness fill singleton',0,
      '{"answers":["if","se"]}'::jsonb,null),
    ('00000000-0000-4000-e000-00000000a601','sum_alternatives','Harness sum singleton',0,
      '{"statements":[{"value":1,"correct":true},{"value":2,"correct":false},{"value":4,"correct":true}],"expected":5}'::jsonb,null),
    ('00000000-0000-4000-e000-00000000a701','match','Harness match singleton',0,
      '{"pairs":[{"left":"a","right":"A"},{"left":"b","right":"B"}]}'::jsonb,null),
    ('00000000-0000-4000-e000-00000000a101','multiple_choice','Harness MC 2',1,
      '{"options":[{"id":"a","text":"certa","correct":true},{"id":"b","text":"errada","correct":false}]}'::jsonb,null),
    ('00000000-0000-4000-e000-00000000a101','sum_alternatives','Harness soma',2,
      '{"statements":[{"value":1,"correct":true},{"value":2,"correct":false},{"value":4,"correct":true}],"expected":5}'::jsonb,null),
    ('00000000-0000-4000-e000-00000000a101','match','Harness associação',3,
      '{"pairs":[{"left":"a","right":"A"},{"left":"b","right":"B"}]}'::jsonb,null),
    ('00000000-0000-4000-e000-00000000a201','multiple_choice','Harness MC 3',1,
      '{"options":[{"id":"a","text":"certa","correct":true},{"id":"b","text":"errada","correct":false}]}'::jsonb,null),
    ('00000000-0000-4000-e000-00000000a201','sum_alternatives','Harness soma 2',2,
      '{"statements":[{"value":1,"correct":true},{"value":2,"correct":false},{"value":4,"correct":true}],"expected":5}'::jsonb,null),
    ('00000000-0000-4000-e000-00000000a201','match','Harness associação 2',3,
      '{"pairs":[{"left":"a","right":"A"},{"left":"b","right":"B"}]}'::jsonb,null),
    ('00000000-0000-4000-e000-00000000a201','fill_blank','Harness lacuna 2',4,
      '{"answers":["if","se"]}'::jsonb,null),
    ('00000000-0000-4000-e000-00000000a201','multiple_choice','Harness MC 4',5,
      '{"options":[{"id":"a","text":"certa","correct":true},{"id":"b","text":"errada","correct":false}]}'::jsonb,null),
    ('00000000-0000-4000-e000-00000000a201','multiple_choice','Harness MC 5',6,
      '{"options":[{"id":"a","text":"certa","correct":true},{"id":"b","text":"errada","correct":false}]}'::jsonb,null),
    ('00000000-0000-4000-e000-00000000a201','multiple_choice','Harness MC 6',7,
      '{"options":[{"id":"a","text":"certa","correct":true},{"id":"b","text":"errada","correct":false}]}'::jsonb,null),
    ('00000000-0000-4000-e000-00000000a201','multiple_choice','Harness MC 7',8,
      '{"options":[{"id":"a","text":"certa","correct":true},{"id":"b","text":"errada","correct":false}]}'::jsonb,null),
    ('00000000-0000-4000-e000-00000000a201','multiple_choice','Harness MC 8',9,
      '{"options":[{"id":"a","text":"certa","correct":true},{"id":"b","text":"errada","correct":false}]}'::jsonb,null);

  insert into public.completions(user_id, lesson_id, context, attempt_id)
  select v_user, l.id, 'course', null
    from public.lessons l join public.modules m on m.id = l.module_id
   where m.course_id = '00000000-0000-4000-c000-00000000000a'
  on conflict (user_id, lesson_id, context) do update
    set completed_at = excluded.completed_at;

  insert into public.completions(user_id, lesson_id, context, attempt_id)
  select v_user, l.id, 'course', null
    from public.lessons l join public.modules m on m.id = l.module_id
   where m.course_id = '00000000-0000-4000-c000-00000000000d'
  on conflict (user_id, lesson_id, context) do update
    set completed_at = excluded.completed_at;

  update public.course_review_schedules
     set anchor_at = clock_timestamp() - interval '8 days',
         anchor_source = 'rollout', first_course_completed_at = null
   where user_id = v_user;

  -- Cada harness cria uma ocorrência própria, sem depender de IDs sorteados.
  insert into public.course_review_occurrences(
    user_id, period_index, due_at, expires_at, selection_state,
    course_id, course_title, assigned_at, bonus_xp, delivery_state
  )
  select v_user,
         coalesce(max(period_index), 0) + 100,
         clock_timestamp() - interval '1 minute',
         clock_timestamp() + interval '1 day',
         'assigned',
         '00000000-0000-4000-c000-00000000000a',
         'Lógica de Programação',
         clock_timestamp(),
         10,
         'suppressed'
    from public.course_review_occurrences
   where user_id = v_user;
end;
$issue47_fixture$;

-- Testa as RPCs como authenticated, não como owner. A prática normal permanece
-- sem bônus; a ocorrência opt-out é utilizável e o resultado aprovado concede
-- exatamente 10 XP. Erros esperados são capturados em subtransações PL/pgSQL.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}',
  true
);

do $issue47_behavior$
declare
  v_course uuid := '00000000-0000-4000-c000-00000000000a';
  v_empty_course uuid := '00000000-0000-4000-c000-00000000000d';
  v_draft uuid := '00000000-0000-4000-c000-00000000000e';
  v_occ uuid;
  v_status record;
  v_session record;
  v_item record;
  v_result record;
  v_normal record;
  v_normal_replay record;
  v_normal_request uuid := gen_random_uuid();
  v_before integer;
  v_after integer;
  v_error text;
begin
  select * into strict v_status from public.course_review_status(v_course);
  assert v_status.can_review and v_status.question_count = 18 and v_status.sample_count = 7,
    format('Curso completo deve permitir revisão com 18/7 questões, veio %s/%s/%s',
      v_status.can_review, v_status.question_count, v_status.sample_count);
  assert (select count(*) from jsonb_array_elements(v_status.module_counts) m
           where (m->>'question_count')::integer=1 and (m->>'sample_count')::integer=1) = 4
     and (select count(*) from jsonb_array_elements(v_status.module_counts) m
           where (m->>'question_count')::integer=4 and (m->>'sample_count')::integer=1) = 1
     and (select count(*) from jsonb_array_elements(v_status.module_counts) m
           where (m->>'question_count')::integer=10 and (m->>'sample_count')::integer=2) = 1
     and (select count(*) from jsonb_array_elements(v_status.module_counts) m
           where (m->>'question_count')::integer=0 and (m->>'sample_count')::integer=0) = 1,
    format('Quotas por módulo divergentes: %s', v_status.module_counts);

  select * into strict v_status from public.course_review_status(v_empty_course);
  assert not v_status.can_review and v_status.reason = 'REVIEW_EMPTY'
    and v_status.question_count = 0 and v_status.sample_count = 0,
    'Curso completo sem questões deve ser estado vazio, sem revisão disponível';

  begin
    perform * from public.course_review_status(v_draft);
    raise exception 'esperava REVIEW_FORBIDDEN para curso rascunho alheio';
  exception when sqlstate '42501' then
    get stacked diagnostics v_error = message_text;
    assert v_error = 'REVIEW_FORBIDDEN', format('Erro de acesso inesperado: %s', v_error);
  end;

  select o.id into strict v_occ from public.course_review_occurrences o
   where o.user_id = auth.uid() and o.course_id = v_course
   order by o.period_index desc limit 1;

  select * into strict v_normal
    from public.start_course_review(v_course, v_normal_request, null);
  assert v_normal.mode = 'normal' and v_normal.bonus_xp = 0
    and v_normal.occurrence_id is null and jsonb_array_length(v_normal.items)=7,
    'Prática normal deve ser independente da ocorrência e conceder zero XP';
  select * into strict v_normal_replay
    from public.start_course_review(v_course, v_normal_request, null);
  assert v_normal_replay.session_id = v_normal.session_id
    and v_normal_replay.items = v_normal.items,
    'Retry da mesma intenção deve retornar a sessão/amostra persistida';

  for v_item in
    select i.question_id, i.type from public.course_review_items i
     where i.session_id = v_normal.session_id
  loop
    if v_item.type = 'multiple_choice' then
      perform * from public.submit_course_review_answer(
        v_normal.session_id, v_item.question_id, '{"selected":["a"]}'::jsonb
      );
    elsif v_item.type = 'fill_blank' then
      perform * from public.submit_course_review_answer(
        v_normal.session_id, v_item.question_id, '{"text":"if"}'::jsonb
      );
    elsif v_item.type = 'sum_alternatives' then
      perform * from public.submit_course_review_answer(
        v_normal.session_id, v_item.question_id, '{"sum":5}'::jsonb
      );
    elsif v_item.type = 'match' then
      perform * from public.submit_course_review_answer(
        v_normal.session_id, v_item.question_id,
        '{"pairs":[{"left":"a","right":"A"},{"left":"b","right":"B"}]}'::jsonb
      );
    end if;
  end loop;
  select * into strict v_result from public.finalize_course_review(v_normal.session_id);
  assert v_result.approved and v_result.bonus_earned=0
    and v_result.bonus_outcome='not_applicable' and v_result.xp_event_id is null,
    'Finalizar prática normal não deve creditar XP nem ledger de bônus';

  select xp_global into strict v_before from public.profiles where id = auth.uid();
  select * into strict v_session
    from public.start_course_review(v_course, gen_random_uuid(), v_occ);
  assert v_session.mode = 'bonus' and v_session.bonus_xp = 10
    and jsonb_array_length(v_session.items) = 7,
    'Início de bônus deve persistir o modo, prêmio e amostra por módulo';

  perform set_config(
    'request.jwt.claims',
    '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}',
    true
  );
  begin
    perform * from public.my_course_review(v_session.session_id);
    raise exception 'esperava REVIEW_FORBIDDEN para sessão de outra pessoa';
  exception when sqlstate '42501' then
    get stacked diagnostics v_error = message_text;
    assert v_error = 'REVIEW_FORBIDDEN', format('Erro de posse inesperado: %s', v_error);
  end;
  perform set_config(
    'request.jwt.claims',
    '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}',
    true
  );

  begin
    perform * from public.finalize_course_review(v_session.session_id);
    raise exception 'esperava REVIEW_INCOMPLETE';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    assert v_error = 'REVIEW_INCOMPLETE', format('Erro de amostra vazia inesperado: %s', v_error);
  end;

  for v_item in
    select i.question_id, i.type
      from public.course_review_items i
     where i.session_id = v_session.session_id
  loop
    if v_item.type = 'multiple_choice' then
      begin
        perform * from public.submit_course_review_answer(
          v_session.session_id, v_item.question_id, '{"selected":[]}'::jsonb
        );
        raise exception 'esperava REVIEW_INVALID_INPUT para seleção vazia';
      exception when sqlstate '22023' then
        get stacked diagnostics v_error = message_text;
        assert v_error = 'REVIEW_INVALID_INPUT', format('Erro de entrada inesperado: %s', v_error);
      end;
      perform * from public.submit_course_review_answer(
        v_session.session_id, v_item.question_id, '{"selected":["a"]}'::jsonb
      );
    elsif v_item.type = 'fill_blank' then
      begin
        perform * from public.submit_course_review_answer(
          v_session.session_id, v_item.question_id, '{"text":""}'::jsonb
        );
        raise exception 'esperava REVIEW_INVALID_INPUT para resposta vazia';
      exception when sqlstate '22023' then
        get stacked diagnostics v_error = message_text;
        assert v_error = 'REVIEW_INVALID_INPUT', format('Erro de entrada inesperado: %s', v_error);
      end;
      perform * from public.submit_course_review_answer(
        v_session.session_id, v_item.question_id, '{"text":"if"}'::jsonb
      );
    elsif v_item.type = 'sum_alternatives' then
      begin
        perform * from public.submit_course_review_answer(
          v_session.session_id, v_item.question_id, '{"sum":null}'::jsonb
        );
        raise exception 'esperava REVIEW_INVALID_INPUT para soma não numérica';
      exception when sqlstate '22023' then
        get stacked diagnostics v_error = message_text;
        assert v_error = 'REVIEW_INVALID_INPUT', format('Erro de soma inesperado: %s', v_error);
      end;
      perform * from public.submit_course_review_answer(
        v_session.session_id, v_item.question_id, '{"sum":5}'::jsonb
      );
    elsif v_item.type = 'match' then
      begin
        perform * from public.submit_course_review_answer(
          v_session.session_id, v_item.question_id, '{"pairs":[]}'::jsonb
        );
        raise exception 'esperava REVIEW_INVALID_INPUT para associação vazia';
      exception when sqlstate '22023' then
        get stacked diagnostics v_error = message_text;
        assert v_error = 'REVIEW_INVALID_INPUT', format('Erro de associação inesperado: %s', v_error);
      end;
      perform * from public.submit_course_review_answer(
        v_session.session_id, v_item.question_id,
        '{"pairs":[{"left":"a","right":"A"},{"left":"b","right":"B"}]}'::jsonb
      );
    else
      raise exception 'Tipo inesperado na fixture do curso A: %', v_item.type;
    end if;
  end loop;

  select * into strict v_result from public.finalize_course_review(v_session.session_id);
  assert v_result.approved and v_result.bonus_earned = 10
    and v_result.bonus_outcome = 'awarded' and v_result.xp_event_id is not null,
    'Resultado aprovado deve conceder bônus global único de 10 XP';
  select xp_global into strict v_after from public.profiles where id = auth.uid();
  assert v_after = v_before + 10,
    format('Saldo deve aumentar exatamente 10, antes=%s depois=%s', v_before, v_after);

  select * into strict v_result from public.finalize_course_review(v_session.session_id);
  select xp_global into strict v_after from public.profiles where id = auth.uid();
  assert v_result.bonus_earned = 10 and v_after = v_before + 10,
    'Replay da finalização deve retornar o mesmo prêmio sem duplicar saldo';
end;
$issue47_behavior$;
reset role;
select set_config('request.jwt.claims', '', true);

-- Regression: operational anchor changes can leave overlapping historical
-- windows. The current reader must select the schedule's period, not all windows.
do $issue47_current_fixture$
declare
  u uuid := gen_random_uuid(); other_user uuid := gen_random_uuid();
  c uuid := '00000000-0000-4000-c000-00000000000a';
  first_id uuid; second_id uuid; own_notice uuid; other_notice uuid;
begin
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
    confirmation_token,recovery_token,email_change_token_new,email_change)
  select '00000000-0000-0000-0000-000000000000',id,'authenticated','authenticated',
    'issue47-current-'||id::text||'@example.invalid','',clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username','current_'||replace(id::text,'-',''),'role','student'),
    clock_timestamp(),clock_timestamp(),'','','','' from unnest(array[u,other_user]) id;
  insert into public.enrollments(user_id,course_id,status,progress) values(u,c,'active',100);
  insert into public.completions(user_id,lesson_id,context)
    select u,l.id,'course' from public.lessons l join public.modules m on m.id=l.module_id where m.course_id=c;
  insert into public.course_review_schedules(user_id,anchor_at,anchor_source)
    values(other_user,clock_timestamp()-interval '8 days','rollout');
  update public.course_review_schedules set anchor_at=clock_timestamp()-interval '8 days',
    anchor_source='rollout',first_course_completed_at=null where user_id=u;
  insert into public.course_review_occurrences(user_id,period_index,due_at,expires_at,
    selection_state,course_id,course_title,assigned_at,bonus_xp,delivery_state)
    values(u,1,clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day',
      'assigned',c,'Current fixture',clock_timestamp(),10,'delivered') returning id into first_id;
  insert into public.course_review_occurrences(user_id,period_index,due_at,expires_at,
    selection_state,course_id,course_title,assigned_at,bonus_xp,delivery_state)
    values(u,2,clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day',
      'assigned',c,'Overlapping historical fixture',clock_timestamp(),10,'suppressed') returning id into second_id;
  insert into public.course_review_occurrences(user_id,period_index,due_at,expires_at)
    values(other_user,1,clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day');
  insert into public.notifications(recipient_id,type,title,reference_id)
    values(u,'revisao_curso','Current fixture notice',first_id) returning id into own_notice;
  update public.course_review_occurrences set notification_id=own_notice,notified_at=clock_timestamp() where id=first_id;
  insert into public.notifications(recipient_id,type,title)
    values(other_user,'revisao_curso','Other recipient notice') returning id into other_notice;
  perform set_config('issue47.current_user',u::text,true);
  perform set_config('issue47.current_other_user',other_user::text,true);
  perform set_config('issue47.current_id',first_id::text,true);
  perform set_config('issue47.history_id',second_id::text,true);
  perform set_config('issue47.own_notice',own_notice::text,true);
  perform set_config('issue47.other_notice',other_notice::text,true);
end;
$issue47_current_fixture$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',current_setting('issue47.current_user'),'role','authenticated')::text,true);
do $issue47_current_read$
declare n integer; selected uuid; s record; i record; answer jsonb; result record; before_facts jsonb; changed integer;
begin
  select count(*),min(occurrence_id::text)::uuid into n,selected from public.my_current_course_review();
  assert n=1 and selected=current_setting('issue47.current_id')::uuid,
    format('CURRENT_REVIEW_EXPECTED_ONE_CURRENT_PERIOD_GOT_%s',n);
  select * into strict s from public.start_course_review('00000000-0000-4000-c000-00000000000a',
    gen_random_uuid(),selected);
  for i in select * from public.course_review_items where session_id=s.session_id loop
    answer := case i.type
      when 'multiple_choice' then jsonb_build_object('selected',(select jsonb_agg(x->'id') from jsonb_array_elements(i.config->'options') x where (x->>'correct')::boolean))
      when 'fill_blank' then jsonb_build_object('text',i.config->'answers'->>0)
      when 'match' then jsonb_build_object('pairs',i.config->'pairs')
      when 'sum_alternatives' then jsonb_build_object('sum',coalesce(i.config->'expected',
        (select to_jsonb(sum((x->>'value')::numeric)) from jsonb_array_elements(i.config->'statements') x where (x->>'correct')::boolean))) end;
    perform * from public.submit_course_review_answer(s.session_id,i.question_id,answer);
  end loop;
  select * into strict result from public.finalize_course_review(s.session_id);
  assert result.bonus_earned=10,'Deletion regression requires a genuinely awarded occurrence';
  perform set_config('issue47.awarded_session',s.session_id::text,true);
  select jsonb_build_object('occurrence',to_jsonb(o),'session',to_jsonb(x)) into before_facts
    from public.course_review_occurrences o join public.course_review_sessions x on x.id=o.reward_session_id where o.id=selected;
  perform set_config('issue47.delete_facts',before_facts::text,true);
  delete from public.notifications where id=current_setting('issue47.other_notice')::uuid;
  get diagnostics changed=row_count;
  assert changed=0,'Recipient A deleted recipient B notification';
  delete from public.notifications where id=current_setting('issue47.own_notice')::uuid;
  get diagnostics changed=row_count;
  assert changed=1,'Recipient cannot delete own revision notification';
  assert not exists(select 1 from public.notifications where id=current_setting('issue47.own_notice')::uuid),
    'Own notification still visible after delete';
end;
$issue47_current_read$;
reset role;
do $issue47_current_windows$
declare u uuid := current_setting('issue47.current_user')::uuid;
begin
  assert exists(select 1 from public.notifications where id=current_setting('issue47.other_notice')::uuid),
    'Other recipient notice was removed';
  perform public.tick_course_reviews();
  assert not exists(select 1 from public.notifications where recipient_id=u and type='revisao_curso'),
    'Deleting a delivered notification caused tick to resend';
  assert (select jsonb_build_object('occurrence',to_jsonb(o),'session',to_jsonb(s))
    from public.course_review_occurrences o join public.course_review_sessions s on s.id=o.reward_session_id
    where o.id=current_setting('issue47.current_id')::uuid)=current_setting('issue47.delete_facts')::jsonb,
    'Deleting notice altered occurrence, reward or persisted session';
  update public.course_review_schedules set anchor_at=clock_timestamp() where user_id=u;
end;
$issue47_current_windows$;
set local role authenticated;
do $$ begin
  assert (select count(*) from public.my_current_course_review())=0,'Not-due schedule returned historical overlapping windows';
end $$;
reset role;
update public.course_review_schedules set anchor_at=clock_timestamp()-interval '15 days'
  where user_id=current_setting('issue47.current_user')::uuid;
set local role authenticated;
do $$ begin
  assert (select count(*) from public.my_current_course_review())=1
    and (select occurrence_id from public.my_current_course_review())=current_setting('issue47.history_id')::uuid,
    'Current reader ignored the period derived from the changed anchor';
  assert (select state from public.my_course_review_occurrence(current_setting('issue47.current_id')::uuid))='claimed'
    and (select (result->>'bonus_earned')::integer from public.my_course_review(current_setting('issue47.awarded_session')::uuid))=10,
    'Changing the current period lost historical by-id access or frozen reward';
end $$;
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',current_setting('issue47.current_other_user'),'role','authenticated')::text,true);
do $$ begin
  assert (select count(*) from public.my_current_course_review())=1
    and not exists(select 1 from public.my_current_course_review() where occurrence_id in
      (current_setting('issue47.current_id')::uuid,current_setting('issue47.history_id')::uuid)),
    'Current review leaked another user period';
end $$;
reset role;
delete from public.course_review_schedules where user_id=current_setting('issue47.current_other_user')::uuid;
set local role authenticated;
do $$ begin
  assert (select count(*) from public.my_current_course_review())=0,
    'User without a schedule received a current occurrence';
end $$;
reset role;
select set_config('request.jwt.claims','',true);
do $$ begin
  raise notice 'HARNESS ISSUE 47: período atual único/isolamento/exclusão própria e não reenvio passaram';
end $$;

-- Course eligibility must never be inferred from room membership, room PAC,
-- forged enrollment progress, or completions whose context is only 'room'.
-- This fixture remains inside the runner's outer rollback transaction.
do $issue47_room_fixture$
declare
  u uuid := '00000000-0000-4000-a000-000000000004';
  c uuid := '00000000-0000-4000-c000-00000000000a';
  r uuid := gen_random_uuid();
  o uuid;
begin
  delete from public.completions x using public.lessons l, public.modules m
    where x.user_id=u and x.context='course' and x.lesson_id=l.id
      and l.module_id=m.id and m.course_id=c;
  insert into public.rooms(id,educator_id,course_id,name,access_code)
    values(r,u,c,'Issue47 room isolation', 'issue47-' || r::text);
  insert into public.room_members(room_id,user_id,status,progress,pac_internal)
    values(r,u,'active',100,100);
  insert into public.completions(user_id,lesson_id,context)
    select u,l.id,'room' from public.lessons l join public.modules m on m.id=l.module_id
      where m.course_id=c
    on conflict (user_id,lesson_id,context) do nothing;
  update public.enrollments set status='completed',progress=100 where user_id=u and course_id=c;
  insert into public.course_review_occurrences(
    user_id,period_index,due_at,expires_at,selection_state,course_id,
    course_title,assigned_at,bonus_xp,delivery_state)
    select u,coalesce(max(period_index),0)+100,clock_timestamp()-interval '1 minute',
      clock_timestamp()+interval '1 day','assigned',c,'Room isolation fixture',
      clock_timestamp(),10,'suppressed'
    from public.course_review_occurrences where user_id=u returning id into o;
  perform set_config('issue47.room_occurrence',o::text,true);
end;
$issue47_room_fixture$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}',true);
do $issue47_room_forbidden$
declare
  s record; o uuid; e text;
begin
  select * into strict s from public.course_review_status('00000000-0000-4000-c000-00000000000a');
  assert not s.can_review and s.reason='REVIEW_NOT_ELIGIBLE',
    'Sala concluída/participação e matrícula forjada não autorizam revisão de curso';
  foreach o in array array[null::uuid,current_setting('issue47.room_occurrence')::uuid] loop
    begin
      perform * from public.start_course_review('00000000-0000-4000-c000-00000000000a',gen_random_uuid(),o);
      raise exception 'ROOM_CONTEXT_UNEXPECTEDLY_AUTHORIZED';
    exception when sqlstate 'P0001' then
      get stacked diagnostics e=message_text;
      assert e='REVIEW_NOT_ELIGIBLE',format('Contexto sala deveria recusar início normal/bônus: %s',e);
    end;
  end loop;
end;
$issue47_room_forbidden$;
reset role;

-- Add the missing individual facts without removing the separate room facts.
insert into public.completions(user_id,lesson_id,context)
  select '00000000-0000-4000-a000-000000000004',l.id,'course'
    from public.lessons l join public.modules m on m.id=l.module_id
    where m.course_id='00000000-0000-4000-c000-00000000000a'
  on conflict (user_id,lesson_id,context) do nothing;
set local role authenticated;
do $issue47_room_restored$
declare s record; o uuid;
begin
  select * into strict s from public.course_review_status('00000000-0000-4000-c000-00000000000a');
  assert s.can_review,'Conclusões individuais próprias devem restabelecer elegibilidade';
  foreach o in array array[null::uuid,current_setting('issue47.room_occurrence')::uuid] loop
    select * into strict s from public.start_course_review('00000000-0000-4000-c000-00000000000a',gen_random_uuid(),o);
    assert s.session_id is not null and s.occurrence_id is not distinct from o,
      'Após conclusão individual devem funcionar início normal e bônus';
  end loop;
  raise notice 'HARNESS ISSUE 47: isolamento sala/curso e restauração individual passaram';
end;
$issue47_room_restored$;
reset role;
select set_config('request.jwt.claims','',true);

do $issue47_done$
begin
  raise notice 'HARNESS ISSUE 47: elegibilidade/estado vazio/RPCs/prêmio passaram';
end;
$issue47_done$;
