-- 0023_leagues.sql
-- LIGAS SEMANAIS (temporadas de XP) — substitui o "ranking global por nível".
--
-- Regras implementadas (resumo; decisões Q101–Q109 e Q137–Q143 do guia):
--   * Temporada = semana de segunda 00:00 a segunda seguinte 00:00, fuso America/Sao_Paulo,
--     intervalo [início, fim). Nada de relógio do navegador.
--   * 7 categorias: 1 Bronze, 2 Prata, 3 Ouro, 4 Platina, 5 Diamante, 6 Mestre, 7 Lendário.
--     O nível vitalício (profiles.level) NÃO define a liga. 1ª participação = Bronze; depois,
--     a categoria resultante do último fechamento.
--   * Pontuação da temporada = soma dos créditos de XP "competitivos" (public.xp_credits)
--     confirmados dentro da janela: só aprendizagem individual (curso), nunca XP de sala,
--     bônus de missão, ajustes ou curso de autoria própria. Repetição já creditada vale 0
--     (anti-regrind da 0018).
--   * Inscrição automática: na virada, toda conta ativa com ao menos 1 conclusão de aula
--     (curso OU sala) nos 7 dias anteriores entra num grupo. Quem ficou de fora entra
--     na 1ª atividade oficial da semana (conclusão de aula), sem exigir XP positivo.
--     Não existe "abandonar temporada".
--   * Grupos: alvo 20, teto 30, mesma categoria, afinidade por amizades (diretas peso 2,
--     amigos de amigos peso 1) com semente persistida na temporada. Sem localização.
--   * Fechamento: topo 20% sobe, base 20% desce (grupos de 10+; grupos de 2–9 só promovem
--     max(1, 20%)); empates em bloco; quem termina com 0 XP cai uma categoria (piso Bronze);
--     Lendário não sobe. Sem prêmio de colocação.
--   * Quem executa a virada: public.league_tick() (idempotente). É chamada por
--     public.league_sync() (a página Ligas chama ao abrir), pelo finalize_attempt e por
--     complete_empty_lesson. Opcionalmente agende no pg_cron (veja o fim do arquivo).
--
-- Futuro (missões): bônus de missão devem ser gravados em xp_credits com
-- source = 'mission_bonus' e competitive = false; eles não entram na liga.

-- ===========================================================================
-- 0) Correção de base: room_members tem o gatilho set_updated_at (0012) mas não tinha a
--    coluna updated_at (0005). Qualquer UPDATE na tabela falhava ("record new has no field
--    updated_at"), inclusive a finalização de aulas em sala e o reingresso via join_room.
--    Idempotente: não faz nada se a coluna já existir no seu banco.
-- ===========================================================================
alter table public.room_members
  add column if not exists updated_at timestamptz not null default now();

-- ===========================================================================
-- 1) Livro de créditos de XP (fonte única da pontuação competitiva)
-- ===========================================================================
create table if not exists public.xp_credits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  source      text not null check (source in ('learning', 'mission_bonus', 'adjustment')),
  amount      integer not null check (amount <> 0),
  -- true = conta para a liga. Só aprendizagem individual elegível.
  competitive boolean not null default false,
  course_id   uuid references public.courses (id) on delete set null,
  attempt_id  uuid references public.attempts (id) on delete set null,
  answer_id   uuid references public.answers (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (not competitive or (source = 'learning' and amount > 0))
);

comment on table public.xp_credits is
  'Livro de créditos de XP. A liga soma apenas linhas competitive = true (aprendizagem individual elegível). Bônus de missão/ajustes entram aqui com competitive = false.';

-- Um crédito por resposta (idempotência do finalize_attempt).
create unique index if not exists xp_credits_answer_uidx
  on public.xp_credits (answer_id) where answer_id is not null;
create index if not exists xp_credits_user_competitive_idx
  on public.xp_credits (user_id, created_at) where competitive;

-- ===========================================================================
-- 2) Temporadas, grupos e inscrições
-- ===========================================================================
create table if not exists public.league_seasons (
  id         uuid primary key default gen_random_uuid(),
  starts_at  timestamptz not null unique,
  ends_at    timestamptz not null,
  status     text not null default 'open' check (status in ('open', 'closed')),
  -- Semente persistida: a mesma fotografia + semente reproduz a formação.
  seed       text not null default md5(random()::text || clock_timestamp()::text),
  created_at timestamptz not null default now(),
  closed_at  timestamptz,
  check (ends_at > starts_at)
);

create index if not exists league_seasons_status_idx on public.league_seasons (status, ends_at);

create table if not exists public.league_groups (
  id           uuid primary key default gen_random_uuid(),
  season_id    uuid not null references public.league_seasons (id) on delete cascade,
  tier         smallint not null check (tier between 1 and 7),
  group_number integer not null,
  late         boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (season_id, tier, group_number)
);

