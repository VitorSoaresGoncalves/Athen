-- 0005_rooms_members_announcements_missions.sql
-- Rooms (salas): isolated learning contexts owned by an educator.
--
-- Room performance (xp_internal / progress / pac_internal) is isolated per room
-- and NEVER contributes to profiles.xp_global.

create table if not exists public.rooms (
  id             uuid primary key default gen_random_uuid(),
  educator_id    uuid not null references public.profiles (id) on delete cascade,
  course_id      uuid references public.courses (id) on delete set null,
  name           text not null,
  access_code    text not null unique,
  code_active    boolean not null default true,
  pac_visibility text not null default 'members'
                   check (pac_visibility in ('members', 'educator_only', 'public')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.rooms is
  'A sala owned by an educator. Members join with a valid active access_code via join_room(). Room metrics never touch global XP.';

create index if not exists rooms_educator_idx on public.rooms (educator_id);
create index if not exists rooms_course_idx on public.rooms (course_id);

-- Now that rooms exists, wire up the attempts.room_id FK deferred from 0004.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'attempts_room_id_fkey'
  ) then
    alter table public.attempts
      add constraint attempts_room_id_fkey
      foreign key (room_id) references public.rooms (id) on delete set null;
  end if;
end
$$;

create table if not exists public.room_members (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  status       public.room_member_status not null default 'active',
  joined_at    timestamptz not null default now(),
  removed_at   timestamptz,
  xp_internal  integer not null default 0 check (xp_internal >= 0),
  progress     numeric(5,2) not null default 0 check (progress >= 0 and progress <= 100),
  pac_internal numeric(5,2) not null default 0 check (pac_internal >= 0 and pac_internal <= 100),
  unique (room_id, user_id)
);

comment on column public.room_members.xp_internal is
  'XP earned inside this room only. Updated by finalize_attempt for room-context attempts. Never added to profiles.xp_global.';

create index if not exists room_members_room_idx on public.room_members (room_id);
create index if not exists room_members_user_idx on public.room_members (user_id);

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  title      text not null,
  content    text,
  status     public.content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_room_idx on public.announcements (room_id, created_at desc);

create table if not exists public.missions (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  description text,
  deadline    timestamptz,
  reward_xp   integer not null default 0 check (reward_xp >= 0),
  min_correct integer not null default 0 check (min_correct >= 0),
  status      public.content_status not null default 'published',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists missions_room_idx on public.missions (room_id);

create table if not exists public.mission_progress (
  id         uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  progress   numeric(5,2) not null default 0 check (progress >= 0 and progress <= 100),
  completed  boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (mission_id, user_id)
);

create index if not exists mission_progress_mission_idx on public.mission_progress (mission_id);
create index if not exists mission_progress_user_idx on public.mission_progress (user_id);
