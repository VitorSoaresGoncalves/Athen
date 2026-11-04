-- 0024_xp_ordinal_credits.sql
-- ============================================================================
-- Nova economia de XP: crédito proporcional à tentativa, saldos decimais, revisão sem XP repetido.
--
-- REGRAS (guia Q111/Q112/Q122/Q126/Q127/Q129; resposta do dono em Q112):
--   1. XP base de uma questão = questions.xp_value. Só quem acerta a questão INTEIRA recebe XP
--      (associação parcial deixa de pagar XP parcial; o PAC já tratava parcial como erro).
--   2. Cada usuário recebe UM crédito por questão em cada contexto: o curso individual conta como
--      um contexto e cada sala (rooms.id) como outro. Depois de creditada, refazer não paga de novo.
--   3. Valor do crédito = base / n, arredondado uma única vez em 4 casas decimais, onde n é o
--      ORDINAL do primeiro acerto entre os primeiros envios da questão, em tentativas distintas do
--      mesmo usuário e contexto. Base 4: acerta na 1ª tentativa = 4; 1º acerto na 2ª = 2; na 3ª = 1,3333.
--   4. O erro enviado conta mesmo se a tentativa for abandonada (o ordinal não "reseta"). Se o acerto
--      aconteceu numa tentativa abandonada, o ordinal dele é preservado: o crédito sai quando uma
--      tentativa finalizada confirmar o acerto.
--   5. Refazer a aula inteira continua válido (conclusão/progresso/PAC), mas só rende XP nas questões
--      ainda não creditadas naquele contexto.
--   6. Saldos em 4 casas decimais (numeric(12,4)); níveis mantêm os limites 0/100/250/500/1000/2000
--      e depois +2000: 99,9999 ainda é nível 1 e 100 é nível 2.
--   7. O primeiro envio de cada resposta é imutável (cliente não regrava resposta nem is_correct/xp).
--
-- COMPATIBILIDADE: recria finalize_attempt (0023). Liga: pontuação e saldos passam a numeric. XP de
-- bônus de missões (futuro) entra em xp_credits com source = 'mission_bonus' e competitive = false.
-- Aplicar depois da 0023.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Colunas de XP passam a decimal (4 casas)
-- ---------------------------------------------------------------------------
drop view if exists public.global_ranking;

alter table public.profiles      alter column xp_global    type numeric(12,4) using xp_global::numeric(12,4);
alter table public.room_members  alter column xp_internal  type numeric(12,4) using xp_internal::numeric(12,4);
alter table public.attempts      alter column xp_earned    type numeric(12,4) using xp_earned::numeric(12,4);
alter table public.answers       alter column xp_earned    type numeric(12,4) using xp_earned::numeric(12,4);
alter table public.xp_credits    alter column amount       type numeric(12,4) using amount::numeric(12,4);
alter table public.league_entries alter column final_score type numeric(12,4) using final_score::numeric(12,4);

create or replace view public.global_ranking as
  select
    p.id            as user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.xp_global,
    p.level,
    p.streak_count,
    rank() over (order by p.xp_global desc, p.created_at asc) as position
  from public.profiles p
  where p.account_status = 'active';

comment on view public.global_ranking is
  'All-time global leaderboard ordered by xp_global (no weekly period/reset). Inherits profiles RLS: readable by any authenticated user.';
alter view public.global_ranking set (security_invoker = true);
grant select on public.global_ranking to authenticated;

-- Nível a partir do saldo decimal. Mesmos limites inferiores da função inteira anterior.
drop function if exists public.level_for_xp(integer);
create or replace function public.level_for_xp(p_xp numeric)
returns integer
language sql
immutable
as $$
  select case
    when p_xp is null or p_xp < 100  then 1
    when p_xp < 250  then 2
    when p_xp < 500  then 3
    when p_xp < 1000 then 4
    when p_xp < 2000 then 5
    else 6 + floor((p_xp - 2000) / 2000)::integer
  end;
$$;

