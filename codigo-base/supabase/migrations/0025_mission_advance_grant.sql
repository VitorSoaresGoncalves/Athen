-- 0025_mission_advance_grant.sql
-- Avanço de progresso e concessão de bônus das missões globais/curso.
--
-- Contexto: 0024 criou a estrutura (mission_definitions / mission_occurrences /
-- mission_assignments) mas nada avança o progresso nem concede bônus. Esta fatia
-- liga a atividade real do usuário às missões e credita o bônus uma única vez.
--
-- Fontes de verdade (sem contadores próprios, para ser reentrante/idempotente):
--   - attempts finalizados (finished_at) dentro do período da ocorrência;
--   - answers.is_correct desses attempts (questões distintas acertadas);
--   - o dia local (America/Sao_Paulo) de cada attempt para "dias de estudo".
-- O progresso é RECALCULADO a cada chamada, não incrementado: reexecutar é
-- seguro e nunca duplica contagem.
--
-- Regras do questionário aplicadas:
--   Q019/Q092: uma atividade avança todas as missões compatíveis; cada missão
--              concede seu bônus UMA vez; o crédito base (xp_events learning_base)
--              não é alterado por participar de missões.
--   Q020:      adesão automática — a atribuição é criada ao materializar/avançar,
--              sem aceite manual.
--   Q044:      crédito automático ao atingir a meta, sem resgate.
--   Q102:      o bônus é xp_events origin=mission_bonus — NÃO pontua a temporada.
--   Globais (Q017): contam atividade de curso OU sala. Diária de curso: só o
--              curso da ocorrência, contexto individual (room_id is null, Q125).

