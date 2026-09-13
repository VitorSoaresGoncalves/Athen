create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace
    and typname = 'course_level'
  ) then
    create type public.course_level as enum (
      'Beginner', 'Intermediate', 'Advanced'
    );
  end if;

  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace
    and typname = 'course_status'
  ) then
    create type public.course_status as enum (
      'draft', 'published', 'archived'
    );
  end if;

  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace
    and typname = 'question_type'
  ) then
    create type public.question_type as enum (
      'word_match', 'fill_blank', 'multiple_choice', 'order_sequence'
    );
  end if;
end
$$;

-- ============================================================
-- 1. USUARIO
-- ============================================================
create table public."Usuario" (
  "ID" uuid primary key references auth.users (id) on delete cascade,
  "Nome_Display" text not null default 'Athen learner',
  "Avatar_Url" text,
  "Biografia" text not null default '',
  "Cargo" text not null default 'learner' check ("Cargo" in ('learner', 'creator', 'moderator')),
  "Nome_Usuario" text unique,
  "Data_Criacao" timestamptz not null default now(),
  "Data_Atualizacao" timestamptz not null default now()
);

-- ============================================================
-- 2. CURSO
-- ============================================================
create table public."Curso" (
  "ID" uuid primary key default gen_random_uuid (),
  "Cor_Capa" text not null default '#dcefe5',
  "Titulo" text not null,
  "Slug" text not null unique,
  "Descricao" text not null default '',
  "ID_Criador" uuid not null references public."Usuario" ("ID") on delete restrict,
  "Dificuldade" public.course_level not null default 'Beginner',
  "Categoria" text not null default 'Software engineering',
  "Tags" text[] not null default '{}',
  "Icone" text not null default '◒',
  "Status" public.course_status not null default 'draft',
  "Avaliacao" numeric(3, 2) not null default 0 check (
    "Avaliacao" >= 0
    and "Avaliacao" <= 5
  ),
  "Contagem_Avaliacao" integer not null default 0 check ("Contagem_Avaliacao" >= 0),
  "Contagem_Estudante" integer not null default 0 check ("Contagem_Estudante" >= 0),
  "Data_Criacao" timestamptz not null default now(),
  "Data_Atualizacao" timestamptz not null default now()
);

-- ============================================================
-- 3. SALA
-- ============================================================
create table public."Sala" (
  "ID" uuid primary key default gen_random_uuid (),
  "Nome" text not null,
  "Codigo" text not null unique,
  "ID_Criador" uuid not null references public."Usuario" ("ID") on delete restrict,
  "Data_Criacao" timestamptz not null default now(),
  "Data_Atualizacao" timestamptz not null default now(),
  "fk_Curso_ID" uuid references public."Curso" ("ID") on delete cascade
);

-- ============================================================
-- 4. MODULO
-- ============================================================
create table public."Modulo" (
  "ID" uuid primary key default gen_random_uuid (),
  "ID_Curso" uuid not null references public."Curso" ("ID") on delete cascade,
  "Titulo" text not null,
  "Subtitulo" text not null default '',
  "Icone" text not null default '01',
  "Cor_Tema" text not null default '#2f8061',
  "Posicao" integer not null default 0 check ("Posicao" >= 0),
  "Data_Criacao" timestamptz not null default now(),
  "Data_Atualizacao" timestamptz not null default now(),
  constraint modulo_curso_posicao_unique unique ("ID_Curso", "Posicao")
);

-- ============================================================
-- 5. AULA
-- ============================================================
create table public."Aula" (
  "ID" uuid primary key default gen_random_uuid (),
  "ID_Modulo" uuid not null references public."Modulo" ("ID") on delete cascade,
  "Titulo" text not null,
  "Descricao" text not null default '',
  "Duracao" text not null default '5 min',
  "Posicao" integer not null default 0 check ("Posicao" >= 0),
  "Publicado" boolean not null default false,
  "Data_Criacao" timestamptz not null default now(),
  "Data_Atualizacao" timestamptz not null default now(),
  constraint aula_modulo_posicao_unique unique ("ID_Modulo", "Posicao")
);