-- Fórmula única do crédito (ajuste de balanceamento = mexer só aqui).
create or replace function public.xp_credit_for(p_base numeric, p_ordinal integer)
returns numeric
language sql
immutable
as $$
  select round(coalesce(p_base, 0) / greatest(coalesce(p_ordinal, 1), 1), 4);
$$;

-- ---------------------------------------------------------------------------
-- 2) Livro de créditos: um crédito por usuário + questão + contexto
-- ---------------------------------------------------------------------------
alter table public.xp_credits
  add column if not exists question_id uuid references public.questions (id) on delete set null,
  add column if not exists room_id     uuid references public.rooms (id) on delete set null,
  add column if not exists ordinal     integer check (ordinal >= 1),
  add column if not exists base_xp     numeric(12,4),
  add column if not exists legacy      boolean not null default false;

comment on column public.xp_credits.ordinal is
  'n do crédito base/n: ordinal do primeiro acerto entre os primeiros envios da questão no contexto. Nulo em créditos legados e em bônus/ajustes.';
comment on column public.xp_credits.legacy is
  'true = marcador da abertura: a questão já havia sido acertada antes desta regra. Não soma saldo nem liga; só impede novo crédito.';

create unique index if not exists xp_credits_context_question_uidx
  on public.xp_credits (user_id, question_id, coalesce(room_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where source = 'learning' and question_id is not null;

-- Abertura (idempotente): créditos já gravados pela 0023 ganham a questão...
update public.xp_credits c
   set question_id = a.question_id
  from public.answers a
 where c.answer_id = a.id and c.question_id is null;

-- ...e quem já tinha acerto finalizado recebe um marcador por questão/contexto, para não ser pago de novo.
insert into public.xp_credits
  (user_id, source, amount, competitive, course_id, attempt_id, answer_id, question_id, room_id, legacy)
select distinct on (t.user_id, a.question_id, t.room_id)
       t.user_id, 'learning', a.xp_earned, false, t.course_id, t.id, a.id, a.question_id, t.room_id, true
  from public.answers a
  join public.attempts t on t.id = a.attempt_id
 where t.finished_at is not null
   and a.is_correct
   and a.xp_earned > 0
 order by t.user_id, a.question_id, t.room_id, t.finished_at, a.created_at
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3) Primeiro envio imutável e sem XP vindo do cliente
-- ---------------------------------------------------------------------------
create or replace function public.answers_guard()
returns trigger
language plpgsql
as $$
declare
  v_finished timestamptz;
begin
  if tg_op = 'INSERT' then
    select finished_at into v_finished from public.attempts where id = new.attempt_id;
    if v_finished is not null then
      raise exception 'attempt % is already finalized', new.attempt_id using errcode = '55000';
    end if;
    if current_user in ('anon', 'authenticated') then
      new.is_correct := false;
      new.xp_earned  := 0;
    end if;
  else
    -- Reenvio da mesma pergunta na mesma tentativa mantém o PRIMEIRO envio.
    new.attempt_id  := old.attempt_id;
    new.question_id := old.question_id;
    new.submitted   := old.submitted;
    new.created_at  := old.created_at;
    if current_user in ('anon', 'authenticated') then
      new.is_correct := old.is_correct;
      new.xp_earned  := old.xp_earned;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists answers_guard_ins on public.answers;
create trigger answers_guard_ins before insert on public.answers
  for each row execute function public.answers_guard();
drop trigger if exists answers_guard_upd on public.answers;
create trigger answers_guard_upd before update on public.answers
  for each row execute function public.answers_guard();

-- ---------------------------------------------------------------------------
-- 4) Ordinal, prévia e detalhamento
-- ---------------------------------------------------------------------------
-- Menor ordinal (1, 2, 3...) entre os primeiros envios CORRETOS do usuário nesta questão e contexto
-- (p_room_id nulo = curso individual). Considera tentativas finalizadas e abandonadas.
create or replace function public.learning_first_correct_ordinal(
  p_user_id uuid, p_question_id uuid, p_room_id uuid
)
returns integer
language sql
stable
set search_path = public
as $$
  with subs as (
    select a.submitted, q.type, q.config, q.xp_value,
           row_number() over (order by a.created_at, a.id)::integer as n
      from public.answers a
      join public.attempts t on t.id = a.attempt_id
      join public.questions q on q.id = a.question_id
     where t.user_id = p_user_id
       and a.question_id = p_question_id
       and t.room_id is not distinct from p_room_id
  )
  select min(s.n)
    from subs s
   where (select g.is_correct from public.grade_answer(s.type, s.config, s.submitted, s.xp_value) g);
