-- 0031_mission_read.sql
-- Leitura das missões globais/curso para a UI (página /missoes e TopDown).
--
-- Contexto: 0024/0025 criaram o catálogo, as ocorrências, as atribuições e o
-- avanço/concessão. Faltava uma leitura que junte, para o usuário autenticado,
-- a ocorrência corrente + a definição + o progresso dele. A materialização das
-- ocorrências até aqui era sob demanda (ao finalizar atividade); para a lista
-- mostrar as missões do período mesmo antes de qualquer atividade (Q020/Q072),
-- esta leitura materializa as ocorrências GLOBAIS do período corrente de forma
-- idempotente (reutilizando ensure_occurrence) e então retorna a junção.
--
-- Diárias de CURSO: lista as ocorrências já materializadas dos cursos em que o
-- usuário tem atividade individual (elas são criadas quando ele estuda o curso);
-- não materializa para todo curso do catálogo, respeitando Q125.

-- ---------------------------------------------------------------------------
-- ensure_current_global_occurrences(): materializa (idempotente) a ocorrência
-- do período corrente para cada definição GLOBAL ativa — diária de hoje e
-- semanal desta semana. SECURITY DEFINER; usada pela leitura abaixo.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_current_global_occurrences()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_def record;
begin
  for v_def in
    select id from public.mission_definitions
     where active = true and scope in ('global_daily', 'global_weekly')
  loop
    perform public.ensure_occurrence(v_def.id, null, now());
  end loop;
end;
$$;

comment on function public.ensure_current_global_occurrences() is
  'Materializa idempotentemente as ocorrências do período corrente das missões globais ativas (diária de hoje, semanal desta semana). Base da lista de missões mesmo sem atividade prévia (Q020/Q072).';

-- ---------------------------------------------------------------------------
-- my_missions(): lista as missões do período corrente para o usuário logado,
-- com progresso. Inclui:
--   - todas as ocorrências GLOBAIS do período corrente (materializadas acima);
--   - as ocorrências de DIÁRIA DE CURSO do dia corrente que já existem para o
--     usuário (criadas quando ele estuda o curso).
-- Cada linha traz escopo, objetivo, meta, bônus, prazo (period_end), progresso,
-- contagem e estado de conclusão. pendente = não concluída e ainda no período.
-- ---------------------------------------------------------------------------
create or replace function public.my_missions()
returns table (
  occurrence_id uuid,
  definition_id uuid,
  scope         public.mission_scope,
  objective     public.mission_objective,
  code          text,
  title         text,
  description   text,
  course_id     uuid,
  course_title  text,
  target        integer,
  reward_xp     integer,
  period_start  timestamptz,
  period_end    timestamptz,
  progress      numeric,
  current_count integer,
  completed     boolean
)
language plpgsql
-- VOLATILE (padrão): a função materializa ocorrências globais antes de ler, então
-- não pode ser STABLE (que proíbe escrita e não enxergaria as linhas recém-criadas
-- na mesma chamada).
security definer
set search_path = public
as $$
begin
  -- Garante as ocorrências globais do período corrente antes de ler.
  perform public.ensure_current_global_occurrences();

  return query
  select
    o.id as occurrence_id,
    o.definition_id,
    o.scope,
    o.objective,
    d.code,
    d.title,
    d.description,
    o.course_id,
    c.title as course_title,
    o.target,
    o.reward_xp,
    o.period_start,
    o.period_end,
    coalesce(a.progress, 0) as progress,
    coalesce(a.current_count, 0) as current_count,
    coalesce(a.completed, false) as completed
  from public.mission_occurrences o
  join public.mission_definitions d on d.id = o.definition_id
  left join public.courses c on c.id = o.course_id
  left join public.mission_assignments a
         on a.occurrence_id = o.id and a.user_id = auth.uid()
  where now() >= o.period_start
    and now() <  o.period_end
    and (
      -- Globais: sempre visíveis no período.
      o.scope in ('global_daily', 'global_weekly')
      -- Diária de curso: só as do próprio usuário (já materializadas por atividade).
      or (o.scope = 'course_daily' and a.id is not null)
    )
  order by
    case o.scope when 'global_daily' then 0 when 'course_daily' then 1 else 2 end,
    d.display_order asc,
    o.period_end asc;
end;
$$;

comment on function public.my_missions() is
  'Missões do período corrente do usuário autenticado (globais + diárias de curso já materializadas), com progresso. Materializa as globais do período antes de ler (Q020/Q072).';

grant execute on function public.my_missions() to authenticated;

-- ---------------------------------------------------------------------------
-- my_mission_detail(occurrence): detalhe de uma ocorrência para o usuário
-- logado — os mesmos campos de my_missions para uma única ocorrência. Usado na
-- tela de detalhe (Q073). Retorna vazio se a ocorrência não existir.
-- ---------------------------------------------------------------------------
create or replace function public.my_mission_detail(p_occurrence_id uuid)
returns table (
  occurrence_id uuid,
  definition_id uuid,
  scope         public.mission_scope,
  objective     public.mission_objective,
  code          text,
  title         text,
  description   text,
  course_id     uuid,
  course_title  text,
  target        integer,
  reward_xp     integer,
  period_start  timestamptz,
  period_end    timestamptz,
  progress      numeric,
  current_count integer,
  completed     boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id as occurrence_id,
    o.definition_id,
    o.scope,
    o.objective,
    d.code,
    d.title,
    d.description,
    o.course_id,
    c.title as course_title,
    o.target,
    o.reward_xp,
    o.period_start,
    o.period_end,
    coalesce(a.progress, 0) as progress,
    coalesce(a.current_count, 0) as current_count,
    coalesce(a.completed, false) as completed
  from public.mission_occurrences o
  join public.mission_definitions d on d.id = o.definition_id
  left join public.courses c on c.id = o.course_id
  left join public.mission_assignments a
         on a.occurrence_id = o.id and a.user_id = auth.uid()
  where o.id = p_occurrence_id;
$$;

comment on function public.my_mission_detail(uuid) is
  'Detalhe de uma ocorrência de missão para o usuário autenticado, com progresso (Q073).';

grant execute on function public.my_mission_detail(uuid) to authenticated;
