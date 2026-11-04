-- Executar em transação revertida antes da 0040 para simular os dados da
-- antiga 0023_ligas.sql sem alterar o banco de ensaio.
create table public.xp_credits (
  id uuid primary key, user_id uuid, source text, competitive boolean,
  amount integer, attempt_id uuid, course_id uuid, created_at timestamptz
);
create table public.league_seasons (
  id uuid primary key, starts_at timestamptz, ends_at timestamptz,
  status text, closed_at timestamptz
);
create table public.league_groups (
  id uuid primary key, season_id uuid, tier smallint, group_number integer
);
create table public.league_entries (
  id uuid primary key, season_id uuid, user_id uuid, group_id uuid,
  tier smallint, final_score integer, final_position integer,
  tier_after smallint, joined_at timestamptz
);
insert into public.xp_credits values (
  '00000000-0000-4000-b000-000000000101',
  '00000000-0000-4000-a000-000000000004',
  'learning', true, 17, null, null, now() - interval '10 days'
);
insert into public.league_seasons values (
  '00000000-0000-4000-b000-000000000102',
  public.mission_week_start(now()) - interval '14 days',
  public.mission_week_start(now()) - interval '7 days',
  'closed', now() - interval '7 days'
);
insert into public.league_groups values (
  '00000000-0000-4000-b000-000000000103',
  '00000000-0000-4000-b000-000000000102', 3, 1
);
insert into public.league_entries values (
  '00000000-0000-4000-b000-000000000104',
  '00000000-0000-4000-b000-000000000102',
  '00000000-0000-4000-a000-000000000004',
  '00000000-0000-4000-b000-000000000103',
  3, 17, 1, 4, now() - interval '12 days'
);
