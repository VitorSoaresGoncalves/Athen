-- Reviews are not lesson attempts/completions. Only a unique occurrence reward
-- changes global XP; no mission, streak, medal or season hooks are invoked.
create table public.course_review_schedules (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  anchor_at timestamptz not null,
  anchor_source text not null check (anchor_source in ('first_completion','rollout','legacy_observed')),
  first_course_completed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((anchor_source = 'first_completion' and first_course_completed_at is not null and first_course_completed_at = anchor_at)
    or (anchor_source <> 'first_completion' and first_course_completed_at is null))
);

create table public.course_review_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.course_review_schedules(user_id) on delete cascade,
  period_index integer not null check (period_index >= 1),
  due_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > due_at),
  selection_state text not null default 'no_candidates' check (selection_state in ('no_candidates','assigned')),
  -- Historical content identifiers deliberately have no content FK.
  course_id uuid,
  course_title text,
  assigned_at timestamptz,
  bonus_xp integer not null default 0,
  sample_percent integer not null default 20 check (sample_percent = 20),
  target_percent integer not null default 70 check (target_percent = 70),
  delivery_state text not null default 'not_applicable'
    check (delivery_state in ('not_applicable','pending','delivered','suppressed','failed')),
  notification_id uuid,
  notified_at timestamptz,
  last_delivery_error text,
  reward_session_id uuid,
  rewarded_at timestamptz,
  xp_event_id uuid references public.xp_events(id),
  unique (user_id, period_index),
  unique (id, user_id, course_id),
  check ((selection_state = 'no_candidates' and course_id is null and course_title is null
      and assigned_at is null and bonus_xp = 0 and delivery_state = 'not_applicable')
    or (selection_state = 'assigned' and course_id is not null and course_title is not null
      and assigned_at is not null and bonus_xp = 10 and delivery_state <> 'not_applicable')),
  check (num_nonnulls(reward_session_id, rewarded_at, xp_event_id) in (0,3))
);

create table public.course_review_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null,
  course_title text not null,
  request_id uuid not null,
  mode text not null check (mode in ('normal','bonus')),
  occurrence_id uuid,
  expires_at timestamptz,
  bonus_xp integer not null,
  sample_percent integer not null default 20 check (sample_percent = 20),
  target_percent integer not null default 70 check (target_percent = 70),
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  correct_count integer,
  total_count integer,
  approved boolean,
  bonus_earned integer,
  bonus_outcome text check (bonus_outcome in ('not_applicable','below_target','awarded','already_awarded')),
  xp_event_id uuid references public.xp_events(id),
  unique (user_id, request_id),
  unique (id, occurrence_id),
  foreign key (occurrence_id, user_id, course_id)
    references public.course_review_occurrences(id, user_id, course_id),
  check ((mode = 'normal' and occurrence_id is null and expires_at is null and bonus_xp = 0)
    or (mode = 'bonus' and occurrence_id is not null and expires_at is not null and bonus_xp = 10)),
  check ((finished_at is null and num_nonnulls(correct_count,total_count,approved,bonus_earned,bonus_outcome,xp_event_id) = 0)
    or (finished_at is not null and num_nonnulls(correct_count,total_count,approved,bonus_earned,bonus_outcome) = 5
      and correct_count between 0 and total_count and total_count > 0
      and approved = (correct_count::bigint * 100 >= total_count::bigint * target_percent)
      and ((bonus_outcome = 'awarded' and mode = 'bonus' and approved and bonus_earned = 10 and xp_event_id is not null)
        or (bonus_outcome <> 'awarded' and bonus_earned = 0 and xp_event_id is null)))),
  check (bonus_outcome is null or
    (mode = 'normal' and bonus_outcome = 'not_applicable') or
    (mode = 'bonus' and ((not approved and bonus_outcome = 'below_target')
      or (approved and bonus_outcome in ('awarded','already_awarded')))))
);
alter table public.course_review_occurrences add constraint course_review_reward_session_fk
  foreign key (reward_session_id, id) references public.course_review_sessions(id, occurrence_id);
create index course_review_sessions_resume_idx
  on public.course_review_sessions(user_id, occurrence_id, started_at desc, id desc);
create index course_review_sessions_finished_idx
  on public.course_review_sessions(user_id, occurrence_id, finished_at desc, id desc)
  where finished_at is not null;

