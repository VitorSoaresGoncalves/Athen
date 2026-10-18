-- 0003_courses_modules_lessons_questions.sql
-- Course content hierarchy: courses -> modules -> lessons -> questions.

create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  slug        text not null unique,
  description text,
  category    text,
  tags        text[] not null default '{}',
  cover_url   text,
  status      public.course_status not null default 'draft',
  visibility  public.course_visibility not null default 'public',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.courses is
  'A course owned by its creator. Only published + public courses are discoverable by other authenticated users (enforced by RLS).';

create index if not exists courses_creator_idx on public.courses (creator_id);
create index if not exists courses_status_visibility_idx
  on public.courses (status, visibility);

create table if not exists public.modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  title       text not null,
  description text,
  position    integer not null default 0,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists modules_course_idx on public.modules (course_id, position);

create table if not exists public.lessons (
  id         uuid primary key default gen_random_uuid(),
  module_id  uuid not null references public.modules (id) on delete cascade,
  title      text not null,
  content    text,
  position   integer not null default 0,
  status     public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lessons_module_idx on public.lessons (module_id, position);

-- ---------------------------------------------------------------------------
-- questions
--
-- config jsonb SHAPE PER TYPE (the server-authoritative grader in
-- 0010_domain_functions.sql::grade_answer reads these exact shapes; the client
-- submits an answer jsonb described alongside each):
--
-- match:
--   config    = { "pairs": [ { "left": "A", "right": "1" }, ... ] }
--   submitted = { "pairs": [ { "left": "A", "right": "1" }, ... ] }
--   Grading   = proportional partial XP: xp_value * (correct_pairs / total_pairs),
--               rounded down; is_correct when ALL pairs correct.
--
-- multiple_choice:
--   config    = { "options": [ { "id": "a", "text": "..", "correct": true }, ... ] }
--               (correct option ids = those with correct=true)
--   submitted = { "selected": ["a","c"] }
--   Grading   = exact set match of selected vs correct ids. Any extra OR missing
--               selection => wrong. NO partial XP (all-or-nothing).
--
-- fill_blank:
--   config    = { "answers": ["Paris", "paris"] }   (any accepted spelling)
--   submitted = { "text": "  PÁRIS " }
--   Grading   = normalize both sides (lower + unaccent + trim + collapse spaces);
--               correct if the submitted text matches ANY configured answer.
--               All-or-nothing.
--
-- sum_alternatives (somatória):
--   config    = { "statements": [ { "value": 1, "correct": true }, ... ],
--                 "expected": 7 }   (expected may be omitted => sum of correct values)
--   submitted = { "sum": 7 }
--   Grading   = correct if submitted.sum equals the expected numeric sum of the
--               correct statements. All-or-nothing.
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  type       public.question_type not null,
  prompt     text not null,
  position   integer not null default 0,
  config     jsonb not null default '{}'::jsonb,
  xp_value   integer not null default 0 check (xp_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.questions.config is
  'Per-type answer configuration. See table-level comment / 0010 grade_answer for the jsonb shape of each question_type.';
comment on column public.questions.xp_value is
  'Base XP for a correct answer. Defaults from xp_from_question(type): match 2, multiple_choice 4, fill_blank 6, sum_alternatives 8.';

create index if not exists questions_lesson_idx on public.questions (lesson_id, position);
