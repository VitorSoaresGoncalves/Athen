-- Seed OPCIONAL de demonstração (0041+). Nunca executar em produção.
-- 125 contas @athen.test, senha test123!. Não faz parte do db reset/migrações.
-- npm run seed:demo:remote aponta exclusivamente para testeAthen.
-- Uma única instrução DO: criação atômica e compatível com db query --local.
do $demo$
declare
  v_marker constant text := 'athen-demo-v1';
  v_start timestamptz := public.mission_week_start(now());
  v_day timestamptz := public.mission_day_start(now());
  v_season uuid;
  v_group uuid;
  v_user uuid;
  v_educator uuid := md5('athen-demo-v1:user:124')::uuid;
  v_course uuid := md5('athen-demo-v1:course')::uuid;
  v_module uuid := md5('athen-demo-v1:module')::uuid;
  v_lesson uuid;
  v_question uuid;
  v_attempt uuid;
  v_entry uuid;
  v_category public.season_category;
  v_categories text[] := array['bronze','silver','gold','platinum','diamond','master'];
  v_labels text[] := array['bronze','prata','ouro','platina','diamante','mestre'];
  v_names text[] := array['Ana Ribeiro','Bruno Carvalho','Carla Mendes','Diego Alves','Elisa Souza',
    'Felipe Lima','Gabriela Costa','Henrique Dias','Isabela Rocha','João Martins',
    'Laura Santos','Marcos Oliveira','Nina Pereira','Otávio Silva','Paula Gomes',
    'Rafael Melo','Sofia Ramos','Tiago Nunes','Valentina Cruz','Victor Freitas'];
  v_scores integer[] := array[1200,1100,1000,900,900,800,700,600,500,400,350,300,250,200,150,100,75,25,0,0];
  v_label text;
  v_email text;
  v_username text;
  v_name text;
  v_slot integer;
  v_rank integer;
  v_score integer;
  v_delta integer;
  v_steps integer;
  v_attempt_new boolean;
  v_hash text := extensions.crypt('test123!', extensions.gen_salt('bf'));