create table public.course_review_items (
  session_id uuid not null references public.course_review_sessions(id) on delete cascade,
  question_id uuid not null,
  ordinal integer not null check (ordinal > 0),
  module_id uuid not null,
  module_title text not null,
  lesson_id uuid not null,
  type public.question_type not null,
  prompt text not null,
  config jsonb not null,
  explanation text,
  submitted jsonb,
  is_correct boolean,
  answered_at timestamptz,
  primary key (session_id, question_id),
  unique (session_id, ordinal),
  check (num_nonnulls(submitted,is_correct,answered_at) in (0,3))
);

alter table public.course_review_schedules enable row level security;
alter table public.course_review_occurrences enable row level security;
alter table public.course_review_sessions enable row level security;
alter table public.course_review_items enable row level security;
create policy review_schedules_read on public.course_review_schedules
  for select to authenticated using (user_id = auth.uid());
create policy review_occurrences_read on public.course_review_occurrences
  for select to authenticated using (user_id = auth.uid());
create policy review_sessions_read on public.course_review_sessions
  for select to authenticated using (user_id = auth.uid());
create policy review_items_read on public.course_review_items
  for select to authenticated using (exists (
    select 1 from public.course_review_sessions s where s.id = session_id and s.user_id = auth.uid()
  ));
revoke all on public.course_review_schedules, public.course_review_occurrences,
  public.course_review_sessions, public.course_review_items from public, anon, authenticated;
grant select on public.course_review_schedules, public.course_review_occurrences,
  public.course_review_sessions, public.course_review_items to authenticated;
grant all on public.course_review_schedules, public.course_review_occurrences,
  public.course_review_sessions, public.course_review_items to service_role;

-- Remove broad AND preexisting column UPDATE grants before whitelisting.
revoke update on public.profiles, public.notifications from public, anon, authenticated;
do $$
declare t text; cols text;
begin
  foreach t in array array['profiles','notifications'] loop
    select string_agg(quote_ident(attname), ',') into cols
      from pg_attribute where attrelid = ('public.' || t)::regclass
        and attnum > 0 and not attisdropped;
    execute format('revoke update (%s) on public.%I from public, anon, authenticated', cols, t);
  end loop;
end $$;
grant update (username,display_name,bio,avatar_url,banner_url,notification_preferences)
  on public.profiles to authenticated;
grant update (is_read) on public.notifications to authenticated;
revoke execute on function public.create_notification(uuid,public.notification_type,text,text,uuid)
  from public, anon, authenticated;

-- All review mutations share a transaction-level advisory lock per user.
create function public.course_review_lock(p_user_id uuid) returns void
language sql security definer set search_path = pg_catalog, public
as $$ select pg_advisory_xact_lock(hashtextextended('course-review:' || p_user_id::text, 0)); $$;

create function public.course_review_readable(p_user_id uuid, p_course_id uuid) returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.courses c join public.profiles p on p.id = p_user_id
    where c.id = p_course_id and
      ((c.status = 'published' and c.visibility = 'public') or c.creator_id = p_user_id or p.role = 'admin')
  );
$$;

-- Completion observation cannot depend on enrollment being inserted/updated
-- first: both official lesson RPCs write completions before enrollment.
create function public.course_review_completed(p_user_id uuid, p_course_id uuid) returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select public.course_review_readable(p_user_id,p_course_id)
    and exists (select 1 from public.profiles where id = p_user_id and account_status = 'active')
    and exists (select 1 from public.courses where id = p_course_id and status = 'published')
    and exists (select 1 from public.lessons l join public.modules m on m.id = l.module_id where m.course_id = p_course_id)
    and not exists (
      select 1 from public.lessons l join public.modules m on m.id = l.module_id
      where m.course_id = p_course_id and not exists (
        select 1 from public.completions c where c.user_id = p_user_id
          and c.lesson_id = l.id and c.context = 'course'
      )
    );
$$;

create function public.course_review_eligible(p_user_id uuid, p_course_id uuid) returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select public.course_review_completed(p_user_id,p_course_id)
    and exists (select 1 from public.enrollments where user_id = p_user_id
      and course_id = p_course_id and status <> 'dropped');
$$;

create function public.course_review_status(p_course_id uuid)
returns table (course_id uuid, course_title text, can_review boolean, reason text,
  question_count integer, sample_count integer, module_counts jsonb)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_user uuid := auth.uid(); v_eligible boolean;
