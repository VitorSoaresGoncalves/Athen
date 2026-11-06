-- 0006_social_friendships_notifications.sql
-- Social graph: friendships and notifications.

create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       public.friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

comment on table public.friendships is
  'Directed friend request. The requester creates; the addressee responds (accept/decline). Uniqueness is enforced per unordered pair by friendships_pair_uidx.';

-- Enforce a single friendship per unordered pair regardless of direction.
create unique index if not exists friendships_pair_uidx on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type         public.notification_type not null,
  title        text not null,
  message      text,
  reference_id uuid,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

comment on column public.notifications.reference_id is
  'Optional id of the referenced entity (friendship, room, mission, course) depending on type.';

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, is_read, created_at desc);
