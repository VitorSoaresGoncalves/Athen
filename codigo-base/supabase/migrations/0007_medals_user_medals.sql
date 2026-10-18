-- 0007_medals_user_medals.sql
-- Medals catalog and per-user awards.
--
-- Section 17 EXCLUSIONS: no 'Top da semana' / weekly medal, no joint streak, no
-- educator-created medals. The catalog is a fixed system set seeded in 0013.

create table if not exists public.medals (
  code        text primary key,
  name        text not null,
  description text not null,
  icon        text
);

comment on table public.medals is
  'System medal catalog. Fixed set: first_lesson, on_fire, bookworm, owl. No weekly or educator-created medals.';

create table if not exists public.user_medals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  medal_code  text not null references public.medals (code) on delete cascade,
  acquired_at timestamptz not null default now(),
  featured    boolean not null default false,
  unique (user_id, medal_code)
);

comment on column public.user_medals.featured is
  'A user may feature at most 3 medals on their profile. Enforced by enforce_max_featured_medals trigger (0012).';

create index if not exists user_medals_user_idx on public.user_medals (user_id);
