-- 0004_enrollments_attempts_answers_completions.sql
-- Learning activity: enrollments, attempts, answers (full audit), completions.
--
-- Section 8.1: ALL submitted answers are stored for audit, even wrong ones.

create table if not exists public.enrollments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  status     public.enrollment_status not null default 'active',
  progress   numeric(5,2) not null default 0 check (progress >= 0 and progress <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists enrollments_user_idx on public.enrollments (user_id);
create index if not exists enrollments_course_idx on public.enrollments (course_id);

-- attempts
-- An attempt is tied to a lesson and is executed in exactly one context:
--   course context  -> course_id is set, room_id is null
--   room (sala) ctx  -> room_id is set (course_id may also be set for reference)
-- xp_earned / correct_count / total_count are computed by finalize_attempt only.
create table if not exists public.attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  lesson_id     uuid not null references public.lessons (id) on delete cascade,
  course_id     uuid references public.courses (id) on delete set null,
  room_id       uuid,  -- FK added in 0005 after rooms exists
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  xp_earned     integer not null default 0 check (xp_earned >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  total_count   integer not null default 0 check (total_count >= 0)
);

comment on column public.attempts.xp_earned is
  'Server-computed by finalize_attempt(). The client never sends a trusted XP value.';
comment on column public.attempts.room_id is
  'When set, the attempt is a ROOM-context attempt: it updates room_members internal metrics ONLY and never touches profiles.xp_global.';

create index if not exists attempts_user_idx on public.attempts (user_id);
create index if not exists attempts_lesson_idx on public.attempts (lesson_id);
create index if not exists attempts_room_idx on public.attempts (room_id);

-- answers: one row per submitted answer, kept for audit.
create table if not exists public.answers (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null references public.attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  submitted   jsonb not null default '{}'::jsonb,
  is_correct  boolean not null default false,
  xp_earned   integer not null default 0 check (xp_earned >= 0),
  created_at  timestamptz not null default now(),
  unique (attempt_id, question_id)
);

comment on column public.answers.is_correct is
  'Set by finalize_attempt() via grade_answer(). Client-submitted values are overwritten.';

create index if not exists answers_attempt_idx on public.answers (attempt_id);
create index if not exists answers_question_idx on public.answers (question_id);

-- completions: a lesson finished in a given context.
create table if not exists public.completions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  lesson_id    uuid not null references public.lessons (id) on delete cascade,
  context      text not null check (context in ('course', 'room')),
  attempt_id   uuid references public.attempts (id) on delete set null,
  completed_at timestamptz not null default now(),
  unique (user_id, lesson_id, context)
);

comment on column public.completions.context is
  'Derived by finalize_attempt from attempt.room_id: ''room'' when a room attempt, else ''course''.';

create index if not exists completions_user_idx on public.completions (user_id);
create index if not exists completions_lesson_idx on public.completions (lesson_id);
