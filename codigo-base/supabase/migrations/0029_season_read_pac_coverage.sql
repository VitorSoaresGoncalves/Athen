-- 0029_season_read_pac_coverage.sql
-- Leituras da temporada (grupo/resumo/histórico) e cobertura do PAC.
--
-- Contexto: 0026–0028 criaram e operaram as temporadas, mas sem leitura para a
-- UI. Esta fatia expõe as consultas que a página de ligas usará (Q066/Q069) e
-- complementa o PAC com a COBERTURA separada (Q111, opção A), sem alterar a
-- função pac() binária já em produção (usada em sala e amigos-curso).
--
-- Identidade (Q069): as leituras expõem SOMENTE a identidade padrão — display
-- name, avatar e banner. identity_hidden (conta desativada após inscrição —
-- Q070) oculta esses campos mas preserva a linha competitiva (posição/XP).
--
-- NÃO altera a economia de XP. A ponderação de acerto por número de tentativa
-- (Q112) muda o CRÉDITO de XP, que é comportamento do núcleo (finalize_attempt/
-- anti-regrind, já mesclado); fica para uma fatia de ajuste de economia própria,
-- para não conflitar com o anti-regrind atual. Aqui o PAC permanece o mesmo e só
-- ganha a cobertura ao lado (Q111).

-- ===========================================================================
-- PARTE A — Cobertura do PAC (Q111, opção A)
-- ===========================================================================

