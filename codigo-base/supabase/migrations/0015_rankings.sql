-- 0015_rankings.sql
-- Read helpers for the gamification rankings (FEAT-006 / spec sections 8, Fase 7).
--
-- Authority note: these are READ-ONLY aggregations over the server-authoritative
-- tables (profiles / attempts / completions / friendships). They compute no XP;
-- they only expose values already granted server-side so the UI can render
-- rankings without weakening RLS on owner-scoped tables (attempts/completions).
--
-- NO weekly period / reset / cron / scheduled job anywhere. Global ranking is a
-- simple all-time ordering by xp_global; the room ranking is read directly from
-- room_members.xp_internal by the client (RLS already scopes it to the room).

-- ===========================================================================
-- global_ranking: all-time leaderboard by global XP. Readable by any
-- authenticated user (same visibility as the already-public profiles select
-- policy). A plain view inherits the caller's RLS, and profiles are readable by
-- every authenticated user, so no SECURITY DEFINER is required here.
-- ===========================================================================
create or replace view public.global_ranking as
  select
    p.id            as user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.xp_global,
    p.level,
    p.streak_count,
    rank() over (order by p.xp_global desc, p.created_at asc) as position
  from public.profiles p
  where p.account_status = 'active';

comment on view public.global_ranking is
  'All-time global leaderboard ordered by xp_global (no weekly period/reset). Inherits profiles RLS: readable by any authenticated user.';

-- Explicit read grant (mirrors the function-grant style in 0014). The view
-- enforces the caller's RLS on profiles via security_invoker.
alter view public.global_ranking set (security_invoker = true);
grant select on public.global_ranking to authenticated;

-- ===========================================================================
-- friends_course_pac(p_course_id): for the authenticated user, return each
-- accepted friend's PAC/division FOR A SPECIFIC COURSE (course-context attempts
-- only), plus the caller's own value. This is the "friends ranking by PAC per
-- course" from the spec (NOT global XP, NO weekly period).
--
-- SECURITY DEFINER so it can read friends' owner-scoped attempts, but it ONLY
-- ever discloses rows for the caller and their accepted friends, and only the
-- aggregate PAC (never raw answers). PAC uses the same public.pac() the server
-- grading uses, so values match everywhere.
-- ===========================================================================
create or replace function public.friends_course_pac(p_course_id uuid)
returns table (
  user_id      uuid,
  username     text,
  display_name text,
  avatar_url   text,
  is_self      boolean,
  correct      integer,
  total        integer,
  pac          numeric,
  division     text
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as uid
  ),
  friend_ids as (
    -- The caller plus every accepted-friendship counterpart.
    select (select uid from me) as id
    union
    select case when f.requester_id = (select uid from me)
                then f.addressee_id else f.requester_id end
      from public.friendships f
     where f.status = 'accepted'
       and ((select uid from me) in (f.requester_id, f.addressee_id))
  ),
  agg as (
    select
      a.user_id,
      coalesce(sum(a.correct_count), 0)::integer as correct,
      coalesce(sum(a.total_count), 0)::integer   as total
    from public.attempts a
    where a.course_id = p_course_id
      and a.room_id is null            -- COURSE context only (never room XP)
      and a.finished_at is not null
      and a.user_id in (select id from friend_ids where id is not null)
    group by a.user_id
  )
  select
    p.id as user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    (p.id = (select uid from me)) as is_self,
    coalesce(ag.correct, 0) as correct,
    coalesce(ag.total, 0)   as total,
    public.pac(coalesce(ag.correct, 0), coalesce(ag.total, 0)) as pac,
    public.division_for_pac(
      public.pac(coalesce(ag.correct, 0), coalesce(ag.total, 0))
    ) as division
  from public.profiles p
  join friend_ids fi on fi.id = p.id
  left join agg ag on ag.user_id = p.id
  where fi.id is not null
  order by pac desc, p.display_name asc;
$$;

comment on function public.friends_course_pac(uuid) is
  'Per-course PAC/division for the caller and their accepted friends (course-context attempts only; no room XP; no weekly period). SECURITY DEFINER but only exposes the caller + accepted friends.';

grant execute on function public.friends_course_pac(uuid) to authenticated;

-- ===========================================================================
-- Broaden room_members read access so ACTIVE members can see the full roster
-- (and thus the internal ranking / PAC) of rooms they belong to. The original
-- 0011 policy only let a member read their own row, which hid the roster and
-- ranking from students. The educator and admin still see everything; students
-- still cannot read members of rooms they do not belong to.
--
-- A SECURITY DEFINER helper avoids infinite recursion: a policy on room_members
-- that itself selects from room_members would recurse under RLS.
-- ===========================================================================
create or replace function public.is_active_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members rm
     where rm.room_id = p_room_id
       and rm.user_id = auth.uid()
       and rm.status = 'active'
  );
$$;

comment on function public.is_active_room_member(uuid) is
  'True when the caller is an active member of the given room. SECURITY DEFINER so RLS policies on room_members can reference membership without recursion.';

grant execute on function public.is_active_room_member(uuid) to authenticated;

drop policy if exists room_members_select on public.room_members;
create policy room_members_select on public.room_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.rooms r
                where r.id = room_members.room_id and r.educator_id = auth.uid())
    -- Active members of the same room can read the full roster (ranking/PAC).
    or public.is_active_room_member(room_members.room_id)
  );
