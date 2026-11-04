-- ensaio_temporada.sql
-- Ensaio LOCAL (não é migration): cria uma temporada aberta e inscreve as contas
-- do seed num grupo de Prata com XPs variados, para exercitar a página de ligas
-- (current_season / my_season_summary / my_season_group) no ambiente local.
--
-- NÃO usar em produção nem preencher grupos reais com estes dados (Q090).
-- Rodar: docker exec -i supabase_db_codigo-base psql -U postgres -d postgres -f <este arquivo>
-- ou cole no SQL Editor do Studio local.

do $$
declare
  v_start   timestamptz := public.mission_week_start(now());
  v_season  uuid;
  v_group   uuid;
begin
  -- Temporada da semana corrente, aberta.
  insert into public.seasons (starts_at, ends_at, status)
  values (v_start, v_start + interval '7 days', 'open')
  on conflict (starts_at) do update set status = 'open'
  returning id into v_season;
  if v_season is null then
    select id into v_season from public.seasons where starts_at = v_start;
  end if;

  -- Um grupo de Prata.
  insert into public.season_groups (season_id, category, group_index, capacity)
  values (v_season, 'silver', 1, 30)
  on conflict (season_id, category, group_index) do nothing;
  select id into v_group
    from public.season_groups
   where season_id = v_season and category = 'silver' and group_index = 1;

  -- Inscreve as contas de teste do seed no grupo, com XPs variados (inclui um zero).
  insert into public.season_entries (season_id, user_id, group_id, category, season_xp)
  values
    (v_season, '00000000-0000-4000-a000-000000000002', v_group, 'silver', 410),
    (v_season, '00000000-0000-4000-a000-000000000003', v_group, 'silver', 305),
    (v_season, '00000000-0000-4000-a000-000000000004', v_group, 'silver', 240),
    (v_season, '00000000-0000-4000-a000-000000000005', v_group, 'silver', 180),
    (v_season, '00000000-0000-4000-a000-000000000006', v_group, 'silver', 60),
    (v_season, '00000000-0000-4000-a000-000000000007', v_group, 'silver', 0)
  on conflict (season_id, user_id) do update
    set group_id = excluded.group_id, season_xp = excluded.season_xp;
end
$$;

-- Conferência rápida.
select s.status, g.category, count(e.*) as inscritos
  from public.seasons s
  join public.season_groups g on g.season_id = s.id
  left join public.season_entries e on e.group_id = g.id
 group by s.status, g.category;
