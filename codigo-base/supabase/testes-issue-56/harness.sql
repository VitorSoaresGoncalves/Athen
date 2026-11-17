-- Issue 56: run only against a disposable local database with 0001-0041 +
-- 0046_room_stats.sql, or integrated 0001-0046. Fixtures are rolled back.
-- psql -X -v ON_ERROR_STOP=1 -f supabase/testes-issue-56/harness.sql
begin;
set plpgsql.check_asserts = on;
set statement_timeout = '20s';
create temporary table review56_checks(name text, passed boolean not null);
grant select,insert on review56_checks to authenticated;
insert into auth.users(id,email,raw_user_meta_data) values
 ('56000000-0000-0000-0000-000000000001','review56-owner@local.test','{"username":"review56_owner","role":"educator"}'),
 ('56000000-0000-0000-0000-000000000002','review56-other@local.test','{"username":"review56_other","role":"educator"}'),
 ('56000000-0000-0000-0000-000000000003','review56-student@local.test','{"username":"review56_student","role":"student"}');
insert into public.courses(id,creator_id,title,slug,status,visibility) values
 ('56000000-0000-0000-0000-000000000010','56000000-0000-0000-0000-000000000001','Review56 course','review56-course','published','public');
insert into public.modules(id,course_id,title,position) values
 ('56000000-0000-0000-0000-000000000020','56000000-0000-0000-0000-000000000010','Review56 module',0);
insert into public.lessons(id,module_id,title,status) values
 ('56000000-0000-0000-0000-000000000030','56000000-0000-0000-0000-000000000020','Review56 lesson','published');
insert into public.questions(id,lesson_id,type,prompt,config,position)
 select ('56000000-0000-0000-0001-' || lpad(n::text,12,'0'))::uuid,
 '56000000-0000-0000-0000-000000000030','multiple_choice','Review56 question ' || n,
 '{"options":[{"id":"a","text":"A","correct":true},{"id":"b","text":"B","correct":false}]}',n
 from generate_series(1,101) n;
insert into public.rooms(id,educator_id,course_id,name,access_code) values
 ('56000000-0000-0000-0000-000000000040','56000000-0000-0000-0000-000000000001','56000000-0000-0000-0000-000000000010','Review56 room','review56-room'),
 ('56000000-0000-0000-0000-000000000041','56000000-0000-0000-0000-000000000001',null,'Review56 empty','review56-empty');
insert into public.room_members(room_id,user_id) values
 ('56000000-0000-0000-0000-000000000040','56000000-0000-0000-0000-000000000003');
set role authenticated;
select set_config('request.jwt.claim.sub','56000000-0000-0000-0000-000000000001',true);
do $$ declare r record; begin
 select * into strict r from public.room_stats_overview('56000000-0000-0000-0000-000000000040');
 assert r.active_members=1 and r.avg_progress=0 and r.avg_first_try=0 and r.attention_count=0;
 assert (select count(*)=1 from public.room_stats_students('56000000-0000-0000-0000-000000000040'));
 assert (select count(*)=1 from public.room_stats_modules('56000000-0000-0000-0000-000000000040'));
 assert (select count(*)=0 from public.room_stats_hard_questions('56000000-0000-0000-0000-000000000040'));
 select * into strict r from public.room_stats_overview('56000000-0000-0000-0000-000000000041');
 assert r.active_members=0 and r.avg_progress=0;
 assert (select count(*)=0 from public.room_stats_modules('56000000-0000-0000-0000-000000000041'));
 raise notice 'PASS owner: all four RPCs, empty room, room without course';
end $$;
select set_config('request.jwt.claim.sub','56000000-0000-0000-0000-000000000002',true);
do $$ declare fn text; begin
 foreach fn in array array['room_stats_overview','room_stats_students','room_stats_modules','room_stats_hard_questions'] loop
  begin execute format('select * from public.%I(%L::uuid)',fn,'56000000-0000-0000-0000-000000000040');
  raise exception 'unexpected authorization for %',fn; exception when insufficient_privilege then null; end;
 end loop;
 raise notice 'PASS other educator: four RPCs denied';
end $$;
select set_config('request.jwt.claim.sub','56000000-0000-0000-0000-000000000003',true);
do $$ declare fn text; begin
 foreach fn in array array['room_stats_overview','room_stats_students','room_stats_modules','room_stats_hard_questions'] loop
  begin execute format('select * from public.%I(%L::uuid)',fn,'56000000-0000-0000-0000-000000000040');
  raise exception 'unexpected authorization for %',fn; exception when insufficient_privilege then null; end;
 end loop;
 raise notice 'PASS student: four RPCs denied';
