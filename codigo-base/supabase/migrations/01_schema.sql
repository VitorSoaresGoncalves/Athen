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

-- ============================================================
-- ÍNDICES
-- ============================================================
create index curso_status_categoria_idx on public."Curso" ("Status", "Categoria");

create index curso_criador_idx on public."Curso" ("ID_Criador");

create index sala_criador_idx on public."Sala" ("ID_Criador");

create index sala_curso_idx on public."Sala" ("fk_Curso_ID");

create index modulo_curso_idx on public."Modulo" ("ID_Curso", "Posicao");

create index aula_modulo_idx on public."Aula" ("ID_Modulo", "Posicao");

create index questao_aula_idx on public."Questao" ("ID_Aula", "Posicao");

create index matricula_usuario_idx on public."matricula" ("fk_Usuario_ID");

create index matricula_curso_idx on public."matricula" ("fk_Curso_ID");

create index participa_sala_pontos_idx on public."participa" ("fk_Sala_ID", "Pontos" desc);

create index participa_usuario_idx on public."participa" ("fk_Usuario_ID");

create index conclui_usuario_idx on public."conclui" ("fk_Usuario_ID", "Data_Finalizacao" desc);

create index conclui_aula_idx on public."conclui" ("fk_Aula_ID");

create index notebook_usuario_idx on public."Notebook" ("ID_Usuario");

create index notebook_curso_idx on public."Notebook" ("ID_Curso");

create index notebook_modulo_idx on public."Notebook" ("ID_Modulo");

create index notebook_sala_idx on public."Notebook" ("ID_Sala");

create index anotacoes_notebook_idx on public."Anotacoes" ("ID_Notebook", "Data_Criacao" desc);

-- ============================================================
-- FUNÇÃO GENÉRICA DE DATA DE ATUALIZAÇÃO
-- ============================================================
create or replace function public.atualizar_data_atualizacao () returns trigger language plpgsql as $$
begin
  new."Data_Atualizacao" = now();
  return new;
end;
$$;

-- ============================================================
-- XP_DIARIO -> XP_TOTAL
-- ============================================================
create or replace function public.atualizar_xp_matricula () returns trigger language plpgsql as $$
declare
  diferenca integer;
begin
  if tg_op = 'INSERT' then
    new."XP_Total" = new."XP_Diario";
    if new."XP_Diario" > 0 or new."Ultima_Aparicao" is null then
      new."Ultima_Aparicao" = coalesce(new."Ultima_Aparicao", now());
    end if;
    return new;
  end if;

  -- Impede alteração manual de XP_Total.
  new."XP_Total" = old."XP_Total";

  if new."XP_Diario" is distinct from old."XP_Diario" then
    if old."Ultima_Aparicao" is not null
       and old."Ultima_Aparicao"::date = current_date then
      diferenca = new."XP_Diario" - old."XP_Diario";
      new."XP_Total" = greatest(old."XP_Total" + diferenca, 0);
    else
      new."XP_Total" = old."XP_Total" + new."XP_Diario";
    end if;

    new."Ultima_Aparicao" = now();
  else
    new."Ultima_Aparicao" = old."Ultima_Aparicao";
  end if;

  return new;
end;
$$;

-- ============================================================
-- AULAS_FINALIZADAS
-- ============================================================
create or replace function public.recalcular_aulas_finalizadas_matricula () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  curso_id uuid;
  usuario_id uuid;
  total_aulas integer;
begin
  usuario_id = coalesce(new."fk_Usuario_ID", old."fk_Usuario_ID");
  curso_id = coalesce(new."fk_Curso_ID", old."fk_Curso_ID");

  select count(*)
    into total_aulas
  from public."conclui" c
  join public."Aula" a on a."ID" = c."fk_Aula_ID"
  join public."Modulo" m on m."ID" = a."ID_Modulo"
  where c."fk_Usuario_ID" = usuario_id
    and m."ID_Curso" = curso_id;

  if tg_op <> 'DELETE' then
    new."Aulas_Finalizadas" = total_aulas;
    return new;
  end if;

  return old;
end;
$$;

create or replace function public.atualizar_aulas_finalizadas () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  curso_id uuid;
  total_aulas integer;
begin
  select m."ID_Curso"
    into curso_id
  from public."Aula" a
  join public."Modulo" m on m."ID" = a."ID_Modulo"
  where a."ID" = new."fk_Aula_ID";

  select count(*)
    into total_aulas
  from public."conclui" c
  join public."Aula" a on a."ID" = c."fk_Aula_ID"
  join public."Modulo" m on m."ID" = a."ID_Modulo"
  where c."fk_Usuario_ID" = new."fk_Usuario_ID"
    and m."ID_Curso" = curso_id;

  update public."matricula"
  set "Aulas_Finalizadas" = total_aulas
  where "fk_Usuario_ID" = new."fk_Usuario_ID"
    and "fk_Curso_ID" = curso_id;

  return new;
end;
$$;

