-- Operational anchor changes can leave overlapping historical due/expiry
-- windows. Keep those facts intact and read only the schedule's current period.
-- UNIQUE (user_id, period_index) guarantees this RPC returns at most one row.
create or replace function public.my_current_course_review()
returns table (occurrence_id uuid, period_index integer, course_id uuid, course_title text,
  state text, due_at timestamptz, expires_at timestamptz, bonus_xp integer, delivery_state text,
  resume_session_id uuid, last_finished_session_id uuid, reward_session_id uuid, rewarded_at timestamptz)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
begin
  if v_user is null then raise exception using errcode = '42501', message = 'REVIEW_FORBIDDEN'; end if;
  return query
    select d.*
    from public.course_review_schedules a
    join public.course_review_occurrences o on o.user_id = a.user_id
      and o.period_index = floor(extract(epoch from (v_now - a.anchor_at)) / 604800)::integer
    cross join lateral public.my_course_review_occurrence(o.id) d
    where a.user_id = v_user and o.due_at <= v_now and o.expires_at > v_now;
end;
$$;

revoke execute on function public.my_current_course_review() from public, anon, authenticated;
grant execute on function public.my_current_course_review() to authenticated, service_role;

comment on function public.my_current_course_review() is
  'Own current review occurrence, selected by the global schedule period; overlapping historical windows remain available through history/by-id reads.';
