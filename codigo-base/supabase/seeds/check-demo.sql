-- Verificação das fixtures recém-criadas nesta semana pelas RPCs da aplicação.
-- Deve rodar logo após o seed, antes de usar as contas ou virar a semana.
do $check$
declare
  v_season uuid;
  v_previous_claims text := current_setting('request.jwt.claims',true);
  v_user uuid := md5('athen-demo-v1:user:21')::uuid; -- Prata 01
begin
  select id into strict v_season from public.seasons where starts_at=public.mission_week_start(now());
  assert (select count(*) from auth.users where raw_user_meta_data->>'demo_seed'='athen-demo-v1')=125,
    'Deve haver 125 contas de demonstração.';
  assert (select count(*) from public.season_entries where season_id=v_season
    and user_id in(select id from auth.users where raw_user_meta_data->>'demo_seed'='athen-demo-v1'))=123,
    '123 contas devem ter liga; educador e sem-liga ficam fora.';
  perform set_config('request.jwt.claims',json_build_object('sub',v_user)::text,true);
  perform set_config('role','authenticated',true);
  assert (select count(*) from public.my_season_standings(v_season))=20,'Grupo Prata deve ter 20 usuários.';
  assert (select count(*) from public.my_season_standings(v_season) where movement='promoted')=5,'Empate em 900 XP deve promover cinco.';
  assert (select count(*) from public.my_season_standings(v_season) where movement='demoted')=6,'Quatro positivos e dois zeros devem ter projeção de queda.';
  assert (select season_xp from public.my_season_standings(v_season) where is_self)=1200,'Bônus não pode alterar XP da temporada.';
  assert (select bool_and(display_name is null and avatar_url is null) from public.my_season_standings(v_season) where hidden),
    'Identidade oculta deve preservar privacidade.';
  assert (select count(*) from public.my_missions() where completed)>0,'Conta deve ter missão concluída.';
  assert (select count(*) from public.my_missions() where not completed and current_count>0)>0,'Conta deve ter missão em progresso.';
  perform set_config('request.jwt.claims',json_build_object('sub',md5('athen-demo-v1:user:125')::uuid)::text,true);
  assert not exists(select 1 from public.my_season_standings(v_season)),'Sem-liga não pode ver outro grupo.';
  perform set_config('role','none',true);
  perform set_config('request.jwt.claims',coalesce(v_previous_claims,''),true);
  raise notice 'DEMO CHECK: OK (contas, projeções, empates, privacidade e missões).';
end;
$check$;
