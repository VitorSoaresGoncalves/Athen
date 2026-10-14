-- 0011_rls_policies.sql
-- Enable Row Level Security on EVERY table and define access policies.
--
-- Guiding rules:
--   * The owner of a row controls their own data.
--   * Only public + published courses (and their modules/lessons/questions) are
--     readable by other authenticated users.
--   * attempts/answers/completions are owner-scoped; grading happens through the
--     SECURITY DEFINER finalize_attempt.
--   * Rooms are visible to their educator and active members only.
--   * /crud admin access depends on role = 'admin' verified server-side via
--     public.is_admin(), NOT on merely having a session.
--
-- Policies are dropped-if-exists then created so this migration is re-runnable.

-- Helper to drop a policy if present.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  end loop;
end
$$;

-- Enable RLS on all public tables.
alter table public.profiles         enable row level security;
alter table public.courses          enable row level security;
alter table public.modules          enable row level security;
alter table public.lessons          enable row level security;
alter table public.questions        enable row level security;
alter table public.enrollments      enable row level security;
alter table public.attempts         enable row level security;
alter table public.answers          enable row level security;
alter table public.completions      enable row level security;
alter table public.rooms            enable row level security;
alter table public.room_members     enable row level security;
alter table public.announcements    enable row level security;
alter table public.missions         enable row level security;
alter table public.mission_progress enable row level security;
alter table public.friendships      enable row level security;
alter table public.notifications    enable row level security;
alter table public.medals           enable row level security;
alter table public.user_medals      enable row level security;
alter table public.reviews          enable row level security;
alter table public.comments         enable row level security;
alter table public.notebooks        enable row level security;
alter table public.notebook_pages   enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: readable by any authenticated user; owner may update own row EXCEPT
-- role (immutable via the trigger in 0012). Admins manage via is_admin().
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
create policy courses_select_public on public.courses
  for select to authenticated
  using (
    (status = 'published' and visibility = 'public')
    or creator_id = auth.uid()
    or public.is_admin()
  );

create policy courses_insert_own on public.courses
  for insert to authenticated
  with check (creator_id = auth.uid());

create policy courses_update_own on public.courses
  for update to authenticated
  using (creator_id = auth.uid() or public.is_admin())
  with check (creator_id = auth.uid() or public.is_admin());

create policy courses_delete_own on public.courses
  for delete to authenticated
  using (creator_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- modules / lessons / questions: follow the owning course's readability and
-- creator-only writes.
-- ---------------------------------------------------------------------------
create policy modules_select on public.modules
  for select to authenticated
  using (exists (
    select 1 from public.courses c
     where c.id = modules.course_id
       and ((c.status = 'published' and c.visibility = 'public')
            or c.creator_id = auth.uid() or public.is_admin())
  ));

create policy modules_write on public.modules
  for all to authenticated
  using (exists (
    select 1 from public.courses c
     where c.id = modules.course_id and (c.creator_id = auth.uid() or public.is_admin())
  ))
  with check (exists (
    select 1 from public.courses c
     where c.id = modules.course_id and (c.creator_id = auth.uid() or public.is_admin())
  ));

create policy lessons_select on public.lessons
  for select to authenticated
  using (exists (
    select 1 from public.modules m
     join public.courses c on c.id = m.course_id
     where m.id = lessons.module_id
       and ((c.status = 'published' and c.visibility = 'public')
            or c.creator_id = auth.uid() or public.is_admin())
  ));

create policy lessons_write on public.lessons
  for all to authenticated
  using (exists (
    select 1 from public.modules m
     join public.courses c on c.id = m.course_id
     where m.id = lessons.module_id and (c.creator_id = auth.uid() or public.is_admin())
  ))
  with check (exists (
    select 1 from public.modules m
     join public.courses c on c.id = m.course_id
     where m.id = lessons.module_id and (c.creator_id = auth.uid() or public.is_admin())
  ));

create policy questions_select on public.questions
  for select to authenticated
  using (exists (
    select 1 from public.lessons l
     join public.modules m on m.id = l.module_id
     join public.courses c on c.id = m.course_id
     where l.id = questions.lesson_id
       and ((c.status = 'published' and c.visibility = 'public')
            or c.creator_id = auth.uid() or public.is_admin())
  ));

create policy questions_write on public.questions
  for all to authenticated
  using (exists (
    select 1 from public.lessons l
     join public.modules m on m.id = l.module_id
     join public.courses c on c.id = m.course_id
     where l.id = questions.lesson_id and (c.creator_id = auth.uid() or public.is_admin())
  ))
  with check (exists (
    select 1 from public.lessons l
     join public.modules m on m.id = l.module_id
     join public.courses c on c.id = m.course_id
     where l.id = questions.lesson_id and (c.creator_id = auth.uid() or public.is_admin())
  ));

-- ---------------------------------------------------------------------------
-- enrollments: owner-scoped. Creating allowed only for public+published courses.
-- ---------------------------------------------------------------------------
create policy enrollments_select_own on public.enrollments
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy enrollments_insert_own on public.enrollments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.courses c
       where c.id = enrollments.course_id
         and c.status = 'published' and c.visibility = 'public'
    )
  );

