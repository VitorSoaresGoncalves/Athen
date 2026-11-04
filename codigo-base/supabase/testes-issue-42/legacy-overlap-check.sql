-- A transação de ensaio deve criar review_entries_before como uma fotografia
-- de season_entries antes de aplicar a 0040.
do $check$
begin
  assert not exists (
    select 1 from review_entries_before b
    left join public.season_entries e on e.id = b.id
    where e.id is null or e.group_id is distinct from b.group_id
      or e.category is distinct from b.category
      or e.season_xp is distinct from b.season_xp
      or e.result_category is distinct from b.result_category
  ), 'reconciliacao alterou uma inscricao existente';
  assert not exists (
    select 1 from public.league_entries le
    join public.league_seasons ls on ls.id = le.season_id
    where not exists (
      select 1 from public.season_entries e
      join public.seasons s on s.id = e.season_id
      where s.starts_at = ls.starts_at and e.user_id = le.user_id
    )
  ), 'participante legado ausente apos reconciliacao';
  assert not has_function_privilege('authenticated',
    'public.record_xp_event(uuid, public.xp_event_origin, public.xp_event_context, integer, text, uuid, uuid, uuid, uuid, timestamptz)',
    'EXECUTE'), 'funcao interna de XP continua exposta';
end;
$check$;
