-- 0026_seasons_structure.sql
-- Temporadas competitivas (ligas globais por XP) — ESTRUTURA.
--
-- Contexto: o ranking global atual (view global_ranking, 0015) é vitalício por
-- xp_global, sem período/reset. O questionário redefine as ligas como GLOBAIS e
-- divididas em TEMPORADAS de XP (Q101/Q103): cada temporada tem duração semanal
-- (segunda a segunda, America/Sao_Paulo — Q021), categorias Bronze→Lendário
-- (Q105) e grupos competitivos congelados por temporada (Q104). A pontuação da
-- temporada é só o XP novo elegível de aprendizagem individual na janela (Q102),
-- que já pode ser lido por user_xp_in_window (0023).
--
-- Esta fatia cria SOMENTE a estrutura persistente (temporadas, grupos, entradas)
-- e a leitura básica. A FORMAÇÃO de grupos por afinidade social (Q123) e a
-- ABERTURA/FECHAMENTO com cortes e rebaixamento de zeros (Q105/Q143) ficam para
-- as próximas fatias. Nada aqui reinicia nível/XP vitalício (Q101) nem toca o
-- PAC de curso/sala, que não tem temporada (Q118).

-- ---------------------------------------------------------------------------
-- Enums.
--   season_category: as 7 faixas competitivas, espelhando os tiers do cliente
--     (src/pages/Ligas.tsx / RankingPodium Tier). Bronze é o piso (Q143).
--   season_status:   ciclo de vida da temporada.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'season_category') then
    create type public.season_category as enum (
      'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'legendary'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'season_status') then
    create type public.season_status as enum (
      'scheduled',  -- criada, janela ainda não começou
      'open',       -- janela corrente aceitando XP competitivo
      'closing',    -- virada ocorreu; apuração/formação em andamento
      'closed'      -- resultado fechado e publicado
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- seasons: uma temporada por janela semanal. starts_at inclusivo, ends_at
-- exclusivo (Q022/Q094). Único por starts_at para não duplicar a mesma semana.
-- ---------------------------------------------------------------------------
create table if not exists public.seasons (
  id         uuid primary key default gen_random_uuid(),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  status     public.season_status not null default 'scheduled',
  closed_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (starts_at)
);

comment on table public.seasons is
  'Temporada competitiva (liga global por XP), janela semanal [starts_at, ends_at) em America/Sao_Paulo. A pontuação é o XP novo elegível (learning_base/course) na janela (Q102). Não reinicia nível/XP vitalício.';
comment on column public.seasons.status is
  'scheduled -> open -> closing -> closed. closing cobre a apuração/formação (alvo de 5 min após a virada, Q141).';

create index if not exists seasons_status_idx on public.seasons (status, starts_at);

-- ---------------------------------------------------------------------------
-- season_groups: grupo competitivo dentro de uma temporada e categoria. Os
-- competidores de uma mesma categoria são divididos em múltiplos grupos
-- (alvo 20, mínimo 10, teto 30 — Q104/Q124). A formação em si (afinidade social)
-- vem na próxima fatia; aqui só a tabela e os parâmetros congelados.
-- ---------------------------------------------------------------------------
create table if not exists public.season_groups (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references public.seasons (id) on delete cascade,
  category    public.season_category not null,
  group_index integer not null check (group_index >= 1), -- 1..N dentro da (temporada, categoria)
  capacity    integer not null default 30 check (capacity >= 1), -- teto 30 (Q104)
  created_at  timestamptz not null default now(),
  unique (season_id, category, group_index)
);

comment on table public.season_groups is
  'Grupo competitivo de uma temporada+categoria. Alvo 20, mínimo 10, teto 30 (Q104/Q124). A audiência do usuário é o próprio grupo (Q066).';

create index if not exists season_groups_season_idx on public.season_groups (season_id, category);

-- ---------------------------------------------------------------------------
-- season_entries: a inscrição de um usuário numa temporada. Categoria e grupo
-- são atribuídos na formação e CONGELADOS até encerrar (Q104). season_xp é a
-- pontuação competitiva (só learning_base/course na janela — Q102), consolidada
-- no fechamento. result_category é a categoria resultante após os cortes (Q105/
-- Q143), definida no fechamento. Aqui a tabela é criada; os valores são
-- preenchidos pelas fatias de formação/fechamento.
-- ---------------------------------------------------------------------------
create table if not exists public.season_entries (
  id              uuid primary key default gen_random_uuid(),
  season_id       uuid not null references public.seasons (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  group_id        uuid references public.season_groups (id) on delete set null,
  category        public.season_category not null default 'bronze', -- categoria da temporada (congelada)
  season_xp       integer not null default 0 check (season_xp >= 0), -- XP competitivo consolidado
  final_rank      integer,                       -- posição no grupo no fechamento
  result_category public.season_category,        -- categoria após cortes (persistida para a próxima temporada)
  identity_hidden boolean not null default false, -- Q070: conta desativada oculta identidade, mantém linha
  joined_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (season_id, user_id)
);

comment on table public.season_entries is
  'Inscrição de um usuário numa temporada. category/group congelados na formação (Q104); season_xp é o XP competitivo (learning_base/course na janela, Q102); result_category é a categoria após os cortes (Q105/Q143), base da categoria inicial da próxima temporada. identity_hidden preserva a linha competitiva sem identidade exposta (Q070).';
comment on column public.season_entries.category is
  'Categoria competitiva da temporada, congelada. Primeira participação começa em bronze (Q139); demais herdam a result_category anterior.';

create index if not exists season_entries_season_idx on public.season_entries (season_id);
create index if not exists season_entries_user_idx on public.season_entries (user_id);
create index if not exists season_entries_group_idx on public.season_entries (group_id);

-- ---------------------------------------------------------------------------
-- RLS / audiência (Q066/Q069).
--   seasons / season_groups: legíveis por qualquer autenticado (metadados da
--     liga; a navegação entre grupos alheios é limitada nas leituras da fatia
--     de ranking, não aqui).
--   season_entries: o usuário lê a PRÓPRIA inscrição e as inscrições do SEU
--     grupo (audiência = próprio grupo, Q066). Identidade exibida é tratada na
--     camada de leitura/ranking (Q069); a política garante o alcance ao grupo.
--     Admin lê tudo. Escrita só por funções de autoridade (formação/fechamento)
--     e admin; sem escrita livre do cliente.
-- ---------------------------------------------------------------------------
alter table public.seasons        enable row level security;
alter table public.season_groups  enable row level security;
alter table public.season_entries enable row level security;

drop policy if exists seasons_select on public.seasons;
create policy seasons_select on public.seasons
  for select to authenticated using (true);

drop policy if exists seasons_admin_write on public.seasons;
create policy seasons_admin_write on public.seasons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists season_groups_select on public.season_groups;
create policy season_groups_select on public.season_groups
  for select to authenticated using (true);

drop policy if exists season_groups_admin_write on public.season_groups;
create policy season_groups_admin_write on public.season_groups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Helper SECURITY DEFINER para evitar recursão de RLS ao consultar o próprio
-- grupo dentro da política de season_entries (mesmo padrão de is_active_room_member).
create or replace function public.is_in_season_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.season_entries se
     where se.group_id = p_group_id
       and se.user_id = auth.uid()
  );
$$;

comment on function public.is_in_season_group(uuid) is
  'True quando o usuário autenticado pertence ao grupo de temporada informado. SECURITY DEFINER para a política de season_entries referenciar o grupo sem recursão.';

grant execute on function public.is_in_season_group(uuid) to authenticated;

drop policy if exists season_entries_select on public.season_entries;
create policy season_entries_select on public.season_entries
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or (group_id is not null and public.is_in_season_group(group_id))
  );

drop policy if exists season_entries_admin_write on public.season_entries;
create policy season_entries_admin_write on public.season_entries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- updated_at automático (trigger touch_updated_at de 0012).
drop trigger if exists set_updated_at on public.seasons;
create trigger set_updated_at before update on public.seasons
  for each row execute function public.touch_updated_at();

drop trigger if exists set_updated_at on public.season_entries;
create trigger set_updated_at before update on public.season_entries
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Leitura de apoio: season_category_rank(category) -> ordinal 1..7 (bronze=1 ..
-- legendary=7). Usado pela promoção/rebaixamento das próximas fatias para subir
-- ou descer uma faixa respeitando o piso Bronze (Q143). Determinístico.
-- ---------------------------------------------------------------------------
create or replace function public.season_category_rank(p_category public.season_category)
returns integer
language sql
immutable
as $$
  select case p_category
    when 'bronze'    then 1
    when 'silver'    then 2
    when 'gold'      then 3
    when 'platinum'  then 4
    when 'diamond'   then 5
    when 'master'    then 6
    when 'legendary' then 7
  end;
$$;

comment on function public.season_category_rank(public.season_category) is
  'Ordinal 1..7 da categoria (bronze=1 .. legendary=7). Base para promoção/rebaixamento de uma faixa com piso Bronze (Q143).';

-- season_category_from_rank(rank): inverso, com clamp em [1,7]. O piso Bronze e o
-- teto Lendário são garantidos pelo clamp.
create or replace function public.season_category_from_rank(p_rank integer)
returns public.season_category
language sql
immutable
as $$
  select case greatest(1, least(7, p_rank))
    when 1 then 'bronze'::public.season_category
    when 2 then 'silver'::public.season_category
    when 3 then 'gold'::public.season_category
    when 4 then 'platinum'::public.season_category
    when 5 then 'diamond'::public.season_category
    when 6 then 'master'::public.season_category
    when 7 then 'legendary'::public.season_category
  end;
$$;

comment on function public.season_category_from_rank(integer) is
  'Categoria a partir do ordinal, com clamp em [1,7] (piso Bronze, teto Lendário). Usada para mover uma faixa nos cortes.';