end $$;
reset role;
set role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ declare fn text; begin
 foreach fn in array array['room_stats_overview','room_stats_students','room_stats_modules','room_stats_hard_questions','assert_room_educator','room_first_answers','room_student_metrics'] loop
  assert not has_function_privilege('anon','public.'||fn||'(uuid)','execute');
  begin execute format('select * from public.%I(%L::uuid)',fn,'56000000-0000-0000-0000-000000000040');
  raise exception 'unexpected authorization for %',fn; exception when insufficient_privilege then null; end;
 end loop;
 raise notice 'PASS anon: RPCs and helpers denied';
end $$;
reset role;
do $$ declare fn text; begin
 foreach fn in array array['assert_room_educator','room_first_answers','room_student_metrics'] loop
  assert not has_function_privilege('authenticated','public.'||fn||'(uuid)','execute');
 end loop;
 raise notice 'PASS authenticated: helpers denied';
end $$;
-- A real server finalization with 1/101 answers: no official completion.
insert into public.attempts(id,user_id,lesson_id,room_id,course_id) values
 ('56000000-0000-0000-0000-000000000050','56000000-0000-0000-0000-000000000003','56000000-0000-0000-0000-000000000030','56000000-0000-0000-0000-000000000040','56000000-0000-0000-0000-000000000010');
insert into public.answers(attempt_id,question_id,submitted) values
 ('56000000-0000-0000-0000-000000000050','56000000-0000-0000-0001-000000000001','{"selected":["a"]}');
set role authenticated;
select set_config('request.jwt.claim.sub','56000000-0000-0000-0000-000000000003',true);
select * from public.finalize_attempt('56000000-0000-0000-0000-000000000050');
reset role;
do $$ begin
 assert (select count(*)=0 from public.completions where user_id='56000000-0000-0000-0000-000000000003');
 raise notice 'PASS fixture: finalized partial attempt, zero official completions';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','56000000-0000-0000-0000-000000000001',true);
insert into review56_checks select 'partial attempt is not completion', completion_pct=0 from public.room_stats_modules('56000000-0000-0000-0000-000000000040');
reset role;
-- Expand server fixture to exact 50/101 first-answer ratio (49.50495049%).
insert into public.answers(attempt_id,question_id,submitted,is_correct)
 select '56000000-0000-0000-0000-000000000050',('56000000-0000-0000-0001-'||lpad(n::text,12,'0'))::uuid,
 '{"selected":["a"]}',n<=50 from generate_series(2,101) n;
set role authenticated;
select set_config('request.jwt.claim.sub','56000000-0000-0000-0000-000000000001',true);
insert into review56_checks select '50/101 requires attention even when displayed as 50', first_try_rate=50 and days_idle=0 and needs_attention from public.room_stats_students('56000000-0000-0000-0000-000000000040');
do $$ begin assert (select count(*)=0 from public.answers), 'educator must not read raw answers'; end $$;
reset role;
-- Exactly 50% must not trigger the accuracy alert; all current questions answered.
delete from public.answers where question_id='56000000-0000-0000-0001-000000000101';
set role authenticated;
select set_config('request.jwt.claim.sub','56000000-0000-0000-0000-000000000001',true);
insert into review56_checks select 'exactly 50 percent needs no attention', first_try_rate=50 and not needs_attention from public.room_stats_students('56000000-0000-0000-0000-000000000040');
reset role;
insert into public.answers(attempt_id,question_id,submitted,is_correct) values
 ('56000000-0000-0000-0000-000000000050','56000000-0000-0000-0001-000000000101','{"selected":["b"]}',false);
set role authenticated;
select set_config('request.jwt.claim.sub','56000000-0000-0000-0000-000000000001',true);
insert into review56_checks select 'late answers do not complete a finalized partial attempt', completion_pct=0 from public.room_stats_modules('56000000-0000-0000-0000-000000000040');
reset role;
-- A separate complete attempt is finalized by the real server function.
insert into public.attempts(id,user_id,lesson_id,room_id,course_id) values
 ('56000000-0000-0000-0000-000000000052','56000000-0000-0000-0000-000000000003','56000000-0000-0000-0000-000000000030','56000000-0000-0000-0000-000000000040','56000000-0000-0000-0000-000000000010');
insert into public.answers(attempt_id,question_id,submitted)
 select '56000000-0000-0000-0000-000000000052',q.id,'{"selected":["a"]}' from public.questions q where q.lesson_id='56000000-0000-0000-0000-000000000030';
set role authenticated;
select set_config('request.jwt.claim.sub','56000000-0000-0000-0000-000000000003',true);
select * from public.finalize_attempt('56000000-0000-0000-0000-000000000052');
reset role;
do $$ begin assert exists(select 1 from public.completions where attempt_id='56000000-0000-0000-0000-000000000052' and context='room'), 'real full attempt must create completion'; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','56000000-0000-0000-0000-000000000001',true);
insert into review56_checks select 'fully answered attempt completes module', completion_pct=100 from public.room_stats_modules('56000000-0000-0000-0000-000000000040');
reset role;
-- A later answer finalized first must not replace an earlier answer.
update public.attempts set started_at=now()-interval '2 hours',finished_at=now()-interval '30 minutes'
 where id='56000000-0000-0000-0000-000000000050';