begin
  if v_user is null or not public.course_review_readable(v_user,p_course_id) then
    raise exception using errcode = '42501', message = 'REVIEW_FORBIDDEN';
  end if;
  v_eligible := public.course_review_eligible(v_user,p_course_id);
  return query
  with counts as (
    select m.id, count(q.id)::integer n from public.modules m
      left join public.lessons l on l.module_id = m.id
      left join public.questions q on q.lesson_id = l.id
    where m.course_id = p_course_id group by m.id
  ), totals as (
    select coalesce(sum(n),0)::integer n, coalesce(sum(ceil(n * 0.2)),0)::integer k,
      coalesce(jsonb_agg(jsonb_build_object('module_id',id,'question_count',n,
        'sample_count',ceil(n * 0.2)::integer) order by id),'[]'::jsonb) modules from counts
  )
  select c.id,c.title,v_eligible and t.n > 0,
    case when not v_eligible then 'REVIEW_NOT_ELIGIBLE' when t.n = 0 then 'REVIEW_EMPTY' end,
    t.n,t.k,t.modules from public.courses c cross join totals t where c.id = p_course_id;
end $$;

create function public.course_review_occurrence_data(p_id uuid) returns jsonb
language sql stable security definer set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'occurrence_id',o.id,'period_index',o.period_index,'course_id',o.course_id,'course_title',o.course_title,
    'state',case when o.rewarded_at is not null then 'claimed'
      when clock_timestamp() >= o.expires_at then 'expired'
      when o.course_id is null then 'no_candidates'
      when public.course_review_eligible(o.user_id,o.course_id) then 'available' else 'unavailable' end,
    'due_at',o.due_at,'expires_at',o.expires_at,'bonus_xp',o.bonus_xp,'delivery_state',o.delivery_state,
    'resume_session_id',(select s.id from public.course_review_sessions s
      where s.occurrence_id = o.id and s.user_id = o.user_id and s.finished_at is null order by s.started_at desc,s.id desc limit 1),
    'last_finished_session_id',(select s.id from public.course_review_sessions s
      where s.occurrence_id = o.id and s.user_id = o.user_id and s.finished_at is not null order by s.finished_at desc,s.id desc limit 1),
    'reward_session_id',o.reward_session_id,'rewarded_at',o.rewarded_at)
  from public.course_review_occurrences o where o.id = p_id;
$$;

create function public.my_course_review_occurrence(p_occurrence_id uuid)
returns table (occurrence_id uuid, period_index integer, course_id uuid, course_title text,
  state text, due_at timestamptz, expires_at timestamptz, bonus_xp integer, delivery_state text,
  resume_session_id uuid, last_finished_session_id uuid, reward_session_id uuid, rewarded_at timestamptz)
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.course_review_occurrences o where o.id = p_occurrence_id and o.user_id = auth.uid()
  ) then raise exception using errcode = '42501', message = 'REVIEW_FORBIDDEN'; end if;
  return query select d.* from jsonb_to_record(public.course_review_occurrence_data(p_occurrence_id)) as d(
    occurrence_id uuid, period_index integer, course_id uuid, course_title text, state text,
    due_at timestamptz, expires_at timestamptz, bonus_xp integer, delivery_state text,
    resume_session_id uuid, last_finished_session_id uuid, reward_session_id uuid, rewarded_at timestamptz);
end $$;

create function public.my_current_course_review()
returns table (occurrence_id uuid, period_index integer, course_id uuid, course_title text,
  state text, due_at timestamptz, expires_at timestamptz, bonus_xp integer, delivery_state text,
  resume_session_id uuid, last_finished_session_id uuid, reward_session_id uuid, rewarded_at timestamptz)
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'REVIEW_FORBIDDEN'; end if;
  return query select d.* from public.course_review_occurrences o
    cross join lateral public.my_course_review_occurrence(o.id) d
    where o.user_id = auth.uid() and o.due_at <= clock_timestamp() and o.expires_at > clock_timestamp();
end $$;