begin
  perform pg_advisory_xact_lock(hashtext(v_marker));
  if to_regprocedure('public.my_season_standings(uuid)') is null then
    raise exception 'Aplique a migração 0041 antes do seed.';
  end if;
  select id into v_season from public.seasons where starts_at = v_start and status = 'open';
  if v_season is null then
    -- Só abre uma semana ausente; não fecha nem altera temporadas existentes.
    if exists(select 1 from public.seasons where starts_at = v_start) then
      raise exception 'A temporada corrente não está aberta; resolva a apuração antes do seed.';
    end if;
    v_season := public.open_season(now());
  end if;
  if v_season is null then raise exception 'Não foi possível abrir a temporada corrente.'; end if;

  -- Identidades determinísticas. Colisão com conta não pertencente ao seed aborta tudo.
  for i in 1..125 loop
    v_user := md5(v_marker || ':user:' || i)::uuid;
    v_slot := ((i - 1) % 20) + 1;
    v_rank := ((i - 1) / 20) + 1;
    v_label := case when i <= 120 then v_labels[v_rank]
      when i <= 123 then 'pequeno' when i = 124 then 'educador' else 'sem-liga' end;
    v_username := 'demo.' || v_label || case when i <= 120 then '.' || lpad(v_slot::text,2,'0')
      when i <= 123 then '.' || lpad((i-120)::text,2,'0') else '' end;
    v_email := v_username || '@athen.test';
    v_name := case when i = 124 then 'Educador Demo' when i = 125 then 'Estudante Sem Liga'
      else v_names[v_slot] || ' · ' || initcap(v_label) end;
    if exists(select 1 from auth.users where (id = v_user or email = v_email)
      and (id <> v_user or email is distinct from v_email or raw_user_meta_data->>'demo_seed' is distinct from v_marker)) then
      raise exception 'Colisão de identidade de demonstração: %', v_email;
    end if;
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
      confirmation_token,recovery_token,email_change_token_new,email_change)
    values('00000000-0000-0000-0000-000000000000',v_user,'authenticated','authenticated',
      v_email,v_hash,now(),'{"provider":"email","providers":["email"]}',
      jsonb_build_object('username',v_username,'display_name',v_name,'role',
        case when i = 124 then 'educator' else 'student' end,'demo_seed',v_marker),
      now(),now(),'','','','') on conflict(id) do nothing;
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
    values(gen_random_uuid(),v_user,v_user::text,jsonb_build_object('sub',v_user::text,
      'email',v_email,'email_verified',true),'email',now(),now())
    on conflict(provider_id,provider) do nothing;
    update public.profiles set bio = 'Conta fictícia para demonstração de ligas e missões.',
      avatar_url = case when v_slot % 3 = 0 then null else
        'data:image/svg+xml;base64,' || replace(encode(convert_to(
          '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="20" fill="#6d28d9"/><text x="40" y="53" text-anchor="middle" font-family="sans-serif" font-size="38" fill="#facc15">'
          || left(v_name,1) || '</text></svg>','UTF8'),'base64'),E'\n','') end
      where id = v_user and bio is null;
  end loop;

  -- Curso independente do seed base. Atividades sintéticas alimentam as funções
  -- reais de missões; não alteramos catálogo, metas ou progresso de outras contas.
  insert into public.courses(id,creator_id,title,slug,description,category,status,visibility)
  values(v_course,v_educator,'Laboratório de ligas e missões','demo-ligas-missoes',
    'Curso fictício com atividades de demonstração.','Tecnologia','published','public') on conflict(id) do nothing;
  insert into public.modules(id,course_id,title,position,icon,color)
  values(v_module,v_course,'Primeiros passos',0,'🏆','#a855f7') on conflict(id) do nothing;
  for j in 1..3 loop
    v_lesson := md5(v_marker || ':lesson:' || j)::uuid;
    insert into public.lessons(id,module_id,title,content,position,status)
    values(v_lesson,v_module,'Desafio de demonstração ' || j,'Selecione a alternativa correta.',j-1,'published') on conflict(id) do nothing;
    for k in 1..2 loop
      v_question := md5(v_marker || ':question:' || j || ':' || k)::uuid;
      insert into public.questions(id,lesson_id,type,prompt,position,config,xp_value)
      values(v_question,v_lesson,'multiple_choice','Quanto é 1 + 1?',k-1,
        '{"options":[{"id":"a","text":"2","correct":true},{"id":"b","text":"3","correct":false}]}',10)
      on conflict(id) do nothing;
    end loop;
  end loop;

  for i in 1..123 loop
    v_user := md5(v_marker || ':user:' || i)::uuid;
    v_rank := ((i-1)/20)+1;
    v_slot := case when i <= 120 then ((i-1)%20)+1 else i-120 end;
    v_category := case when i <= 120 then v_categories[v_rank]::public.season_category else 'gold' end;
    v_label := case when i <= 120 then v_categories[v_rank] else 'small' end;
    v_group := md5(v_marker || ':group:' || v_season || ':' || v_label)::uuid;
    insert into public.season_groups(id,season_id,category,group_index)
    select v_group,v_season,v_category,coalesce(max(group_index),0)+1
      from public.season_groups where season_id=v_season and category=v_category
    on conflict(id) do nothing;
    v_entry := null;
    insert into public.season_entries(season_id,user_id,group_id,category,identity_hidden)
    values(v_season,v_user,v_group,v_category,i<=120 and v_slot=5)
    on conflict(season_id,user_id) do nothing returning id into v_entry;
    -- Rótulos sintéticos conhecidos, exclusivos das inscrições novas do seed.
    if v_entry is not null then
      update public.season_entries set entry_kind=case when v_slot<=10 then 'snapshot' else 'late' end
        where id=v_entry;
    end if;
    -- Apenas inscrições novas recebem grupo/categoria; reexecução não reagrupa.
    v_score := case when i <= 120 then v_scores[v_slot] else (array[50,25,0])[v_slot] end;
    insert into public.enrollments(user_id,course_id) values(v_user,v_course) on conflict(user_id,course_id) do nothing;
    if v_score = 0 then continue; end if;
    v_steps := ((v_slot-1)%3)+1;
    for j in 1..v_steps loop
      v_lesson := md5(v_marker || ':lesson:' || j)::uuid;
      v_attempt := md5(v_marker || ':attempt:' || v_user || ':' || v_day || ':' || j)::uuid;
      v_attempt_new := false;
      insert into public.attempts(id,user_id,lesson_id,course_id,started_at,finished_at,xp_earned,correct_count,total_count)
      values(v_attempt,v_user,v_lesson,v_course,now(),null,0,0,0)
      on conflict(id) do nothing returning true into v_attempt_new;
      if not coalesce(v_attempt_new,false) then continue; end if;
      for k in 1..2 loop
        v_question := md5(v_marker || ':question:' || j || ':' || k)::uuid;
        insert into public.answers(attempt_id,question_id,submitted,is_correct)
        values(v_attempt,v_question,'{"selected":["a"]}',true) on conflict(attempt_id,question_id) do nothing;
      end loop;
      -- O remoto legado impede respostas depois de finished_at: finalize só
      -- após gravá-las, sem desabilitar o trigger de proteção.
      update public.attempts set finished_at=now(),xp_earned=case when j=1 then v_score else 0 end,
        correct_count=2,total_count=2 where id=v_attempt;
      insert into public.completions(user_id,lesson_id,context,attempt_id)
      values(v_user,v_lesson,'course',v_attempt) on conflict(user_id,lesson_id,context) do nothing;
      if j=1 then
        v_delta := null;
        insert into public.xp_events(user_id,origin,context,amount,attempt_id,course_id,idempotency_key)
        values(v_user,'learning_base','course',v_score,v_attempt,v_course,v_marker || ':xp:' || v_user || ':' || v_season)
        on conflict(idempotency_key) do nothing returning amount into v_delta;
        if v_delta is not null then
          update public.profiles set xp_global=xp_global+v_delta,level=public.level_for_xp(xp_global+v_delta)
            where id=v_user;
        end if;
      end if;
      perform public.advance_missions_for_attempt(v_attempt);
    end loop;
    perform public.recompute_course_progress(v_user,v_course);
  end loop;
  raise notice 'DEMO: 125 contas disponíveis; senha test123!. Grupos Bronze–Mestre, grupo pequeno, educador e sem liga.';
end;
$demo$;
