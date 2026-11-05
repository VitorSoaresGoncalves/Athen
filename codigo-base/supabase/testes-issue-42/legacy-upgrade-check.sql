do $review$
begin
  assert exists (
    select 1 from public.xp_events
     where idempotency_key = 'legacy:xp-credit:00000000-0000-4000-b000-000000000101'
       and origin = 'learning_base' and context = 'course' and amount = 17
  ), 'credito legado nao foi copiado ao livro novo';
  assert exists (
    select 1 from public.season_entries
     where id = '00000000-0000-4000-b000-000000000104'
       and category = 'gold' and result_category = 'platinum'
       and season_xp = 17 and final_rank = 1
  ), 'resultado da temporada legada nao foi preservado';
end;
$review$;