create function public.course_review_result(p_id uuid) returns jsonb
language sql stable security definer set search_path = pg_catalog, public
as $$
  select case when s.finished_at is not null then jsonb_build_object(
    'session_id',s.id,'correct_count',s.correct_count,'total_count',s.total_count,'approved',s.approved,
    'bonus_earned',s.bonus_earned,'bonus_outcome',s.bonus_outcome,'xp_event_id',s.xp_event_id,'finished_at',s.finished_at) end
  from public.course_review_sessions s where s.id = p_id;
$$;

create function public.course_review_validate_snapshot(p_type public.question_type,p_config jsonb)
returns void language plpgsql immutable set search_path = pg_catalog, public
as $$
declare a jsonb; x jsonb;
begin
  if jsonb_typeof(p_config) is distinct from 'object' then raise exception 'REVIEW_INVALID_SNAPSHOT'; end if;
  a := case p_type when 'match' then p_config->'pairs'
    when 'multiple_choice' then p_config->'options'
    when 'fill_blank' then p_config->'answers'
    when 'sum_alternatives' then p_config->'statements' end;
  if jsonb_typeof(a) is distinct from 'array' then raise exception 'REVIEW_INVALID_SNAPSHOT'; end if;
  if jsonb_array_length(a) = 0 then raise exception 'REVIEW_INVALID_SNAPSHOT'; end if;
  for x in select * from jsonb_array_elements(a) loop
    if p_type = 'fill_blank' then
      if jsonb_typeof(x) <> 'string' then raise exception 'REVIEW_INVALID_SNAPSHOT'; end if;
    elsif p_type = 'match' then
      if jsonb_typeof(x->'left') is distinct from 'string'
        or jsonb_typeof(x->'right') is distinct from 'string' then raise exception 'REVIEW_INVALID_SNAPSHOT'; end if;
    elsif p_type = 'multiple_choice' then
      if jsonb_typeof(x->'id') is distinct from 'string'
        or jsonb_typeof(x->'correct') is distinct from 'boolean' then raise exception 'REVIEW_INVALID_SNAPSHOT'; end if;
    else
      if jsonb_typeof(x->'value') is distinct from 'number'
        or jsonb_typeof(x->'correct') is distinct from 'boolean' then raise exception 'REVIEW_INVALID_SNAPSHOT'; end if;
    end if;
  end loop;
  if p_type = 'sum_alternatives' and p_config ? 'expected'
    and jsonb_typeof(p_config->'expected') is distinct from 'number' then
    raise exception 'REVIEW_INVALID_SNAPSHOT';
  end if;
end $$;

create function public.my_course_review(p_session_id uuid)
returns table (session_id uuid, course_id uuid, course_title text, mode text, occurrence_id uuid,
  expires_at timestamptz, bonus_xp integer, finished_at timestamptz, result jsonb, items jsonb)
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.course_review_sessions s where s.id = p_session_id and s.user_id = auth.uid()
  ) then raise exception using errcode = '42501', message = 'REVIEW_FORBIDDEN'; end if;
  return query select s.id,s.course_id,s.course_title,s.mode,s.occurrence_id,s.expires_at,s.bonus_xp,
    s.finished_at,public.course_review_result(s.id),
    (select coalesce(jsonb_agg(jsonb_build_object(
      'question_id',i.question_id,'ordinal',i.ordinal,'module_id',i.module_id,'module_title',i.module_title,
      'lesson_id',i.lesson_id,'type',i.type,'prompt',i.prompt,'config',i.config,'explanation',i.explanation,
      'submitted',i.submitted,'is_correct',i.is_correct) order by i.ordinal),'[]'::jsonb)
      from public.course_review_items i where i.session_id = s.id)
    from public.course_review_sessions s where s.id = p_session_id;
end $$;

create function public.start_course_review(p_course_id uuid, p_request_id uuid, p_occurrence_id uuid default null)
returns table (session_id uuid, course_id uuid, course_title text, mode text, occurrence_id uuid,
  expires_at timestamptz, bonus_xp integer, finished_at timestamptz, result jsonb, items jsonb)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid(); v_session public.course_review_sessions;
  v_occ public.course_review_occurrences; v_id uuid; v_now timestamptz; v_count integer;
