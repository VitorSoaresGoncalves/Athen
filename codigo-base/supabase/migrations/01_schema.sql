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
-- FUNÇÃO PARA EXCLUSÃO DE CONTA
-- ============================================================
create or replace function public.excluir_minha_conta ()
returns void
language plpgsql security definer
set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;

  if exists (select 1 from public."Curso" where "ID_Criador" = auth.uid())
     or exists (select 1 from public."Sala" where "ID_Criador" = auth.uid()) then
    raise exception 'Exclua ou transfira seus cursos e salas antes de excluir a conta.';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.excluir_minha_conta () from public, anon;
grant execute on function public.excluir_minha_conta () to authenticated;

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
create or replace function public.atualizar_aulas_finalizadas () returns trigger
language plpgsql security definer
set search_path = public as $$
declare
  v_usuario uuid; v_aula uuid; v_curso uuid; total_aulas integer;
begin
  if tg_op = 'DELETE' then
    v_usuario := old."fk_Usuario_ID"; v_aula := old."fk_Aula_ID";
  else
    v_usuario := new."fk_Usuario_ID"; v_aula := new."fk_Aula_ID";
  end if;

  select m."ID_Curso" into v_curso
  from public."Aula" a
  join public."Modulo" m on m."ID" = a."ID_Modulo"
  where a."ID" = v_aula;

  select count(*)::integer into total_aulas
  from public."conclui" c
  join public."Aula" a on a."ID" = c."fk_Aula_ID"
  join public."Modulo" m on m."ID" = a."ID_Modulo"
  where c."fk_Usuario_ID" = v_usuario and m."ID_Curso" = v_curso;

  update public."matricula"
     set "Aulas_Finalizadas" = total_aulas
   where "fk_Usuario_ID" = v_usuario and "fk_Curso_ID" = v_curso;

  if tg_op = 'DELETE' then return old; end if;
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
create or replace function public.lidar_novo_user () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  v_username text := nullif(new.raw_user_meta_data ->> 'username', '');
begin
  -- Se o username já estiver em uso, cria o perfil sem username
  -- em vez de derrubar o cadastro.
  if v_username is not null
     and exists (select 1 from public."Usuario" where "Nome_Usuario" = v_username) then
    v_username := null;
  end if;

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
    v_username
  )
  on conflict ("ID") do nothing;

  return new;
end;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Datas
drop trigger if exists trg_curso_data_atualizacao on public."Curso";

create trigger trg_curso_data_atualizacao before
update on public."Curso" for each row
execute function public.atualizar_data_atualizacao ();

drop trigger if exists trg_sala_data_atualizacao on public."Sala";

create trigger trg_sala_data_atualizacao before
update on public."Sala" for each row
execute function public.atualizar_data_atualizacao ();

drop trigger if exists trg_usuario_data_atualizacao on public."Usuario";

create trigger trg_usuario_data_atualizacao before
update on public."Usuario" for each row
execute function public.atualizar_data_atualizacao ();

drop trigger if exists trg_matricula_data_atualizacao on public."matricula";

create trigger trg_matricula_data_atualizacao before
update on public."matricula" for each row
execute function public.atualizar_data_atualizacao ();

drop trigger if exists trg_notebook_data_atualizacao on public."Notebook";

create trigger trg_notebook_data_atualizacao before
update on public."Notebook" for each row
execute function public.atualizar_data_atualizacao ();

drop trigger if exists trg_anotacoes_data_atualizacao on public."Anotacoes";

create trigger trg_anotacoes_data_atualizacao before
update on public."Anotacoes" for each row
execute function public.atualizar_data_atualizacao ();

drop trigger if exists trg_aula_data_atualizacao on public."Aula";

create trigger trg_aula_data_atualizacao before
update on public."Aula" for each row
execute function public.atualizar_data_atualizacao ();

drop trigger if exists trg_modulo_data_atualizacao on public."Modulo";

create trigger trg_modulo_data_atualizacao before
update on public."Modulo" for each row
execute function public.atualizar_data_atualizacao ();

drop trigger if exists trg_questao_data_atualizacao on public."Questao";

create trigger trg_questao_data_atualizacao before
update on public."Questao" for each row
execute function public.atualizar_data_atualizacao ();

-- Protege os campos agregados do curso.
drop trigger if exists trg_proteger_campos_derivados_curso on public."Curso";