create policy enrollments_update_own on public.enrollments
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy enrollments_delete_own on public.enrollments
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- attempts / answers / completions: owner-scoped. Grading is done by
-- finalize_attempt (SECURITY DEFINER) which bypasses these for writes.
-- ---------------------------------------------------------------------------
create policy attempts_select_own on public.attempts
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy attempts_insert_own on public.attempts
  for insert to authenticated with check (user_id = auth.uid());
create policy attempts_update_own on public.attempts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy answers_select_own on public.answers
  for select to authenticated
  using (exists (
    select 1 from public.attempts a
     where a.id = answers.attempt_id and (a.user_id = auth.uid() or public.is_admin())
  ));
create policy answers_insert_own on public.answers
  for insert to authenticated
  with check (exists (
    select 1 from public.attempts a
     where a.id = answers.attempt_id and a.user_id = auth.uid()
  ));
create policy answers_update_own on public.answers
  for update to authenticated
  using (exists (
    select 1 from public.attempts a
     where a.id = answers.attempt_id and a.user_id = auth.uid()
  ));

create policy completions_select_own on public.completions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- rooms: educator (owner) full control; members and the educator may read.
-- ---------------------------------------------------------------------------
create policy rooms_select on public.rooms
  for select to authenticated
  using (
    educator_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.room_members rm
       where rm.room_id = rooms.id and rm.user_id = auth.uid() and rm.status = 'active'
    )
  );

create policy rooms_insert_own on public.rooms
  for insert to authenticated with check (educator_id = auth.uid());
create policy rooms_update_own on public.rooms
  for update to authenticated
  using (educator_id = auth.uid() or public.is_admin())
  with check (educator_id = auth.uid() or public.is_admin());
create policy rooms_delete_own on public.rooms
  for delete to authenticated using (educator_id = auth.uid() or public.is_admin());

-- room_members: educator manages all; member reads own row. Self-join is done
-- through join_room() (SECURITY DEFINER), so no broad insert policy is needed.
create policy room_members_select on public.room_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.rooms r
                where r.id = room_members.room_id and r.educator_id = auth.uid())
  );

create policy room_members_educator_write on public.room_members
  for all to authenticated
  using (exists (select 1 from public.rooms r
                  where r.id = room_members.room_id and r.educator_id = auth.uid()))
  with check (exists (select 1 from public.rooms r
                       where r.id = room_members.room_id and r.educator_id = auth.uid()));

-- announcements / missions: room members read, educator writes.
create policy announcements_select on public.announcements
  for select to authenticated
  using (
    exists (select 1 from public.rooms r
             where r.id = announcements.room_id and r.educator_id = auth.uid())
    or exists (select 1 from public.room_members rm
                where rm.room_id = announcements.room_id and rm.user_id = auth.uid()
                  and rm.status = 'active')
  );
create policy announcements_write on public.announcements
  for all to authenticated
  using (exists (select 1 from public.rooms r
                  where r.id = announcements.room_id and r.educator_id = auth.uid()))
  with check (exists (select 1 from public.rooms r
                       where r.id = announcements.room_id and r.educator_id = auth.uid()));