-- ---------------------------------------------------------------------------
-- count_mission_progress(occurrence, user): contagem bruta rumo à meta de UMA
-- ocorrência, recalculada das fontes de verdade dentro do seu período.
--   complete_lessons    -> aulas distintas com attempt finalizado no período
--   complete_executions -> attempts finalizados no período
--   correct_questions   -> questões distintas acertadas no período
--   study_days          -> dias locais distintos com attempt finalizado no período
-- Globais consideram curso e sala; course_daily restringe ao curso individual.
-- ---------------------------------------------------------------------------
create or replace function public.count_mission_progress(
  p_occurrence_id uuid,
  p_user_id       uuid
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_occ   public.mission_occurrences%rowtype;
  v_count integer := 0;
begin
  select * into v_occ from public.mission_occurrences where id = p_occurrence_id;
  if not found then
    return 0;
  end if;

  -- Base comum: attempts finalizados do usuário dentro do período.
  -- course_daily restringe ao curso da ocorrência e ao contexto individual
  -- (room_id is null — Q125). Globais aceitam curso ou sala (Q017).
  if v_occ.objective = 'complete_executions' then
    select count(*) into v_count
      from public.attempts a
     where a.user_id = p_user_id
       and a.finished_at is not null
       and a.finished_at >= v_occ.period_start
       and a.finished_at <  v_occ.period_end
       and (
         v_occ.scope <> 'course_daily'
         or (a.course_id = v_occ.course_id and a.room_id is null)
       );

  elsif v_occ.objective = 'complete_lessons' then
    select count(distinct a.lesson_id) into v_count
      from public.attempts a
     where a.user_id = p_user_id
       and a.finished_at is not null
       and a.finished_at >= v_occ.period_start
       and a.finished_at <  v_occ.period_end
       and (
         v_occ.scope <> 'course_daily'
         or (a.course_id = v_occ.course_id and a.room_id is null)
       );

  elsif v_occ.objective = 'correct_questions' then
    select count(distinct ans.question_id) into v_count
      from public.answers ans
      join public.attempts a on a.id = ans.attempt_id
     where a.user_id = p_user_id
       and ans.is_correct = true
       and a.finished_at is not null
       and a.finished_at >= v_occ.period_start
       and a.finished_at <  v_occ.period_end
       and (
         v_occ.scope <> 'course_daily'
         or (a.course_id = v_occ.course_id and a.room_id is null)
       );

  elsif v_occ.objective = 'study_days' then
    select count(distinct (a.finished_at at time zone 'America/Sao_Paulo')::date) into v_count
      from public.attempts a
     where a.user_id = p_user_id
       and a.finished_at is not null
       and a.finished_at >= v_occ.period_start
       and a.finished_at <  v_occ.period_end
       and (
         v_occ.scope <> 'course_daily'
         or (a.course_id = v_occ.course_id and a.room_id is null)
       );

  else
    v_count := 0;
  end if;

  return coalesce(v_count, 0);
end;
$$;

comment on function public.count_mission_progress(uuid, uuid) is
  'Contagem bruta rumo à meta de uma ocorrência, recalculada das fontes (attempts/answers) dentro do período. Determinística e reentrante; não usa contador próprio.';

-- ---------------------------------------------------------------------------
-- upsert_mission_assignment(occurrence, user): materializa/atualiza a atribuição
-- do usuário para uma ocorrência e CONCEDE o bônus uma única vez ao concluir.
--   - progress = min(100, count/target*100), current_count = count.
--   - completed vira true quando count >= target (e congela completed_at).
--   - ao concluir pela 1ª vez (granted=false), lança xp_events origin=
--     mission_bonus (idempotente por chave 'xpbonus:assignment:<id>'), credita
--     reward_xp ao saldo global e marca granted=true.
-- O crédito base de aprendizagem NÃO é tocado aqui (Q092). O bônus não pontua a
-- temporada (Q102), pois a janela de temporada soma só learning_base/course.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_mission_assignment(
  p_occurrence_id uuid,
  p_user_id       uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occ        public.mission_occurrences%rowtype;
  v_count      integer;
  v_progress   numeric(5,2);
  v_completed  boolean;
  v_assignment public.mission_assignments%rowtype;
begin
  select * into v_occ from public.mission_occurrences where id = p_occurrence_id;
  if not found then
    return;
  end if;

  v_count := public.count_mission_progress(p_occurrence_id, p_user_id);
  v_progress := least(100, round((v_count::numeric / v_occ.target::numeric) * 100, 2));
  v_completed := v_count >= v_occ.target;

  -- Materializa (adesão automática) ou atualiza a atribuição.
  insert into public.mission_assignments (occurrence_id, user_id, progress, current_count, completed, completed_at)
  values (
    p_occurrence_id, p_user_id, v_progress, v_count, v_completed,
    case when v_completed then now() else null end
  )
  on conflict (occurrence_id, user_id) do update
    set progress      = excluded.progress,
        current_count = excluded.current_count,
        completed     = public.mission_assignments.completed or excluded.completed,
        -- congela o instante da primeira conclusão
        completed_at  = coalesce(public.mission_assignments.completed_at,
                                 case when excluded.completed then now() else null end),
        updated_at    = now();

  -- Relê o estado consolidado para decidir a concessão.
  select * into v_assignment
    from public.mission_assignments
   where occurrence_id = p_occurrence_id and user_id = p_user_id;

  -- CONCESSÃO ÚNICA: concluída e ainda não concedida -> lança o bônus.
  if v_assignment.completed and not v_assignment.granted then
    if v_occ.reward_xp > 0 then
      -- Registra o bônus no livro de XP (origem mission_bonus; não pontua temporada).
      perform public.record_xp_event(
        p_user_id         => p_user_id,
        p_origin          => 'mission_bonus',
        p_context         => 'course',
        p_amount          => v_occ.reward_xp,
        p_idempotency_key => 'xpbonus:assignment:' || v_assignment.id::text,
        p_course_id       => v_occ.course_id,
        p_occurred_at     => now()
      );

      -- Credita o bônus ao saldo global vitalício e recalcula o nível.
      update public.profiles
         set xp_global = xp_global + v_occ.reward_xp,
             level = public.level_for_xp(xp_global + v_occ.reward_xp),
             updated_at = now()
       where id = p_user_id;
    end if;

    update public.mission_assignments
       set granted = true, updated_at = now()
     where id = v_assignment.id;
  end if;
end;
$$;

comment on function public.upsert_mission_assignment(uuid, uuid) is
  'Materializa/atualiza a atribuição de uma ocorrência ao usuário e concede o bônus uma única vez ao concluir (xp_events mission_bonus + xp_global). Idempotente: progresso recalculado, concessão protegida por granted + idempotency_key.';

-- ---------------------------------------------------------------------------
-- Fronteiras de período no calendário oficial (America/Sao_Paulo, Q021).
--   mission_day_start(ts)  -> 00h local do dia de ts, como timestamptz.
--   mission_week_start(ts) -> 00h local da segunda-feira da semana de ts.
-- Usadas para materializar a ocorrência do período que contém um instante.
-- ---------------------------------------------------------------------------
create or replace function public.mission_day_start(p_ts timestamptz)
returns timestamptz
language sql
immutable
as $$
  select (date_trunc('day', p_ts at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
$$;

create or replace function public.mission_week_start(p_ts timestamptz)
returns timestamptz
language sql
immutable
as $$
  -- date_trunc('week') usa segunda-feira como início da semana (ISO), o que
  -- atende Q021 (semana iniciada na segunda 00h).
  select (date_trunc('week', p_ts at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
$$;

comment on function public.mission_day_start(timestamptz) is
  '00h local (America/Sao_Paulo) do dia de p_ts. Início inclusivo do período diário.';
comment on function public.mission_week_start(timestamptz) is
  '00h local (America/Sao_Paulo) da segunda-feira da semana de p_ts (Q021). Início inclusivo do período semanal.';

-- ---------------------------------------------------------------------------
-- ensure_occurrence(definition, course, instant): materializa (idempotente) a
-- ocorrência da definição no período que contém o instante, copiando meta/bônus
-- do catálogo (congelados — Q035/Q095). Retorna o id da ocorrência.
--   - global_daily / course_daily: período diário [dia, dia+1).
--   - global_weekly: período semanal [segunda, segunda+7).
-- ---------------------------------------------------------------------------
create or replace function public.ensure_occurrence(
  p_definition_id uuid,
  p_course_id     uuid,
  p_instant       timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_def   public.mission_definitions%rowtype;
  v_start timestamptz;
  v_end   timestamptz;
  v_id    uuid;
begin
  select * into v_def from public.mission_definitions where id = p_definition_id;
  if not found or not v_def.active then
    return null;
  end if;

  if v_def.scope = 'global_weekly' then
    v_start := public.mission_week_start(p_instant);
    v_end   := v_start + interval '7 days';
  else
    v_start := public.mission_day_start(p_instant);
    v_end   := v_start + interval '1 day';
  end if;

  insert into public.mission_occurrences (
    definition_id, scope, objective, course_id, target, reward_xp, period_start, period_end
  )
  values (
    v_def.id, v_def.scope, v_def.objective,
    case when v_def.scope = 'course_daily' then p_course_id else null end,
    v_def.target, v_def.reward_xp, v_start, v_end
  )
  on conflict (definition_id, course_id, period_start) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
      from public.mission_occurrences
     where definition_id = v_def.id
       and course_id is not distinct from (case when v_def.scope = 'course_daily' then p_course_id else null end)
       and period_start = v_start;
  end if;

  return v_id;
end;
$$;

comment on function public.ensure_occurrence(uuid, uuid, timestamptz) is
  'Materializa idempotentemente a ocorrência de uma definição no período que contém o instante (diário ou semanal, America/Sao_Paulo), copiando meta/bônus do catálogo. Retorna o id da ocorrência.';

-- ---------------------------------------------------------------------------
-- advance_missions_for_attempt(attempt_id): após finalizar uma tentativa,
-- materializa e avança todas as missões ativas compatíveis com o attempt:
--   - globais (global_daily/global_weekly): sempre (curso ou sala — Q017);
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
      -- Só individual (room_id is null) e com curso resolvido (Q125).
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
  'Avança as missões globais/curso ativas cujo período cobre o attempt finalizado (globais por curso/sala; course_daily só individual do curso). Chamada por finalize_attempt.';

-- ---------------------------------------------------------------------------
-- finalize_attempt: redefinição que PRESERVA 0023 e apenas ACRESCENTA, no fim do
-- bloco de primeiro finalize, a chamada advance_missions_for_attempt. O avanço é
-- feito com o progresso já consolidado (completion/XP/ledger gravados).
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

    -- ANTI-REGRIND: already-correct question in a prior finalized attempt -> 0 XP.
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
    -- Depois dos efeitos acima, para que as fontes já estejam consolidadas.
    perform public.advance_missions_for_attempt(p_attempt_id);
  end if;

  correct_count := v_correct;
  total_count   := v_total;
  xp_earned     := v_total_xp;
  return next;
end;
$$;

comment on function public.finalize_attempt(uuid) is
  'Server authority: grades answers, reports totals, idempotent by finished_at. First finalize: completion, XP/room-XP, enrollment/progress, streak, medals, xp_events ledger row, and mission advancement (advance_missions_for_attempt). COURSE credits global XP+level for accessible course (learning_base/course, season-eligible); ROOM updates room internal metrics only (learning_base/room). ANTI-REGRIND: already-correct question awards 0 XP. Mission bonuses are mission_bonus events (not season-eligible).';
