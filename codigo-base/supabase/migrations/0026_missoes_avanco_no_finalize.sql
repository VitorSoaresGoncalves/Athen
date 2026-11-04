-- 0026_missoes_avanco_no_finalize.sql
-- Liga o avanço das missões globais/de curso à atividade real do usuário.
--
-- Contexto: 0024 criou a estrutura das missões e 0025 criou a materialização de
-- ocorrências, o avanço de progresso e a concessão única de bônus (em
-- xp_credits, não competitivo). Faltava disparar esse avanço quando o usuário
-- realmente estuda. Esta fatia cria advance_missions_for_attempt e reescreve
-- finalize_attempt PARTINDO DA VERSÃO DA 0023_ligas.sql, acrescentando apenas a
-- chamada de avanço após o crédito de XP, no primeiro finalize.
--
-- Preservação obrigatória da liga (0023): o corpo do finalize_attempt abaixo é o
-- da 0023 por inteiro — grade/anti-regrind, idempotência por finished_at,
-- conclusão, XP de sala (xp_internal/recompute_room_metrics), XP de curso
-- (profiles.xp_global/level/enrollment/recompute_course_progress), gravação dos
-- créditos competitivos em xp_credits e league_register_activity. Nada da liga é
-- removido ou alterado; só se acrescenta advance_missions_for_attempt no fim do
-- bloco de primeiro finalize, com o progresso já consolidado.
--
-- complete_empty_lesson NÃO é alterado: as fontes de verdade das missões são
-- attempts finalizados (0025 count_mission_progress), e uma aula sem questões é
-- concluída sem attempt. Avançar missões ali não teria do que contar; a 0023
-- mantém o gancho da liga (league_register_activity), que continua intacto.

-- ---------------------------------------------------------------------------
-- advance_missions_for_attempt(attempt_id): após finalizar uma tentativa,
-- materializa e avança todas as missões ativas compatíveis com o attempt:
--   - globais (global_daily/global_weekly): sempre (curso ou sala);
--   - course_daily: só quando o attempt é individual (room_id is null) e tem
--     curso resolvido; materializa a ocorrência daquele curso/dia.
-- Materializa a ocorrência do período que contém finished_at (adesão automática
-- não depende de job prévio). SECURITY DEFINER; chamada por finalize_attempt.
-- ---------------------------------------------------------------------------
create or replace function public.advance_missions_for_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt   public.attempts%rowtype;
  v_course_id uuid;
  v_def       record;
  v_occ_id    uuid;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id;
  if not found or v_attempt.finished_at is null then
    return;
  end if;

  -- Resolve o curso do attempt (para a diária de curso), mesmo quando course_id
  -- não está gravado diretamente.
  v_course_id := v_attempt.course_id;
  if v_course_id is null then
    select m.course_id into v_course_id
      from public.lessons l
      join public.modules m on m.id = l.module_id
     where l.id = v_attempt.lesson_id;
  end if;

  -- Para cada definição ativa, materializa a ocorrência do período e avança.
  for v_def in
    select d.id, d.scope from public.mission_definitions d where d.active = true
  loop
    if v_def.scope = 'course_daily' then
      -- Só individual (room_id is null) e com curso resolvido.
      if v_attempt.room_id is not null or v_course_id is null then
        continue;
      end if;
      v_occ_id := public.ensure_occurrence(v_def.id, v_course_id, v_attempt.finished_at);
    else
      v_occ_id := public.ensure_occurrence(v_def.id, null, v_attempt.finished_at);
    end if;

    if v_occ_id is not null then
      perform public.upsert_mission_assignment(v_occ_id, v_attempt.user_id);
    end if;
  end loop;
end;
$$;

comment on function public.advance_missions_for_attempt(uuid) is
  'Avanca as missoes globais/curso ativas cujo periodo cobre o attempt finalizado (globais por curso/sala; course_daily so individual do curso). Chamada por finalize_attempt.';

-- ---------------------------------------------------------------------------
-- finalize_attempt: redefinição que PRESERVA a 0023 por inteiro e apenas
-- ACRESCENTA, no fim do bloco de primeiro finalize, a chamada
-- advance_missions_for_attempt. O avanço é feito com o progresso já consolidado
-- (conclusão, XP, créditos da liga gravados).
-- ---------------------------------------------------------------------------
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

    -- MISSÕES: avança as missões globais/curso compatíveis e concede o bônus.
    -- Depois dos efeitos acima, para que as fontes (attempts/answers/conclusão)
    -- já estejam consolidadas. Não interfere na liga: o bônus é xp_credits não
    -- competitivo (0025) e nada aqui toca league_register_activity.
    perform public.advance_missions_for_attempt(p_attempt_id);
  end if;

  correct_count := v_correct;
  total_count   := v_total;
  xp_earned     := v_total_xp;
  return next;
end;
$$;

comment on function public.finalize_attempt(uuid) is
  'Server authority: grades all answers and reports totals. Owner-only (or admin) despite SECURITY DEFINER. Idempotent: XP/room-XP, completion, enrollment/progress, streak and medals apply only on the FIRST finalize (finished_at was null). COURSE context credits global XP+level only for an accessible course (public+published, own, or already-enrolled); ROOM context updates room_members internal metrics only and never touches global XP. ANTI-REGRIND: a question already answered correctly in a prior finalized attempt (same user) awards 0 XP on re-answer; is_correct and correct_count still reflect correctness, only xp_earned (per-answer and the summed attempt XP) excludes already-correct questions, in both course and room contexts. LIGA: grava xp_credits (competitivo só em curso não-próprio) e inscreve a atividade oficial na liga. MISSOES: avanca missoes globais/curso e concede bonus (advance_missions_for_attempt), sem alterar a liga.';

-- ---------------------------------------------------------------------------
-- Permissões: advance_missions_for_attempt é interna (SECURITY DEFINER),
-- chamada só pelo finalize_attempt; não é executável diretamente pelo cliente.
-- finalize_attempt mantém as permissões de execute vigentes (create or replace
-- não as altera), continuando o ponto de entrada de correção para o cliente.
-- ---------------------------------------------------------------------------
revoke execute on function public.advance_missions_for_attempt(uuid)
  from public, anon, authenticated;