create policy missions_select on public.missions
  for select to authenticated
  using (
    exists (select 1 from public.rooms r
             where r.id = missions.room_id and r.educator_id = auth.uid())
    or exists (select 1 from public.room_members rm
                where rm.room_id = missions.room_id and rm.user_id = auth.uid()
                  and rm.status = 'active')
  );
create policy missions_write on public.missions
  for all to authenticated
  using (exists (select 1 from public.rooms r
                  where r.id = missions.room_id and r.educator_id = auth.uid()))
  with check (exists (select 1 from public.rooms r
                       where r.id = missions.room_id and r.educator_id = auth.uid()));

-- mission_progress: member reads/updates own; educator reads all in the room.
create policy mission_progress_select on public.mission_progress
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.missions mi
                join public.rooms r on r.id = mi.room_id
                where mi.id = mission_progress.mission_id and r.educator_id = auth.uid())
  );
create policy mission_progress_write_own on public.mission_progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- friendships: either party reads; requester creates; addressee responds.
-- ---------------------------------------------------------------------------
create policy friendships_select on public.friendships
  for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid() or public.is_admin());
create policy friendships_insert on public.friendships
  for insert to authenticated with check (requester_id = auth.uid());
create policy friendships_update on public.friendships
  for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());
create policy friendships_delete on public.friendships
  for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notifications: recipient only.
-- ---------------------------------------------------------------------------
create policy notifications_select on public.notifications
  for select to authenticated using (recipient_id = auth.uid());
create policy notifications_update on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy notifications_delete on public.notifications
  for delete to authenticated using (recipient_id = auth.uid());
-- Inserts are performed by SECURITY DEFINER flows / service role (friend
-- requests, invites, etc.); no broad client insert policy.

-- ---------------------------------------------------------------------------
-- medals: read-only catalog for everyone; writes via service role / admin only.
-- ---------------------------------------------------------------------------
create policy medals_select on public.medals
  for select to authenticated using (true);
create policy medals_admin_write on public.medals
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- user_medals: owner reads own + others' featured; owner may toggle featured.
create policy user_medals_select on public.user_medals
  for select to authenticated
  using (user_id = auth.uid() or featured = true or public.is_admin());
create policy user_medals_update_own on public.user_medals
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Awarding is done by grant_medals (SECURITY DEFINER); no client insert policy.

-- ---------------------------------------------------------------------------
-- reviews: owner writes; authenticated read for published courses.
-- ---------------------------------------------------------------------------
create policy reviews_select on public.reviews
  for select to authenticated
  using (
    exists (select 1 from public.courses c
             where c.id = reviews.course_id
               and ((c.status = 'published' and c.visibility = 'public')
                    or c.creator_id = auth.uid()))
    or user_id = auth.uid()
  );
create policy reviews_write_own on public.reviews
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- comments: owner writes; authenticated read for published courses/lessons.
create policy comments_select on public.comments
  for select to authenticated
  using (
    author_id = auth.uid()
    or (course_id is not null and exists (
          select 1 from public.courses c
           where c.id = comments.course_id
             and ((c.status = 'published' and c.visibility = 'public')
                  or c.creator_id = auth.uid())))
    or (lesson_id is not null and exists (
          select 1 from public.lessons l
           join public.modules m on m.id = l.module_id
           join public.courses c on c.id = m.course_id
           where l.id = comments.lesson_id
             and ((c.status = 'published' and c.visibility = 'public')
                  or c.creator_id = auth.uid())))
  );
create policy comments_write_own on public.comments
  for all to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notebook: owner only.
-- ---------------------------------------------------------------------------
create policy notebooks_all_own on public.notebooks
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notebook_pages_all_own on public.notebook_pages
  for all to authenticated
  using (exists (select 1 from public.notebooks n
                  where n.id = notebook_pages.notebook_id and n.user_id = auth.uid()))
  with check (exists (select 1 from public.notebooks n
                       where n.id = notebook_pages.notebook_id and n.user_id = auth.uid()));
