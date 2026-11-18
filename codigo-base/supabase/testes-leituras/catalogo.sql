-- Somente no Supabase LOCAL descartável. Todas as fixtures são revertidas.
begin;
set plpgsql.check_asserts = on;
set statement_timeout = '20s';

insert into auth.users(id,email,raw_user_meta_data) values
 ('67000000-0000-4000-8000-000000000001','catalog-owner@local.test','{"username":"catalog_owner","role":"educator"}'),
 ('67000000-0000-4000-8000-000000000002','catalog-a@local.test','{"username":"catalog_a","role":"student"}'),
 ('67000000-0000-4000-8000-000000000003','catalog-b@local.test','{"username":"catalog_b","role":"student"}');
insert into public.courses(id,creator_id,title,slug,status,visibility,category,tags) values
 ('67000000-0000-4000-8000-000000000011','67000000-0000-4000-8000-000000000001','Catálogo A','catalog-fixture-a','published','public','Tecnologia','{logica}'),
 ('67000000-0000-4000-8000-000000000012','67000000-0000-4000-8000-000000000001','Catálogo B','catalog-fixture-b','published','public','Tecnologia','{logica}'),
 ('67000000-0000-4000-8000-000000000013','67000000-0000-4000-8000-000000000002','Catálogo próprio','catalog-fixture-own','published','public','Outra','{}'),
 ('67000000-0000-4000-8000-000000000014','67000000-0000-4000-8000-000000000001','Rascunho','catalog-fixture-draft','draft','public','Outra','{}'),
 ('67000000-0000-4000-8000-000000000015','67000000-0000-4000-8000-000000000001','Privado','catalog-fixture-private','published','private','Outra','{}');
insert into public.enrollments(user_id,course_id,created_at) values
 ('67000000-0000-4000-8000-000000000002','67000000-0000-4000-8000-000000000011',now()-interval '6 days'),
 ('67000000-0000-4000-8000-000000000003','67000000-0000-4000-8000-000000000011',now()-interval '10 days');
-- Inclui o próprio criador explicitamente; a métrica deve ignorá-lo.
insert into public.enrollments(user_id,course_id) values
 ('67000000-0000-4000-8000-000000000001','67000000-0000-4000-8000-000000000011') on conflict do nothing;
insert into public.reviews(user_id,course_id,rating,status,created_at) values
 ('67000000-0000-4000-8000-000000000002','67000000-0000-4000-8000-000000000011',5,'published',now()-interval '2 years'),
 ('67000000-0000-4000-8000-000000000003','67000000-0000-4000-8000-000000000011',1,'draft',now());

set role authenticated;
select set_config('request.jwt.claim.sub','67000000-0000-4000-8000-000000000002',true);
do $$ declare r record; begin
  select * into strict r from public.catalog_course_feed() where course_id='67000000-0000-4000-8000-000000000011';
  assert r.rating_avg=5 and r.rating_count=1, 'published lifetime ratings only';
  assert r.enrollments_total=2 and r.enrollments_7d=1, 'recent enrollment window excludes creator';
  assert r.is_enrolled and r.recommended_score is null, 'own enrollment is not recommended';
  assert (select recommended_score>=4 from public.catalog_course_feed() where course_id='67000000-0000-4000-8000-000000000012'), 'category and tag affinity';
  assert (select recommended_score is null from public.catalog_course_feed() where course_id='67000000-0000-4000-8000-000000000013'), 'created course not recommended';
  assert not exists(select 1 from public.catalog_course_feed() where course_id in ('67000000-0000-4000-8000-000000000014','67000000-0000-4000-8000-000000000015')), 'private and draft courses stay hidden';
end $$;
reset role;
set role anon;
do $$ begin
  assert not has_function_privilege('anon','public.catalog_course_feed()','execute');
  begin
    perform * from public.catalog_course_feed();
    raise exception 'anonymous access unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
