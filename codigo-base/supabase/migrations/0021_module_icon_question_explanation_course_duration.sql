-- 0021_module_icon_question_explanation_course_duration.sql
-- Complementos trazidos do v2_schema (antigo) que faltavam no schema atual.
-- Migration puramente ADITIVA: só adiciona colunas e os gatilhos que mantêm a
-- duração do curso em dia. Nenhuma regra, RLS ou gatilho existente é alterado;
-- o schema das migrations 0001-0020 continua sendo a fonte de verdade.
--
-- Itens adicionados:
--   1. modules.icon            — ícone (emoji/texto curto) do módulo.
--   2. questions.explanation   — explicação opcional exibida após responder.
--   3. courses.duration_minutes — duração ESTIMADA do curso, calculada pelo
--                                 servidor a partir da quantidade de módulos e
--                                 aulas (ver estimate_course_duration).

-- ---------------------------------------------------------------------------
-- 1. modules.icon
-- Ícone do módulo (antigo Modulo."Icone"). Default alinhado ao ícone padrão
-- usado no Dashboard (DEFAULT_MODULE_ICON = "📘").
-- ---------------------------------------------------------------------------
alter table public.modules
  add column if not exists icon text not null default '📘';

comment on column public.modules.icon is
  'Ícone do módulo (emoji ou texto curto). Exibido na trilha do Dashboard.';

-- ---------------------------------------------------------------------------
-- 2. questions.explanation
-- Explicação opcional (antigo Questao."Explicacao"). Fica NULL quando o criador
-- não escreve uma: na criação da questão, a explicação é opt-in.
-- ---------------------------------------------------------------------------
alter table public.questions
  add column if not exists explanation text;

comment on column public.questions.explanation is
  'Explicação opcional mostrada depois que o usuário responde. NULL quando não há.';

-- ---------------------------------------------------------------------------
-- 3. courses.duration_minutes (calculado pelo servidor)
-- Estimativa de duração do curso, mantida automaticamente por gatilhos. Não é
-- editada pelo cliente — depende só da estrutura (módulos e aulas).
--
-- Regra de estimativa (ajustável): ~8 min por aula + ~2 min de contexto por
-- módulo. A UI formata o valor (ex.: "1 h 20 min").
-- ---------------------------------------------------------------------------
alter table public.courses
  add column if not exists duration_minutes integer not null default 0
    check (duration_minutes >= 0);

comment on column public.courses.duration_minutes is
  'Duração estimada do curso em minutos, calculada pelo servidor: aulas*8 + módulos*2. Não editar pelo cliente.';

-- Constantes da estimativa centralizadas numa função só, para ajuste fácil.
create or replace function public.estimate_course_duration(p_course_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select count(l.id) * 8 + count(distinct m.id) * 2
      from public.modules m
      left join public.lessons l on l.module_id = m.id
      where m.course_id = p_course_id
    ),
    0
  )::integer;
$$;

comment on function public.estimate_course_duration(uuid) is
  'Duração estimada (min) de um curso: 8 min por aula + 2 min por módulo.';

-- Recalcula e grava courses.duration_minutes de um curso.
create or replace function public.recompute_course_duration(p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_course_id is null then
    return;
  end if;
  update public.courses
     set duration_minutes = public.estimate_course_duration(p_course_id)
   where id = p_course_id;
end;
$$;

comment on function public.recompute_course_duration(uuid) is
  'Atualiza courses.duration_minutes do curso informado.';

-- Gatilho em modules: ao inserir/remover/mover módulo, recalcula o curso dono.
create or replace function public.trg_modules_course_duration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_course_duration(old.course_id);
    return old;
  end if;

  perform public.recompute_course_duration(new.course_id);
  -- Se o módulo mudou de curso, recalcula também o curso anterior.
  if tg_op = 'UPDATE' and new.course_id is distinct from old.course_id then
    perform public.recompute_course_duration(old.course_id);
  end if;
  return new;
end;
$$;

drop trigger if exists modules_course_duration on public.modules;
create trigger modules_course_duration
  after insert or update or delete on public.modules
  for each row execute function public.trg_modules_course_duration();

-- Gatilho em lessons: ao inserir/remover/mover aula, recalcula o curso dono
-- (resolvido via modules.course_id, já que lessons só referencia o módulo).
create or replace function public.trg_lessons_course_duration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_course uuid;
  v_old_course uuid;
begin
  if tg_op <> 'INSERT' then
    select course_id into v_old_course from public.modules where id = old.module_id;
  end if;
  if tg_op <> 'DELETE' then
    select course_id into v_new_course from public.modules where id = new.module_id;
  end if;

  perform public.recompute_course_duration(v_new_course);
  if v_old_course is distinct from v_new_course then
    perform public.recompute_course_duration(v_old_course);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists lessons_course_duration on public.lessons;
create trigger lessons_course_duration
  after insert or update or delete on public.lessons
  for each row execute function public.trg_lessons_course_duration();

-- Backfill: calcula a duração de todos os cursos já existentes uma única vez.
update public.courses c
   set duration_minutes = public.estimate_course_duration(c.id);