begin
  if v_user is null then raise exception using errcode = '42501', message = 'REVIEW_FORBIDDEN'; end if;
  if p_course_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT';
  end if;
  perform public.course_review_lock(v_user);
  perform 1 from public.course_review_schedules where user_id = v_user for update;
  select s.* into v_session from public.course_review_sessions s
    where s.user_id = v_user and s.request_id = p_request_id;
  if found then
    if v_session.course_id <> p_course_id or v_session.occurrence_id is distinct from p_occurrence_id then
      raise exception 'REVIEW_REQUEST_CONFLICT';
    end if;
    return query select * from public.my_course_review(v_session.id);
    return;
  end if;
  if p_occurrence_id is not null then
    select o.* into v_occ from public.course_review_occurrences o
      where o.id = p_occurrence_id and o.user_id = v_user for update;
    if not found then raise exception using errcode = '42501', message = 'REVIEW_FORBIDDEN'; end if;
    v_now := clock_timestamp();
    if v_occ.course_id is distinct from p_course_id or v_occ.selection_state <> 'assigned' then
      raise exception 'REVIEW_OCCURRENCE_UNAVAILABLE';
    end if;
    if v_now >= v_occ.expires_at then raise exception 'REVIEW_OCCURRENCE_EXPIRED'; end if;
    if v_now < v_occ.due_at then raise exception 'REVIEW_OCCURRENCE_UNAVAILABLE'; end if;
    if v_occ.rewarded_at is not null then raise exception 'REVIEW_BONUS_ALREADY_AWARDED'; end if;
  end if;
  if not public.course_review_readable(v_user,p_course_id) then
    raise exception using errcode = '42501', message = 'REVIEW_FORBIDDEN';
  end if;
  if not public.course_review_eligible(v_user,p_course_id) then raise exception 'REVIEW_NOT_ELIGIBLE'; end if;
  insert into public.course_review_sessions(user_id,course_id,course_title,request_id,mode,occurrence_id,expires_at,bonus_xp)
    select v_user,c.id,c.title,p_request_id,case when p_occurrence_id is null then 'normal' else 'bonus' end,
      p_occurrence_id,v_occ.expires_at,case when p_occurrence_id is null then 0 else 10 end
    from public.courses c where c.id = p_course_id returning id into v_id;
  -- Quota, selection and snapshot share ONE statement snapshot.
  with ranked as materialized (
    select q.id,q.lesson_id,q.type,q.prompt,q.config,q.explanation,m.id module_id,m.title module_title,
      row_number() over (partition by m.id order by random(),q.id) r,
      count(*) over (partition by m.id) n
    from public.questions q join public.lessons l on l.id = q.lesson_id
      join public.modules m on m.id = l.module_id where m.course_id = p_course_id
  ), sampled as (
    select *,row_number() over (order by random(),id)::integer ordinal from ranked where r <= ceil(n * 0.2)
  )
  insert into public.course_review_items(session_id,question_id,ordinal,module_id,module_title,lesson_id,type,prompt,config,explanation)
    select v_id,id,ordinal,module_id,module_title,lesson_id,type,prompt,config,explanation from sampled;
  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'REVIEW_EMPTY'; end if;
  perform public.course_review_validate_snapshot(i.type,i.config)
    from public.course_review_items i where i.session_id = v_id;
  if not public.course_review_eligible(v_user,p_course_id) then raise exception 'REVIEW_NOT_ELIGIBLE'; end if;
  if p_occurrence_id is not null and clock_timestamp() >= v_occ.expires_at then
    raise exception 'REVIEW_OCCURRENCE_EXPIRED';
  end if;
  return query select * from public.my_course_review(v_id);
end $$;

-- Assumes the user lock is held. Lock occurrence BEFORE session, check wall
-- time AFTER waiting, and let completed sessions replay forever.
create function public.course_review_mutable_session(p_user uuid,p_id uuid)
returns public.course_review_sessions
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare s public.course_review_sessions; o public.course_review_occurrences; t timestamptz;
begin
  perform 1 from public.course_review_schedules where user_id = p_user for update;
  select * into s from public.course_review_sessions where id = p_id and user_id = p_user;
  if not found then raise exception using errcode = '42501', message = 'REVIEW_FORBIDDEN'; end if;
  if s.occurrence_id is not null then
    select * into o from public.course_review_occurrences where id = s.occurrence_id for update;
  end if;
  select * into s from public.course_review_sessions where id = p_id for update;
  if s.finished_at is not null then return s; end if;
  t := clock_timestamp();
  if s.mode = 'bonus' and t >= o.expires_at then raise exception 'REVIEW_OCCURRENCE_EXPIRED'; end if;
  if s.mode = 'bonus' and (t < o.due_at or o.selection_state <> 'assigned') then
    raise exception 'REVIEW_OCCURRENCE_UNAVAILABLE';
  end if;
  if not public.course_review_eligible(p_user,s.course_id) then raise exception 'REVIEW_NOT_ELIGIBLE'; end if;
  return s;
