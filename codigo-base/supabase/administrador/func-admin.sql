-- ============================================================
-- FUNÇAÔ PARA EXCLUIR USUÁRIOS E TRANSFERIR SUAS CRIAÇÕES PARA OUTRO USUÁRIO
-- ============================================================

create or replace function public.admin_excluir_conta (
  p_id uuid,
  p_transferir_para uuid default null
)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  if not public.e_admin() then
    raise exception 'Apenas administradores.';
  end if;

  if p_id = auth.uid() then
    raise exception 'Use excluir_minha_conta para apagar a própria conta.';
  end if;

  if exists (select 1 from public."Curso" where "ID_Criador" = p_id)
     or exists (select 1 from public."Sala" where "ID_Criador" = p_id) then

    if p_transferir_para is null then
      raise exception 'Este usuário criou cursos ou salas. Informe p_transferir_para.';
    end if;
    if p_transferir_para = p_id
       or not exists (select 1 from public."Usuario" where "ID" = p_transferir_para) then
      raise exception 'Destino da transferência inválido.';
    end if;

    update public."Curso" set "ID_Criador" = p_transferir_para where "ID_Criador" = p_id;
    update public."Sala"  set "ID_Criador" = p_transferir_para where "ID_Criador" = p_id;
  end if;

  delete from auth.users where id = p_id;
end;
$$;

revoke all on function public.admin_excluir_conta (uuid, uuid) from public, anon;
grant execute on function public.admin_excluir_conta (uuid, uuid) to authenticated;

-- ============================================================
-- FUNÇAÔ PARA TRANSFERIR CRIAÇÕES PARA OUTRO USUÁRIO
-- ============================================================

create or replace function public.admin_transferir_criador (
  p_de uuid,
  p_para uuid,
  p_curso_id uuid default null,
  p_sala_id uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = public as $$
declare
  n_cursos integer := 0;
  n_salas  integer := 0;
begin
  if not public.e_admin() then
    raise exception 'Apenas administradores.';
  end if;

  if p_de is null or p_para is null then
    raise exception 'Informe p_de e p_para.';
  end if;

  if p_de = p_para then
    raise exception 'Origem e destino são o mesmo usuário.';
  end if;

  if not exists (select 1 from public."Usuario" where "ID" = p_de) then
    raise exception 'Usuário de origem não encontrado.';
  end if;

  if not exists (select 1 from public."Usuario" where "ID" = p_para) then
    raise exception 'Usuário de destino não encontrado.';
  end if;

  -- Transferência de um curso específico
  if p_curso_id is not null then
    update public."Curso"
       set "ID_Criador" = p_para
     where "ID" = p_curso_id and "ID_Criador" = p_de;
    get diagnostics n_cursos = row_count;

  -- Transferência de uma sala específica
elsif p_sala_id is not null then
    update public."Sala"
       set "ID_Criador" = p_para
     where "ID" = p_sala_id and "ID_Criador" = p_de;
    get diagnostics n_salas = row_count;

else
    update public."Curso" set "ID_Criador" = p_para where "ID_Criador" = p_de;
    get diagnostics n_cursos = row_count;

    update public."Sala" set "ID_Criador" = p_para where "ID_Criador" = p_de;
    get diagnostics n_salas = row_count;
  end if;

if p_sala_id is not null then
    update public."Sala"
       set "ID_Criador" = p_para
     where "ID" = p_sala_id and "ID_Criador" = p_de;
    get diagnostics n_salas = row_count;
end if;

  -- Transferência de tudo
  

  return jsonb_build_object('cursos', n_cursos, 'salas', n_salas);
end;
$$;

revoke all on function public.admin_transferir_criador (uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.admin_transferir_criador (uuid, uuid, uuid, uuid) to authenticated;