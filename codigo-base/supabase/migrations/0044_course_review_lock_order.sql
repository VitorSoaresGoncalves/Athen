-- Acquire the review user lock BEFORE any completion AFTER trigger.
--
-- In 0043 the AFTER observer obtained it after advance_empty_lesson_missions
-- (triggers in the same phase run by name). That mission trigger can already
-- hold profiles, inverting finalize_course_review's user -> profile order.
--
-- The current official writers, finalize_attempt (0035) and
-- complete_empty_lesson (0040), insert/upsert completions before their own
-- profile effects. A BEFORE row trigger covers both INSERT and the upsert's
-- UPDATE path, including retries, without changing either RPC's effects.
-- Leave the anchor observer AFTER: it must see the completed lesson.
create function public.course_review_lock_before_completion()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.context = 'course' then
    perform public.course_review_lock(new.user_id);
  end if;
  return new;
end;
$$;

revoke execute on function public.course_review_lock_before_completion()
  from public, anon, authenticated;
grant execute on function public.course_review_lock_before_completion()
  to service_role;

create trigger course_review_lock_before_completion
  before insert or update on public.completions
  for each row execute function public.course_review_lock_before_completion();

comment on function public.course_review_lock_before_completion() is
  'Internal: serialize individual completions with course reviews before mission/profile effects; anchor observation remains AFTER completion.';
