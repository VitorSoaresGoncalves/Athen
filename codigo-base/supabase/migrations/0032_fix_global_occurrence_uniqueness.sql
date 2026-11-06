-- 0032_fix_global_occurrence_uniqueness.sql
-- Correção: a unicidade das ocorrências de missão não impedia duplicatas das
-- missões GLOBAIS. A constraint `unique (definition_id, course_id, period_start)`
-- (0024) não restringe linhas em que course_id É NULL, porque no Postgres dois
-- NULL não são considerados iguais numa UNIQUE padrão. Como as ocorrências
-- globais têm course_id NULL, cada chamada de ensure_occurrence criava uma nova
-- linha (o `on conflict ... do nothing` nunca disparava), gerando duplicatas e
-- repetindo cada missão na leitura (detectado no ensaio local).
--
-- Correção: substituir a constraint por um ÍNDICE ÚNICO que normaliza o NULL via
-- coalesce para um UUID sentinela, de modo que (def, período) com course_id NULL
-- seja único. ensure_occurrence passa a usar esse índice no `on conflict`.
-- Também remove as duplicatas já existentes, preservando a ocorrência mais antiga
-- e realocando eventuais atribuições para ela.

-- ---------------------------------------------------------------------------
-- 1. Remove duplicatas existentes.
--    Mantém, por (definition_id, course_id normalizado, period_start), a linha
--    de menor created_at (desempate por id). Realoca mission_assignments das
--    duplicatas para a linha mantida (sem violar o unique (occurrence,user)) e
--    então apaga as duplicatas.
-- ---------------------------------------------------------------------------
do $$
declare
  v_nil uuid := '00000000-0000-0000-0000-000000000000';
begin
  -- Mapa: para cada ocorrência duplicada, qual é a "canônica" (a mantida).
  create temporary table _occ_canon on commit drop as
  with ranked as (
    select
      o.id,
      first_value(o.id) over (
        partition by o.definition_id, coalesce(o.course_id, v_nil), o.period_start
        order by o.created_at asc, o.id asc
      ) as canon_id
    from public.mission_occurrences o
  )
  select id, canon_id from ranked where id <> canon_id;

  -- Realoca atribuições das duplicatas para a canônica, evitando colisão com
  -- uma atribuição que o mesmo usuário já tenha na canônica.
  update public.mission_assignments a
     set occurrence_id = m.canon_id
    from _occ_canon m
   where a.occurrence_id = m.id
     and not exists (
       select 1 from public.mission_assignments b
        where b.occurrence_id = m.canon_id and b.user_id = a.user_id
     );

  -- Atribuições que colidiriam (usuário já tem na canônica) são redundantes: apaga.
  delete from public.mission_assignments a
   using _occ_canon m
   where a.occurrence_id = m.id;

  -- Apaga as ocorrências duplicadas.
  delete from public.mission_occurrences o
   using _occ_canon m
   where o.id = m.id;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Substitui a constraint por um índice único que trata course_id NULL.
-- ---------------------------------------------------------------------------
alter table public.mission_occurrences
  drop constraint if exists mission_occurrences_definition_id_course_id_period_start_key;

create unique index if not exists mission_occurrences_unique_idx
  on public.mission_occurrences (
    definition_id,
    coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid),
    period_start
  );

comment on index public.mission_occurrences_unique_idx is
  'Unicidade de ocorrência por (definição, curso, período). Normaliza course_id NULL (globais) para um UUID sentinela, de modo que as globais também sejam únicas por período.';

-- ---------------------------------------------------------------------------
-- 3. ensure_occurrence: usa o índice acima no `on conflict`. O alvo do conflito
--    passa a ser a expressão coalesce (idêntica à do índice), para que o upsert
--    das globais (course_id NULL) seja idempotente de verdade.
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
  v_nil   uuid := '00000000-0000-0000-0000-000000000000';
  v_cid   uuid;
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

  v_cid := case when v_def.scope = 'course_daily' then p_course_id else null end;

  insert into public.mission_occurrences (
    definition_id, scope, objective, course_id, target, reward_xp, period_start, period_end
  )
  values (
    v_def.id, v_def.scope, v_def.objective, v_cid,
    v_def.target, v_def.reward_xp, v_start, v_end
  )
  on conflict (definition_id, coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid), period_start)
    do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
      from public.mission_occurrences
     where definition_id = v_def.id
       and coalesce(course_id, v_nil) = coalesce(v_cid, v_nil)
       and period_start = v_start;
  end if;

  return v_id;
end;
$$;

comment on function public.ensure_occurrence(uuid, uuid, timestamptz) is
  'Materializa idempotentemente a ocorrência de uma definição no período que contém o instante (diário ou semanal, America/Sao_Paulo), copiando meta/bônus do catálogo. Idempotente também para globais (course_id NULL) via índice com coalesce. Retorna o id da ocorrência.';
