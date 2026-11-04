-- 0023_xp_events_ledger.sql
-- Livro de créditos de XP por evento (fundação das temporadas competitivas).
--
-- Contexto: até aqui o XP era apenas um inteiro corrente em profiles.xp_global
-- (contexto de curso) e room_members.xp_internal (contexto de sala), sem
-- histórico por evento. As temporadas (Q101–Q102) precisam somar SOMENTE o XP
-- novo de aprendizagem individual elegível dentro de uma janela de tempo,
-- excluindo abertura de saldo, ajustes históricos, XP de sala e bônus de missão.
-- Isso é impossível sobre um contador corrente. Esta migração cria um registro
-- append-only de créditos de XP (xp_events) e passa finalize_attempt a gravar um
-- evento por tentativa finalizada, SEM alterar como o XP já é creditado hoje.
--
-- Esta fatia é apenas a fundação: cria a tabela, a origem/contexto dos créditos
-- e a gravação idempotente. A composição da pontuação de temporada (o "XP novo
-- elegível") será lida a partir daqui em fatias posteriores; nada do saldo atual
-- muda de valor.

-- ---------------------------------------------------------------------------
-- Enums: origem e contexto do crédito.
--   origin  = de onde veio o XP (base de aprendizagem vs bônus de missão vs
--             abertura de saldo legado vs ajuste auditado). Só 'learning_base'
--             (contexto de curso) é elegível à temporada; os demais existem para
--             as fatias seguintes registrarem suas origens sem se confundirem.
--   context = 'course' (conta para saldo global/temporada) ou 'room' (interno).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'xp_event_origin') then
    create type public.xp_event_origin as enum (
      'learning_base',   -- XP base de aprendizagem (tentativa finalizada)
      'mission_bonus',   -- bônus concedido por missão (fatias futuras)
      'legacy_opening',  -- abertura auditada de saldo legado (fatias futuras)
      'adjustment'       -- ajuste/estorno auditado por admin (fatias futuras)
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'xp_event_context') then
    create type public.xp_event_context as enum ('course', 'room');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- xp_events: uma linha por crédito de XP. Append-only; nunca editado.
--
-- A idempotência é garantida por um "idempotency_key" único: a mesma origem
-- aplicada ao mesmo fato (ex.: a mesma tentativa finalizada) nunca grava dois
-- eventos. Assim, reexecutar finalize_attempt ou uma migração de abertura não
-- duplica o histórico, espelhando a autoridade idempotente de finalize_attempt.
-- ---------------------------------------------------------------------------
create table if not exists public.xp_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  origin          public.xp_event_origin  not null,
  context         public.xp_event_context not null,
  amount          integer not null check (amount >= 0),
  -- Referências opcionais ao fato que originou o crédito (sem FK rígida para não
  -- bloquear a limpeza do fato original; o evento é um registro contábil).
  attempt_id      uuid references public.attempts (id) on delete set null,
  course_id       uuid references public.courses (id)  on delete set null,
  room_id         uuid references public.rooms (id)    on delete set null,
  mission_id      uuid references public.missions (id) on delete set null,
  -- Chave de idempotência: identifica o fato+origem de forma estável.
  idempotency_key text not null unique,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

comment on table public.xp_events is
  'Livro append-only de créditos de XP por evento. Fundação das temporadas: permite somar o XP novo elegível (origin=learning_base, context=course) por janela de tempo. Não substitui os contadores correntes profiles.xp_global / room_members.xp_internal; registra como esses contadores foram formados.';
comment on column public.xp_events.origin is
  'Origem do crédito. Só learning_base em contexto course pontua a temporada (Q102); mission_bonus/legacy_opening/adjustment são excluídos.';
comment on column public.xp_events.context is
  'course = crédito que soma ao saldo global; room = crédito interno de sala (nunca pontua temporada).';
comment on column public.xp_events.idempotency_key is
  'Identidade estável do fato+origem (ex.: xp:attempt:<attempt_id>). UNIQUE: reexecutar a origem não duplica o evento.';

create index if not exists xp_events_user_occurred_idx
  on public.xp_events (user_id, occurred_at desc);
create index if not exists xp_events_user_origin_context_idx
  on public.xp_events (user_id, origin, context, occurred_at);

-- ---------------------------------------------------------------------------
-- RLS: o dono lê os próprios eventos; admin lê tudo. Nenhuma escrita pelo
-- cliente — os eventos são gravados por funções SECURITY DEFINER (como
-- completions / user_medals, que também não têm política de insert do cliente).
-- ---------------------------------------------------------------------------
alter table public.xp_events enable row level security;

