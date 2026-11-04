-- 0025_missoes_progresso_e_bonus.sql
-- Avanço de progresso e concessão de bônus das missões globais/de curso.
--
-- Contexto: 0024 criou a estrutura (mission_definitions / mission_occurrences /
-- mission_assignments) mas nada materializa ocorrência, avança progresso ou
-- concede bônus. Esta fatia cria as funções que ligam a atividade real do
-- usuário às missões e creditam o bônus uma única vez. O gancho no
-- finalize_attempt fica para a fatia seguinte; aqui nenhuma função de
-- aprendizagem é alterada.
--
-- Fontes de verdade (sem contador próprio, para ser reentrante/idempotente):
--   - attempts finalizados (finished_at) dentro do período da ocorrência;
--   - answers.is_correct desses attempts (questões distintas acertadas);
--   - o dia local (America/Sao_Paulo) de cada attempt para "dias de estudo".
-- O progresso é RECALCULADO a cada chamada, não incrementado: reexecutar é
-- seguro e nunca duplica contagem.
--
-- Bônus no Athen (0023_ligas.sql): o livro de XP é public.xp_credits. O bônus é
-- lançado como linha com source='mission_bonus' e competitive=false (não pontua
-- a liga competitiva) e soma em profiles.xp_global como o resto do projeto faz
-- (level recalculado por level_for_xp). Não há temporadas nem xp_events aqui.
-- Calendário America/Sao_Paulo, semana na segunda 00h, como as ligas.

-- ---------------------------------------------------------------------------
-- Idempotência do bônus: xp_credits (0023) não tinha chave de idempotência para
-- lançamentos que não vêm de uma answer (o bônus de missão não tem answer_id).
-- Acrescenta idempotency_key com índice único parcial, sem alterar a 0023.
-- A concessão também é protegida por mission_assignments.granted; a chave é a
-- segunda barreira contra lançamento duplicado do mesmo bônus.
-- ---------------------------------------------------------------------------
alter table public.xp_credits
  add column if not exists idempotency_key text;

comment on column public.xp_credits.idempotency_key is
  'Chave de idempotência de lançamentos sem answer_id (ex.: bonus de missao). Unica quando presente.';

create unique index if not exists xp_credits_idempotency_uidx
  on public.xp_credits (idempotency_key) where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- Fronteiras de período no calendário oficial (America/Sao_Paulo).
