-- 0024_global_course_missions.sql
-- Catálogo de missões globais e diárias de curso (estrutura).
--
-- Contexto: até aqui só existiam missões de SALA (tabela public.missions,
-- room_id NOT NULL, criadas pelo educador). O questionário define também
-- missões da plataforma, determinísticas e iguais para todos os elegíveis
-- (Q016/Q017/Q119/Q136):
--   - globais DIÁRIAS e SEMANAIS: contam atividade de qualquer curso ou sala;
--   - diárias de CURSO: uma por curso com vínculo individual elegível, geradas
--     automaticamente pelo sistema (não pelo criador do curso).
--
-- Esta fatia cria SOMENTE a estrutura (catálogo determinístico, ocorrências por
-- período e atribuições por usuário) e não altera a tabela de salas nem a lógica
-- de crédito. O AVANÇO de progresso e a CONCESSÃO de bônus (lançando xp_events
-- com origem mission_bonus da fatia 0023) ficam para a próxima fatia; aqui nada
-- credita XP ainda.
--
-- Calendário (Q021): America/Sao_Paulo, dia local, semana iniciada na segunda
-- 00h. As ocorrências carregam período explícito [period_start, period_end).

-- ---------------------------------------------------------------------------
-- Enums de catálogo.
--   scope      = alcance temporal/contextual da definição.
--   objective  = o que a missão mede. Espelha o catálogo de Q136; novos tipos
--                podem ser adicionados em fatias futuras.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'mission_scope') then
    create type public.mission_scope as enum (
      'global_daily',   -- 3 diárias globais (Q136)
      'global_weekly',  -- 2 semanais globais (Q136)
      'course_daily'    -- 1 diária por curso elegível (Q125/Q136)
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'mission_objective') then
    create type public.mission_objective as enum (
      'complete_lessons',    -- concluir N aulas (nova ou revisão integral)
      'correct_questions',   -- acertar N questões distintas (Q128)
      'complete_executions', -- concluir N execuções completas
      'study_days'           -- estudar em N dias distintos
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- mission_definitions: catálogo determinístico da plataforma. Compartilhado por
-- todos os usuários elegíveis (sem sorteio individual — Q017/Q119). Para
-- course_daily, a definição é um molde: a ocorrência por curso é materializada
-- em mission_occurrences. active controla quais moldes o sistema instancia.
-- ---------------------------------------------------------------------------
create table if not exists public.mission_definitions (
  id            uuid primary key default gen_random_uuid(),
  scope         public.mission_scope     not null,
  objective     public.mission_objective not null,
  code          text not null unique,     -- identificador estável do molde (ex.: 'global_daily_complete_lesson')
  title         text not null,
  description   text,
  target        integer not null check (target >= 1),   -- meta (N aulas/questões/execuções/dias)
  reward_xp     integer not null check (reward_xp >= 0), -- bônus concedido ao cumprir
  display_order integer not null default 0,             -- ordem estável de apresentação (Q072)
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.mission_definitions is
  'Catálogo determinístico de missões globais/diárias de curso da plataforma (Q016/Q119/Q136). Compartilhado por todos os elegíveis, sem sorteio individual. course_daily é um molde instanciado por curso em mission_occurrences.';
comment on column public.mission_definitions.target is
  'Meta da missão. Variantes de meta inviável (Q018/Q136) são materializadas na ocorrência, não aqui.';
comment on column public.mission_definitions.reward_xp is
  'Bônus concedido ao cumprir (origem mission_bonus no livro de XP). Não pontua a temporada (Q102).';

create index if not exists mission_definitions_scope_idx
  on public.mission_definitions (scope, active, display_order);

-- ---------------------------------------------------------------------------
-- mission_occurrences: instância de uma definição em um período concreto.
--   - global_daily/global_weekly: uma ocorrência por período (course_id NULL).
--   - course_daily: uma ocorrência por (curso, dia).
-- target/reward_xp são COPIADOS da definição no momento da materialização, para
-- que uma edição futura do catálogo não altere ocorrências já publicadas
-- (regra publicada é imutável — Q035/Q095). period_start inclusivo, period_end
-- exclusivo (Q022/Q094).
-- ---------------------------------------------------------------------------
create table if not exists public.mission_occurrences (
  id            uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.mission_definitions (id) on delete cascade,
  scope         public.mission_scope     not null,
  objective     public.mission_objective not null,
  course_id     uuid references public.courses (id) on delete cascade, -- só para course_daily
  target        integer not null check (target >= 1),
  reward_xp     integer not null check (reward_xp >= 0),
  period_start  timestamptz not null,
  period_end    timestamptz not null,
  created_at    timestamptz not null default now(),
  check (period_end > period_start),
  -- Uma ocorrência por definição+curso+período (course_id NULL para globais).
  unique (definition_id, course_id, period_start)
);

comment on table public.mission_occurrences is
  'Instância de uma definição em um período [period_start, period_end). Uma por período para globais; uma por (curso, dia) para course_daily. target/reward_xp congelados na materialização (regra publicada imutável).';
comment on column public.mission_occurrences.course_id is
  'Curso da diária de curso (course_daily). NULL para missões globais, que contam atividade de qualquer curso/sala (Q017).';

create index if not exists mission_occurrences_period_idx
  on public.mission_occurrences (scope, period_start, period_end);
create index if not exists mission_occurrences_course_idx
  on public.mission_occurrences (course_id, period_start);

-- ---------------------------------------------------------------------------
-- mission_assignments: a atribuição de uma ocorrência a um usuário, com o
-- progresso dele. Adesão automática a partir da elegibilidade (Q020): a linha é
-- criada quando o usuário se torna elegível/age, não por aceite manual.
-- completed_at marca a conquista; granted indica se o bônus já foi lançado
-- (a concessão em si fica na próxima fatia). Espelha mission_progress das salas.
-- ---------------------------------------------------------------------------
create table if not exists public.mission_assignments (
  id            uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.mission_occurrences (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  progress      numeric(5,2) not null default 0 check (progress >= 0 and progress <= 100),
  current_count integer not null default 0 check (current_count >= 0), -- contagem bruta rumo ao target
  completed     boolean not null default false,
  completed_at  timestamptz,
  granted       boolean not null default false, -- bônus já lançado no livro de XP?
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (occurrence_id, user_id)
);

comment on table public.mission_assignments is
  'Atribuição de uma ocorrência a um usuário, com progresso. Adesão automática pela elegibilidade (Q020). granted evita conceder o bônus duas vezes; a concessão é feita em fatia posterior.';

create index if not exists mission_assignments_user_idx
  on public.mission_assignments (user_id, completed);
create index if not exists mission_assignments_occurrence_idx
  on public.mission_assignments (occurrence_id);

-- ---------------------------------------------------------------------------
-- RLS.
--   mission_definitions / mission_occurrences: catálogo legível por qualquer
--     usuário autenticado (como o catálogo de medals). Escrita só admin/serviço.
--   mission_assignments: o dono lê/avança as próprias; admin lê tudo. Sem
--     insert/update livre do cliente além do próprio usuário — o avanço real
--     virá de função SECURITY DEFINER na próxima fatia, mas a leitura própria é
--     liberada desde já para o painel /missoes.
-- ---------------------------------------------------------------------------
alter table public.mission_definitions enable row level security;
alter table public.mission_occurrences enable row level security;
alter table public.mission_assignments enable row level security;

drop policy if exists mission_definitions_select on public.mission_definitions;
create policy mission_definitions_select on public.mission_definitions
  for select to authenticated using (true);

drop policy if exists mission_definitions_admin_write on public.mission_definitions;
create policy mission_definitions_admin_write on public.mission_definitions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists mission_occurrences_select on public.mission_occurrences;
create policy mission_occurrences_select on public.mission_occurrences
  for select to authenticated using (true);

drop policy if exists mission_occurrences_admin_write on public.mission_occurrences;
create policy mission_occurrences_admin_write on public.mission_occurrences
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists mission_assignments_select_own on public.mission_assignments;
create policy mission_assignments_select_own on public.mission_assignments
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Escrita das atribuições fica para a fatia de avanço (função SECURITY DEFINER);
-- admin pode gerir enquanto isso.
drop policy if exists mission_assignments_admin_write on public.mission_assignments;
create policy mission_assignments_admin_write on public.mission_assignments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- updated_at automático, como nas demais tabelas (trigger touch_updated_at de 0012).
drop trigger if exists set_updated_at on public.mission_definitions;
create trigger set_updated_at before update on public.mission_definitions
  for each row execute function public.touch_updated_at();

drop trigger if exists set_updated_at on public.mission_assignments;
create trigger set_updated_at before update on public.mission_assignments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Seed do catálogo inicial (Q136 + valores delegados de Q045/Q135).
-- Determinístico e idempotente por code. Valores:
--   diárias globais: até 6 XP/dia  -> 2 XP cada (3 diárias)
--   semanais globais: até 16 XP/semana -> 8 XP cada (2 semanais)
--   diária de curso: 1 XP por curso/dia
-- Metas de Q136. Variantes de meta inviável são tratadas na materialização.
-- ---------------------------------------------------------------------------
insert into public.mission_definitions (scope, objective, code, title, description, target, reward_xp, display_order)
values
  ('global_daily',  'complete_lessons',    'global_daily_complete_lesson',   'Conclua uma aula',            'Conclua uma aula hoje, nova ou em revisão integral.', 1,  2, 1),
  ('global_daily',  'correct_questions',   'global_daily_correct_3',         'Acerte três questões',        'Acerte três questões distintas hoje.',                3,  2, 2),
  ('global_daily',  'complete_executions', 'global_daily_executions_3',      'Complete três execuções',     'Conclua três execuções completas hoje.',              3,  2, 3),
  ('global_weekly', 'complete_executions', 'global_weekly_executions_10',    'Dez execuções na semana',     'Conclua dez execuções completas nesta semana.',       10, 8, 1),
  ('global_weekly', 'study_days',          'global_weekly_study_3_days',     'Estude em três dias',         'Estude em três dias distintos nesta semana.',         3,  8, 2),
  ('course_daily',  'complete_lessons',    'course_daily_complete_lesson',   'Conclua uma aula do curso',   'Conclua uma aula deste curso hoje.',                  1,  1, 1)
on conflict (code) do nothing;