create trigger trg_proteger_campos_derivados_curso before insert
or
update on public."Curso" for each row
execute function public.proteger_campos_derivados_curso ();

-- XP: dispara em qualquer INSERT/UPDATE para impedir edição direta de XP_Total.
drop trigger if exists trg_atualizar_xp_matricula on public."matricula";

create trigger trg_atualizar_xp_matricula before insert
or
update on public."matricula" for each row
execute function public.atualizar_xp_matricula ();

-- Protege Aulas_Finalizadas e a identidade da matrícula.
drop trigger if exists trg_proteger_matricula on public."matricula";

create trigger trg_proteger_matricula before insert
or
update on public."matricula" for each row
execute function public.proteger_campos_derivados_matricula ();

-- Avaliação não pode ser alterada depois de preenchida.
drop trigger if exists trg_impedir_alteracao_avaliacao on public."matricula";

create trigger trg_impedir_alteracao_avaliacao before
update of "Avaliacao" on public."matricula" for each row
execute function public.impedir_alteracao_avaliacao ();

-- Matrícula: contagem de estudantes.
drop trigger if exists trg_contagem_estudantes on public."matricula";

create trigger trg_contagem_estudantes
after insert
or delete on public."matricula" for each row
execute function public.atualizar_contagem_estudantes ();

-- Matrícula: média e quantidade de avaliações.
drop trigger if exists trg_avaliacao_curso on public."matricula";

create trigger trg_avaliacao_curso
after insert
or
update of "Avaliacao"
or delete on public."matricula" for each row
execute function public.atualizar_avaliacao_curso ();

-- Conclusão: aulas finalizadas.
drop trigger if exists trg_aulas_finalizadas on public."conclui";
create trigger trg_aulas_finalizadas
after insert or delete on public."conclui" for each row
execute function public.atualizar_aulas_finalizadas ();

-- Usuário criado no Auth.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users for each row
execute function public.lidar_novo_user ();

-- ============================================================
-- RLS
-- ============================================================
alter table public."Usuario" enable row level security;

alter table public."Curso" enable row level security;

alter table public."Modulo" enable row level security;

alter table public."Aula" enable row level security;

alter table public."Questao" enable row level security;

alter table public."Sala" enable row level security;

alter table public."matricula" enable row level security;

alter table public."participa" enable row level security;

alter table public."conclui" enable row level security;

alter table public."Notebook" enable row level security;

alter table public."Anotacoes" enable row level security;

-- ============================================================
-- HELPERS SECURITY DEFINER PARA RLS
-- ============================================================
create or replace function public.usuario_e_criador_curso (p_curso_id uuid) returns boolean language sql stable security definer
set
  search_path = public as $$
  select exists (
    select 1 from public."Curso"
    where "ID" = p_curso_id and "ID_Criador" = auth.uid()
  );
$$;

create or replace function public.usuario_participa_sala (p_sala_id uuid) returns boolean language sql stable security definer
set
  search_path = public as $$
  select exists (
    select 1 from public."participa"
    where "fk_Sala_ID" = p_sala_id and "fk_Usuario_ID" = auth.uid()
  );
$$;

-- ============================================================
-- REMOÇÃO SEGURA DE POLICIES ANTIGAS
-- ============================================================
-- Usuario
drop policy if exists "usuario gerencia proprio perfil" on public."Usuario";

drop policy if exists "usuario le perfis" on public."Usuario";

-- Curso
drop policy if exists "cursos publicados podem ser lidos" on public."Curso";

drop policy if exists "criadores gerenciam seus cursos" on public."Curso";

-- Modulo
drop policy if exists "modulos de cursos publicados podem ser lidos" on public."Modulo";

drop policy if exists "criadores gerenciam seus modulos" on public."Modulo";

-- Aula
drop policy if exists "aulas publicadas podem ser lidas" on public."Aula";

drop policy if exists "criadores gerenciam suas aulas" on public."Aula";

-- Questao
drop policy if exists "questoes de cursos publicados podem ser lidas" on public."Questao";

drop policy if exists "criadores gerenciam suas questoes" on public."Questao";

-- Matricula
drop policy if exists "usuario gerencia propria matricula" on public."matricula";

drop policy if exists "usuario le sua matricula" on public."matricula";

drop policy if exists "usuario cria sua matricula" on public."matricula";

