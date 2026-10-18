-- 0019_course_edit_gating.sql
-- Course editability gating.
--
-- Rule (literal reading of the product requirement "cursos em rascunho possam
-- ser alterados por completo, e então publicados; cursos publicados possam
-- receber adições de novos módulos, mas conteúdos anteriores não podem ser
-- alterados"):
--
--   * A DRAFT course is fully mutable by its creator (insert/update/delete of
--     any module/lesson/question).
--   * A PUBLISHED course may receive NEW modules (and new lessons/questions
--     WITHIN those new modules), but every piece of content that existed at or
--     before publication is IMMUTABLE: no UPDATE and no DELETE of existing
--     modules/lessons/questions, and no INSERT of lessons/questions under a
--     module that predates publication.
--   * public.is_admin() overrides all of these (matching the convention in
--     0011_rls_policies.sql).
--
-- Discriminator for "new vs existing": courses gains a nullable published_at
-- timestamptz set by a trigger when the course first becomes 'published'. A
-- module is "new" (and therefore editable while the course is published) when
-- modules.created_at > courses.published_at. A null published_at (course never
-- published / draft) means everything is new, i.e. fully editable. Lessons and
-- questions inherit their owning module's new/existing status via the join
-- chain lessons -> modules -> courses and questions -> lessons -> modules ->
-- courses.
--
-- This migration is self-contained and re-runnable:
--   * add column if not exists for courses.published_at
--   * idempotent backfill for already-published rows
--   * create or replace function + drop trigger if exists for the publish-stamp
--   * drop policy if exists before each create policy for the split write
--     policies (replacing the FOR ALL *_write policies from 0011)
--
-- NOTE: adding courses.published_at changes the generated Database shape; the
-- user must re-run `supabase gen types` after this migration is applied. The
-- client gating is driven off courses.status (already present), so no client
-- query selects published_at.

-- ---------------------------------------------------------------------------
-- 1) published_at discriminator column + backfill.
-- ---------------------------------------------------------------------------
alter table public.courses
  add column if not exists published_at timestamptz;

comment on column public.courses.published_at is
  'Timestamp the course first became published. Set by set_course_published_at(). Used by RLS write policies to distinguish modules/lessons/questions created AFTER publication (editable additions) from pre-existing, immutable content. NULL for courses that have never been published.';

-- Backfill existing published rows that predate this column. Use the best
-- available signal (updated_at, else created_at). Idempotent: only touches rows
-- that are published and not yet stamped.
update public.courses
   set published_at = coalesce(updated_at, created_at)
 where status = 'published'
   and published_at is null;

-- ---------------------------------------------------------------------------
-- 2) Trigger: (re)stamp published_at on each publish, clear it on unpublish.
--
-- Fires on INSERT (insert-as-published) and UPDATE. The publication boundary is
-- re-stamped every time status TRANSITIONS to published (draft -> published or
-- insert-as-published) and cleared whenever status moves back to a non-published
-- state. This keeps the "new vs existing" discriminator coherent across a
-- published -> draft -> published cycle: content added during a draft-again
-- window is created while published_at is NULL (so it is fully editable) and,
-- once the course is re-published, published_at advances to that moment so the
-- freshly-added content pre-dates the new boundary and becomes immutable just
-- like any other pre-existing content. A re-stamp never moves the boundary
-- backwards because it only fires on the draft -> published transition, not on
-- an idempotent published -> published update.
-- ---------------------------------------------------------------------------
create or replace function public.set_course_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' then
    -- (Re)stamp only on the transition INTO published: on INSERT old is null;
    -- on UPDATE only when the row was not already published. An idempotent
    -- published -> published update leaves the existing boundary intact.
    if tg_op = 'INSERT' or old.status is distinct from 'published' then
      new.published_at := now();
    end if;
  else
    -- Any non-published status (e.g. unpublish back to draft) clears the
    -- boundary so a later re-publish re-stamps it from scratch.
    new.published_at := null;
  end if;
  return new;
end;
$$;

comment on function public.set_course_published_at() is
  'BEFORE INSERT OR UPDATE on public.courses: stamps published_at := now() on each transition into published (insert-as-published or draft->published) and clears it whenever status is not published, so a published->draft->published cycle re-stamps the boundary coherently.';

drop trigger if exists set_course_published_at on public.courses;
create trigger set_course_published_at
  before insert or update on public.courses
  for each row execute function public.set_course_published_at();

-- ---------------------------------------------------------------------------
-- 3) Split write policies for modules / lessons / questions.
--
-- These REPLACE the FOR ALL *_write policies from 0011 with granular
-- INSERT / UPDATE / DELETE policies. The *_select policies from 0011 are left
-- untouched. is_admin() short-circuits every policy below.
--
-- Helpers inlined per policy (no SQL functions) to mirror 0011's style.
--   draft course + creator      -> fully writable
--   published course + creator  -> INSERT new modules; INSERT lessons/questions
--                                  only under modules created after published_at
--   admin                       -> everything
-- ---------------------------------------------------------------------------

-- modules -------------------------------------------------------------------
drop policy if exists modules_write on public.modules;
drop policy if exists modules_insert on public.modules;
drop policy if exists modules_update on public.modules;
drop policy if exists modules_delete on public.modules;

