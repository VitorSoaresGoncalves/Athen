-- 0018_no_xp_for_already_correct.sql
-- ITEM 4 (anti-regrind): a user must NOT earn XP for a question they have
-- already answered correctly in a PRIOR finalized attempt.
--
-- This create-or-replaces public.finalize_attempt(uuid). The body is the 0010
-- definition kept byte-for-byte, with ONE addition inside the grading loop:
-- after grade_answer computes (is_correct, xp) for an answer, if the same user
-- already answered THIS question_id correctly in a different, already-finalized
-- attempt (attempts.finished_at not null, same attempts.user_id, that answer
-- is_correct = true), the awarded xp for this answer is forced to 0. The
-- is_correct flag is still recorded truthfully, so correct_count / total_count
-- continue to reflect correctness; only xp_earned (per-answer AND the summed
-- attempt xp that feeds profiles.xp_global / room_members.xp_internal) excludes
-- already-correct questions. The xp sum is accumulated here, before the
-- course/room branch, so zeroing at grade time covers BOTH contexts.
--
-- Everything else is preserved: ownership check, idempotency (side effects only
-- when finished_at was null), completion insert, enrollment boundary, streak
-- and medals. Re-runnable via create or replace.

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
  v_award_xp        integer;
  v_already_correct boolean;
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
    select ans.id as answer_id, ans.question_id, q.type, q.config, q.xp_value, ans.submitted
      from public.answers ans
      join public.questions q on q.id = ans.question_id
     where ans.attempt_id = p_attempt_id
  loop
    select * into v_graded
      from public.grade_answer(v_ans.type, v_ans.config, v_ans.submitted, v_ans.xp_value);

    v_award_xp := v_graded.xp;

    -- ANTI-REGRIND: if the user already answered THIS question correctly in a
    -- different, already-finalized attempt, award 0 XP for it now. is_correct
    -- is still recorded truthfully (so correct_count/total_count are accurate);
    -- only the XP is suppressed, and the suppression propagates to the summed
    -- attempt xp (profiles.xp_global / room_members.xp_internal) below.
    v_already_correct := exists (
      select 1
        from public.answers prev
        join public.attempts pa on pa.id = prev.attempt_id
       where prev.question_id = v_ans.question_id
         and prev.attempt_id <> p_attempt_id
         and prev.is_correct = true
         and pa.user_id = v_attempt.user_id
         and pa.finished_at is not null
    );
    if v_already_correct then
      v_award_xp := 0;
    end if;

    update public.answers
       set is_correct = v_graded.is_correct,
           xp_earned  = v_award_xp
     where id = v_ans.answer_id;

    v_total := v_total + 1;
    if v_graded.is_correct then
      v_correct := v_correct + 1;
    end if;
    v_total_xp := v_total_xp + v_award_xp;
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
  'Server authority: grades all answers and reports totals. Owner-only (or admin) despite SECURITY DEFINER. Idempotent: XP/room-XP, completion, enrollment/progress, streak and medals apply only on the FIRST finalize (finished_at was null). COURSE context credits global XP+level only for an accessible course (public+published, own, or already-enrolled); ROOM context updates room_members internal metrics only and never touches global XP. ANTI-REGRIND: a question already answered correctly in a prior finalized attempt (same user) awards 0 XP on re-answer; is_correct and correct_count still reflect correctness, only xp_earned (per-answer and the summed attempt XP) excludes already-correct questions, in both course and room contexts.';