create table if not exists public.league_entries (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references public.league_seasons (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  group_id       uuid not null references public.league_groups (id) on delete cascade,
  tier           smallint not null check (tier between 1 and 7),
  entry_kind     text not null check (entry_kind in ('snapshot', 'late')),
  joined_at      timestamptz not null default now(),
  -- Preenchidos no fechamento:
  final_score    integer,
  final_position integer,
  group_size     integer,
  movement       text check (movement in ('promoted', 'demoted', 'stayed')),
  tier_after     smallint check (tier_after between 1 and 7),
  closed_at      timestamptz,
  unique (season_id, user_id)
);

create index if not exists league_entries_group_idx on public.league_entries (group_id);
create index if not exists league_entries_user_idx on public.league_entries (user_id, season_id);

-- RLS: nenhuma leitura/escrita direta pelo cliente. Tudo passa pelas funções abaixo
-- (SECURITY DEFINER), que só devolvem o grupo do próprio usuário.
alter table public.xp_credits     enable row level security;
alter table public.league_seasons enable row level security;
alter table public.league_groups  enable row level security;
alter table public.league_entries enable row level security;

revoke all on public.xp_credits, public.league_seasons, public.league_groups, public.league_entries
  from anon, authenticated;

drop policy if exists xp_credits_select_own on public.xp_credits;
create policy xp_credits_select_own on public.xp_credits
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
grant select on public.xp_credits to authenticated;

drop policy if exists league_seasons_admin on public.league_seasons;
create policy league_seasons_admin on public.league_seasons
  for select to authenticated using (public.is_admin());
drop policy if exists league_groups_admin on public.league_groups;
create policy league_groups_admin on public.league_groups
  for select to authenticated using (public.is_admin());
drop policy if exists league_entries_admin on public.league_entries;
create policy league_entries_admin on public.league_entries
  for select to authenticated using (public.is_admin());
grant select on public.league_seasons, public.league_groups, public.league_entries to authenticated;

-- ===========================================================================
-- 3) Calendário (America/Sao_Paulo, semana começa na segunda 00:00)
-- ===========================================================================
create or replace function public.league_week_start(p_ts timestamptz)
returns timestamptz
language sql
immutable
as $$
  select date_trunc('week', p_ts at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
$$;

create or replace function public.league_week_end(p_start timestamptz)
returns timestamptz
language sql
immutable
as $$
  select ((p_start at time zone 'America/Sao_Paulo') + interval '7 days') at time zone 'America/Sao_Paulo';
$$;

-- ===========================================================================
-- 4) Afinidade social: amigos diretos (peso 2) e amigos de amigos (peso 1)
--    Só devolve pares dentro do conjunto informado; não expõe caminhos a ninguém.
-- ===========================================================================
create or replace function public.league_affinity(p_user_ids uuid[])
returns table (a uuid, b uuid, w integer)
language sql
stable
security definer
set search_path = public
as $$
  with adj as (
    select requester_id as u, addressee_id as v from public.friendships where status = 'accepted'
    union all
    select addressee_id, requester_id from public.friendships where status = 'accepted'
  ),
  s as (select unnest(p_user_ids) as id),
  d1 as (
    select x.u as a, x.v as b from adj x
     where x.u in (select id from s) and x.v in (select id from s)
  ),
  d2 as (
    select x.u as a, y.v as b
      from adj x join adj y on y.u = x.v
     where x.u <> y.v
       and x.u in (select id from s) and y.v in (select id from s)
  )
  select t.a, t.b, max(t.w)::integer
    from (select a, b, 2 as w from d1 union all select a, b, 1 from d2) t
   group by t.a, t.b;
$$;

