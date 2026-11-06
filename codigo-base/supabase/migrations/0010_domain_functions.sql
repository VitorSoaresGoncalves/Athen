-- 0010_domain_functions.sql
-- SERVER-AUTHORITATIVE DOMAIN FUNCTIONS.
--
-- These are the single source of truth for XP, grading, PAC, level, division,
-- medals and streak. src/domain/constants.ts and src/domain/rules.ts MIRROR
-- these numbers; keep them byte-for-byte in sync.
--
-- Canonical constants (must match src/domain):
--   QUESTION_XP: match 2, multiple_choice 4, fill_blank 6, sum_alternatives 8
--   Levels: L1 0-99, L2 100-249, L3 250-499, L4 500-999, L5 1000-1999,
--           L6+ every additional +2000 (L6=2000, L7=4000, ...)
--   Divisions: Bronze 0-59, Prata 60-74, Gold 75-84, Platina 85-94, Diamante 95-100
--   PAC = correct/total*100 (0 when total 0)
--
-- NO weekly/period/reset/cron logic anywhere.

-- ===========================================================================
-- (b) xp_from_question(type): base XP for a correct answer, by type.
-- ===========================================================================
create or replace function public.xp_from_question(p_type public.question_type)
returns integer
language sql
immutable
as $$
  select case p_type
    when 'match'            then 2
    when 'multiple_choice'  then 4
    when 'fill_blank'       then 6
    when 'sum_alternatives' then 8
  end;
$$;

-- ===========================================================================
-- (c) level_for_xp(xp): mirrors rules.ts levelForXp EXACTLY.
-- ===========================================================================
create or replace function public.level_for_xp(p_xp integer)
returns integer
language sql
immutable
as $$
  select case
    when p_xp is null or p_xp <= 0 then 1
    when p_xp <= 99   then 1
    when p_xp <= 249  then 2
    when p_xp <= 499  then 3
    when p_xp <= 999  then 4
    when p_xp <= 1999 then 5
    -- L6 at 2000, L7 at 4000, ... : 6 + floor((xp - 2000) / 2000)
    else 6 + floor((p_xp - 2000) / 2000)::integer
  end;
$$;

-- ===========================================================================
-- (c) pac(correct, total): correct/total*100, 0 when total 0.
-- ===========================================================================
create or replace function public.pac(p_correct integer, p_total integer)
returns numeric
language sql
immutable
as $$
  select case
    when p_total is null or p_total <= 0 then 0::numeric
    else (greatest(coalesce(p_correct, 0), 0)::numeric / p_total::numeric) * 100
  end;
$$;

-- ===========================================================================
-- (c) division_for_pac(pac): mirrors rules.ts divisionForPac EXACTLY.
-- Returns the Portuguese division label used across the UI.
-- ===========================================================================
create or replace function public.division_for_pac(p_pac numeric)
returns text
language sql
immutable
as $$
  select case
    when p_pac is null or p_pac < 60 then 'Bronze'
    when p_pac <= 74 then 'Prata'
    when p_pac <= 84 then 'Gold'
    when p_pac <= 94 then 'Platina'
    else 'Diamante'   -- 95..100 (and clamps above)
  end;
$$;

-- ===========================================================================
-- normalize_fill_blank(text): lower + unaccent + trim + collapse whitespace.
-- Mirrors rules.ts normalizeFillBlank().
-- ===========================================================================
create or replace function public.normalize_fill_blank(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
           btrim(lower(public.unaccent(coalesce(p_text, '')))),
           '\s+', ' ', 'g'
         );
$$;

-- ===========================================================================
-- (a) grade_answer(type, config, submitted) -> (is_correct, xp)
-- Implements grading per type. XP is based on the question's own xp_value, which
-- the caller passes via config->>'_xp_value' OR falls back to xp_from_question.
-- To keep the grader self-contained we accept xp_value as a 4th argument.
-- ===========================================================================
create or replace function public.grade_answer(
  p_type      public.question_type,
  p_config    jsonb,
  p_submitted jsonb,
  p_xp_value  integer
)
returns table (is_correct boolean, xp integer)
language plpgsql
immutable
as $$
declare
  v_base_xp integer := coalesce(p_xp_value, public.xp_from_question(p_type));