end $$;

create function public.course_review_validate_answer(p_type public.question_type,p_config jsonb,p_submitted jsonb)
returns void language plpgsql immutable set search_path = pg_catalog, public
as $$
declare e jsonb; v_count integer;
begin
  if p_submitted is null or jsonb_typeof(p_submitted) <> 'object' then
    raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT';
  end if;
  select count(*) into v_count from jsonb_object_keys(p_submitted);
  if v_count <> 1 then raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT'; end if;
  case p_type
  when 'fill_blank' then
    if jsonb_typeof(p_submitted->'text') is distinct from 'string'
      or btrim(p_submitted->>'text') = '' then
      raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT';
    end if;
  when 'sum_alternatives' then
    if jsonb_typeof(p_submitted->'sum') is distinct from 'number' then
      raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT';
    end if;
  when 'multiple_choice' then
    if jsonb_typeof(p_submitted->'selected') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT';
    end if;
    if jsonb_array_length(p_submitted->'selected') = 0 then
      raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT';
    end if;
    for e in select * from jsonb_array_elements(p_submitted->'selected') loop
      if jsonb_typeof(e) <> 'string' or not exists (
        select 1 from jsonb_array_elements(p_config->'options') opt where opt->'id' = e
      ) then raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT'; end if;
    end loop;
    if (select count(distinct x) from jsonb_array_elements(p_submitted->'selected') x)
      <> jsonb_array_length(p_submitted->'selected') then
      raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT';
    end if;
  when 'match' then
    if jsonb_typeof(p_submitted->'pairs') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT';
    end if;
    if jsonb_array_length(p_submitted->'pairs') <> jsonb_array_length(p_config->'pairs')
      or jsonb_array_length(p_submitted->'pairs') = 0 then
      raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT';
    end if;
    for e in select * from jsonb_array_elements(p_submitted->'pairs') loop
      if jsonb_typeof(e) <> 'object' then
        raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT';
      end if;
      if (select count(*) from jsonb_object_keys(e)) <> 2
        or jsonb_typeof(e->'left') is distinct from 'string'
        or jsonb_typeof(e->'right') is distinct from 'string'
        or not exists (select 1 from jsonb_array_elements(p_config->'pairs') x where x->'left' = e->'left')
        or not exists (select 1 from jsonb_array_elements(p_config->'pairs') x where x->'right' = e->'right')
      then raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT'; end if;
    end loop;
    if (select count(distinct x->>'left') from jsonb_array_elements(p_submitted->'pairs') x)
      <> jsonb_array_length(p_submitted->'pairs') then
      raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT';
    end if;
  else raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT';
  end case;
end $$;

create function public.submit_course_review_answer(p_session_id uuid,p_question_id uuid,p_submitted jsonb)
returns table (question_id uuid,is_correct boolean,answered_count integer,total_count integer)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare u uuid := auth.uid(); s public.course_review_sessions; i public.course_review_items; correct boolean;
begin
  if u is null then raise exception using errcode = '42501', message = 'REVIEW_FORBIDDEN'; end if;
  perform public.course_review_lock(u);
  s := public.course_review_mutable_session(u,p_session_id);
  if s.finished_at is not null then raise exception 'REVIEW_FINISHED'; end if;
  select x.* into i from public.course_review_items x where x.session_id = s.id and x.question_id = p_question_id;
  if not found then raise exception using errcode = '22023', message = 'REVIEW_INVALID_INPUT'; end if;
  if i.submitted is not null then
    if i.submitted is distinct from p_submitted then raise exception 'REVIEW_ANSWER_LOCKED'; end if;
    correct := i.is_correct;
  else
    perform public.course_review_validate_answer(i.type,i.config,p_submitted);
    select g.is_correct into strict correct from public.grade_answer(i.type,i.config,p_submitted,0) g;
    if correct is null then raise exception 'REVIEW_INVALID_SNAPSHOT'; end if;
    update public.course_review_items x set submitted = p_submitted,is_correct = correct,answered_at = clock_timestamp()
      where x.session_id = s.id and x.question_id = p_question_id;
  end if;
  return query select p_question_id,correct,count(x.submitted)::integer,count(*)::integer
    from public.course_review_items x where x.session_id = s.id;
