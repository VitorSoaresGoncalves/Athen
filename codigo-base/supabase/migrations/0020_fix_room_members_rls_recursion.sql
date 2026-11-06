-- 0020_fix_room_members_rls_recursion.sql
-- Fix the Salas error: "infinite recursion detected in policy for relation
-- room_members [42P17]".
--
-- Root cause (see 0011_rls_policies.sql, refined by 0015_rankings.sql):
--   * rooms_select (0011) has an INLINE "exists (select 1 from room_members ...)"
--     subquery. Reading room_members inside that subquery triggers RLS on
--     room_members, i.e. the room_members_select policy.
--   * room_members_select (re-created in 0015) has an INLINE
--     "exists (select 1 from rooms r where r.educator_id = auth.uid())"
--     subquery. Reading rooms inside that subquery triggers RLS on rooms, i.e.
--     the rooms_select policy.
--   Each policy's cross-table subquery re-enters the OTHER table's policy, which
--   re-enters the first one. Postgres detects the cycle and aborts with 42P17.
--
-- Fix: break the cycle with SECURITY DEFINER helper functions that read the
-- membership / educator fact WITHOUT triggering RLS (a SECURITY DEFINER function
-- runs with the owner's rights and bypasses the caller's row-level policies),
-- then rewrite rooms_select and room_members_select to call the helpers instead
-- of the inline cross-table EXISTS. This mirrors the existing patterns:
--   * public.is_admin()               (0010_domain_functions.sql)
--   * public.is_active_room_member()  (0015_rankings.sql)
--
-- Scope / NOT part of the recursion:
--   * announcements_select and missions_select (0011) also contain an inline
--     "exists (select 1 from room_members ...)" subquery, but they are defined
--     on the announcements / missions tables - NOT on rooms and NOT on
--     room_members - so they are a single-direction read into room_members and
--     do NOT form a mutual rooms <-> room_members cycle. They are intentionally
--     left UNCHANGED by this migration. For defensive consistency and to avoid
--     any future re-entrancy through room_members_select, their room_members
--     reads are additionally rewritten below to use public.is_room_member();
--     this is behavior-preserving (same membership fact) and documented inline.
--
-- Re-runnable: functions use "create or replace"; policies are
-- "drop policy if exists" then "create policy".
--
-- ENVIRONMENT NOTE: this SQL could NOT be executed or verified in the sandbox
-- (there is no live Supabase here). It was validated by structural / logical
-- review only and MUST be applied and verified by a human against a real
-- Supabase database (supabase db reset / supabase db push, or the SQL editor,
-- applied in filename order after 0019).

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helper functions (mirror public.is_admin() style exactly:
-- language sql; stable; security definer; set search_path = public).
-- ---------------------------------------------------------------------------

-- True when the given user is an ACTIVE member of the given room. SECURITY
-- DEFINER so policies on room_members / rooms can test membership without
-- re-entering room_members RLS (which would recurse).
create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members rm
     where rm.room_id = p_room_id
       and rm.user_id = p_user_id
       and rm.status = 'active'
  );
$$;

comment on function public.is_room_member(uuid, uuid) is
  'True when p_user_id is an active member of p_room_id. SECURITY DEFINER so RLS policies on rooms/room_members can test membership without recursion (fixes 42P17).';

-- True when the given user is the educator (owner) of the given room. SECURITY
-- DEFINER so policies on room_members can test room ownership without
-- re-entering rooms RLS (which would recurse back into room_members).
create or replace function public.is_room_educator(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms r
     where r.id = p_room_id
       and r.educator_id = p_user_id
  );
$$;

comment on function public.is_room_educator(uuid, uuid) is
  'True when p_user_id is the educator/owner of p_room_id. SECURITY DEFINER so RLS policies on room_members can test room ownership without recursion (fixes 42P17).';

-- Expose the helpers to authenticated clients (consistent with how domain
-- functions in 0014/0015/0016 are granted).
grant execute on function public.is_room_member(uuid, uuid)   to authenticated;
grant execute on function public.is_room_educator(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rewrite the two mutually recursive policies to call the helpers instead of
-- inline cross-table EXISTS. Behavior is preserved:
--   * rooms_select: educator OR admin OR active member of the room.
--   * room_members_select: own row OR admin OR room educator OR (preserved from
--     0015) active member of the same room sees the roster.
-- ---------------------------------------------------------------------------

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms
  for select to authenticated
  using (
    educator_id = auth.uid()
    or public.is_admin()
    or public.is_room_member(rooms.id, auth.uid())
  );

drop policy if exists room_members_select on public.room_members;
create policy room_members_select on public.room_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_room_educator(room_members.room_id, auth.uid())
    -- Preserved from 0015: active members of the same room can read the full
    -- roster (ranking / PAC). is_active_room_member is SECURITY DEFINER too.
    or public.is_active_room_member(room_members.room_id)
  );

-- ---------------------------------------------------------------------------
-- Defensive consistency rewrite (NOT part of the rooms <-> room_members cycle):
-- announcements_select and missions_select read room_members inline. Replace
-- those reads with public.is_room_member() so they never re-enter room_members
-- RLS. This is behavior-preserving (same active-membership fact) and keeps the
-- room_members read path uniformly routed through the SECURITY DEFINER helper.
-- The educator read path keeps its inline rooms EXISTS: these policies are on
-- announcements / missions (not rooms), so reading rooms here does not form a
-- cycle; the inline check is left as-is to minimize the diff.
-- ---------------------------------------------------------------------------

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated
  using (
    exists (select 1 from public.rooms r
             where r.id = announcements.room_id and r.educator_id = auth.uid())
    or public.is_room_member(announcements.room_id, auth.uid())
  );

drop policy if exists missions_select on public.missions;
create policy missions_select on public.missions
  for select to authenticated
  using (
    exists (select 1 from public.rooms r
             where r.id = missions.room_id and r.educator_id = auth.uid())
    or public.is_room_member(missions.room_id, auth.uid())
  );