begin
  if p_type = 'match' then
    declare
      v_total   integer := 0;
      v_correct integer := 0;
      v_pair    jsonb;
      v_sub     jsonb;
      v_matched boolean;
    begin
      for v_pair in
        select * from jsonb_array_elements(coalesce(p_config -> 'pairs', '[]'::jsonb))
      loop
        v_total := v_total + 1;
        v_matched := false;
        for v_sub in
          select * from jsonb_array_elements(coalesce(p_submitted -> 'pairs', '[]'::jsonb))
        loop
          if (v_sub ->> 'left') = (v_pair ->> 'left')
             and (v_sub ->> 'right') = (v_pair ->> 'right') then
            v_matched := true;
            exit;
          end if;
        end loop;
        if v_matched then
          v_correct := v_correct + 1;
        end if;
      end loop;

      if v_total = 0 then
        is_correct := false;
        xp := 0;
      else
        -- Proportional partial XP by correct pairs (floored).
        is_correct := (v_correct = v_total);
        xp := floor(v_base_xp::numeric * v_correct / v_total)::integer;
      end if;
      return next;
      return;
    end;

  elsif p_type = 'multiple_choice' then
    declare
      v_correct_ids text[];
      v_selected    text[];
    begin
      select coalesce(array_agg(opt ->> 'id' order by opt ->> 'id'), '{}')
        into v_correct_ids
        from jsonb_array_elements(coalesce(p_config -> 'options', '[]'::jsonb)) opt
       where (opt ->> 'correct')::boolean is true;

      select coalesce(array_agg(sel order by sel), '{}')
        into v_selected
        from jsonb_array_elements_text(coalesce(p_submitted -> 'selected', '[]'::jsonb)) sel;

      -- Exact set match: no extras, no missing. All-or-nothing.
      is_correct := (v_correct_ids = v_selected) and array_length(v_correct_ids, 1) is not null;
      xp := case when is_correct then v_base_xp else 0 end;
      return next;
      return;
    end;

  elsif p_type = 'fill_blank' then
    declare
      v_norm_submitted text := public.normalize_fill_blank(p_submitted ->> 'text');
      v_hit integer;
    begin
      select count(*)
        into v_hit
        from jsonb_array_elements_text(coalesce(p_config -> 'answers', '[]'::jsonb)) ans
       where public.normalize_fill_blank(ans) = v_norm_submitted;

      is_correct := (v_hit > 0);
      xp := case when is_correct then v_base_xp else 0 end;
      return next;
      return;
    end;

  elsif p_type = 'sum_alternatives' then
    declare
      v_expected   numeric;
      v_submitted  numeric;
    begin
      -- Expected = explicit config.expected if present, else sum of correct values.
      if (p_config ? 'expected') and (p_config ->> 'expected') is not null then
        v_expected := (p_config ->> 'expected')::numeric;
      else
        select coalesce(sum((st ->> 'value')::numeric), 0)
          into v_expected
          from jsonb_array_elements(coalesce(p_config -> 'statements', '[]'::jsonb)) st
         where (st ->> 'correct')::boolean is true;
      end if;

      begin
        v_submitted := (p_submitted ->> 'sum')::numeric;
      exception when others then
        v_submitted := null;
      end;

      is_correct := (v_submitted is not null and v_submitted = v_expected);
      xp := case when is_correct then v_base_xp else 0 end;
      return next;
      return;
    end;

  else
    is_correct := false;
    xp := 0;
    return next;
    return;
  end if;
end;
$$;