--   mission_day_start(ts)  -> 00h local do dia de ts, como timestamptz.
--   mission_week_start(ts) -> 00h local da segunda-feira da semana de ts.
-- A semana reusa league_week_start (0023) para não divergir do calendário das
-- ligas (segunda 00h). Usadas para materializar a ocorrência do período que
-- contém um instante.
-- ---------------------------------------------------------------------------
create or replace function public.mission_day_start(p_ts timestamptz)
returns timestamptz
language sql
immutable
as $$
  select date_trunc('day', p_ts at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
$$;

create or replace function public.mission_week_start(p_ts timestamptz)
returns timestamptz
language sql
stable
as $$
  -- Mesma referência de semana das ligas (segunda 00h, America/Sao_Paulo).
  select public.league_week_start(p_ts);
$$;

comment on function public.mission_day_start(timestamptz) is
  '00h local (America/Sao_Paulo) do dia de p_ts. Inicio inclusivo do periodo diario.';
comment on function public.mission_week_start(timestamptz) is
  '00h local da segunda-feira da semana de p_ts, reusando league_week_start. Inicio inclusivo do periodo semanal.';

-- ---------------------------------------------------------------------------
-- count_mission_progress(occurrence, user): contagem bruta rumo à meta de UMA
-- ocorrência, recalculada das fontes de verdade dentro do seu período.
--   complete_lessons    -> aulas distintas com attempt finalizado no período
--   complete_executions -> attempts finalizados no período
--   correct_questions   -> questões distintas acertadas no período
--   study_days          -> dias locais distintos com attempt finalizado no período
-- Globais consideram curso e sala; course_daily restringe ao curso da ocorrência
-- e ao contexto individual (room_id is null).
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

  -- Base comum: attempts finalizados do usuário dentro do período. course_daily
  -- restringe ao curso da ocorrência e ao contexto individual (room_id is null);
  -- globais aceitam curso ou sala.
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
  'Contagem bruta rumo a meta de uma ocorrencia, recalculada das fontes (attempts/answers) dentro do periodo. Deterministica e reentrante; nao usa contador proprio.';

-- ---------------------------------------------------------------------------
-- ensure_occurrence(definition, course, instant): materializa (idempotente) a
-- ocorrência da definição no período que contém o instante, copiando meta/bônus
-- do catálogo (congelados na materialização). Retorna o id da ocorrência.
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

  -- A unicidade (0024) usa indice que normaliza course_id NULL das globais; por
  -- isso o on conflict aponta para esse indice de expressao.
  insert into public.mission_occurrences (
    definition_id, scope, objective, course_id, target, reward_xp, period_start, period_end
  )
  values (
    v_def.id, v_def.scope, v_def.objective,
    case when v_def.scope = 'course_daily' then p_course_id else null end,
    v_def.target, v_def.reward_xp, v_start, v_end
  )
  on conflict (definition_id, coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid), period_start)
    do nothing
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
  'Materializa idempotentemente a ocorrencia de uma definicao no periodo que contem o instante (diario ou semanal, America/Sao_Paulo), copiando meta/bonus do catalogo. Retorna o id da ocorrencia.';

-- ---------------------------------------------------------------------------
-- upsert_mission_assignment(occurrence, user): materializa/atualiza a atribuição
-- do usuário para uma ocorrência e CONCEDE o bônus uma única vez ao concluir.
--   - progress = min(100, count/target*100), current_count = count.
--   - completed vira true quando count >= target (e congela completed_at).
--   - ao concluir pela 1ª vez (granted=false), lança o bônus em xp_credits
--     (source='mission_bonus', competitive=false), idempotente por
--     idempotency_key 'mission:bonus:<assignment>', soma em profiles.xp_global
--     (level recalculado) e marca granted=true.
-- O crédito base de aprendizagem (xp_credits source='learning') não é tocado
-- aqui. O bônus não é competitivo, então não entra na pontuação da liga.
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
      -- Bônus no livro de XP: não competitivo (não pontua a liga). A chave de
      -- idempotência protege contra lançamento duplicado além do flag granted.
      insert into public.xp_credits
        (user_id, source, amount, competitive, course_id, idempotency_key)
      values
        (p_user_id, 'mission_bonus', v_occ.reward_xp, false, v_occ.course_id,
         'mission:bonus:' || v_assignment.id::text)
      on conflict (idempotency_key) where idempotency_key is not null do nothing;

      -- Soma o bônus ao saldo global vitalício e recalcula o nível.
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
  'Materializa/atualiza a atribuicao de uma ocorrencia ao usuario e concede o bonus uma unica vez ao concluir (xp_credits mission_bonus nao competitivo + xp_global). Idempotente: progresso recalculado, concessao protegida por granted e idempotency_key.';

-- ---------------------------------------------------------------------------
-- Permissões: estas funções são internas (materialização/avanço/concessão) e
-- serão chamadas pela fatia de gancho do finalize_attempt (SECURITY DEFINER).
-- Nenhuma delas é executável diretamente pelo cliente.
-- ---------------------------------------------------------------------------
revoke execute on function
  public.mission_day_start(timestamptz),
  public.mission_week_start(timestamptz),
  public.count_mission_progress(uuid, uuid),
  public.ensure_occurrence(uuid, uuid, timestamptz),
  public.upsert_mission_assignment(uuid, uuid)
from public, anon, authenticated;