end $$;

create function public.finalize_course_review(p_session_id uuid)
returns table (session_id uuid,correct_count integer,total_count integer,approved boolean,
  bonus_earned integer,bonus_outcome text,xp_event_id uuid,finished_at timestamptz)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  u uuid := auth.uid(); s public.course_review_sessions; o public.course_review_occurrences;
  n integer; a integer; c integer; ok boolean; earned integer := 0;
  outcome text; event_id uuid; t timestamptz;
begin
  if u is null then raise exception using errcode = '42501', message = 'REVIEW_FORBIDDEN'; end if;
  perform public.course_review_lock(u);
  s := public.course_review_mutable_session(u,p_session_id);
  if s.finished_at is null then
    select count(*)::integer,count(i.submitted)::integer,count(*) filter (where i.is_correct)::integer
      into n,a,c from public.course_review_items i where i.session_id = s.id;
    if n = 0 or a <> n then raise exception 'REVIEW_INCOMPLETE'; end if;
    ok := c::bigint * 100 >= n::bigint * s.target_percent;
    outcome := 'not_applicable';
    if s.mode = 'bonus' then
      select * into o from public.course_review_occurrences where id = s.occurrence_id;
      if ok and o.rewarded_at is null then
        -- Do not let waiting on another XP source extend the reward window.
        perform 1 from public.profiles where id = u for update;
      end if;
      t := clock_timestamp();
      if t >= o.expires_at then raise exception 'REVIEW_OCCURRENCE_EXPIRED'; end if;
      if not public.course_review_eligible(u,s.course_id) then raise exception 'REVIEW_NOT_ELIGIBLE'; end if;
      if not ok then outcome := 'below_target';
      elsif o.rewarded_at is not null then outcome := 'already_awarded';
      else
        event_id := public.record_xp_event(u,'review_bonus','course',10,
          'xp:course-review:' || o.id::text,p_course_id => s.course_id,p_occurred_at => t);
        earned := 10;
        outcome := 'awarded';
        -- Atomic additive balance update; no previously read balance.
        update public.profiles set xp_global = xp_global + earned,
          level = public.level_for_xp(xp_global + earned) where id = u;
        update public.course_review_occurrences set reward_session_id = s.id,rewarded_at = t,xp_event_id = event_id
          where id = o.id;
      end if;
    else
      t := clock_timestamp();
    end if;
    update public.course_review_sessions set finished_at = t,correct_count = c,total_count = n,
      approved = ok,bonus_earned = earned,bonus_outcome = outcome,xp_event_id = event_id where id = s.id;
  end if;
  return query select d.* from jsonb_to_record(public.course_review_result(s.id)) as d(
    session_id uuid,correct_count integer,total_count integer,approved boolean,
    bonus_earned integer,bonus_outcome text,xp_event_id uuid,finished_at timestamptz);
end $$;

-- New official completion versus legacy reconciliation are distinct origins.
create function public.course_review_observe(p_user uuid,p_source text) returns void
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare t timestamptz;
begin
  perform public.course_review_lock(p_user);
  if exists (select 1 from public.course_review_schedules where user_id = p_user) then return; end if;
  if exists (select 1 from public.courses c where public.course_review_completed(p_user,c.id)) then
    t := clock_timestamp();
    insert into public.course_review_schedules(user_id,anchor_at,anchor_source,first_course_completed_at)
      values (p_user,t,p_source,case when p_source = 'first_completion' then t end)
      on conflict (user_id) do nothing;
  end if;
end $$;

-- One rollout instant, never asserted to be a historical first completion.
do $$
declare u uuid; rollout_at timestamptz := clock_timestamp();
begin
  for u in select id from public.profiles order by id loop
    perform public.course_review_lock(u);
    if exists (select 1 from public.courses c where public.course_review_completed(u,c.id)) then
      insert into public.course_review_schedules(user_id,anchor_at,anchor_source)
        values (u,rollout_at,'rollout') on conflict (user_id) do nothing;
    end if;
  end loop;