-- ===========================================================================
-- (f) touch_streak(user_id): America/Sao_Paulo, one-day tolerance, no recovery.
--   same day              -> no change
--   exactly next day      -> streak_count + 1
--   gap > 1 day (or first)-> streak_count = 1
-- ===========================================================================
create or replace function public.touch_streak(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_last  date;
begin
  select last_study_date into v_last
    from public.profiles where id = p_user_id for update;

  if v_last is null then
    update public.profiles
       set streak_count = 1, last_study_date = v_today, updated_at = now()
     where id = p_user_id;
  elsif v_last = v_today then
    -- already counted today; no change
    null;
  elsif v_last = v_today - 1 then
    update public.profiles
       set streak_count = streak_count + 1, last_study_date = v_today, updated_at = now()
     where id = p_user_id;
  else
    -- gap larger than one day: reset to 1 (no recovery)
    update public.profiles
       set streak_count = 1, last_study_date = v_today, updated_at = now()
     where id = p_user_id;
  end if;
end;
$$;

-- ===========================================================================
-- (e) grant_medals(user_id): apply the 4 medal rules idempotently.
--   first_lesson -> >= 1 completion
--   on_fire      -> streak_count >= 7
--   bookworm     -> >= 5 courses completed (enrollments.status = 'completed')
--   owl          -> >= 10 lessons completed (distinct completions)
-- ===========================================================================
create or replace function public.grant_medals(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completions     integer;
  v_streak          integer;
  v_courses_done    integer;
begin
  select count(distinct lesson_id) into v_completions
    from public.completions where user_id = p_user_id;

  select streak_count into v_streak
    from public.profiles where id = p_user_id;

  select count(*) into v_courses_done
    from public.enrollments
   where user_id = p_user_id and status = 'completed';

  -- first_lesson
  if v_completions >= 1 then
    insert into public.user_medals (user_id, medal_code)
    values (p_user_id, 'first_lesson')
    on conflict (user_id, medal_code) do nothing;
  end if;

  -- on_fire (streak 7)
  if coalesce(v_streak, 0) >= 7 then
    insert into public.user_medals (user_id, medal_code)
    values (p_user_id, 'on_fire')
    on conflict (user_id, medal_code) do nothing;
  end if;

  -- bookworm (5 courses completed)
  if v_courses_done >= 5 then
    insert into public.user_medals (user_id, medal_code)
    values (p_user_id, 'bookworm')
    on conflict (user_id, medal_code) do nothing;
  end if;

  -- owl (10 lessons completed)
  if v_completions >= 10 then
    insert into public.user_medals (user_id, medal_code)
    values (p_user_id, 'owl')
    on conflict (user_id, medal_code) do nothing;
  end if;
end;
$$;

-- ===========================================================================
-- recompute_course_progress(user_id, course_id): % of course lessons completed
-- in COURSE context. Updates enrollments.progress and marks 'completed' at 100%.
-- ===========================================================================
create or replace function public.recompute_course_progress(
  p_user_id uuid, p_course_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total     integer;
  v_done      integer;
  v_progress  numeric(5,2);
begin
  select count(*) into v_total
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_id = p_course_id;

  if v_total = 0 then
    v_progress := 0;
  else
    select count(distinct c.lesson_id) into v_done
      from public.completions c
      join public.lessons l on l.id = c.lesson_id
      join public.modules m on m.id = l.module_id
     where c.user_id = p_user_id
       and c.context = 'course'
       and m.course_id = p_course_id;

    v_progress := round((v_done::numeric / v_total::numeric) * 100, 2);
  end if;

  update public.enrollments
     set progress = v_progress,
         status = case when v_progress >= 100 then 'completed'::public.enrollment_status
                       else status end,
         updated_at = now()
   where user_id = p_user_id and course_id = p_course_id;

  return v_progress;
end;
$$;

-- ===========================================================================
-- recompute_room_metrics(room_id, user_id): recompute a member's internal
-- progress and PAC from their ROOM-context attempts. Never touches global XP.
-- ===========================================================================
create or replace function public.recompute_room_metrics(
  p_room_id uuid, p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_lessons integer;
  v_done_lessons  integer;
  v_correct       integer;
  v_total_q       integer;
  v_progress      numeric(5,2);
  v_pac           numeric(5,2);
  v_course_id     uuid;
begin
  select course_id into v_course_id from public.rooms where id = p_room_id;

  -- Progress: distinct lessons completed in this room / lessons in the room's course.
  if v_course_id is null then
    v_progress := 0;
  else
    select count(*) into v_total_lessons
      from public.lessons l
      join public.modules m on m.id = l.module_id
     where m.course_id = v_course_id;

    select count(distinct a.lesson_id) into v_done_lessons
      from public.attempts a
     where a.room_id = p_room_id and a.user_id = p_user_id
       and a.finished_at is not null;

    v_progress := case when coalesce(v_total_lessons, 0) = 0 then 0
                       else round((v_done_lessons::numeric / v_total_lessons::numeric) * 100, 2) end;
  end if;

  -- PAC: correct answers / total answers across this member's room attempts.
  select coalesce(sum(a.correct_count), 0), coalesce(sum(a.total_count), 0)
    into v_correct, v_total_q
    from public.attempts a
   where a.room_id = p_room_id and a.user_id = p_user_id
     and a.finished_at is not null;

  v_pac := public.pac(v_correct, v_total_q);

  update public.room_members
     set progress = least(v_progress, 100),
         pac_internal = v_pac
   where room_id = p_room_id and user_id = p_user_id;
end;
$$;

-- ===========================================================================
-- (d) finalize_attempt(attempt_id) SECURITY DEFINER: THE grading entrypoint.
--   - grades every stored answer via grade_answer
--   - sets attempt.correct_count / total_count / xp_earned / finished_at
--   - inserts a completion when all lesson questions have been answered
--   - COURSE context: adds xp to profiles.xp_global, recomputes level,
--                     recomputes course progress
--   - ROOM context:   updates room_members.xp_internal / progress / pac_internal
--                     ONLY; never touches global XP
--   - touches streak and grants medals
-- Returns the attempt's computed totals.
-- ===========================================================================
create or replace function public.finalize_attempt(p_attempt_id uuid)
returns table (correct_count integer, total_count integer, xp_earned integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt         public.attempts%rowtype;
  v_is_room         boolean;
  v_context         text;
  v_total_xp        integer := 0;
  v_correct         integer := 0;
  v_total           integer := 0;
  v_lesson_qcount   integer;
  v_answered        integer;
  v_course_id       uuid;
  v_already_final   boolean;
  v_course_public   boolean := false;
  v_ans             record;
  v_graded          record;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id for update;
  if not found then
    raise exception 'attempt % not found', p_attempt_id;
  end if;

  -- OWNERSHIP: although SECURITY DEFINER, only the attempt owner (or an admin)
  -- may finalize/grade an attempt. This prevents one user re-grading another's
  -- attempt or triggering writes against a victim's rows.
  if auth.uid() is not null
     and v_attempt.user_id <> auth.uid()
     and not public.is_admin() then
    raise exception 'not authorized to finalize attempt %', p_attempt_id
      using errcode = '42501';
  end if;

  -- IDEMPOTENCY: capture whether the attempt was already finalized BEFORE this
  -- call. XP/room-XP, completion side effects and progress are applied only on
  -- the first finalize so a repeated RPC cannot double-count global/room XP.
  v_already_final := v_attempt.finished_at is not null;

  v_is_room := v_attempt.room_id is not null;
  v_context := case when v_is_room then 'room' else 'course' end;

  -- Grade each stored answer against its question config.
  for v_ans in
    select ans.id as answer_id, q.type, q.config, q.xp_value, ans.submitted
      from public.answers ans
      join public.questions q on q.id = ans.question_id
     where ans.attempt_id = p_attempt_id
  loop
    select * into v_graded
      from public.grade_answer(v_ans.type, v_ans.config, v_ans.submitted, v_ans.xp_value);

    update public.answers
       set is_correct = v_graded.is_correct,
           xp_earned  = v_graded.xp
     where id = v_ans.answer_id;

    v_total := v_total + 1;
    if v_graded.is_correct then
      v_correct := v_correct + 1;
    end if;
    v_total_xp := v_total_xp + v_graded.xp;
  end loop;

  update public.attempts
     set correct_count = v_correct,
         total_count   = v_total,
         xp_earned     = v_total_xp,
         finished_at   = coalesce(finished_at, now())
   where id = p_attempt_id;

  -- The side effects below (completion, XP, enrollment/progress, streak, medals)
  -- run ONLY on the first finalize of this attempt. A repeat call re-grades and
  -- re-reports totals but does not re-award XP (idempotent authority).
  if not v_already_final then
    -- Completion: inserted when every question of the lesson has been answered.
    select count(*) into v_lesson_qcount
      from public.questions where lesson_id = v_attempt.lesson_id;

    select count(*) into v_answered
      from public.answers where attempt_id = p_attempt_id;

    if v_lesson_qcount > 0 and v_answered >= v_lesson_qcount then
      insert into public.completions (user_id, lesson_id, context, attempt_id)
      values (v_attempt.user_id, v_attempt.lesson_id, v_context, p_attempt_id)
      on conflict (user_id, lesson_id, context) do update
        set attempt_id = excluded.attempt_id, completed_at = now();
    end if;

    if v_is_room then
      -- ROOM context: internal metrics only. NEVER touch profiles.xp_global.
      update public.room_members
         set xp_internal = xp_internal + v_total_xp
       where room_id = v_attempt.room_id and user_id = v_attempt.user_id;

      perform public.recompute_room_metrics(v_attempt.room_id, v_attempt.user_id);
    else
      -- COURSE context: resolve the course from the attempt or the lesson's module.
      v_course_id := v_attempt.course_id;
      if v_course_id is null then
        select m.course_id into v_course_id
          from public.lessons l
          join public.modules m on m.id = l.module_id
         where l.id = v_attempt.lesson_id;
      end if;

      -- ENROLLMENT BOUNDARY: only auto-enroll and credit course-context global
      -- XP for a course the user may actually enroll in (public + published),
      -- or one the user already created / already enrolled in. This mirrors the
      -- enrollments_insert_own RLS policy that this SECURITY DEFINER path would
      -- otherwise bypass, so a draft/private lesson cannot self-enroll a user.
      if v_course_id is not null then
        select (c.status = 'published' and c.visibility = 'public')
               or c.creator_id = v_attempt.user_id
               or exists (
                    select 1 from public.enrollments e
                     where e.user_id = v_attempt.user_id and e.course_id = v_course_id
                  )
          into v_course_public
          from public.courses c
         where c.id = v_course_id;
      end if;

      if v_course_id is not null and coalesce(v_course_public, false) then
        -- Credit global XP + recompute level only for an accessible course.
        update public.profiles
           set xp_global = xp_global + v_total_xp,
               level = public.level_for_xp(xp_global + v_total_xp),
               updated_at = now()
         where id = v_attempt.user_id;

        -- Ensure an enrollment row exists so progress can be tracked.
        insert into public.enrollments (user_id, course_id)
        values (v_attempt.user_id, v_course_id)
        on conflict (user_id, course_id) do nothing;

        perform public.recompute_course_progress(v_attempt.user_id, v_course_id);
      end if;
    end if;

    -- Streak + medals apply to any study activity (first finalize only).
    perform public.touch_streak(v_attempt.user_id);
    perform public.grant_medals(v_attempt.user_id);
  end if;

  correct_count := v_correct;
  total_count   := v_total;
  xp_earned     := v_total_xp;
  return next;
end;
$$;

comment on function public.finalize_attempt(uuid) is
  'Server authority: grades all answers and reports totals. Owner-only (or admin) despite SECURITY DEFINER. Idempotent: XP/room-XP, completion, enrollment/progress, streak and medals apply only on the FIRST finalize (finished_at was null). COURSE context credits global XP+level only for an accessible course (public+published, own, or already-enrolled); ROOM context updates room_members internal metrics only and never touches global XP.';

-- ===========================================================================
-- join_room(access_code): self-join via a valid, active access code.
-- Returns the room_members row id. SECURITY DEFINER so a student can insert a
-- membership despite restrictive RLS.
-- ===========================================================================
create or replace function public.join_room(p_access_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id   uuid;
  v_member_id uuid;
  v_uid       uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select id into v_room_id
    from public.rooms
   where access_code = p_access_code and code_active is true;

  if v_room_id is null then
    raise exception 'invalid or inactive access code';
  end if;

  insert into public.room_members (room_id, user_id, status)
  values (v_room_id, v_uid, 'active')
  on conflict (room_id, user_id) do update
    set status = 'active', removed_at = null
  returning id into v_member_id;

  return v_member_id;
end;
$$;

-- ===========================================================================
-- is_admin(): true when the current user has role 'admin'. Used by /crud RLS.
-- ===========================================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'admin'
  );
$$;