drop policy if exists "usuario atualiza sua avaliacao" on public."matricula";

-- Conclui
drop policy if exists "usuario le suas conclusoes" on public."conclui";

drop policy if exists "usuario le suas conclusoes" on public."conclui";

drop policy if exists "usuario registra suas conclusoes" on public."conclui";

-- Sala
drop policy if exists "usuarios autenticados leem salas" on public."Sala";

drop policy if exists "criadores gerenciam suas salas" on public."Sala";

-- Participa
drop policy if exists "participantes leem participacoes" on public."participa";

drop policy if exists "usuario entra em salas" on public."participa";

drop policy if exists "usuario sai de salas" on public."participa";

-- Notebook / Anotacoes
drop policy if exists "usuario gerencia seus notebooks" on public."Notebook";

drop policy if exists "usuario gerencia suas anotacoes" on public."Anotacoes";

-- ============================================================
-- POLICIES — USUARIO
-- ============================================================

create policy "usuario le proprio perfil" on public."Usuario"
  for select using ("ID" = auth.uid());

create policy "usuario atualiza proprio perfil" on public."Usuario"
  for update using ("ID" = auth.uid())
  with check ("ID" = auth.uid());
-- ============================================================
-- POLICIES — CURSO
-- ============================================================
create policy "cursos publicados podem ser lidos" on public."Curso" for
select
  using (
    "Status" = 'published'
    or "ID_Criador" = auth.uid ()
  );

create policy "criadores gerenciam seus cursos" on public."Curso" for all using ("ID_Criador" = auth.uid ())
with
  check ("ID_Criador" = auth.uid ());

-- ============================================================
-- POLICIES — MODULO
-- ============================================================
create policy "modulos de cursos publicados podem ser lidos" on public."Modulo" for
select
  using (
    exists (
      select
        1
      from
        public."Curso" c
      where
        c."ID" = "ID_Curso"
        and (
          c."Status" = 'published'
          or c."ID_Criador" = auth.uid ()
        )
    )
  );

create policy "criadores gerenciam seus modulos" on public."Modulo" for all using (public.usuario_e_criador_curso ("ID_Curso"))
with
  check (public.usuario_e_criador_curso ("ID_Curso"));

-- ============================================================
-- POLICIES — AULA
-- ============================================================
create policy "aulas publicadas podem ser lidas" on public."Aula" for
select
  using (
    exists (
      select
        1
      from
        public."Modulo" m
        join public."Curso" c on c."ID" = m."ID_Curso"
      where
        m."ID" = "ID_Modulo"
        and (
          c."Status" = 'published'
          or c."ID_Criador" = auth.uid ()
        )
    )
  );

create policy "criadores gerenciam suas aulas" on public."Aula" for all using (
  exists (
    select
      1
    from
      public."Modulo" m
    where
      m."ID" = "ID_Modulo"
      and public.usuario_e_criador_curso (m."ID_Curso")
  )
)
with
  check (
    exists (
      select
        1
      from
        public."Modulo" m
      where
        m."ID" = "ID_Modulo"
        and public.usuario_e_criador_curso (m."ID_Curso")
    )
  );

-- ============================================================
-- POLICIES — QUESTAO
-- ============================================================
create policy "questoes de cursos publicados podem ser lidas" on public."Questao" for
select
  using (
    exists (
      select
        1
      from
        public."Aula" a
        join public."Modulo" m on m."ID" = a."ID_Modulo"
        join public."Curso" c on c."ID" = m."ID_Curso"
      where
        a."ID" = "ID_Aula"
        and (
          c."Status" = 'published'
          or c."ID_Criador" = auth.uid ()
        )
    )
  );

create policy "criadores gerenciam suas questoes" on public."Questao" for all using (
  exists (
    select
      1
    from
      public."Aula" a
      join public."Modulo" m on m."ID" = a."ID_Modulo"
    where
      a."ID" = "ID_Aula"
      and public.usuario_e_criador_curso (m."ID_Curso")
  )
)
with
  check (
    exists (
      select
        1
      from
        public."Aula" a
        join public."Modulo" m on m."ID" = a."ID_Modulo"
      where
        a."ID" = "ID_Aula"
        and public.usuario_e_criador_curso (m."ID_Curso")
    )
  );

