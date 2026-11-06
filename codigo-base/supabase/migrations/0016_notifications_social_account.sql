-- 0016_notifications_social_account.sql
-- Social actions, internal notifications, notification preferences, and the
-- account deactivation/anonymization flow for FEAT-007.
--
-- notifications has NO broad client INSERT policy (see 0011); every insert is
-- done here through SECURITY DEFINER functions so a client can only create the
-- notifications that a legitimate action implies (friend request, room invite,
-- mission, course update, study reminder). Each function verifies the caller is
-- entitled to trigger it before inserting.
--
-- This migration is re-runnable (create or replace / add column if not exists).

-- ---------------------------------------------------------------------------
-- Notification preferences on profiles (persisted settings).
-- A jsonb map of notification_type -> boolean (true = deliver). Missing keys
-- default to enabled. The UI reads/writes this; the notify helpers below honor
-- it so a disabled type is simply not inserted.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.notification_preferences is
  'Per-type notification toggles: {"pedido_amizade": true, ...}. Missing key = enabled.';

-- ---------------------------------------------------------------------------
-- Internal helper: insert a notification unless the recipient disabled the type.
-- SECURITY DEFINER so it can write past the recipient-only notifications RLS.
-- Not granted to clients directly; only called by the gated functions below.
-- ---------------------------------------------------------------------------
create or replace function public.create_notification(
  p_recipient_id uuid,
  p_type         public.notification_type,
  p_title        text,
  p_message      text default null,
  p_reference_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pref jsonb;
  v_id   uuid;
begin
  if p_recipient_id is null then
    return null;
  end if;

  select notification_preferences into v_pref
    from public.profiles where id = p_recipient_id;

  -- Honor an explicit opt-out; a missing key means enabled.
  if v_pref is not null
     and (v_pref ? p_type::text)
     and (v_pref ->> p_type::text) = 'false' then
    return null;
  end if;

  insert into public.notifications (recipient_id, type, title, message, reference_id)
  values (p_recipient_id, p_type, p_title, p_message, p_reference_id)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.create_notification is
  'Internal: insert a notification honoring the recipient notification_preferences opt-out. Called only by the gated action functions.';

-- ---------------------------------------------------------------------------
-- send_study_reminder: a user nudges an accepted friend to study. Creates a
-- lembrete_estudo notification for the friend. Requires an accepted friendship.
-- ---------------------------------------------------------------------------
create or replace function public.send_study_reminder(p_friend_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me   uuid := auth.uid();
  v_name text;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if p_friend_id = v_me then
    raise exception 'Cannot remind yourself';
  end if;

  -- Only accepted friends may send reminders.
  if not exists (
    select 1 from public.friendships f
     where f.status = 'accepted'
       and ((f.requester_id = v_me and f.addressee_id = p_friend_id)
            or (f.requester_id = p_friend_id and f.addressee_id = v_me))
  ) then
    raise exception 'You can only remind your friends';
  end if;

  select coalesce(display_name, username::text) into v_name
    from public.profiles where id = v_me;

  return public.create_notification(
    p_friend_id,
    'lembrete_estudo',
    'Lembrete para estudar',
    coalesce(v_name, 'Um amigo') || ' enviou um lembrete para você estudar!',
    v_me
  );
end;
$$;

comment on function public.send_study_reminder is
  'Create a lembrete_estudo notification for an accepted friend.';

-- ---------------------------------------------------------------------------
-- notify_friend_request: on sending a friend request, notify the addressee.
-- Verifies the caller actually created a pending request to that user.
-- ---------------------------------------------------------------------------
create or replace function public.notify_friend_request(p_friendship_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me   uuid := auth.uid();
  v_name text;
  v_to   uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select addressee_id into v_to
    from public.friendships
   where id = p_friendship_id and requester_id = v_me and status = 'pending';
  if v_to is null then
    raise exception 'No matching pending request';
  end if;

  select coalesce(display_name, username::text) into v_name
    from public.profiles where id = v_me;

  return public.create_notification(
    v_to,
    'pedido_amizade',
    'Novo pedido de amizade',
    coalesce(v_name, 'Alguém') || ' quer ser seu amigo.',
    p_friendship_id
  );
end;
$$;

comment on function public.notify_friend_request is
  'Notify the addressee of a pending friend request created by the caller.';

-- ---------------------------------------------------------------------------
-- notify_room_invite: an educator added a member to their room. Notifies the
-- invited user. Verifies the caller educates the room and the target is a member.
-- ---------------------------------------------------------------------------
create or replace function public.notify_room_invite(p_room_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me        uuid := auth.uid();
  v_room_name text;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select name into v_room_name
    from public.rooms
   where id = p_room_id and educator_id = v_me;
  if v_room_name is null then
    raise exception 'Not the educator of this room';
  end if;

  if not exists (
    select 1 from public.room_members
     where room_id = p_room_id and user_id = p_user_id
  ) then
    raise exception 'Target is not a member of this room';
  end if;

  return public.create_notification(
    p_user_id,
    'convite_sala',
    'Convite para a sala',
    'Você foi adicionado(a) à sala "' || v_room_name || '".',
    p_room_id
  );
end;
$$;

comment on function public.notify_room_invite is
  'Notify a user that the room educator added them to a room.';

-- ---------------------------------------------------------------------------
-- notify_room_mission: a mission was created/updated. Notifies every active
-- member of the room. Verifies the caller educates the room.
-- ---------------------------------------------------------------------------
create or replace function public.notify_room_mission(p_mission_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me         uuid := auth.uid();
  v_room_id    uuid;
  v_title      text;
  v_count      integer := 0;
  v_member     record;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select mi.room_id, mi.title into v_room_id, v_title
    from public.missions mi
    join public.rooms r on r.id = mi.room_id
   where mi.id = p_mission_id and r.educator_id = v_me;
  if v_room_id is null then
    raise exception 'Not the educator of this mission''s room';
  end if;

  for v_member in
    select user_id from public.room_members
     where room_id = v_room_id and status = 'active' and user_id <> v_me
  loop
    perform public.create_notification(
      v_member.user_id,
      'missao',
      'Nova missão',
      'A missão "' || v_title || '" está disponível na sua sala.',
      p_mission_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.notify_room_mission is
  'Notify every active room member about a mission the educator created/updated.';

-- ---------------------------------------------------------------------------
-- notify_course_update: a course creator notifies enrolled students that the
-- course was updated. Verifies the caller owns the course. Returns the count.
-- ---------------------------------------------------------------------------
create or replace function public.notify_course_update(p_course_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me     uuid := auth.uid();
  v_title  text;
  v_count  integer := 0;
  v_stud   record;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select title into v_title
    from public.courses
   where id = p_course_id and creator_id = v_me;
  if v_title is null then
    raise exception 'Not the creator of this course';
  end if;

  for v_stud in
    select user_id from public.enrollments
     where course_id = p_course_id and user_id <> v_me
  loop
    perform public.create_notification(
      v_stud.user_id,
      'atualizacao_curso',
      'Curso atualizado',
      'O curso "' || v_title || '" recebeu uma atualização.',
      p_course_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.notify_course_update is
  'Notify enrolled students that the course creator updated the course.';

-- ---------------------------------------------------------------------------
-- deactivate_account: soft-delete. Marks the profile deactivated and scrubs
-- PII (display name, bio, avatar/banner, anonymizes username). Does NOT hard
-- cascade-delete the user's content so data integrity (attempts, courses,
-- room history) is preserved. Only the owner may deactivate their own account.
-- ---------------------------------------------------------------------------
create or replace function public.deactivate_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me  uuid := auth.uid();
  v_tag text;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  v_tag := 'deleted_' || substr(replace(v_me::text, '-', ''), 1, 10);

  update public.profiles
     set account_status = 'deactivated',
         username       = v_tag,
         display_name   = 'Usuário removido',
         bio            = null,
         avatar_url     = null,
         banner_url     = null
   where id = v_me;

  -- Clean up pending social state without destroying history.
  update public.friendships
     set status = 'cancelled', responded_at = now()
   where (requester_id = v_me or addressee_id = v_me)
     and status = 'pending';

  -- Remove the user from active room rosters (history retained via removed).
  update public.room_members
     set status = 'removed', removed_at = now()
   where user_id = v_me and status = 'active';
end;
$$;

comment on function public.deactivate_account is
  'Soft account deletion: set account_status=deactivated and scrub PII. No hard cascade; attempts/courses/room history are preserved for integrity.';

-- ---------------------------------------------------------------------------
-- search_profiles: look up users for the friends/user-search UI. Returns active
-- profiles whose username or display_name matches the query. SECURITY DEFINER
-- is unnecessary (profiles are readable by any authenticated user), so this is a
-- plain SQL function running with the caller's RLS.
-- ---------------------------------------------------------------------------
create or replace function public.search_profiles(p_query text)
returns table (
  id           uuid,
  username     text,
  display_name text,
  avatar_url   text,
  level        integer
)
language sql
stable
set search_path = public
as $$
  select p.id, p.username::text, p.display_name, p.avatar_url, p.level
    from public.profiles p
   where p.account_status = 'active'
     and p.id <> auth.uid()
     and (p.username::text ilike '%' || p_query || '%'
          or p.display_name ilike '%' || p_query || '%')
   order by p.username
   limit 20;
$$;

comment on function public.search_profiles is
  'User search for the friends UI: active profiles matching username/display_name (excludes the caller).';

-- ---------------------------------------------------------------------------
-- Grants: expose the gated action functions to authenticated clients. The
-- internal create_notification helper is intentionally NOT granted.
-- ---------------------------------------------------------------------------
grant execute on function public.send_study_reminder(uuid)      to authenticated;
grant execute on function public.notify_friend_request(uuid)    to authenticated;
grant execute on function public.notify_room_invite(uuid, uuid) to authenticated;
grant execute on function public.notify_room_mission(uuid)      to authenticated;
grant execute on function public.notify_course_update(uuid)     to authenticated;
grant execute on function public.deactivate_account()           to authenticated;
grant execute on function public.search_profiles(text)          to authenticated;

revoke execute on function public.create_notification(uuid, public.notification_type, text, text, uuid) from authenticated;