end $$;

create function public.course_review_completion_observer() returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if new.context = 'course' then
    perform public.course_review_observe(new.user_id,
      case when tg_op = 'INSERT' then 'first_completion' else 'legacy_observed' end);
  end if;
  return new;
end $$;
create trigger course_review_completion_observer
  after insert or update of completed_at on public.completions
  for each row execute function public.course_review_completion_observer();

create function public.tick_course_reviews()
returns table (occurrences_created integer,courses_assigned integer,notifications_created integer)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  u uuid; a public.course_review_schedules; o public.course_review_occurrences;
  chosen public.courses; t timestamptz; k integer; changed integer; notice_id uuid;
begin
  occurrences_created := 0; courses_assigned := 0; notifications_created := 0;
  -- Multi-user ticks acquire advisory locks in deterministic UUID order.
  for u in select id from public.profiles order by id loop
    perform public.course_review_lock(u);
    perform public.course_review_observe(u,'legacy_observed');
    select * into a from public.course_review_schedules where user_id = u for update;
    if not found then continue; end if;
    if not exists (select 1 from public.profiles where id = u and account_status = 'active') then continue; end if;
    t := clock_timestamp();
    k := floor(extract(epoch from (t - a.anchor_at)) / 604800)::integer;
    if k < 1 then continue; end if;
    insert into public.course_review_occurrences(user_id,period_index,due_at,expires_at)
      values (u,k,a.anchor_at + k * interval '168 hours',a.anchor_at + (k+1) * interval '168 hours')
      on conflict (user_id,period_index) do nothing;
    get diagnostics changed = row_count;
    occurrences_created := occurrences_created + changed;
    select * into o from public.course_review_occurrences where user_id = u and period_index = k for update;
    if o.selection_state = 'no_candidates' then
      select c.* into chosen from public.courses c
        where public.course_review_eligible(u,c.id) and exists (
          select 1 from public.questions q join public.lessons l on l.id = q.lesson_id
            join public.modules m on m.id = l.module_id where m.course_id = c.id
        ) order by random(),c.id limit 1;
      if found then
        update public.course_review_occurrences set selection_state = 'assigned',course_id = chosen.id,
          course_title = chosen.title,assigned_at = clock_timestamp(),bonus_xp = 10,delivery_state = 'pending'
          where id = o.id returning * into o;
        courses_assigned := courses_assigned + 1;
      end if;
    end if;
    if o.delivery_state in ('pending','failed') and clock_timestamp() < o.expires_at then
      -- Failure rolls back only delivery, never the assigned occurrence.
      begin
        notice_id := public.create_notification(u,'revisao_curso','Revisão de curso disponível',
          o.course_title || ' · +10 XP de bônus de revisão',o.id);
        update public.course_review_occurrences set
          delivery_state = case when notice_id is null then 'suppressed' else 'delivered' end,
          notification_id = notice_id,notified_at = case when notice_id is not null then clock_timestamp() end,
          last_delivery_error = null where id = o.id;
        if notice_id is not null then notifications_created := notifications_created + 1; end if;
      exception when others then
        update public.course_review_occurrences set delivery_state = 'failed',
          last_delivery_error = sqlstate where id = o.id;
      end;
    end if;
  end loop;
  return next;
end $$;

-- Explicit ACLs include PUBLIC inheritance. Helpers are not user RPCs.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure signature,p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'course_review_%'
      or p.proname in ('my_course_review','my_course_review_occurrence','my_current_course_review',
        'start_course_review','submit_course_review_answer','finalize_course_review','tick_course_reviews'))
  loop
    execute format('revoke execute on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
    if f.proname in ('course_review_status','my_course_review','my_course_review_occurrence',
      'my_current_course_review','start_course_review','submit_course_review_answer','finalize_course_review') then
      execute format('grant execute on function %s to authenticated',f.signature);
    end if;
  end loop;
end $$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if exists (select 1 from cron.job where jobname = 'tick_course_reviews_every_5m') then
      perform cron.unschedule('tick_course_reviews_every_5m');
    end if;
    perform cron.schedule('tick_course_reviews_every_5m','*/5 * * * *','select public.tick_course_reviews();');
  else
    raise notice 'pg_cron unavailable: course reviews require a privileged external scheduler; periodic execution is pending.';
  end if;
end $$;