-- INSERT: a new module is allowed for the creator whether the course is draft
-- OR published (adding modules to a published course is explicitly permitted),
-- and always for admins.
create policy modules_insert on public.modules
  for insert to authenticated
  with check (exists (
    select 1 from public.courses c
     where c.id = modules.course_id
       and (
         public.is_admin()
         or (c.creator_id = auth.uid() and c.status in ('draft', 'published'))
       )
  ));

-- UPDATE: only draft-course content is mutable by the creator; admin overrides.
create policy modules_update on public.modules
  for update to authenticated
  using (exists (
    select 1 from public.courses c
     where c.id = modules.course_id
       and (public.is_admin() or (c.creator_id = auth.uid() and c.status = 'draft'))
  ))
  with check (exists (
    select 1 from public.courses c
     where c.id = modules.course_id
       and (public.is_admin() or (c.creator_id = auth.uid() and c.status = 'draft'))
  ));

-- DELETE: only draft-course content is removable by the creator; admin overrides.
create policy modules_delete on public.modules
  for delete to authenticated
  using (exists (
    select 1 from public.courses c
     where c.id = modules.course_id
       and (public.is_admin() or (c.creator_id = auth.uid() and c.status = 'draft'))
  ));

-- lessons -------------------------------------------------------------------
drop policy if exists lessons_write on public.lessons;
drop policy if exists lessons_insert on public.lessons;
drop policy if exists lessons_update on public.lessons;
drop policy if exists lessons_delete on public.lessons;

-- INSERT: allowed for a draft course, OR for a published course only when the
-- owning module is NEW (module.created_at > course.published_at). Admin always.
create policy lessons_insert on public.lessons
  for insert to authenticated
  with check (exists (
    select 1 from public.modules m
     join public.courses c on c.id = m.course_id
     where m.id = lessons.module_id
       and (
         public.is_admin()
         or (
           c.creator_id = auth.uid()
           and (
             c.status = 'draft'
             or (
               c.status = 'published'
               and (c.published_at is null or m.created_at > c.published_at)
             )
           )
         )
       )
  ));

-- UPDATE: only draft-course lessons are mutable by the creator; admin overrides.
create policy lessons_update on public.lessons
  for update to authenticated
  using (exists (
    select 1 from public.modules m
     join public.courses c on c.id = m.course_id
     where m.id = lessons.module_id
       and (public.is_admin() or (c.creator_id = auth.uid() and c.status = 'draft'))
  ))
  with check (exists (
    select 1 from public.modules m
     join public.courses c on c.id = m.course_id
     where m.id = lessons.module_id
       and (public.is_admin() or (c.creator_id = auth.uid() and c.status = 'draft'))
  ));

-- DELETE: only draft-course lessons are removable by the creator; admin overrides.
create policy lessons_delete on public.lessons
  for delete to authenticated
  using (exists (
    select 1 from public.modules m
     join public.courses c on c.id = m.course_id
     where m.id = lessons.module_id
       and (public.is_admin() or (c.creator_id = auth.uid() and c.status = 'draft'))
  ));

-- questions -----------------------------------------------------------------
drop policy if exists questions_write on public.questions;
drop policy if exists questions_insert on public.questions;
drop policy if exists questions_update on public.questions;
drop policy if exists questions_delete on public.questions;

-- INSERT: allowed for a draft course, OR for a published course only when the
-- question's lesson belongs to a NEW module (module.created_at >
-- course.published_at). Admin always.
create policy questions_insert on public.questions
  for insert to authenticated
  with check (exists (
    select 1 from public.lessons l
     join public.modules m on m.id = l.module_id
     join public.courses c on c.id = m.course_id
     where l.id = questions.lesson_id
       and (
         public.is_admin()
         or (
           c.creator_id = auth.uid()
           and (
             c.status = 'draft'
             or (
               c.status = 'published'
               and (c.published_at is null or m.created_at > c.published_at)
             )
           )
         )
       )
  ));

-- UPDATE: only draft-course questions are mutable by the creator; admin overrides.
create policy questions_update on public.questions
  for update to authenticated
  using (exists (
    select 1 from public.lessons l
     join public.modules m on m.id = l.module_id
     join public.courses c on c.id = m.course_id
     where l.id = questions.lesson_id
       and (public.is_admin() or (c.creator_id = auth.uid() and c.status = 'draft'))
  ))
  with check (exists (
    select 1 from public.lessons l
     join public.modules m on m.id = l.module_id
     join public.courses c on c.id = m.course_id
     where l.id = questions.lesson_id
       and (public.is_admin() or (c.creator_id = auth.uid() and c.status = 'draft'))
  ));

-- DELETE: only draft-course questions are removable by the creator; admin overrides.
create policy questions_delete on public.questions
  for delete to authenticated
  using (exists (
    select 1 from public.lessons l
     join public.modules m on m.id = l.module_id
     join public.courses c on c.id = m.course_id
     where l.id = questions.lesson_id
       and (public.is_admin() or (c.creator_id = auth.uid() and c.status = 'draft'))
  ));