$$;

-- Prévia para a tela: quanto cada questão da aula vale AGORA para quem está logado.
create or replace function public.learning_xp_preview(p_lesson_id uuid, p_room_id uuid default null)
returns table (
  question_id  uuid,
  base_xp      numeric,
  credited     boolean,
  credited_xp  numeric,
  next_ordinal integer,
  potential_xp numeric
)
language sql
stable
set search_path = public
as $$
  select q.id,
         q.xp_value::numeric,
         c.id is not null,
         coalesce(c.amount, 0),
         o.n,
         case when c.id is not null then 0 else public.xp_credit_for(q.xp_value, o.n) end
    from public.questions q
    left join public.xp_credits c
           on c.user_id = auth.uid()
          and c.question_id = q.id
          and c.source = 'learning'
          and c.room_id is not distinct from p_room_id
    cross join lateral (
      select coalesce(
               public.learning_first_correct_ordinal(auth.uid(), q.id, p_room_id),
               (select count(*) + 1
                  from public.answers a
                  join public.attempts t on t.id = a.attempt_id
                 where t.user_id = auth.uid()
                   and a.question_id = q.id
                   and t.room_id is not distinct from p_room_id)::integer
             ) as n
    ) o
   where q.lesson_id = p_lesson_id
     and auth.uid() is not null
   order by q.position, q.id;
$$;

-- Resultado detalhado de uma tentativa já finalizada (para a tela de resultado).
--   status: 'credited' (rendeu XP), 'already_credited' (acertou, mas já havia sido creditada),
--           'wrong' (errou; poderá render base/n numa próxima tentativa), 'no_xp' (questão sem XP).
create or replace function public.learning_attempt_breakdown(p_attempt_id uuid)
returns table (
  question_id        uuid,
  is_correct         boolean,
  submission_ordinal integer,
  base_xp            numeric,
  credited_xp        numeric,
  status             text
)
language sql
stable
set search_path = public
as $$
  select a.question_id,
         a.is_correct,
         (select count(*)::integer
            from public.answers a2
            join public.attempts t2 on t2.id = a2.attempt_id
           where t2.user_id = t.user_id
             and a2.question_id = a.question_id
             and t2.room_id is not distinct from t.room_id
             and (a2.created_at, a2.id) <= (a.created_at, a.id)),
         q.xp_value::numeric,
         a.xp_earned,
         case when not a.is_correct then 'wrong'
              when a.xp_earned > 0 then 'credited'
              when q.xp_value = 0 then 'no_xp'
              else 'already_credited' end
    from public.answers a
    join public.attempts t on t.id = a.attempt_id
    join public.questions q on q.id = a.question_id
   where a.attempt_id = p_attempt_id
   order by q.position, q.id;
$$;

revoke execute on function public.learning_first_correct_ordinal(uuid, uuid, uuid) from public, anon;
revoke execute on function public.learning_xp_preview(uuid, uuid)                  from public, anon;
revoke execute on function public.learning_attempt_breakdown(uuid)                 from public, anon;
grant execute on function public.learning_first_correct_ordinal(uuid, uuid, uuid) to authenticated;
grant execute on function public.learning_xp_preview(uuid, uuid)                  to authenticated;
grant execute on function public.learning_attempt_breakdown(uuid)                 to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Liga: pontuação passa a decimal (mesmas regras da 0023)
-- ---------------------------------------------------------------------------
drop function if exists public.league_overview();
drop function if exists public.league_my_group(uuid);
drop function if exists public.league_my_history(integer);
drop function if exists public.league_compute(uuid, uuid);

