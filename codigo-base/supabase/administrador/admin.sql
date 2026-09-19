-- ============================================================
-- ADMIN
-- ============================================================
create table if not exists public."Admin" (
  "fk_Usuario_ID" uuid primary key references public."Usuario" ("ID") on delete cascade,
  "Data_Criacao" timestamptz not null default now()
);

alter table public."Admin" enable row level security;

-- Sem policies e sem grants: só a service_role (backend) e funções
-- security definer enxergam essa tabela.
revoke all on public."Admin" from anon, authenticated;

-- ============================================================
-- FUNÇÃO e_admin()
-- ============================================================
create or replace function public.e_admin () returns boolean
language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public."Admin"
    where "fk_Usuario_ID" = auth.uid()
  );
$$;

revoke all on function public.e_admin () from public, anon;
grant execute on function public.e_admin () to authenticated;

-- ============================================================
-- POLICIES "ADMIN ACESSO TOTAL" EM TODAS AS TABELAS
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'Usuario','Curso','Modulo','Aula','Questao','Sala',
    'matricula','participa','conclui','Notebook','Anotacoes'
  ]
  loop
    execute format('drop policy if exists "admin acesso total" on public.%I', t);
    execute format($p$
      create policy "admin acesso total" on public.%I
      for all to authenticated
      using ((select public.e_admin()))
      with check ((select public.e_admin()))
    $p$, t);
  end loop;
end
$$;

create or replace function public.proteger_cargo_usuario () returns trigger
language plpgsql security definer
set search_path = public as $$
begin
  if new."Cargo" is distinct from old."Cargo"
     and new."Cargo" = 'moderator'
     and auth.uid() is not null
     and not public.e_admin() then
    raise exception 'Apenas administradores podem definir o cargo moderator.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_cargo_usuario on public."Usuario";
create trigger trg_proteger_cargo_usuario
before update on public."Usuario"
for each row execute function public.proteger_cargo_usuario ();

grant usage on schema public to service_role;
grant all on public."Admin" to service_role;