-- course_coverage(user, course): fração (0..100) das questões do curso que o
-- usuário efetivamente avaliou no contexto individual (room_id is null). O PAC
-- (acertos/avaliadas) mede PRECISÃO; a cobertura mede QUANTO do curso foi
-- coberto — os dois são exibidos lado a lado (Q111). Conta questões distintas
-- respondidas em tentativas finalizadas de curso.
create or replace function public.course_coverage(
  p_user_id   uuid,
  p_course_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with total as (
    select count(*)::numeric as n
      from public.questions q
      join public.lessons  l on l.id = q.lesson_id
      join public.modules  m on m.id = l.module_id
     where m.course_id = p_course_id
  ),
  seen as (
    select count(distinct ans.question_id)::numeric as n
      from public.answers ans
      join public.attempts a on a.id = ans.attempt_id
      join public.questions q on q.id = ans.question_id
      join public.lessons  l on l.id = q.lesson_id
      join public.modules  m on m.id = l.module_id
     where a.user_id = p_user_id
       and a.course_id = p_course_id
       and a.room_id is null
       and a.finished_at is not null
       and m.course_id = p_course_id
  )
  select case
    when (select n from total) <= 0 then 0::numeric
    else round(((select n from seen) / (select n from total)) * 100, 2)
  end;
$$;

comment on function public.course_coverage(uuid, uuid) is
  'Cobertura (0..100) do curso pelo usuário no contexto individual: questões distintas avaliadas / questões do curso (Q111). Exibida ao lado do PAC (precisão), não o substitui.';

grant execute on function public.course_coverage(uuid, uuid) to authenticated;

-- friends_course_pac_v2(course): mesma audiência de friends_course_pac (próprio
-- usuário + amigos aceitos, contexto de curso), agora com a COBERTURA ao lado do
-- PAC (Q111). Mantém friends_course_pac intacta para compatibilidade; a UI pode
-- migrar para esta versão quando mostrar cobertura.
create or replace function public.friends_course_pac_v2(p_course_id uuid)
returns table (
  user_id      uuid,
  username     text,
  display_name text,
  avatar_url   text,
  is_self      boolean,
  correct      integer,
  total        integer,
  pac          numeric,
  coverage     numeric,
  division     text
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as uid
  ),
  friend_ids as (
    select (select uid from me) as id
    union
    select case when f.requester_id = (select uid from me)
                then f.addressee_id else f.requester_id end
      from public.friendships f
     where f.status = 'accepted'
       and ((select uid from me) in (f.requester_id, f.addressee_id))
  ),
  agg as (
    select
      a.user_id,
      coalesce(sum(a.correct_count), 0)::integer as correct,
      coalesce(sum(a.total_count), 0)::integer   as total
    from public.attempts a
    where a.course_id = p_course_id
      and a.room_id is null
      and a.finished_at is not null
      and a.user_id in (select id from friend_ids where id is not null)
    group by a.user_id
  )
  select
    p.id as user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    (p.id = (select uid from me)) as is_self,
    coalesce(ag.correct, 0) as correct,
    coalesce(ag.total, 0)   as total,
    public.pac(coalesce(ag.correct, 0), coalesce(ag.total, 0)) as pac,
    public.course_coverage(p.id, p_course_id) as coverage,
    public.division_for_pac(
      public.pac(coalesce(ag.correct, 0), coalesce(ag.total, 0))
    ) as division
  from public.profiles p
  join friend_ids fi on fi.id = p.id
  left join agg ag on ag.user_id = p.id
  where fi.id is not null
  order by pac desc, coverage desc, p.display_name asc;
$$;

comment on function public.friends_course_pac_v2(uuid) is
  'Como friends_course_pac, com a cobertura ao lado do PAC (Q111). Audiência: caller + amigos aceitos, contexto de curso. SECURITY DEFINER, só expõe caller/amigos e agregados (nunca respostas cruas).';

grant execute on function public.friends_course_pac_v2(uuid) to authenticated;

-- ===========================================================================
-- PARTE B — Leituras da temporada (Q066/Q069)
-- ===========================================================================

-- current_season(): a temporada corrente (status open/closing) cuja janela
-- contém agora; null se não houver. Leitura simples de apoio à UI.
create or replace function public.current_season()
returns table (
  id        uuid,
  starts_at timestamptz,
  ends_at   timestamptz,
  status    public.season_status
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.starts_at, s.ends_at, s.status
    from public.seasons s
   where now() >= s.starts_at and now() < s.ends_at
   order by s.starts_at desc
   limit 1;
$$;

comment on function public.current_season() is
  'Temporada corrente (janela contém agora). Apoio à UI de ligas.';

grant execute on function public.current_season() to authenticated;

-- my_season_summary(season): resumo pessoal do usuário autenticado numa
-- temporada — categoria, grupo, XP competitivo, posição e categoria resultante.
-- Sempre disponível ao próprio usuário mesmo fora do Top N (Q097).
create or replace function public.my_season_summary(p_season_id uuid)
returns table (
  season_id       uuid,
  category        public.season_category,
  group_id        uuid,
  group_index     integer,
  season_xp       integer,
  final_rank      integer,
  result_category public.season_category,
  group_size      integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    se.season_id,
    se.category,
    se.group_id,
    g.group_index,
    se.season_xp,
    se.final_rank,
    se.result_category,
    (select count(*)::integer from public.season_entries x where x.group_id = se.group_id) as group_size
  from public.season_entries se
  left join public.season_groups g on g.id = se.group_id
  where se.season_id = p_season_id
    and se.user_id = auth.uid();
$$;

comment on function public.my_season_summary(uuid) is
  'Resumo pessoal do usuário autenticado numa temporada (categoria, grupo, XP, posição, resultado). Disponível mesmo fora do Top N (Q097).';

grant execute on function public.my_season_summary(uuid) to authenticated;

-- my_season_group(season): a classificação do PRÓPRIO grupo do usuário na
-- temporada (Q066: só o próprio grupo). Expõe identidade padrão (Q069); linhas
-- com identity_hidden (Q070) vêm sem nome/avatar/banner, mas com posição/XP.
-- Retorna [] quando o usuário não tem grupo (estado de formação — Q066/Q141).
create or replace function public.my_season_group(p_season_id uuid)
returns table (
  user_id       uuid,
  display_name  text,
  avatar_url    text,
  banner_url    text,
  season_xp     integer,
  rank_position integer,  -- "position" é palavra reservada do SQL e quebra a criação da função
  is_self       boolean,
  hidden        boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with my_group as (
    select se.group_id
      from public.season_entries se
     where se.season_id = p_season_id and se.user_id = auth.uid()
     limit 1
  )
  select
    se.user_id,
    case when se.identity_hidden then null else p.display_name end as display_name,
    case when se.identity_hidden then null else p.avatar_url end   as avatar_url,
    case when se.identity_hidden then null else p.banner_url end   as banner_url,
    se.season_xp,
    rank() over (order by se.season_xp desc, se.joined_at asc, se.user_id asc)::integer as rank_position,
    (se.user_id = auth.uid()) as is_self,
    se.identity_hidden as hidden
  from public.season_entries se
  join public.profiles p on p.id = se.user_id
  where se.group_id is not null
    and se.group_id = (select group_id from my_group)
  order by rank_position asc;
$$;

comment on function public.my_season_group(uuid) is
  'Classificação do próprio grupo do usuário numa temporada (Q066). Identidade padrão (Q069); identity_hidden oculta nome/avatar/banner mas mantém posição/XP (Q070). Vazio sem grupo (estado de formação).';

grant execute on function public.my_season_group(uuid) to authenticated;

-- my_season_history(limit): histórico próprio das temporadas do usuário
-- (Q066/Q078: histórico próprio acessível). Mais recentes primeiro.
create or replace function public.my_season_history(p_limit integer default 20)
returns table (
  season_id       uuid,
  starts_at       timestamptz,
  ends_at         timestamptz,
  status          public.season_status,
  category        public.season_category,
  season_xp       integer,
  final_rank      integer,
  result_category public.season_category
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id, s.starts_at, s.ends_at, s.status,
    se.category, se.season_xp, se.final_rank, se.result_category
  from public.season_entries se
  join public.seasons s on s.id = se.season_id
  where se.user_id = auth.uid()
  order by s.starts_at desc
  limit greatest(coalesce(p_limit, 20), 1);
$$;

comment on function public.my_season_history(integer) is
  'Histórico próprio das temporadas do usuário autenticado (Q066/Q078), mais recentes primeiro.';

grant execute on function public.my_season_history(integer) to authenticated;
