-- Leituras da liga aberta com XP do ledger e projeção segundo close_season.
-- Mantém as assinaturas existentes e acrescenta uma leitura para a nova UI.
alter table public.season_entries
  add column if not exists entry_kind text check (entry_kind in ('snapshot', 'late'));
comment on column public.season_entries.entry_kind is
  'Origem da inscrição: snapshot (atividade na semana anterior) ou late. NULL para legado sem informação confiável.';

create or replace function public.set_season_entry_kind()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_start timestamptz;
  v_created_at timestamptz;
begin
  select starts_at, created_at into v_start, v_created_at from public.seasons where id = new.season_id;
  new.entry_kind := case when v_created_at = now() and public.is_recently_active(
    new.user_id, v_start - interval '7 days', v_start
  ) then 'snapshot' else 'late' end;
  return new;
end;
$$;
revoke execute on function public.set_season_entry_kind() from public, anon, authenticated;
drop trigger if exists set_season_entry_kind on public.season_entries;
create trigger set_season_entry_kind before insert on public.season_entries
for each row execute function public.set_season_entry_kind();

-- O legado league_entries já registrava o tipo; outros dados antigos ficam NULL.
do $$
begin
  if to_regclass('public.league_entries') is not null then
    update public.season_entries se set entry_kind = le.entry_kind
      from public.league_entries le, public.league_seasons ls, public.seasons s
     where le.season_id = ls.id and s.starts_at = ls.starts_at
       and se.season_id = s.id and se.user_id = le.user_id
       and se.entry_kind is null and le.entry_kind in ('snapshot', 'late');
  end if;
end;
$$;

create or replace function public.my_season_standings(p_season_id uuid)
returns table (
  user_id uuid, display_name text, avatar_url text, banner_url text,
  season_xp integer, rank_position integer, is_self boolean, hidden boolean,
  movement text, projected_category public.season_category, entry_kind text
)
language sql stable security definer set search_path = public
as $$
  with own_entry as (
    select se.group_id from public.season_entries se
     where se.season_id = p_season_id and se.user_id = auth.uid()
  ), scores as (
    select se.*, s.status,
      case when s.status = 'closed' then se.season_xp
           else public.user_season_xp(se.user_id, s.starts_at, s.ends_at) end as score
      from public.season_entries se join public.seasons s on s.id = se.season_id
     where se.season_id = p_season_id
       and (se.user_id = auth.uid() or se.group_id = (select group_id from own_entry))
  ), positive as (
    select group_id, score,
      row_number() over (partition by group_id order by score desc) as top_rank,
      row_number() over (partition by group_id order by score asc) as bottom_rank,
      count(*) over (partition by group_id) as positive_count
      from scores where score > 0
  ), cuts as (
    select group_id, max(positive_count) as positive_count,
      max(score) filter (where top_rank = ceil(positive_count * 0.20)) as promote_cut,
      max(score) filter (where bottom_rank = ceil(positive_count * 0.20)) as demote_cut
      from positive group by group_id
  ), projected as (
    select sc.*,
      row_number() over (partition by sc.group_id order by sc.score desc, sc.joined_at, sc.user_id)::integer as position,
      case
        when sc.status = 'closed' then coalesce(sc.result_category, sc.category)
        when sc.group_id is null then sc.category
        when sc.score = 0 then public.season_category_from_rank(public.season_category_rank(sc.category) - 1)
        when c.positive_count >= 10 and sc.score >= c.promote_cut
          then public.season_category_from_rank(public.season_category_rank(sc.category) + 1)
        when c.positive_count >= 10 and sc.score <= c.demote_cut and sc.score < c.promote_cut
          then public.season_category_from_rank(public.season_category_rank(sc.category) - 1)
        else sc.category
      end as destination
      from scores sc left join cuts c on c.group_id = sc.group_id
  )
  select pr.user_id,
    case when pr.identity_hidden then null else p.display_name end,
    case when pr.identity_hidden then null else p.avatar_url end,
    case when pr.identity_hidden then null else p.banner_url end,
    pr.score,
    case when pr.group_id is null then null
         when pr.status = 'closed' then coalesce(pr.final_rank, pr.position)
         else pr.position end,
    pr.user_id = auth.uid(), pr.identity_hidden,
    case when public.season_category_rank(pr.destination) > public.season_category_rank(pr.category) then 'promoted'
         when public.season_category_rank(pr.destination) < public.season_category_rank(pr.category) then 'demoted'
         else 'stayed' end,
    pr.destination, pr.entry_kind
    from projected pr join public.profiles p on p.id = pr.user_id
   order by pr.score desc, pr.joined_at, pr.user_id;
$$;
revoke execute on function public.my_season_standings(uuid) from public, anon;
grant execute on function public.my_season_standings(uuid) to authenticated;

create or replace function public.my_season_group(p_season_id uuid)
returns table (
  user_id uuid, display_name text, avatar_url text, banner_url text,
  season_xp integer, rank_position integer, is_self boolean, hidden boolean
)
language sql stable security definer set search_path = public
as $$
  select st.user_id, st.display_name, st.avatar_url, st.banner_url,
    st.season_xp, st.rank_position, st.is_self, st.hidden
    from public.my_season_standings(p_season_id) st
   where st.rank_position is not null;
$$;

create or replace function public.my_season_summary(p_season_id uuid)
returns table (
  season_id uuid, category public.season_category, group_id uuid,
  group_index integer, season_xp integer, final_rank integer,
  result_category public.season_category, group_size integer
)
language sql stable security definer set search_path = public
as $$
  select se.season_id, se.category, se.group_id, g.group_index,
    st.season_xp, st.rank_position, se.result_category,
    (select count(*)::integer from public.season_entries x where x.group_id = se.group_id)
    from public.season_entries se
    left join public.season_groups g on g.id = se.group_id
    join public.my_season_standings(p_season_id) st on st.user_id = se.user_id
   where se.season_id = p_season_id and se.user_id = auth.uid();
$$;

comment on function public.my_season_standings(uuid) is
  'Próprio grupo: XP competitivo corrente, posição e projeção com as regras de close_season (mínimo 10 positivos, cortes de 20%, empates, piso Bronze e teto Mestre). Temporada fechada lê os resultados persistidos.';
