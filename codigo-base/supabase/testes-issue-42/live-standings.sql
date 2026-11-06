-- Ensaiar somente em banco isolado com 0041 e seed base. Nada persiste.
begin;
do $test$
declare
  v_start timestamptz := public.mission_week_start(now()) - interval '210 days';
  v_season uuid;
  v_group uuid;
  v_other_group uuid;
  v_user uuid;
  v_users uuid[] := '{}';
  v_scores integer[] := array[100,90,90,70,60,50,40,30,20,10,0,0];
  v_expected jsonb;
  v_row jsonb;
begin
  insert into public.seasons(starts_at,ends_at,status)
  values(v_start,v_start+interval '7 days','open') returning id into v_season;
  insert into public.season_groups(season_id,category,group_index)
  values(v_season,'silver',1) returning id into v_group;
  insert into public.season_groups(season_id,category,group_index)
  values(v_season,'gold',1) returning id into v_other_group;
  for i in 1..14 loop
    v_user := gen_random_uuid();
    v_users := array_append(v_users,v_user);
    insert into auth.users(id,email,raw_user_meta_data)
    values(v_user,'liga-'||v_user::text||'@example.test',jsonb_build_object('username','liga_'||replace(v_user::text,'-','')));
    if i = 14 then
      update public.seasons set created_at=now()-interval '1 day' where id=v_season;
    end if;
    if i in (12,14) then
      insert into public.completions(user_id,lesson_id,context,completed_at)
      values(v_user,'00000000-0000-4000-e000-00000000a101','course',v_start-interval '1 day');
    end if;
    insert into public.season_entries(season_id,user_id,group_id,category)
    values(v_season,v_user,case when i>=13 then v_other_group else v_group end,
      case when i>=13 then 'gold'::public.season_category else 'silver'::public.season_category end);
    if i<=12 and v_scores[i]>0 then
      insert into public.xp_events(user_id,origin,context,amount,idempotency_key,occurred_at)
      values(v_user,'learning_base','course',v_scores[i],'standings:'||v_user::text,v_start+interval '1 day');
    end if;
  end loop;
  update public.season_entries set identity_hidden=true where season_id=v_season and user_id=v_users[2];
  assert (select entry_kind from public.season_entries where season_id=v_season and user_id=v_users[14])='late',
    'retorno apos a abertura deve ser tardio mesmo com atividade anterior';
  insert into public.xp_events(user_id,origin,context,amount,idempotency_key,occurred_at) values
    (v_users[1],'mission_bonus','course',9999,'standings:bonus',v_start+interval '1 day'),
    (v_users[1],'learning_base','room',9999,'standings:room',v_start+interval '1 day');

  perform set_config('request.jwt.claims',json_build_object('sub',v_users[1]::text)::text,true);
  perform set_config('role','authenticated',true);
  assert (select count(*) from public.my_season_standings(v_season))=12,
    'leitura deve mostrar somente o proprio grupo';
  assert (select season_xp from public.my_season_summary(v_season))=100,
    'resumo deve ler XP novo e excluir bonus/sala';
  assert (select display_name is null and avatar_url is null and banner_url is null
    from public.my_season_standings(v_season) where user_id=v_users[2]),
    'identidade oculta nao pode expor nome ou imagens';
  assert (select entry_kind from public.my_season_standings(v_season) where is_self)='late',
    'primeira atividade corrente deve ser entrada tardia';
  assert (select entry_kind from public.my_season_standings(v_season) where user_id=v_users[12])='snapshot',
    'atividade anterior deve registrar inscricao inicial';
  assert (select count(*) from public.my_season_standings(gen_random_uuid()))=0,
    'temporada sem participacao nao pode retornar grupo alheio';
  select jsonb_agg(to_jsonb(st)) into v_expected from public.my_season_standings(v_season) st;
  perform set_config('role','none',true);
  assert not has_function_privilege('anon','public.my_season_standings(uuid)','EXECUTE'),
    'leitura nova exige sessao';
  assert (select count(*) from jsonb_array_elements(v_expected) x where x->>'movement'='promoted')=3,
    'empate na fronteira de promocao deve subir junto';
  assert (select count(*) from jsonb_array_elements(v_expected) x where x->>'movement'='demoted')=4,
    'dois positivos no corte e dois zeros devem cair';
  perform public.close_season(v_season,10);
  for v_row in select * from jsonb_array_elements(v_expected) loop
    assert (select result_category::text from public.season_entries
      where season_id=v_season and user_id=(v_row->>'user_id')::uuid)=(v_row->>'projected_category'),
      'projecao deve corresponder ao fechamento real';
  end loop;
  insert into public.xp_events(user_id,origin,context,amount,idempotency_key,occurred_at)
  values(v_users[1],'learning_base','course',777,'standings:after-close',v_start+interval '2 days');
  assert (select season_xp from public.my_season_summary(v_season))=100,
    'leitura fechada deve preservar pontuacao consolidada';

  -- Grupo pequeno: positivos ficam; zero em Bronze nao cai abaixo do piso.
  update public.seasons set status='open' where id=v_season;
  update public.season_entries set category='bronze',season_xp=0,result_category=null,final_rank=null
   where user_id=v_users[13] and season_id=v_season;
  update public.season_groups set category='bronze' where id=v_other_group;
  perform set_config('request.jwt.claims',json_build_object('sub',v_users[13]::text)::text,true);
  assert (select movement from public.my_season_standings(v_season) where is_self)='stayed',
    'zero em Bronze deve preservar piso';
  insert into public.xp_events(user_id,origin,context,amount,idempotency_key,occurred_at)
  values(v_users[13],'learning_base','course',5,'standings:small',v_start+interval '1 day');
  assert (select movement from public.my_season_standings(v_season) where is_self)='stayed',
    'positivo em grupo pequeno deve conservar categoria';
  update public.season_entries set category='master' where season_id=v_season and group_id=v_group;
  update public.season_groups set category='master' where id=v_group;
  perform set_config('request.jwt.claims',json_build_object('sub',v_users[1]::text)::text,true);
  assert (select projected_category from public.my_season_standings(v_season) where is_self)='master',
    'projecao deve respeitar o teto Mestre';
  raise notice 'LIVE STANDINGS: OK';
end;
$test$;
rollback;