create or replace function public.league_compute(p_season_id uuid, p_group_id uuid default null)
returns table (
  entry_id   uuid,
  group_id   uuid,
  user_id    uuid,
  tier       smallint,
  score      numeric(12,4),
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
           ), 0)::numeric(12,4) as score
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
  score             numeric(12,4),
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
  score        numeric(12,4),
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
  final_score    numeric(12,4),
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


revoke execute on function
  public.league_compute(uuid, uuid),
  public.league_overview(),
  public.league_my_group(uuid),
  public.league_my_history(integer)
from public, anon, authenticated;

grant execute on function public.league_overview()          to authenticated;
grant execute on function public.league_my_group(uuid)      to authenticated;
grant execute on function public.league_my_history(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) finalize_attempt com crédito proporcional à tentativa
--    (corpo da 0023; muda: saldos decimais, ordinal, crédito único por questão/contexto,
--     reexecução idempotente que apenas devolve o resultado já gravado)
-- ---------------------------------------------------------------------------
drop function if exists public.finalize_attempt(uuid);

create or replace function public.finalize_attempt(p_attempt_id uuid)
returns table (correct_count integer, total_count integer, xp_earned numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt         public.attempts%rowtype;
  v_is_room         boolean;
  v_context         text;
  v_total_xp        numeric(12,4) := 0;
  v_correct         integer := 0;
  v_total           integer := 0;
  v_lesson_qcount   integer;
  v_answered        integer;
  v_course_id       uuid;
  v_course_public   boolean := false;
  v_own_course      boolean := false;
  v_creditable      boolean := false;
  v_completed       boolean := false;
  v_ans             record;
  v_graded          record;
  v_ordinal         integer;
  v_credit          numeric(12,4);
  v_rows            integer;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id for update;
  if not found then
    raise exception 'attempt % not found', p_attempt_id;
  end if;

  -- Só o dono da tentativa (ou admin) finaliza.
  if auth.uid() is not null
     and v_attempt.user_id <> auth.uid()
     and not public.is_admin() then
    raise exception 'not authorized to finalize attempt %', p_attempt_id
      using errcode = '42501';
  end if;

  -- IDEMPOTÊNCIA: tentativa já finalizada só devolve o que foi gravado. Nada é corrigido nem pago de novo.
  if v_attempt.finished_at is not null then
    correct_count := v_attempt.correct_count;
    total_count   := v_attempt.total_count;
    xp_earned     := v_attempt.xp_earned;
    return next;
    return;
  end if;

  v_is_room := v_attempt.room_id is not null;
  v_context := case when v_is_room then 'room' else 'course' end;

  -- Curso da tentativa e se este contexto pode creditar XP.
  v_course_id := v_attempt.course_id;
  if v_course_id is null then
    select m.course_id into v_course_id
      from public.lessons l
      join public.modules m on m.id = l.module_id
     where l.id = v_attempt.lesson_id;
  end if;

  if v_is_room then
    -- SALA: o XP vai só para o saldo interno de quem é membro ativo.
    select exists (
             select 1 from public.room_members rm
              where rm.room_id = v_attempt.room_id
                and rm.user_id = v_attempt.user_id
                and rm.status = 'active'
           )
      into v_creditable;
  elsif v_course_id is not null then
    -- CURSO: só credita XP global em curso que o usuário pode cursar (público publicado, próprio ou matriculado).
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
    v_creditable := coalesce(v_course_public, false);
  end if;

  -- Correção e crédito de cada resposta (o primeiro envio já está imutável).
  for v_ans in
    select ans.id as answer_id, ans.question_id, q.type, q.config, q.xp_value, ans.submitted
      from public.answers ans
      join public.questions q on q.id = ans.question_id
     where ans.attempt_id = p_attempt_id
     order by ans.created_at, ans.id
  loop
    select * into v_graded
      from public.grade_answer(v_ans.type, v_ans.config, v_ans.submitted, v_ans.xp_value);

    v_credit := 0;

    if v_graded.is_correct and v_creditable and coalesce(v_ans.xp_value, 0) > 0 then
      -- Serializa tentativas concorrentes do mesmo usuário/questão/contexto.
      perform pg_advisory_xact_lock(hashtextextended(
        'athen:xp:' || v_attempt.user_id::text || ':' || v_ans.question_id::text || ':' ||
        coalesce(v_attempt.room_id::text, '-'), 0));

      if not exists (
        select 1 from public.xp_credits c
         where c.user_id = v_attempt.user_id
           and c.question_id = v_ans.question_id
           and c.source = 'learning'
           and c.room_id is not distinct from v_attempt.room_id
      ) then
        -- n = ordinal do primeiro acerto entre os primeiros envios (inclui esta resposta).
        v_ordinal := coalesce(
          public.learning_first_correct_ordinal(v_attempt.user_id, v_ans.question_id, v_attempt.room_id), 1);
        v_credit := public.xp_credit_for(v_ans.xp_value, v_ordinal);

        insert into public.xp_credits
          (user_id, source, amount, competitive, course_id, attempt_id, answer_id,
           question_id, room_id, ordinal, base_xp)
        values
          (v_attempt.user_id, 'learning', v_credit,
           -- Liga: só aprendizagem individual em curso de terceiros.
           (not v_is_room) and (not v_own_course) and v_credit > 0,
           v_course_id, p_attempt_id, v_ans.answer_id,
           v_ans.question_id, v_attempt.room_id, v_ordinal, v_ans.xp_value)
        on conflict do nothing;

        get diagnostics v_rows = row_count;
        if v_rows = 0 then
          v_credit := 0;
        end if;
      end if;
    end if;

    update public.answers
       set is_correct = v_graded.is_correct,
           xp_earned  = v_credit
     where id = v_ans.answer_id;

    v_total := v_total + 1;
    if v_graded.is_correct then
      v_correct := v_correct + 1;
    end if;
    v_total_xp := v_total_xp + v_credit;
  end loop;

  update public.attempts
     set correct_count = v_correct,
         total_count   = v_total,
         xp_earned     = v_total_xp,
         finished_at   = now()
   where id = p_attempt_id;

  -- Conclusão: toda questão da aula respondida (não precisa estar certa). Refazer só atualiza a conclusão.
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
    -- SALA: métricas internas; NUNCA mexe em profiles.xp_global.
    update public.room_members
       set xp_internal = xp_internal + v_total_xp
     where room_id = v_attempt.room_id and user_id = v_attempt.user_id;

    perform public.recompute_room_metrics(v_attempt.room_id, v_attempt.user_id);
  elsif v_creditable then
    update public.profiles
       set xp_global = xp_global + v_total_xp,
           level = public.level_for_xp(xp_global + v_total_xp),
           updated_at = now()
     where id = v_attempt.user_id;

    insert into public.enrollments (user_id, course_id)
    values (v_attempt.user_id, v_course_id)
    on conflict (user_id, course_id) do nothing;

    perform public.recompute_course_progress(v_attempt.user_id, v_course_id);
  end if;

  -- LIGA: conclusão oficial (curso OU sala) inscreve na liga da semana, mesmo sem XP.
  if v_completed then
    perform public.league_register_activity(v_attempt.user_id);
  end if;

  perform public.touch_streak(v_attempt.user_id);
  perform public.grant_medals(v_attempt.user_id);

  correct_count := v_correct;
  total_count   := v_total;
  xp_earned     := v_total_xp;
  return next;
end;
$$;

comment on function public.finalize_attempt(uuid) is
  'Corrige a tentativa e credita XP. Crédito único por usuário+questão+contexto (curso individual ou cada sala), valor base/n com n = ordinal do primeiro acerto entre os primeiros envios, 4 casas decimais. Reexecução devolve o resultado já gravado. Curso: saldo global + liga (competitivo só em curso de terceiros). Sala: só xp_internal.';

-- Só usuário logado finaliza (anon não tem auth.uid() para a checagem de dono).
revoke execute on function public.finalize_attempt(uuid) from public, anon;
grant execute on function public.finalize_attempt(uuid) to authenticated;