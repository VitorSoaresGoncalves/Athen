-- Corrige a virada, a inscrição tardia, as missões de aulas sem questões e
-- restringe funções internas de autoridade. Aditiva para bancos com 0023–0039.

-- PUBLIC recebe EXECUTE em funções novas por padrão no PostgreSQL. Revogar
-- apenas de authenticated não remove esse privilégio herdado.
revoke execute on function public.record_xp_event(uuid, public.xp_event_origin, public.xp_event_context, integer, text, uuid, uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.upsert_mission_assignment(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.advance_missions_for_attempt(uuid) from public, anon, authenticated;
revoke execute on function public.ensure_occurrence(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.count_mission_progress(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.open_season(timestamptz) from public, anon, authenticated;

create or replace function public.count_mission_progress(p_occurrence_id uuid, p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_occ public.mission_occurrences%rowtype;
  v_count integer := 0;
begin
  select * into v_occ from public.mission_occurrences where id = p_occurrence_id;
  if not found then return 0; end if;

  if v_occ.objective = 'complete_executions' then
    select count(*) into v_count from public.attempts a
     where a.user_id = p_user_id and a.finished_at >= v_occ.period_start
       and a.finished_at < v_occ.period_end
       and (v_occ.scope <> 'course_daily' or
         (a.course_id = v_occ.course_id and a.room_id is null));
  elsif v_occ.objective = 'complete_lessons' then
    select count(distinct activity.lesson_id) into v_count
      from (
        select a.lesson_id from public.attempts a
         where a.user_id = p_user_id and a.finished_at >= v_occ.period_start
           and a.finished_at < v_occ.period_end
           and (v_occ.scope <> 'course_daily' or
             (a.course_id = v_occ.course_id and a.room_id is null))
        union all
        select c.lesson_id from public.completions c
          join public.lessons l on l.id = c.lesson_id
          join public.modules m on m.id = l.module_id
         where c.user_id = p_user_id and c.attempt_id is null
           and c.context = 'course'
           and c.completed_at >= v_occ.period_start
           and c.completed_at < v_occ.period_end
           and (v_occ.scope <> 'course_daily' or m.course_id = v_occ.course_id)
      ) activity;
  elsif v_occ.objective = 'correct_questions' then
    select count(distinct ans.question_id) into v_count
      from public.answers ans join public.attempts a on a.id = ans.attempt_id
     where a.user_id = p_user_id and ans.is_correct = true
       and a.finished_at >= v_occ.period_start and a.finished_at < v_occ.period_end
       and (v_occ.scope <> 'course_daily' or
         (a.course_id = v_occ.course_id and a.room_id is null));
  elsif v_occ.objective = 'study_days' then
    select count(distinct activity.study_day) into v_count
      from (
        select (a.finished_at at time zone 'America/Sao_Paulo')::date as study_day
          from public.attempts a
         where a.user_id = p_user_id and a.finished_at >= v_occ.period_start
           and a.finished_at < v_occ.period_end
           and (v_occ.scope <> 'course_daily' or
             (a.course_id = v_occ.course_id and a.room_id is null))
        union all
        select (c.completed_at at time zone 'America/Sao_Paulo')::date
          from public.completions c
          join public.lessons l on l.id = c.lesson_id
          join public.modules m on m.id = l.module_id
         where c.user_id = p_user_id and c.attempt_id is null
           and c.context = 'course'
           and c.completed_at >= v_occ.period_start
           and c.completed_at < v_occ.period_end
           and (v_occ.scope <> 'course_daily' or m.course_id = v_occ.course_id)
      ) activity;
  end if;
  return coalesce(v_count, 0);
end;
$$;
revoke execute on function public.count_mission_progress(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.close_season(uuid, integer) from public, anon, authenticated;
revoke execute on function public.form_season_groups(uuid, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.tick_seasons() from public, anon, authenticated;

create or replace function public.open_season(p_starts_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := public.mission_week_start(p_starts_at);
  v_end timestamptz := v_start + interval '7 days';
  v_prev timestamptz := v_start - interval '7 days';
  v_season uuid;
  v_entry record;
  v_group uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_start::text, 0));
  -- Uma temporada nova nunca herda uma categoria ainda em apuração.
  if exists (select 1 from public.seasons where ends_at <= v_start and status <> 'closed') then
    return null;
  end if;
  insert into public.seasons (starts_at, ends_at, status)
  values (v_start, v_end, 'open')
  on conflict (starts_at) do update set updated_at = now()
  returning id into v_season;

  -- A janela anterior define a fotografia; atividade da janela corrente permite
  -- inscrição tardia. A restrição superior impede contar atividade futura.
  insert into public.season_entries (season_id, user_id, category)
  select v_season, pr.id,
    coalesce((
      select se.result_category
        from public.season_entries se
        join public.seasons prev on prev.id = se.season_id
       where se.user_id = pr.id and se.result_category is not null
         and prev.ends_at <= v_start
       order by prev.ends_at desc limit 1
    ), 'bronze'::public.season_category)
    from public.profiles pr
   where pr.account_status = 'active'
     and public.is_recently_active(pr.id, v_prev, least(v_end, now() + interval '1 microsecond'))
  on conflict (season_id, user_id) do nothing;
  -- Primeiro aproveita vagas da mesma categoria. O bloqueio acima impede
  -- concorrência de inscrições de exceder a capacidade do grupo.
  for v_entry in
    select id, category from public.season_entries
     where season_id = v_season and group_id is null order by joined_at, user_id
  loop
    select sg.id into v_group
      from public.season_groups sg
      left join public.season_entries member on member.group_id = sg.id
     where sg.season_id = v_season and sg.category = v_entry.category
     group by sg.id, sg.capacity
    having count(member.id) < least(sg.capacity, 30)
     order by count(member.id) desc, sg.id limit 1;
    if v_group is not null then
      update public.season_entries set group_id = v_group, updated_at = now()
       where id = v_entry.id;
    end if;
  end loop;
  perform public.form_season_groups(v_season, 20, 10, 30);
  return v_season;
end;
$$;
revoke execute on function public.open_season(timestamptz) from public, anon, authenticated;
revoke execute on function public.log_season_op(text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.check_season_alerts(integer) from public, anon, authenticated;
revoke execute on function public.deliver_season_alert(uuid, jsonb) from public, anon, authenticated;

-- A antiga 0023_ligas.sql pode ter sido aplicada em outro banco. Sua
-- league_sync não deve manter uma segunda liga nem expor escrita antiga.
do $$
begin
  if to_regprocedure('public.league_sync()') is not null then
    execute 'revoke execute on function public.league_sync() from public, anon, authenticated';
  end if;
end;
$$;

-- Em cada tick, a semana anterior é apurada antes de inscrever participantes
-- na próxima. Se algum fechamento falhar, a nova temporada espera a retentativa.
create or replace function public.tick_seasons()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed integer := 0;
  v_errors integer := 0;
  v_alerts integer := 0;
  v_row record;
  v_errmsg text;
begin
  perform public.log_season_op('tick_start', null, '{}'::jsonb);
  for v_row in
    select id from public.seasons
     where ends_at <= now() and status <> 'closed'
     order by ends_at asc
  loop
    begin
      perform public.close_season(v_row.id, 10);
      v_closed := v_closed + 1;
      perform public.log_season_op('close_ok', v_row.id, '{}'::jsonb);
    exception when others then
      get stacked diagnostics v_errmsg = message_text;
      v_errors := v_errors + 1;
      perform public.log_season_op('close_error', v_row.id, jsonb_build_object('error', v_errmsg));
    end;
  end loop;

  if v_errors = 0 then
    begin
      perform public.open_season(now());
    exception when others then
      get stacked diagnostics v_errmsg = message_text;
      perform public.log_season_op('open_error', null, jsonb_build_object('error', v_errmsg));
    end;
  end if;

  v_alerts := public.check_season_alerts(30);
  perform public.log_season_op('tick_done', null,
    jsonb_build_object('closed', v_closed, 'errors', v_errors, 'alerts', v_alerts));
  return v_closed;
end;
$$;
revoke execute on function public.tick_seasons() from public, anon, authenticated;

-- O gatilho não usa atividade de login ou crédito de XP: somente conclusões
-- oficiais. A chamada reentrante de open_season preenche novos inscritos sem
-- deslocar grupos já formados. Se a virada segue em apuração, o cron fará a
-- inscrição pela leitura da atividade corrente em open_season.
create or replace function public.enroll_on_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.seasons s
     where s.starts_at = public.mission_week_start(new.completed_at)
       and s.status = 'open'
  ) then
    perform public.open_season(now());
  end if;
  return new;
end;
$$;
revoke execute on function public.enroll_on_completion() from public, anon, authenticated;
drop trigger if exists enroll_on_completion on public.completions;
create trigger enroll_on_completion
after insert or update of completed_at on public.completions
for each row execute function public.enroll_on_completion();

-- Preserva fatos competitivos da implementação 0023_ligas em bancos que já a
-- aplicaram. Os saldos correntes não são recalculados: o livro novo espelha os
-- créditos históricos com chave estável, sem duplicá-los na reaplicação.
do $$
begin
  if to_regclass('public.xp_credits') is not null then
    insert into public.xp_events (
      user_id, origin, context, amount, attempt_id, course_id,
      idempotency_key, occurred_at
    )
    select x.user_id,
      case when x.source = 'learning' and x.competitive
        then 'learning_base'::public.xp_event_origin
           when x.source = 'mission_bonus' then 'mission_bonus'::public.xp_event_origin
           else 'adjustment'::public.xp_event_origin end,
      'course'::public.xp_event_context,
      greatest(x.amount, 0), x.attempt_id, x.course_id,
      'legacy:xp-credit:' || x.id::text, x.created_at
      from public.xp_credits x where x.amount > 0
    on conflict (idempotency_key) do nothing;
  end if;
end;
$$;

-- Liga legada permanece acessível para auditoria; dados de temporadas, grupos
-- e participantes são copiados para a nova leitura sem alterar os IDs antigos.
do $$
begin
  if to_regclass('public.league_entries') is not null then
    insert into public.seasons (id, starts_at, ends_at, status, closed_at)
    select id, starts_at, ends_at,
      case when status = 'closed' then 'closed'::public.season_status
           else 'open'::public.season_status end, closed_at
      from public.league_seasons
    on conflict do nothing;

    insert into public.season_groups (id, season_id, category, group_index)
    select lg.id, s.id, public.season_category_from_rank(lg.tier),
      lg.group_number + case when lg.tier = 7 then 1000000 else 0 end
      from public.league_groups lg
      join public.league_seasons ls on ls.id = lg.season_id
      join public.seasons s on s.starts_at = ls.starts_at
    on conflict do nothing;

    insert into public.season_entries (
      id, season_id, user_id, group_id, category, season_xp,
      final_rank, result_category, joined_at
    )
    select le.id, sg.season_id, le.user_id, sg.id,
      public.season_category_from_rank(le.tier), greatest(coalesce(le.final_score, 0), 0),
      le.final_position,
      case when le.tier_after is null then null
           else public.season_category_from_rank(le.tier_after) end,
      le.joined_at
      from public.league_entries le
      join public.league_groups lg on lg.id = le.group_id
      join public.league_seasons ls on ls.id = lg.season_id
      join public.seasons s on s.starts_at = ls.starts_at
      join public.season_groups sg on sg.season_id = s.id
       and sg.category = public.season_category_from_rank(lg.tier)
       and sg.group_index = lg.group_number + case when lg.tier = 7 then 1000000 else 0 end
    on conflict do nothing;

    -- Bancos que experimentaram as duas implementações podem já ter a mesma
    -- semana/grupo/participante com UUIDs novos. Preserva essas inscrições e
    -- identifica equivalência pela semana e pelo usuário, sem mover membros.
    if exists (
      select 1 from public.league_entries le
      join public.league_seasons ls on ls.id = le.season_id
       where not exists (
         select 1 from public.season_entries se
         join public.seasons s on s.id = se.season_id
          where s.starts_at = ls.starts_at and se.user_id = le.user_id
       )
    ) then
      raise exception 'legacy league entries need reconciliation before migration 0040';
    end if;
  end if;
end;
$$;

-- A primeira conclusão sem questões é uma conclusão oficial de aula e um dia
-- de estudo. Não representa uma execução de questões nem concede XP base.
create or replace function public.advance_empty_lesson_missions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_def record;
  v_occ uuid;
begin
  if new.context <> 'course' or new.attempt_id is not null then
    return new;
  end if;
  if exists (select 1 from public.questions where lesson_id = new.lesson_id) then
    return new;
  end if;
  select m.course_id into v_course_id
    from public.lessons l join public.modules m on m.id = l.module_id
   where l.id = new.lesson_id;
  for v_def in select id, scope, objective from public.mission_definitions where active loop
    if v_def.objective not in ('complete_lessons', 'study_days') then
      continue;
    end if;
    v_occ := public.ensure_occurrence(v_def.id,
      case when v_def.scope = 'course_daily' then v_course_id else null end,
      new.completed_at);
    if v_occ is not null then
      perform public.upsert_mission_assignment(v_occ, new.user_id);
    end if;
  end loop;
  return new;
end;
$$;
revoke execute on function public.advance_empty_lesson_missions() from public, anon, authenticated;
drop trigger if exists advance_empty_lesson_missions on public.completions;
create trigger advance_empty_lesson_missions
after insert on public.completions
for each row execute function public.advance_empty_lesson_missions();

-- Restaura a função de 0022 sem chamadas à liga legada.
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
end;
$$;
