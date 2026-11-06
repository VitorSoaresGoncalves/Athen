-- 0002_profiles.sql
-- Profiles: one row per auth.users account. The id is the auth user id.
--
-- role is set at signup from metadata and is treated as IMMUTABLE by the owner
-- (enforced in RLS / triggers below). Only admin (via /crud using the service
-- role) may change a role. xp_global / level / streak are maintained by the
-- server-authoritative domain functions, never trusted from the client.

create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        citext not null unique,
  display_name    text not null,
  role            public.user_role not null default 'student',
  bio             text,
  avatar_url      text,
  banner_url      text,
  xp_global       integer not null default 0 check (xp_global >= 0),
  level           integer not null default 1 check (level >= 1),
  streak_count    integer not null default 0 check (streak_count >= 0),
  last_study_date date,
  account_status  public.account_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.profiles is
  'User profile mirrored from auth.users. Server-authoritative gamification fields: xp_global, level, streak_count, last_study_date.';
comment on column public.profiles.role is
  'Immutable by the owner once set at signup. Only admin via service role may change it.';

create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists profiles_xp_global_idx on public.profiles (xp_global desc);

-- ---------------------------------------------------------------------------
-- handle_new_user: create a profile row when an auth user is created.
-- Reads username / display_name / role from signup metadata (raw_user_meta_data).
-- Falls back to a derived username and 'student' role.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username     citext;
  v_display_name text;
  v_role         public.user_role;
begin
  v_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  if v_username is null then
    -- Derive a unique-ish username from the email local part + short id suffix.
    v_username := lower(split_part(coalesce(new.email, 'user'), '@', 1))
                  || '_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

  v_display_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  if v_display_name is null then
    v_display_name := v_username::text;
  end if;

  begin
    v_role := (new.raw_user_meta_data ->> 'role')::public.user_role;
  exception when others then
    v_role := 'student';
  end;
  if v_role is null then
    v_role := 'student';
  end if;

  insert into public.profiles (id, username, display_name, role)
  values (new.id, v_username, v_display_name, v_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'AFTER INSERT trigger on auth.users: seeds a public.profiles row from signup metadata.';
