-- 0008_reviews_comments.sql
-- Course reviews (ratings) and threaded comments.

create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  rating     integer not null check (rating between 0 and 5),
  comment    text,
  status     public.content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

comment on table public.reviews is
  'One rating (0..5) per user per course. Readable by authenticated users for published courses.';

create index if not exists reviews_course_idx on public.reviews (course_id);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  course_id  uuid references public.courses (id) on delete cascade,
  lesson_id  uuid references public.lessons (id) on delete cascade,
  parent_id  uuid references public.comments (id) on delete cascade,
  content    text not null,
  status     public.content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (course_id is not null or lesson_id is not null)
);

comment on table public.comments is
  'Comments attached to a course or lesson. Optional parent_id for threaded replies.';

create index if not exists comments_course_idx on public.comments (course_id);
create index if not exists comments_lesson_idx on public.comments (lesson_id);
create index if not exists comments_parent_idx on public.comments (parent_id);