drop policy if exists xp_events_select_own on public.xp_events;
create policy xp_events_select_own on public.xp_events
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- record_xp_event(...): gravação idempotente de um crédito de XP.
-- SECURITY DEFINER porque não há política de insert do cliente; é chamada por
-- outras funções de autoridade do servidor (finalize_attempt agora; missões e
-- abertura de saldo nas próximas fatias). Não credita saldo por si só — apenas
-- registra o fato contábil. Retorna o id do evento (novo ou já existente).
-- ---------------------------------------------------------------------------
create or replace function public.record_xp_event(
  p_user_id         uuid,
  p_origin          public.xp_event_origin,
  p_context         public.xp_event_context,
  p_amount          integer,
  p_idempotency_key text,
  p_attempt_id      uuid default null,
  p_course_id       uuid default null,
  p_room_id         uuid default null,
  p_mission_id      uuid default null,
  p_occurred_at     timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_user_id is null or p_idempotency_key is null then
    raise exception 'record_xp_event requires user_id and idempotency_key';
  end if;

  insert into public.xp_events (
    user_id, origin, context, amount,
    attempt_id, course_id, room_id, mission_id,
    idempotency_key, occurred_at
  )
  values (
    p_user_id, p_origin, p_context, greatest(coalesce(p_amount, 0), 0),
    p_attempt_id, p_course_id, p_room_id, p_mission_id,
    p_idempotency_key, coalesce(p_occurred_at, now())
  )
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.xp_events where idempotency_key = p_idempotency_key;
  end if;

  return v_id;
end;
$$;

comment on function public.record_xp_event(uuid, public.xp_event_origin, public.xp_event_context, integer, text, uuid, uuid, uuid, uuid, timestamptz) is
  'Grava um crédito de XP de forma idempotente (unique idempotency_key). Não credita saldo; apenas registra o fato contábil. SECURITY DEFINER: chamada por funções de autoridade do servidor.';

-- Interna: só funções SECURITY DEFINER do servidor devem gravar eventos.
revoke execute on function public.record_xp_event(uuid, public.xp_event_origin, public.xp_event_context, integer, text, uuid, uuid, uuid, uuid, timestamptz) from authenticated;

-- ---------------------------------------------------------------------------
-- finalize_attempt(attempt_id): redefinição que PRESERVA todo o comportamento
-- de 0018 (propriedade, idempotência por finished_at, anti-regrind, split
-- curso/sala, streak/medalhas) e apenas ACRESCENTA a gravação de um evento de
-- XP base no primeiro finalize, com a mesma fronteira de acesso já aplicada.
--
-- O evento registra o XP base efetivamente creditado (já líquido de anti-regrind)
-- com idempotency_key estável por tentativa. Contexto de curso credita evento
-- learning_base/course (elegível à temporada); contexto de sala credita
-- learning_base/room (interno, nunca pontua temporada). Os saldos correntes
-- continuam sendo atualizados exatamente como antes.
--
-- DRIFT GUARD: um ambiente remoto pode ter uma versão divergente de
-- finalize_attempt cujo tipo de retorno de xp_earned é numeric (aplicada fora
-- da cadeia de migrations). create or replace não pode mudar o tipo de retorno
-- (42P13), então removemos a função antes de recriá-la com xp_earned integer,
-- que é o tipo canônico em toda a cadeia (0010/0018/0023/0035). Idempotente e
-- inócuo quando o baseline já está correto.
-- ---------------------------------------------------------------------------
drop function if exists public.finalize_attempt(uuid);
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
    end if;

    if v_is_room then
      -- ROOM context: internal metrics only. NEVER touch profiles.xp_global.
      update public.room_members
         set xp_internal = xp_internal + v_total_xp
       where room_id = v_attempt.room_id and user_id = v_attempt.user_id;

      perform public.recompute_room_metrics(v_attempt.room_id, v_attempt.user_id);

      -- LEDGER: registra o crédito base de sala (interno; nunca pontua temporada).
      perform public.record_xp_event(
        p_user_id         => v_attempt.user_id,
        p_origin          => 'learning_base',
        p_context         => 'room',
        p_amount          => v_total_xp,
        p_idempotency_key => 'xp:attempt:' || p_attempt_id::text,
        p_attempt_id      => p_attempt_id,
        p_room_id         => v_attempt.room_id,
        p_occurred_at     => now()
      );
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
                  )
          into v_course_public
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

        -- LEDGER: registra o crédito base de curso (elegível à temporada).
        perform public.record_xp_event(
          p_user_id         => v_attempt.user_id,
          p_origin          => 'learning_base',
          p_context         => 'course',
          p_amount          => v_total_xp,
          p_idempotency_key => 'xp:attempt:' || p_attempt_id::text,
          p_attempt_id      => p_attempt_id,
          p_course_id       => v_course_id,
          p_occurred_at     => now()
        );
      end if;
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
  'Server authority: grades all answers and reports totals. Owner-only (or admin) despite SECURITY DEFINER. Idempotent: XP/room-XP, completion, enrollment/progress, streak, medals and the xp_events ledger row apply only on the FIRST finalize (finished_at was null). COURSE context credits global XP+level only for an accessible course and records a learning_base/course xp_event (season-eligible); ROOM context updates room_members internal metrics only, never touches global XP, and records a learning_base/room xp_event (internal). ANTI-REGRIND: a question already answered correctly in a prior finalized attempt (same user) awards 0 XP on re-answer; the ledger amount equals the net credited XP.';

-- ---------------------------------------------------------------------------
-- user_xp_in_window(from, to): soma o XP novo ELEGÍVEL de aprendizagem
-- individual do usuário autenticado dentro de [from, to) — origin=learning_base
-- e context=course (Q102). Início inclusivo, fim exclusivo, espelhando a janela
-- de calendário usada nas missões/temporadas. Leitura própria apenas.
-- ---------------------------------------------------------------------------
create or replace function public.user_xp_in_window(
  p_from timestamptz,
  p_to   timestamptz
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(e.amount), 0)::integer
    from public.xp_events e
   where e.user_id = auth.uid()
     and e.origin = 'learning_base'
     and e.context = 'course'
     and e.occurred_at >= p_from
     and e.occurred_at <  p_to;
$$;

comment on function public.user_xp_in_window(timestamptz, timestamptz) is
  'XP novo elegível (learning_base/course) do usuário autenticado em [from, to). Base da pontuação de temporada: exclui bônus, XP de sala, abertura de saldo e ajustes. Início inclusivo, fim exclusivo.';

grant execute on function public.user_xp_in_window(timestamptz, timestamptz) to authenticated;