-- ===========================================================================
-- 5) Formação de grupos de uma categoria (alvo 20, grupos equilibrados)
--    Ordena os usuários por proximidade (busca em largura no grafo de amizades,
--    começando por uma ordem pseudoaleatória fixada pela semente) e fatia em
--    G = ceil(P/20) grupos de tamanho equilibrado.
-- ===========================================================================
create or replace function public.league_form_groups(
  p_season_id uuid, p_tier smallint, p_user_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seed    text;
  v_total   integer := coalesce(array_length(p_user_ids, 1), 0);
  v_groups  integer;
  v_q       integer;
  v_r       integer;
  v_big     integer;
  v_pos     integer := 0;
  v_u       uuid;
  v_cur     uuid;
  v_n       uuid;
  v_queue   uuid[];
  v_gid     uuid;
  v_ids     uuid[] := '{}';
  i         integer;
begin
  if v_total = 0 then
    return 0;
  end if;

  select seed into v_seed from public.league_seasons where id = p_season_id;

  v_groups := ceil(v_total / 20.0)::integer;   -- alvo 20; nunca passa de 20 por grupo
  v_q := v_total / v_groups;
  v_r := v_total % v_groups;
  v_big := v_r * (v_q + 1);

  -- Tabelas temporárias do cálculo (descartadas no fim da transação).
  if to_regclass('pg_temp._lg_users') is null then
    create temp table _lg_users (
      uid uuid primary key, ord integer, done boolean not null default false
    ) on commit drop;
    create temp table _lg_aff (
      a uuid not null, b uuid not null, w integer not null, primary key (a, b)
    ) on commit drop;
  else
    truncate _lg_users;
    truncate _lg_aff;
  end if;

  insert into _lg_users (uid) select distinct unnest(p_user_ids);
  insert into _lg_aff (a, b, w) select a, b, w from public.league_affinity(p_user_ids);

  -- Ordem por proximidade (componentes conectados em BFS; vizinhos por peso e hash).
  loop
    select uid into v_u from _lg_users
     where not done
     order by md5(v_seed || uid::text)
     limit 1;
    exit when v_u is null;

    update _lg_users set done = true where uid = v_u;
    v_queue := array[v_u];

    while coalesce(array_length(v_queue, 1), 0) > 0 loop
      v_cur := v_queue[1];
      v_queue := v_queue[2:array_length(v_queue, 1)];
      v_pos := v_pos + 1;
      update _lg_users set ord = v_pos where uid = v_cur;

      for v_n in
        select f.b
          from _lg_aff f
          join _lg_users u on u.uid = f.b and not u.done
         where f.a = v_cur
         order by f.w desc, md5(v_seed || f.b::text)
      loop
        update _lg_users set done = true where uid = v_n;
        v_queue := v_queue || v_n;
      end loop;
    end loop;
  end loop;

  for i in 1 .. v_groups loop
    insert into public.league_groups (season_id, tier, group_number)
    values (
      p_season_id, p_tier,
      coalesce((select max(group_number) from public.league_groups
                 where season_id = p_season_id and tier = p_tier), 0) + 1
    )
    returning id into v_gid;
    v_ids := v_ids || v_gid;
  end loop;

  insert into public.league_entries (season_id, user_id, group_id, tier, entry_kind)
  select p_season_id, u.uid,
         v_ids[ case when u.ord - 1 < v_big
                     then (u.ord - 1) / (v_q + 1) + 1
                     else v_r + (u.ord - 1 - v_big) / v_q + 1 end ],
         p_tier, 'snapshot'
    from _lg_users u;

  return v_groups;
end;
$$;

-- ===========================================================================
-- 6) Entrada tardia: 1ª atividade oficial da semana (sem exigir XP)
--    Mesma categoria, grupo com vaga (< 30) de maior afinidade; sem vaga, grupo tardio.
-- ===========================================================================
create or replace function public.league_late_enroll(p_season_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier smallint;
  v_gid  uuid;
begin
  select coalesce((
           select e.tier_after
             from public.league_entries e
             join public.league_seasons s on s.id = e.season_id
            where e.user_id = p_user_id and e.closed_at is not null
            order by s.starts_at desc limit 1
         ), 1)
    into v_tier;

  with friends as (
    select case when requester_id = p_user_id then addressee_id else requester_id end as f
      from public.friendships
     where status = 'accepted' and p_user_id in (requester_id, addressee_id)
  ),
  fof as (
    select distinct case when fr.requester_id = fl.f then fr.addressee_id else fr.requester_id end as x
      from friends fl
      join public.friendships fr
        on fr.status = 'accepted' and fl.f in (fr.requester_id, fr.addressee_id)
  )
  select g.id into v_gid
    from public.league_groups g
   where g.season_id = p_season_id and g.tier = v_tier
     and (select count(*) from public.league_entries e where e.group_id = g.id) < 30
   order by
     (select coalesce(sum(case when e.user_id in (select f from friends) then 2
                               when e.user_id in (select x from fof) then 1
                               else 0 end), 0)
        from public.league_entries e where e.group_id = g.id) desc,
     (select count(*) from public.league_entries e where e.group_id = g.id) asc,
     g.group_number asc
   limit 1;

  if v_gid is null then
    insert into public.league_groups (season_id, tier, group_number, late)
    values (
      p_season_id, v_tier,
      coalesce((select max(group_number) from public.league_groups
                 where season_id = p_season_id and tier = v_tier), 0) + 1,
      true
    )
    returning id into v_gid;
  end if;

  insert into public.league_entries (season_id, user_id, group_id, tier, entry_kind)
  values (p_season_id, p_user_id, v_gid, v_tier, 'late')
  on conflict (season_id, user_id) do nothing;

  return v_gid;
end;
$$;

-- ===========================================================================
-- 7) Cálculo de posições e movimentos (usado ao vivo e no fechamento)
--    Regras (grupo inteiro, antes de qualquer paginação):
--      n = TODO inscrito, inclusive com 0 XP.
--      promoção: n<2 nenhuma; 2<=n<10 max(1, 20%); n>=10 20% — do topo, exige XP > 0.
--      zona inferior: só n>=10, 20% da base (zeros contam no corte).
--      empates: todo o bloco empatado no corte entra na zona.
--      bloco positivo nas duas zonas permanece (grupo todo empatado e positivo não muda).
--      XP = 0 sempre cai uma categoria (piso Bronze), inclusive grupo pequeno/zerado/sozinho.
--      Lendário não sobe. Posição compartilhada em empate (1, 1, 3).
-- ===========================================================================
create or replace function public.league_compute(p_season_id uuid, p_group_id uuid default null)
returns table (
  entry_id   uuid,
  group_id   uuid,
  user_id    uuid,
  tier       smallint,
  score      integer,
  "position" integer,
  group_size integer,
  movement   text,
  tier_after smallint
)
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select starts_at, ends_at from public.league_seasons where id = p_season_id
  ),
  sc as (
    select e.id as eid, e.group_id as gid, e.user_id as uid, e.tier as t,
           coalesce((
             select sum(c.amount)
               from public.xp_credits c, s
              where c.user_id = e.user_id and c.competitive
                and c.created_at >= s.starts_at and c.created_at < s.ends_at
           ), 0)::integer as score
      from public.league_entries e
     where e.season_id = p_season_id
       and (p_group_id is null or e.group_id = p_group_id)
  ),
  rk as (
    select sc.*,
           rank() over (partition by gid order by score desc) as pos,
           count(*) over (partition by gid) as n,
           row_number() over (partition by gid order by score desc, uid) as rn_d,
           row_number() over (partition by gid order by score asc, uid) as rn_a
      from sc
  ),
  k as (
    select rk.*,
           case when n < 2 then 0
                when n < 10 then greatest(1, (n * 20) / 100)
                else (n * 20) / 100 end as pk,
           case when n >= 10 then (n * 20) / 100 else 0 end as dk
      from rk
  ),
  cut as (
    select k.*,
           max(score) filter (where rn_d = pk) over (partition by gid) as pcut,
           max(score) filter (where rn_a = dk) over (partition by gid) as dcut
      from k
  ),
  mv as (
    select cut.*,
           case
             when score = 0 then case when t > 1 then 'demoted' else 'stayed' end
             when pk > 0 and score >= pcut and dk > 0 and score <= dcut then 'stayed'
             when pk > 0 and score >= pcut then case when t < 7 then 'promoted' else 'stayed' end
             when dk > 0 and score <= dcut then case when t > 1 then 'demoted' else 'stayed' end
             else 'stayed'
           end as movement
      from cut
  )
  select eid, gid, uid, t, score, pos::integer, n::integer, movement,
         (t + case movement when 'promoted' then 1 when 'demoted' then -1 else 0 end)::smallint
    from mv;