-- ============================================================
-- POLICIES — MATRICULA
-- ============================================================
-- INSERT: o próprio usuário pode se matricular.
-- SELECT: o próprio usuário vê sua matrícula.
-- UPDATE: somente a avaliação é permitida pelo cliente; os demais
-- campos são protegidos pelos triggers e pela ausência de DELETE.
-- ============================================================
create policy "usuario le sua matricula" on public."matricula" for
select
  using ("fk_Usuario_ID" = auth.uid ());

create policy "usuario cria sua matricula" on public."matricula" for insert
with
  check ("fk_Usuario_ID" = auth.uid ());

create policy "usuario atualiza sua avaliacao" on public."matricula"
for update
  using ("fk_Usuario_ID" = auth.uid ())
with
  check ("fk_Usuario_ID" = auth.uid ());

-- ============================================================
-- POLICIES — CONCLUI
-- ============================================================
create policy "usuario le suas conclusoes" on public."conclui" for
select
  using ("fk_Usuario_ID" = auth.uid ());

create policy "usuario registra suas conclusoes" on public."conclui" for insert
with
  check ("fk_Usuario_ID" = auth.uid ());

-- ============================================================
-- POLICIES — SALA
-- ============================================================
create policy "usuarios autenticados leem salas" on public."Sala" for
select
  using (auth.uid () is not null);

create policy "criadores gerenciam suas salas" on public."Sala" for all using ("ID_Criador" = auth.uid ())
with
  check ("ID_Criador" = auth.uid ());

-- ============================================================
-- POLICIES — PARTICIPA
-- ============================================================
create policy "participantes leem participacoes" on public."participa" for
select
  using (
    "fk_Usuario_ID" = auth.uid ()
    or public.usuario_participa_sala ("fk_Sala_ID")
  );

create policy "usuario entra em salas" on public."participa" for insert
with
  check ("fk_Usuario_ID" = auth.uid ());

create policy "usuario sai de salas" on public."participa" for delete using ("fk_Usuario_ID" = auth.uid ());

-- ============================================================
-- POLICIES — NOTEBOOK
-- ============================================================
create policy "usuario gerencia seus notebooks" on public."Notebook" for all using ("ID_Usuario" = auth.uid ())
with
  check ("ID_Usuario" = auth.uid ());

-- ============================================================
-- POLICIES — ANOTACOES
-- ============================================================
create policy "usuario gerencia suas anotacoes" on public."Anotacoes" for all using (
  exists (
    select
      1
    from
      public."Notebook" n
    where
      n."ID" = "ID_Notebook"
      and n."ID_Usuario" = auth.uid ()
  )
)
with
  check (
    exists (
      select
        1
      from
        public."Notebook" n
      where
        n."ID" = "ID_Notebook"
        and n."ID_Usuario" = auth.uid ()
    )
  );

-- ============================================================
-- PRIVILÉGIOS
-- ============================================================
-- O acesso real continua sendo controlado por RLS.
grant usage on schema public to anon,
authenticated;

grant
select
  on public."Curso",
  public."Modulo",
  public."Aula",
  public."Questao",
  public."Sala" to anon,
  authenticated;

grant
select
,
  insert on public."matricula" to authenticated;

grant
update on public."matricula" to authenticated;

grant
select
,
  insert on public."conclui" to authenticated;

grant
select
,
  insert,
  delete on public."participa" to authenticated;

grant
select
,
  insert,
update,
delete on public."Notebook" to authenticated;

grant
select
,
  insert,
update,
delete on public."Anotacoes" to authenticated;

grant
select
,
update on public."Usuario" to authenticated;

grant insert,
update,
delete on public."Curso" to authenticated;

grant insert,
update,
delete on public."Modulo" to authenticated;

grant insert,
update,
delete on public."Aula" to authenticated;

grant insert,
update,
delete on public."Questao" to authenticated;

grant insert,
update,
delete on public."Sala" to authenticated;

grant insert on public."Usuario" to authenticated;
grant delete on public."matricula" to authenticated;
grant update, delete on public."conclui" to authenticated;
grant update on public."participa" to authenticated;

-- Funções auxiliares são usadas internamente por RLS/triggers.
revoke all on function public.usuario_e_criador_curso (uuid)
from
  public;

revoke all on function public.usuario_participa_sala (uuid)
from
  public;

grant
execute on function public.usuario_e_criador_curso (uuid) to authenticated;

grant
execute on function public.usuario_participa_sala (uuid) to authenticated;