update public.answers set created_at=now()-interval '90 minutes',is_correct=false
 where attempt_id='56000000-0000-0000-0000-000000000050' and question_id='56000000-0000-0000-0001-000000000001';
insert into public.attempts(id,user_id,lesson_id,room_id,course_id,started_at,finished_at) values
 ('56000000-0000-0000-0000-000000000051','56000000-0000-0000-0000-000000000003','56000000-0000-0000-0000-000000000030','56000000-0000-0000-0000-000000000040','56000000-0000-0000-0000-000000000010',now()-interval '1 hour',now()-interval '45 minutes');
insert into public.answers(attempt_id,question_id,submitted,is_correct,created_at) values
 ('56000000-0000-0000-0000-000000000051','56000000-0000-0000-0001-000000000001','{"selected":["a"]}',true,now()-interval '50 minutes');
insert into review56_checks select 'first answer uses submission chronology', not is_correct from public.room_first_answers('56000000-0000-0000-0000-000000000040') where question_id='56000000-0000-0000-0001-000000000001';
-- No practice or completion in a different room may complete this room's module.
update public.attempts set room_id='56000000-0000-0000-0000-000000000041'
 where id in ('56000000-0000-0000-0000-000000000050','56000000-0000-0000-0000-000000000052');
set role authenticated;
select set_config('request.jwt.claim.sub','56000000-0000-0000-0000-000000000001',true);
insert into review56_checks select 'other room does not supply completion', completion_pct=0 from public.room_stats_modules('56000000-0000-0000-0000-000000000040');
reset role;
update public.attempts set started_at=now()-interval '6 days' where id='56000000-0000-0000-0000-000000000051';
set role authenticated;
select set_config('request.jwt.claim.sub','56000000-0000-0000-0000-000000000001',true);
insert into review56_checks select 'six days idle requires attention', days_idle=6 and needs_attention from public.room_stats_students('56000000-0000-0000-0000-000000000040');
reset role;
-- Four questions: 0/3, 32/100, 33/100 and 34/103. The last two display 33,
-- but only 33/100 belongs in the exact bottom three.
insert into auth.users(id,email,raw_user_meta_data)
 select ('56000000-0000-0002-0000-'||lpad(n::text,12,'0'))::uuid,
 'review56-hard-'||n||'@local.test',jsonb_build_object('username','review56_hard_'||n,'role','student') from generate_series(1,103) n;
insert into public.room_members(room_id,user_id)
 select '56000000-0000-0000-0000-000000000041',('56000000-0000-0002-0000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,103) n;
insert into public.attempts(id,user_id,lesson_id,room_id,started_at,finished_at)
 select ('56000000-0000-0003-0000-'||lpad(n::text,12,'0'))::uuid,
 ('56000000-0000-0002-0000-'||lpad(n::text,12,'0'))::uuid,
 '56000000-0000-0000-0000-000000000030','56000000-0000-0000-0000-000000000041',now(),now() from generate_series(1,103) n;
insert into public.answers(attempt_id,question_id,submitted,is_correct)
 select ('56000000-0000-0003-0000-'||lpad(n::text,12,'0'))::uuid,
 ('56000000-0000-0000-0001-'||lpad(q::text,12,'0'))::uuid,'{}',
 case q when 1 then false when 2 then n<=32 when 3 then n<=33 when 4 then n<=34 end
 from generate_series(1,103) n cross join generate_series(1,4) q
 where (q=1 and n<=3) or (q in (2,3) and n<=100) or q=4;
set role authenticated;
select set_config('request.jwt.claim.sub','56000000-0000-0000-0000-000000000001',true);
insert into review56_checks select 'hard questions use exact rates before top three',
 count(*)=3 and bool_or(question_id='56000000-0000-0000-0001-000000000003') and not bool_or(question_id='56000000-0000-0000-0001-000000000004')
 from public.room_stats_hard_questions('56000000-0000-0000-0000-000000000041');
reset role;
-- Confirm removed members are excluded.
update public.room_members set status='removed' where room_id='56000000-0000-0000-0000-000000000040';
set role authenticated;
select set_config('request.jwt.claim.sub','56000000-0000-0000-0000-000000000001',true);
do $$ begin
 assert (select active_members=0 from public.room_stats_overview('56000000-0000-0000-0000-000000000040'));
 assert (select count(*)=0 from public.room_stats_students('56000000-0000-0000-0000-000000000040'));
 raise notice 'PASS removed members excluded';
end $$;
reset role;
table review56_checks;
do $$ begin
 assert (select count(*)=9 from review56_checks), 'missing regression cases';
 assert not exists(select 1 from review56_checks where not passed), 'room statistics regression failed';
end $$;
rollback;