$$;

-- ===========================================================================
-- 8) Fechamento e abertura de temporadas
-- ===========================================================================
create or replace function public.league_close_season(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.league_entries e
     set final_score    = r.score,
         final_position = r."position",
         group_size     = r.group_size,
         movement       = r.movement,
         tier_after     = r.tier_after,
         closed_at      = now()
    from public.league_compute(p_season_id) r
   where e.id = r.entry_id and e.season_id = p_season_id and e.closed_at is null;

  update public.league_seasons
     set status = 'closed', closed_at = now()
   where id = p_season_id and status = 'open';
end;
$$;

create or replace function public.league_open_season(p_start timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_t    record;
begin
  insert into public.league_seasons (starts_at, ends_at)
  values (p_start, public.league_week_end(p_start))
  on conflict (starts_at) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.league_seasons where starts_at = p_start;
    return v_id;
  end if;

  -- Fotografia da virada: contas ativas com conclusão oficial (curso ou sala) em [S-7d, S).
  -- Elegibilidade é a fotografia de S, não o instante (talvez atrasado) em que o job roda.
  for v_t in
    with elig as (
      select p.id as uid,
             coalesce((
               select e.tier_after
                 from public.league_entries e
                 join public.league_seasons s on s.id = e.season_id
                where e.user_id = p.id and e.closed_at is not null
                order by s.starts_at desc limit 1
             ), 1)::smallint as tier
        from public.profiles p
       where p.account_status = 'active'
         and exists (
           select 1 from public.completions c
            where c.user_id = p.id
              and c.completed_at >= (p_start - interval '7 days')
              and c.completed_at <  p_start
         )
    )
    select tier, array_agg(uid) as uids from elig group by tier order by tier
  loop
    perform public.league_form_groups(v_id, v_t.tier, v_t.uids);
  end loop;

  return v_id;
end;
$$;

-- Vira a semana quando preciso (idempotente, serializada por advisory lock).
create or replace function public.league_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now   timestamptz := now();
  v_start timestamptz := public.league_week_start(now());
  v_s     record;
begin
  -- Caminho rápido: temporada atual existe e não há temporada vencida aberta.
  if exists (select 1 from public.league_seasons where starts_at = v_start)
     and not exists (select 1 from public.league_seasons where status = 'open' and ends_at <= v_now) then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('athen:league'));

  for v_s in
    select id from public.league_seasons
     where status = 'open' and ends_at <= v_now
     order by starts_at
  loop
    perform public.league_close_season(v_s.id);
  end loop;

  if not exists (select 1 from public.league_seasons where starts_at = v_start) then
    perform public.league_open_season(v_start);
  end if;
end;
$$;

-- Registra atividade oficial (conclusão de aula): garante a temporada e a inscrição tardia.
-- NUNCA propaga erro: falha da liga não pode impedir o estudo (ela se corrige na próxima chamada).
create or replace function public.league_register_activity(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season uuid;
begin
  begin
    perform public.league_tick();

    select id into v_season from public.league_seasons
     where starts_at = public.league_week_start(now()) and status = 'open';
    if v_season is null then
      return;
    end if;

    if exists (select 1 from public.league_entries where season_id = v_season and user_id = p_user_id) then
      return;
    end if;

    perform pg_advisory_xact_lock(hashtext('athen:league'));
    if exists (select 1 from public.league_entries where season_id = v_season and user_id = p_user_id) then
      return;
    end if;
    if exists (select 1 from public.profiles where id = p_user_id and account_status = 'active') then
      perform public.league_late_enroll(v_season, p_user_id);
    end if;
  exception when others then
    raise warning 'league_register_activity falhou para %: %', p_user_id, sqlerrm;
  end;
end;
$$;

-- ===========================================================================
-- 9) Leituras para a interface (sempre restritas ao PRÓPRIO grupo do usuário)
-- ===========================================================================

-- Chamada pela página Ligas ao abrir/atualizar: vira a semana se preciso.
create or replace function public.league_sync()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform public.league_tick();
end;
$$;

-- Resumo pessoal da temporada atual (independe de paginação/Top N).
create or replace function public.league_overview()
returns table (
  season_id         uuid,
  starts_at         timestamptz,
  ends_at           timestamptz,
  entered           boolean,
  entry_kind        text,
  tier              smallint,
  group_number      integer,
  group_size        integer,
  score             integer,
  "position"        integer,
  projected         text,
  projected_tier    smallint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_season public.league_seasons%rowtype;
  v_entry  public.league_entries%rowtype;
  v_num    integer;
  r        record;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select s.* into v_season from public.league_seasons s
   where s.starts_at = public.league_week_start(now());

  if not found then
    return;  -- ainda sem temporada (league_sync cria)
  end if;

  select e.* into v_entry from public.league_entries e
   where e.season_id = v_season.id and e.user_id = v_uid;

  season_id := v_season.id;
  starts_at := v_season.starts_at;
  ends_at   := v_season.ends_at;

  if not found then
    entered := false;
    return next;
    return;
  end if;

  select g.group_number into v_num from public.league_groups g where g.id = v_entry.group_id;
  select * into r from public.league_compute(v_season.id, v_entry.group_id) c where c.user_id = v_uid;

  entered        := true;
  entry_kind     := v_entry.entry_kind;
  tier           := v_entry.tier;
  group_number   := v_num;
  group_size     := r.group_size;
  score          := r.score;
  "position"     := r."position";
  projected      := r.movement;
  projected_tier := r.tier_after;
  return next;
end;
$$;

-- Classificação do próprio grupo (ao vivo na temporada aberta; gravada se fechada).
create or replace function public.league_my_group(p_season_id uuid default null)
returns table (
  user_id      uuid,
  display_name text,
  avatar_url   text,
  banner_url   text,
  active       boolean,
  score        integer,
  "position"   integer,
  movement     text,
  is_self      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_season public.league_seasons%rowtype;
  v_entry  public.league_entries%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_season_id is null then
    select s.* into v_season from public.league_seasons s
     where s.starts_at = public.league_week_start(now());
  else
    select s.* into v_season from public.league_seasons s where s.id = p_season_id;
  end if;
  if not found then
    return;
  end if;

  select e.* into v_entry from public.league_entries e
   where e.season_id = v_season.id and e.user_id = v_uid;
  if not found then
    return;   -- só quem está no grupo enxerga o grupo
  end if;

  if v_season.status = 'closed' then
    return query
      select e.user_id,
             case when p.account_status = 'active' then p.display_name end,
             case when p.account_status = 'active' then p.avatar_url end,
             case when p.account_status = 'active' then p.banner_url end,
             (p.account_status = 'active'),
             coalesce(e.final_score, 0), coalesce(e.final_position, 0), e.movement,
             (e.user_id = v_uid)
        from public.league_entries e
        join public.profiles p on p.id = e.user_id
       where e.group_id = v_entry.group_id
       order by e.final_position, p.display_name;
  else
    return query
      select c.user_id,
             case when p.account_status = 'active' then p.display_name end,
             case when p.account_status = 'active' then p.avatar_url end,
             case when p.account_status = 'active' then p.banner_url end,
             (p.account_status = 'active'),
             c.score, c."position", c.movement,
             (c.user_id = v_uid)
        from public.league_compute(v_season.id, v_entry.group_id) c
        join public.profiles p on p.id = c.user_id
       order by c."position", p.display_name;
  end if;
end;
$$;

-- Histórico próprio de temporadas fechadas.
create or replace function public.league_my_history(p_limit integer default 12)
returns table (
  season_id      uuid,
  starts_at      timestamptz,
  ends_at        timestamptz,
  tier           smallint,
  tier_after     smallint,
  final_score    integer,
  final_position integer,
  group_size     integer,
  movement       text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.starts_at, s.ends_at, e.tier, e.tier_after,
         e.final_score, e.final_position, e.group_size, e.movement
    from public.league_entries e
    join public.league_seasons s on s.id = e.season_id
   where e.user_id = auth.uid() and e.closed_at is not null
   order by s.starts_at desc
   limit greatest(1, least(coalesce(p_limit, 12), 52));
$$;

-- ===========================================================================
-- 10) Ganchos nas funções de aprendizagem
--     finalize_attempt (0018) e complete_empty_lesson (0022) são recriadas com o MESMO
--     corpo, acrescentando apenas:
--       a) gravação dos créditos de XP (xp_credits) no ramo de curso;
--       b) registro da atividade oficial na liga (inscrição tardia), sem propagar erro.
-- ===========================================================================

create or replace function public.finalize_attempt(p_attempt_id uuid)
returns table (correct_count integer, total_count integer, xp_earned integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt         public.attempts%rowtype;
  v_is_room         boolean;
  v_context         text;
  v_total_xp        integer := 0;
  v_correct         integer := 0;
  v_total           integer := 0;
  v_lesson_qcount   integer;
  v_answered        integer;
  v_course_id       uuid;
  v_already_final   boolean;
  v_course_public   boolean := false;
  v_ans             record;
  v_graded          record;
  v_award_xp        integer;
  v_already_correct boolean;
  v_own_course      boolean := false;
  v_completed       boolean := false;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id for update;
  if not found then
    raise exception 'attempt % not found', p_attempt_id;
  end if;

  -- OWNERSHIP: although SECURITY DEFINER, only the attempt owner (or an admin)
  -- may finalize/grade an attempt. This prevents one user re-grading another's
  -- attempt or triggering writes against a victim's rows.
  if auth.uid() is not null
     and v_attempt.user_id <> auth.uid()
     and not public.is_admin() then
    raise exception 'not authorized to finalize attempt %', p_attempt_id
      using errcode = '42501';
  end if;

  -- IDEMPOTENCY: capture whether the attempt was already finalized BEFORE this
  -- call. XP/room-XP, completion side effects and progress are applied only on
  -- the first finalize so a repeated RPC cannot double-count global/room XP.
  v_already_final := v_attempt.finished_at is not null;

  v_is_room := v_attempt.room_id is not null;
  v_context := case when v_is_room then 'room' else 'course' end;

  -- Grade each stored answer against its question config.
  for v_ans in
    select ans.id as answer_id, ans.question_id, q.type, q.config, q.xp_value, ans.submitted
      from public.answers ans
      join public.questions q on q.id = ans.question_id
     where ans.attempt_id = p_attempt_id
  loop
    select * into v_graded
      from public.grade_answer(v_ans.type, v_ans.config, v_ans.submitted, v_ans.xp_value);

    v_award_xp := v_graded.xp;

    -- ANTI-REGRIND: if the user already answered THIS question correctly in a
    -- different, already-finalized attempt, award 0 XP for it now. is_correct
    -- is still recorded truthfully (so correct_count/total_count are accurate);
    -- only the XP is suppressed, and the suppression propagates to the summed
    -- attempt xp (profiles.xp_global / room_members.xp_internal) below.
    v_already_correct := exists (
      select 1
        from public.answers prev
        join public.attempts pa on pa.id = prev.attempt_id
       where prev.question_id = v_ans.question_id
         and prev.attempt_id <> p_attempt_id
         and prev.is_correct = true
         and pa.user_id = v_attempt.user_id
         and pa.finished_at is not null
    );
    if v_already_correct then
      v_award_xp := 0;
    end if;

    update public.answers
       set is_correct = v_graded.is_correct,
           xp_earned  = v_award_xp
     where id = v_ans.answer_id;

    v_total := v_total + 1;
    if v_graded.is_correct then
      v_correct := v_correct + 1;
    end if;
    v_total_xp := v_total_xp + v_award_xp;
  end loop;

  update public.attempts
     set correct_count = v_correct,
         total_count   = v_total,
         xp_earned     = v_total_xp,
         finished_at   = coalesce(finished_at, now())
   where id = p_attempt_id;

  -- The side effects below (completion, XP, enrollment/progress, streak, medals)
  -- run ONLY on the first finalize of this attempt. A repeat call re-grades and
  -- re-reports totals but does not re-award XP (idempotent authority).
  if not v_already_final then
    -- Completion: inserted when every question of the lesson has been answered.
    select count(*) into v_lesson_qcount
      from public.questions where lesson_id = v_attempt.lesson_id;

    select count(*) into v_answered
      from public.answers where attempt_id = p_attempt_id;

    if v_lesson_qcount > 0 and v_answered >= v_lesson_qcount then
      insert into public.completions (user_id, lesson_id, context, attempt_id)
      values (v_attempt.user_id, v_attempt.lesson_id, v_context, p_attempt_id)
      on conflict (user_id, lesson_id, context) do update
        set attempt_id = excluded.attempt_id, completed_at = now();
      v_completed := true;
    end if;

    if v_is_room then
      -- ROOM context: internal metrics only. NEVER touch profiles.xp_global.
      update public.room_members
         set xp_internal = xp_internal + v_total_xp
       where room_id = v_attempt.room_id and user_id = v_attempt.user_id;

      perform public.recompute_room_metrics(v_attempt.room_id, v_attempt.user_id);
    else
      -- COURSE context: resolve the course from the attempt or the lesson's module.
      v_course_id := v_attempt.course_id;
      if v_course_id is null then
        select m.course_id into v_course_id
          from public.lessons l
          join public.modules m on m.id = l.module_id
         where l.id = v_attempt.lesson_id;
      end if;

      -- ENROLLMENT BOUNDARY: only auto-enroll and credit course-context global
      -- XP for a course the user may actually enroll in (public + published),
      -- or one the user already created / already enrolled in. This mirrors the
      -- enrollments_insert_own RLS policy that this SECURITY DEFINER path would
      -- otherwise bypass, so a draft/private lesson cannot self-enroll a user.
      if v_course_id is not null then
        select (c.status = 'published' and c.visibility = 'public')
               or c.creator_id = v_attempt.user_id
               or exists (
                    select 1 from public.enrollments e
                     where e.user_id = v_attempt.user_id and e.course_id = v_course_id
                  ),
               (c.creator_id = v_attempt.user_id)
          into v_course_public, v_own_course
          from public.courses c
         where c.id = v_course_id;
      end if;

      if v_course_id is not null and coalesce(v_course_public, false) then
        -- Credit global XP + recompute level only for an accessible course.
        update public.profiles
           set xp_global = xp_global + v_total_xp,
               level = public.level_for_xp(xp_global + v_total_xp),
               updated_at = now()
         where id = v_attempt.user_id;

        -- Ensure an enrollment row exists so progress can be tracked.
        insert into public.enrollments (user_id, course_id)
        values (v_attempt.user_id, v_course_id)
        on conflict (user_id, course_id) do nothing;

        perform public.recompute_course_progress(v_attempt.user_id, v_course_id);

        -- LIGA: registra os créditos desta tentativa no livro. Só conta para a temporada
        -- quando o curso não é de autoria própria; XP de sala nunca chega aqui.
        -- (answers.xp_earned já vem zerado pelo anti-regrind para questão já acertada.)
        if v_total_xp > 0 then
          insert into public.xp_credits
            (user_id, source, amount, competitive, course_id, attempt_id, answer_id)
          select v_attempt.user_id, 'learning', a.xp_earned, not v_own_course,
                 v_course_id, p_attempt_id, a.id
            from public.answers a
           where a.attempt_id = p_attempt_id and a.xp_earned > 0
          on conflict (answer_id) where answer_id is not null do nothing;
        end if;
      end if;
    end if;

    -- LIGA: conclusão oficial de aula (curso OU sala) inscreve na liga da semana, sem exigir XP.
    if v_completed then
      perform public.league_register_activity(v_attempt.user_id);
    end if;

    -- Streak + medals apply to any study activity (first finalize only).
    perform public.touch_streak(v_attempt.user_id);
    perform public.grant_medals(v_attempt.user_id);
  end if;

  correct_count := v_correct;
  total_count   := v_total;
  xp_earned     := v_total_xp;
  return next;
end;
$$;

comment on function public.finalize_attempt(uuid) is
  'Server authority: grades all answers and reports totals. Owner-only (or admin) despite SECURITY DEFINER. Idempotent: XP/room-XP, completion, enrollment/progress, streak and medals apply only on the FIRST finalize (finished_at was null). COURSE context credits global XP+level only for an accessible course (public+published, own, or already-enrolled); ROOM context updates room_members internal metrics only and never touches global XP. ANTI-REGRIND: a question already answered correctly in a prior finalized attempt (same user) awards 0 XP on re-answer; is_correct and correct_count still reflect correctness, only xp_earned (per-answer and the summed attempt XP) excludes already-correct questions, in both course and room contexts. LIGA: grava xp_credits (competitivo só em curso não-próprio) e inscreve a atividade oficial na liga.';


create or replace function public.complete_empty_lesson(p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user         uuid := auth.uid();
  v_qcount       integer;
  v_course_id    uuid;
  v_accessible   boolean := false;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Só vale para aulas sem nenhuma questão. Aulas com questões usam o fluxo de
  -- tentativa (finalize_attempt), que credita XP e grava a conclusão.
  select count(*) into v_qcount from public.questions where lesson_id = p_lesson_id;
  if v_qcount > 0 then
    raise exception 'lesson % has questions; use finalize_attempt instead', p_lesson_id;
  end if;

  -- Resolve o curso da aula (aula -> módulo -> curso).
  select m.course_id into v_course_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where l.id = p_lesson_id;

  if v_course_id is null then
    raise exception 'lesson % not found', p_lesson_id;
  end if;

  -- Mesma fronteira do finalize_attempt: o curso precisa ser acessível ao
  -- usuário (público+publicado, próprio, ou já matriculado).
  select (c.status = 'published' and c.visibility = 'public')
         or c.creator_id = v_user
         or exists (
              select 1 from public.enrollments e
               where e.user_id = v_user and e.course_id = v_course_id
            )
    into v_accessible
    from public.courses c
   where c.id = v_course_id;

  if not coalesce(v_accessible, false) then
    raise exception 'course % is not accessible to the current user', v_course_id using errcode = '42501';
  end if;

  -- Conclusão (contexto de curso), sem attempt e sem XP.
  insert into public.completions (user_id, lesson_id, context, attempt_id)
  values (v_user, p_lesson_id, 'course', null)
  on conflict (user_id, lesson_id, context) do nothing;

  -- Garante a matrícula e recalcula o progresso do curso.
  insert into public.enrollments (user_id, course_id)
  values (v_user, v_course_id)
  on conflict (user_id, course_id) do nothing;

  perform public.recompute_course_progress(v_user, v_course_id);

  -- Atividade de estudo conta para streak e medalhas (como no finalize).
  perform public.touch_streak(v_user);
  perform public.grant_medals(v_user);

  -- LIGA: conclusão oficial (mesmo sem questões) inscreve na liga da semana, sem exigir XP.
  perform public.league_register_activity(v_user);
end;
$$;



-- ===========================================================================
-- 11) Permissões: o cliente só chama as funções de leitura/sincronização.
--     Funções internas não são executáveis por anon/authenticated.
-- ===========================================================================
revoke execute on function
  public.league_affinity(uuid[]),
  public.league_form_groups(uuid, smallint, uuid[]),
  public.league_late_enroll(uuid, uuid),
  public.league_compute(uuid, uuid),
  public.league_close_season(uuid),
  public.league_open_season(timestamptz),
  public.league_tick(),
  public.league_register_activity(uuid),
  public.league_sync(),
  public.league_overview(),
  public.league_my_group(uuid),
  public.league_my_history(integer)
from public, anon, authenticated;

grant execute on function public.league_sync()                to authenticated;
grant execute on function public.league_overview()           to authenticated;
grant execute on function public.league_my_group(uuid)       to authenticated;
grant execute on function public.league_my_history(integer)  to authenticated;

comment on function public.league_tick() is
  'Fecha temporadas vencidas e abre a da semana atual (idempotente). Agende no pg_cron a cada 5 minutos: select cron.schedule(''athen-league-tick'', ''*/5 * * * *'', $$select public.league_tick()$$);  Sem cron, a virada acontece sozinha na primeira atividade/abertura da página Ligas da semana.';