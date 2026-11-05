-- Executar após 0040 em um banco de ensaio, dentro de BEGIN/ROLLBACK.
do $review$
declare
  v_user uuid := '00000000-0000-4000-a000-000000000004';
  v_late uuid := '00000000-0000-4000-a000-000000000007';
  v_old uuid;
  v_group uuid;
  v_current uuid;
  v_lesson uuid;
  v_before integer;
  v_after integer;
begin
  assert not has_function_privilege('anon',
    'public.record_xp_event(uuid, public.xp_event_origin, public.xp_event_context, integer, text, uuid, uuid, uuid, uuid, timestamptz)',
    'EXECUTE'), 'anon pode fabricar XP';
  assert not has_function_privilege('authenticated',
    'public.record_xp_event(uuid, public.xp_event_origin, public.xp_event_context, integer, text, uuid, uuid, uuid, uuid, timestamptz)',
    'EXECUTE'), 'authenticated pode fabricar XP';
  assert not has_function_privilege('anon', 'public.tick_seasons()', 'EXECUTE'),
    'anon pode executar virada';

  delete from public.season_ops_log;
  delete from public.season_entries;
  delete from public.season_groups;
  delete from public.seasons;

  insert into public.seasons(starts_at, ends_at, status)
  values (public.mission_week_start(now()) - interval '7 days',
          public.mission_week_start(now()), 'open') returning id into v_old;
  insert into public.season_groups(season_id, category, group_index)
  values(v_old, 'gold', 1) returning id into v_group;
  insert into public.season_entries(season_id, user_id, group_id, category)
  values(v_old, v_user, v_group, 'gold');

  select lesson_id into v_lesson from public.completions
   where user_id = v_user limit 1;
  if v_lesson is null then
    select id into v_lesson from public.lessons limit 1;
  end if;
  insert into public.completions(user_id, lesson_id, context, completed_at)
  values(v_user, v_lesson, 'course', now())
  on conflict(user_id, lesson_id, context) do update set completed_at = now();

  perform public.tick_seasons();
  select id into v_current from public.seasons
   where starts_at = public.mission_week_start(now());
  assert v_current is not null, 'tick nao abriu a semana corrente';
  assert (select status from public.seasons where id = v_old) = 'closed',
    'tick nao fechou a semana anterior';
  assert (select category from public.season_entries
           where season_id = v_current and user_id = v_user) = 'silver',
    'categoria da semana corrente ignorou a queda da semana anterior';

  delete from public.season_entries where season_id = v_current and user_id = v_late;
  insert into public.completions(user_id, lesson_id, context, completed_at)
  values(v_late, v_lesson, 'course', now())
  on conflict(user_id, lesson_id, context) do update set completed_at = now();
  assert exists(select 1 from public.season_entries
    where season_id = v_current and user_id = v_late and group_id is not null),
    'primeira atividade da semana nao inscreveu o participante';

  -- A primeira conclusão sem questões avança a missão e não gera XP base.
  select l.id into v_lesson from public.lessons l
   where not exists (select 1 from public.questions q where q.lesson_id = l.id)
     and not exists (select 1 from public.completions c
       where c.user_id = v_user and c.lesson_id = l.id and c.context = 'course')
   limit 1;
  assert v_lesson is not null, 'fixture sem aula vazia inédita';
  select count(*) into v_before from public.xp_events
   where user_id = v_user and origin = 'learning_base';
  perform set_config('request.jwt.claims', json_build_object('sub', v_user::text)::text, true);
  perform public.complete_empty_lesson(v_lesson);
  perform set_config('request.jwt.claims', '', true);
  select count(*) into v_after from public.xp_events
   where user_id = v_user and origin = 'learning_base';
  assert v_before = v_after, 'aula vazia creditou XP base';
  assert exists(
    select 1 from public.mission_assignments a
    join public.mission_occurrences o on o.id = a.occurrence_id
    where a.user_id = v_user and o.objective = 'complete_lessons'
      and o.period_start <= now() and o.period_end > now() and a.current_count > 0
  ), 'aula vazia nao avancou a missao de conclusao';
end;
$review$;
