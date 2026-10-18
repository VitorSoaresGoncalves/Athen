-- 0012_triggers.sql
-- Triggers: new-user profile seeding, updated_at touches, role immutability,
-- default question XP, and the max-3-featured-medals guard.
--
-- grant_medals + touch_streak are invoked by finalize_attempt (0010), NOT by a
-- scheduled job (section 8.6 forbids scheduled jobs).

-- ---------------------------------------------------------------------------
-- handle_new_user on auth.users.
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Generic updated_at touch.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
  tables text[] := array[
    'profiles','courses','modules','lessons','questions','enrollments',
    'rooms','room_members','announcements','missions','mission_progress',
    'reviews','comments','notebooks','notebook_pages'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.touch_updated_at()', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Role immutability: a profile owner cannot change their own role. Admins act
-- through the service role (which bypasses this trigger's auth.uid() check) or
-- via is_admin()-gated policies.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_role_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- Allow when acting as an admin; block owners from self-promoting.
    if not public.is_admin() then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_immutable on public.profiles;
create trigger profiles_role_immutable
  before update on public.profiles
  for each row execute function public.enforce_role_immutable();

-- ---------------------------------------------------------------------------
-- Default a question's xp_value from its type when not explicitly provided.
-- ---------------------------------------------------------------------------
create or replace function public.default_question_xp()
returns trigger
language plpgsql
as $$
begin
  if new.xp_value is null or new.xp_value = 0 then
    new.xp_value := public.xp_from_question(new.type);
  end if;
  return new;
end;
$$;

drop trigger if exists questions_default_xp on public.questions;
create trigger questions_default_xp
  before insert on public.questions
  for each row execute function public.default_question_xp();

-- ---------------------------------------------------------------------------
-- Enforce at most 3 featured medals per user.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_max_featured_medals()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  if new.featured is true then
    select count(*) into v_count
      from public.user_medals
     where user_id = new.user_id and featured = true and id <> new.id;
    if v_count >= 3 then
      raise exception 'a user may feature at most 3 medals';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists user_medals_max_featured on public.user_medals;
create trigger user_medals_max_featured
  before insert or update on public.user_medals
  for each row execute function public.enforce_max_featured_medals();