-- ============================================================
-- 6. QUESTAO
-- ============================================================
create table public."Questao" (
  "ID" uuid primary key default gen_random_uuid (),
  "ID_Aula" uuid not null references public."Aula" ("ID") on delete cascade,
  "Tipo" public.question_type not null,
  "Enunciado" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "Explicacao" text not null default '',
  "XP" integer not null default 10 check ("XP" > 0),
  "Tipo_Resposta" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "Posicao" integer not null default 0 check ("Posicao" >= 0),
  "Data_Criacao" timestamptz not null default now(),
  "Data_Atualizacao" timestamptz not null default now(),
  constraint questao_aula_posicao_unique unique ("ID_Aula", "Posicao")
);

-- ============================================================
-- 7. MATRICULA
-- ============================================================
create table public."matricula" (
  "fk_Curso_ID" uuid not null references public."Curso" ("ID") on delete cascade,
  "fk_Usuario_ID" uuid not null references public."Usuario" ("ID") on delete cascade,
  "Aulas_Finalizadas" integer not null default 0 check ("Aulas_Finalizadas" >= 0),
  "XP_Diario" integer not null default 0 check ("XP_Diario" >= 0),
  "XP_Total" integer not null default 0 check ("XP_Total" >= 0),
  "Ultima_Aparicao" timestamptz,
  "Data_Atualizacao" timestamptz not null default now(),
  "Data_Matricula" timestamptz not null default now(),
  "Avaliacao" numeric(2, 1) check (
    "Avaliacao" is null
    or (
      "Avaliacao" >= 1
      and "Avaliacao" <= 5
    )
  ),
  primary key ("fk_Curso_ID", "fk_Usuario_ID")
);

-- ============================================================
-- 8. PARTICIPA
-- ============================================================
create table public."participa" (
  "fk_Usuario_ID" uuid not null references public."Usuario" ("ID") on delete cascade,
  "fk_Sala_ID" uuid not null references public."Sala" ("ID") on delete cascade,
  "Pontos" integer not null default 0 check ("Pontos" >= 0),
  "Data_Associacao" timestamptz not null default now(),
  primary key ("fk_Usuario_ID", "fk_Sala_ID")
);

-- ============================================================
-- 9. CONCLUI
-- ============================================================
create table public."conclui" (
  "fk_Usuario_ID" uuid not null references public."Usuario" ("ID") on delete cascade,
  "fk_Aula_ID" uuid not null references public."Aula" ("ID") on delete cascade,
  "Pontuacao" integer not null default 0 check (
    "Pontuacao" >= 0
    and "Pontuacao" <= 100
  ),
  "Data_Finalizacao" timestamptz not null default now(),
  "XP_Ganho" integer not null default 0 check ("XP_Ganho" >= 0),
  primary key ("fk_Usuario_ID", "fk_Aula_ID")
);

-- ============================================================
-- 10. NOTEBOOK
-- ============================================================
create table public."Notebook" (
  "ID" uuid primary key default gen_random_uuid (),
  "ID_Usuario" uuid not null references public."Usuario" ("ID") on delete cascade,
  "Nome" text not null,
  "ID_Curso" uuid references public."Curso" ("ID") on delete cascade,
  "ID_Modulo" uuid references public."Modulo" ("ID") on delete cascade,
  "ID_Sala" uuid references public."Sala" ("ID") on delete cascade,
  "Data_Criacao" timestamptz not null default now(),
  "Data_Atualizacao" timestamptz not null default now(),
  constraint notebook_um_contexto check (
    (
      case
        when "ID_Curso" is not null then 1
        else 0
      end
    ) + (
      case
        when "ID_Modulo" is not null then 1
        else 0
      end
    ) + (
      case
        when "ID_Sala" is not null then 1
        else 0
      end
    ) <= 1
  )
);

-- ============================================================
-- 11. ANOTACOES
-- ============================================================
create table public."Anotacoes" (
  "ID" uuid primary key default gen_random_uuid (),
  "ID_Notebook" uuid not null references public."Notebook" ("ID") on delete cascade,
  "Titulo" text not null default '',
  "Conteudo" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "Data_Criacao" timestamptz not null default now(),
  "Data_Atualizacao" timestamptz not null default now()
);