-- ============================================================
-- CONTAGEM DE ESTUDANTES
-- ============================================================
create or replace function public.atualizar_contagem_estudantes () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  curso_id uuid;
begin
  if tg_op = 'INSERT' then
    curso_id = new."fk_Curso_ID";
  elsif tg_op = 'DELETE' then
    curso_id = old."fk_Curso_ID";
  else
    return new;
  end if;

  update public."Curso" c
  set "Contagem_Estudante" = (
    select count(*)::integer
    from public."matricula" m
    where m."fk_Curso_ID" = curso_id
  )
  where c."ID" = curso_id;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- ============================================================
-- AVALIAÇÃO: UMA VEZ POR MATRÍCULA
-- ============================================================
create or replace function public.impedir_alteracao_avaliacao () returns trigger language plpgsql as $$
begin
  if old."Avaliacao" is not null
     and new."Avaliacao" is distinct from old."Avaliacao" then
    raise exception 'A avaliação deste curso já foi realizada e não pode ser alterada.';
  end if;
  return new;
end;
$$;

-- ============================================================
-- AGREGADOS DO CURSO
-- ============================================================
create or replace function public.atualizar_avaliacao_curso () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  curso_id uuid;
  contagem integer;
  media numeric;
begin
  if tg_op = 'DELETE' then
    curso_id = old."fk_Curso_ID";
  else
    curso_id = new."fk_Curso_ID";
  end if;

  -- Se o FK do curso mudou, recalcula o curso antigo.
  if tg_op = 'UPDATE'
     and old."fk_Curso_ID" is distinct from new."fk_Curso_ID" then
    select count(*)::integer, coalesce(avg("Avaliacao"), 0)
      into contagem, media
    from public."matricula"
    where "fk_Curso_ID" = old."fk_Curso_ID"
      and "Avaliacao" is not null;

    update public."Curso"
    set "Contagem_Avaliacao" = contagem,
        "Avaliacao" = round(media, 2)
    where "ID" = old."fk_Curso_ID";
  end if;

  select count(*)::integer, coalesce(avg("Avaliacao"), 0)
    into contagem, media
  from public."matricula"
  where "fk_Curso_ID" = curso_id
    and "Avaliacao" is not null;

  update public."Curso"
  set "Contagem_Avaliacao" = contagem,
      "Avaliacao" = round(media, 2)
  where "ID" = curso_id;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- ============================================================
-- PROTEÇÃO DOS CAMPOS DERIVADOS
-- ============================================================
-- Recalcula os campos derivados quando alguém tenta alterá-los
-- diretamente. Isso evita que o cliente sobrescreva os valores.
-- ============================================================
create or replace function public.proteger_campos_derivados_matricula () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  total_aulas integer;
begin
  if tg_op = 'UPDATE' then
    if new."fk_Usuario_ID" is distinct from old."fk_Usuario_ID"
       or new."fk_Curso_ID" is distinct from old."fk_Curso_ID" then
      raise exception 'Não é permitido alterar o usuário ou o curso de uma matrícula.';
    end if;
  end if;

  select count(*)::integer
    into total_aulas
  from public."conclui" c
  join public."Aula" a on a."ID" = c."fk_Aula_ID"
  join public."Modulo" m on m."ID" = a."ID_Modulo"
  where c."fk_Usuario_ID" = new."fk_Usuario_ID"
    and m."ID_Curso" = new."fk_Curso_ID";

  new."Aulas_Finalizadas" = total_aulas;
  return new;
end;
$$;

-- ============================================================
-- PROTEÇÃO DOS CAMPOS DERIVADOS DO CURSO
-- ============================================================
-- O cliente não pode definir manualmente a média ou as contagens.
-- Os valores são sempre calculados a partir das tabelas relacionadas.
-- ============================================================
create or replace function public.proteger_campos_derivados_curso () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  contagem_avaliacao integer;
  media_avaliacao numeric;
  contagem_estudante integer;
begin
  select count(*)::integer, coalesce(avg("Avaliacao"), 0)
    into contagem_avaliacao, media_avaliacao
  from public."matricula"
  where "fk_Curso_ID" = new."ID"
    and "Avaliacao" is not null;

  select count(*)::integer
    into contagem_estudante
  from public."matricula"
  where "fk_Curso_ID" = new."ID";

  new."Contagem_Avaliacao" = contagem_avaliacao;
  new."Avaliacao" = round(media_avaliacao, 2);
  new."Contagem_Estudante" = contagem_estudante;

  return new;
end;
$$;

-- ============================================================
-- USUÁRIO APÓS SIGNUP
-- ============================================================
create or replace function public.handle_new_user () returns trigger language plpgsql security definer
set
  search_path = public as $$
begin
  insert into public."Usuario" (
    "ID", "Nome_Display", "Avatar_Url", "Biografia", "Cargo", "Nome_Usuario"
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name',
             new.raw_user_meta_data ->> 'full_name',
             'Novo usuário'),
    new.raw_user_meta_data ->> 'avatar_url',
    '',
    'learner',
    new.raw_user_meta_data ->> 'username'
  )
  on conflict ("ID") do nothing;

  return new;
end;
$$;
