-- 0035_xp_proportional_attempt.sql
-- Crédito de XP proporcional ao número da tentativa do primeiro acerto (Q112/Q093/Q126).
--
-- Regra: acertar uma questão na PRIMEIRA execução vale 100% do XP base; o
-- primeiro acerto após erros anteriores vale base / N, onde N é o ordinal da
-- execução finalizada em que o usuário acertou a questão pela primeira vez
-- (N=1 -> 100%, N=2 -> 50%, N=3 -> 1/3 ...). Concedido UMA vez; acertos
-- posteriores a um primeiro acerto continuam valendo 0 (anti-regrind preservado).
-- Exemplo aprovado (Q093): base 4, acerto na 2a execução -> 2 XP.
--
-- Decisão de precisão (opção B aprovada): o XP permanece inteiro em todo o
-- schema; o crédito do primeiro acerto é round(base / N). O exemplo canônico
-- (4/2=2) bate exatamente; casos como 4/3 arredondam para o inteiro mais
-- próximo. A fidelidade de 4 casas (Q126) exigiria XP numérico na cadeia inteira
-- e fica como evolução própria, se necessária.
--
-- Escopo do ordinal/anti-regrind: preserva o mesmo critério da versão vigente
-- (0025) — tentativas finalizadas anteriores do mesmo usuário para a mesma
-- questão. Refinar o escopo para "por contexto" (curso vs sala) seria uma
-- mudança de comportamento separada, não coberta aqui.
--
-- Esta migração redefine finalize_attempt preservando TODO o restante (posse,
-- idempotência por finished_at, split curso/sala, ledger xp_events, streak,
-- medalhas, avanço de missões) e troca somente o cálculo do XP por resposta.

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
  v_prior_attempts  integer;   -- execuções finalizadas anteriores com resposta p/ a questão
  v_ordinal         integer;   -- N: ordinal da execução do primeiro acerto
begin
  select * into v_attempt from public.attempts where id = p_attempt_id for update;
  if not found then
    raise exception 'attempt % not found', p_attempt_id;
  end if;

  -- OWNERSHIP: although SECURITY DEFINER, only the attempt owner (or an admin)
  -- may finalize/grade an attempt.
  if auth.uid() is not null
     and v_attempt.user_id <> auth.uid()
     and not public.is_admin() then
    raise exception 'not authorized to finalize attempt %', p_attempt_id
      using errcode = '42501';
  end if;

  -- IDEMPOTENCY: capture whether the attempt was already finalized BEFORE this call.
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

    if v_graded.is_correct then
      -- ANTI-REGRIND: já acertou esta questão numa execução finalizada anterior?
      -- Se sim, 0 XP (sem repagar).
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
      else
        -- PRIMEIRO ACERTO: credita base / N, onde N = ordinal da execução deste
        -- acerto, contando as execuções finalizadas anteriores em que o usuário
        -- respondeu esta questão (erros) + esta. Q093/Q126: erro na 1a e acerto
        -- na 2a -> base/2. round() mantém o XP inteiro (opção B).
        select count(*) into v_prior_attempts
          from public.answers prev
          join public.attempts pa on pa.id = prev.attempt_id
         where prev.question_id = v_ans.question_id
           and prev.attempt_id <> p_attempt_id
           and pa.user_id = v_attempt.user_id
           and pa.finished_at is not null;

        v_ordinal  := v_prior_attempts + 1;  -- esta execução
        v_award_xp := greatest(round(v_graded.xp::numeric / v_ordinal)::integer, 0);
      end if;
    end if;
    -- (resposta incorreta mantém v_award_xp = v_graded.xp, que já é 0)

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

  -- Side effects on the FIRST finalize only.
  if not v_already_final then
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

      -- LEDGER: crédito base de sala (interno; nunca pontua temporada).
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
      -- COURSE context.
      v_course_id := v_attempt.course_id;
      if v_course_id is null then
        select m.course_id into v_course_id
          from public.lessons l
          join public.modules m on m.id = l.module_id
         where l.id = v_attempt.lesson_id;
      end if;

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
        update public.profiles
           set xp_global = xp_global + v_total_xp,
               level = public.level_for_xp(xp_global + v_total_xp),
               updated_at = now()
         where id = v_attempt.user_id;

        insert into public.enrollments (user_id, course_id)
        values (v_attempt.user_id, v_course_id)
        on conflict (user_id, course_id) do nothing;

        perform public.recompute_course_progress(v_attempt.user_id, v_course_id);

        -- LEDGER: crédito base de curso (elegível à temporada).
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

    -- MISSÕES: avança missões globais/curso compatíveis e concede bônus (Q019).
    perform public.advance_missions_for_attempt(p_attempt_id);
  end if;

  correct_count := v_correct;
  total_count   := v_total;
  xp_earned     := v_total_xp;
  return next;
end;
$$;

comment on function public.finalize_attempt(uuid) is
  'Server authority: grades answers, reports totals, idempotent by finished_at. XP do PRIMEIRO acerto de uma questão = round(base / N), N = ordinal da execução finalizada do primeiro acerto (Q112/Q093/Q126: base 4 na 2a execução -> 2 XP); acerto posterior ao primeiro continua 0 (anti-regrind). First finalize: completion, XP/room-XP, enrollment/progress, streak, medals, xp_events ledger e avanço de missões. COURSE credita global+temporada (learning_base/course); ROOM só interno (learning_base/room).';
