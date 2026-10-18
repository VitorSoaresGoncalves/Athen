-- 0009_notebook.sql
-- Personal notebook: a user owns notebooks, each with ordered pages.

create table if not exists public.notebooks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notebooks_user_idx on public.notebooks (user_id);

create table if not exists public.notebook_pages (
  id          uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  title       text not null,
  content     text,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists notebook_pages_notebook_idx
  on public.notebook_pages (notebook_id, position);
