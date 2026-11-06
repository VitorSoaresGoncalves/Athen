-- 0017_enroll_own_course.sql
-- ITEM 1: allow a user to enroll in a course they themselves created, even when
-- that course is a draft and/or private.
--
-- The original enrollments INSERT policy (enrollments_insert_own in 0011) only
-- permitted enrolling in a course where status = 'published' AND
-- visibility = 'public'. This blocked a creator from matriculating into their
-- own private/draft course from the catalog "Criados por mim" tab.
--
-- This migration redefines ONLY that policy so a user may ALSO enroll when they
-- are the course creator (creator_id = auth.uid()), while still permitting the
-- public + published path for everyone and keeping user_id = auth.uid().
--
-- Note: finalize_attempt (0010) already credits XP for a creator's own course
-- (its enrollment boundary allows creator_id = user_id), so this change only
-- aligns the EXPLICIT enrollment path with that existing behavior.
--
-- Drop-if-exists then create so the migration is re-runnable. No other policy
-- is altered.

drop policy if exists enrollments_insert_own on public.enrollments;

create policy enrollments_insert_own on public.enrollments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.courses c
       where c.id = enrollments.course_id
         and (
           (c.status = 'published' and c.visibility = 'public')
           or c.creator_id = auth.uid()
         )
    )
  );
