-- 0027_season_group_formation.sql
-- Formação de grupos competitivos por AFINIDADE SOCIAL (Q123/Q124/Q104).
--
-- Contexto: 0026 criou seasons/season_groups/season_entries. Falta distribuir os
-- inscritos de cada categoria em grupos. O questionário rejeitou região física e
-- escolheu PROXIMIDADE SOCIAL (Q123): aproximar amigos próximos no mesmo grupo,
-- incluindo amigos de amigos e assim por diante. Alvo 20, mínimo 10, teto 30
-- (Q104/Q124); grupo menor é permitido só quando é o que resta.
--
-- Determinismo e idempotência (congelamento — Q104): a formação só atua sobre
-- entradas AINDA SEM grupo (group_id is null). Grupos já atribuídos não são
-- tocados; reexecutar só acomoda inscritos novos em vagas/grupos adicionais,
-- sem mover ninguém já posicionado.
--
-- Esta fatia NÃO abre nem fecha temporada (sem cortes/rebaixamento ainda): só
-- forma/preenche grupos a partir das entradas existentes.

-- ---------------------------------------------------------------------------
-- social_distance_order(season, category, seed): ordena as entradas SEM grupo
-- de uma (temporada, categoria) por proximidade social a um usuário-semente —
-- amigos (distância 1), amigos de amigos (2), e assim por diante; quem não tem
-- laço vem por último. Empates resolvidos por joined_at, user_id (estável).
-- Usa BFS sobre amizades aceitas, limitado ao conjunto elegível da categoria.
-- SECURITY DEFINER para ler friendships/season_entries sob RLS restritiva.
-- ---------------------------------------------------------------------------
create or replace function public.social_distance_order(
  p_season_id uuid,
  p_category  public.season_category,
  p_seed      uuid
)
returns table (user_id uuid, distance integer, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with recursive
  -- Universo: entradas SEM grupo desta temporada/categoria (candidatas).
  pool as (
    select se.user_id, se.joined_at
      from public.season_entries se
     where se.season_id = p_season_id
       and se.category  = p_category
       and se.group_id is null
  ),
  -- Arestas de amizade aceita como pares direcionados (ambos os sentidos), para
  -- o BFS poder sair de qualquer um dos lados. Restringe ao universo (pool) para
  -- não propagar por quem não é candidato.
  edges as (
    select f.requester_id as src, f.addressee_id as dst
      from public.friendships f
     where f.status = 'accepted'
       and f.requester_id in (select user_id from pool)
       and f.addressee_id in (select user_id from pool)
    union all
    select f.addressee_id as src, f.requester_id as dst
      from public.friendships f
     where f.status = 'accepted'
       and f.requester_id in (select user_id from pool)
       and f.addressee_id in (select user_id from pool)
  ),
  -- BFS a partir da semente, propagando a distância (nº de laços sociais).
  -- O limite de profundidade (< 6) encerra a recursão com segurança.
  bfs (uid, distance) as (
    select p_seed, 0
    union all
    select e.dst, b.distance + 1
      from bfs b
      join edges e on e.src = b.uid
     where b.distance < 6
  ),
  -- Distância mínima de cada candidato à semente; sem laço = distância "infinita".
  dist as (
    select p.user_id,
           coalesce(min(b.distance), 1000000) as distance,
           p.joined_at
      from pool p
      left join bfs b on b.uid = p.user_id
     group by p.user_id, p.joined_at
  )
  select user_id, distance, joined_at
    from dist
   order by distance asc, joined_at asc, user_id asc;
$$;

comment on function public.social_distance_order(uuid, public.season_category, uuid) is
  'Ordena as entradas sem grupo de uma temporada/categoria por proximidade social (BFS por amizades aceitas) a partir de um usuário-semente. Base da formação por afinidade (Q123).';

-- ---------------------------------------------------------------------------
-- form_season_groups(season, target, min, cap): distribui os inscritos SEM grupo
-- de cada categoria em grupos por afinidade social. Determinística e idempotente
-- (só atua sobre group_id is null). Para cada grupo: escolhe uma semente estável
-- (a entrada sem grupo de menor joined_at/user_id), ordena as demais por
-- distância social e preenche até o alvo (teto = cap). Repete enquanto houver
-- entradas sem grupo. Grupo final pode ficar abaixo do mínimo (resto — Q104).
-- ---------------------------------------------------------------------------
create or replace function public.form_season_groups(
  p_season_id uuid,
  p_target    integer default 20,
  p_min       integer default 10,
  p_cap       integer default 30
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat       public.season_category;
  v_seed      uuid;
  v_group_id  uuid;
  v_next_idx  integer;
  v_filled    integer;
  v_member    record;
  v_groups    integer := 0;
begin
  if p_cap < 1 or p_target < 1 then
    raise exception 'form_season_groups: target/cap must be >= 1';
  end if;

  -- Uma categoria por vez (grupos nunca misturam categorias — Q105).
  for v_cat in
    select distinct category
      from public.season_entries
     where season_id = p_season_id and group_id is null
  loop
    -- Enquanto restarem entradas sem grupo nesta categoria, abre um grupo novo.
    loop
      -- Semente estável: a entrada sem grupo de menor (joined_at, user_id).
      select user_id into v_seed
        from public.season_entries
       where season_id = p_season_id and category = v_cat and group_id is null
       order by joined_at asc, user_id asc
       limit 1;

      exit when v_seed is null;

      -- Próximo índice de grupo para a (temporada, categoria).
      select coalesce(max(group_index), 0) + 1 into v_next_idx
        from public.season_groups
       where season_id = p_season_id and category = v_cat;

      insert into public.season_groups (season_id, category, group_index, capacity)
      values (p_season_id, v_cat, v_next_idx, p_cap)
      returning id into v_group_id;

      v_groups := v_groups + 1;
      v_filled := 0;

      -- Preenche o grupo por proximidade social à semente, até o alvo/teto.
      for v_member in
        select user_id
          from public.social_distance_order(p_season_id, v_cat, v_seed)
      loop
        exit when v_filled >= least(p_target, p_cap);

        -- Atribui somente se ainda estiver sem grupo (corrida/idempotência).
        update public.season_entries
           set group_id = v_group_id, updated_at = now()
         where season_id = p_season_id
           and user_id = v_member.user_id
           and group_id is null;

        if found then
          v_filled := v_filled + 1;
        end if;
      end loop;

      -- Se por algum motivo o grupo ficou vazio (não deveria, pois a semente
      -- está no pool), remove-o para não deixar grupo órfão.
      if v_filled = 0 then
        delete from public.season_groups where id = v_group_id;
        v_groups := v_groups - 1;
        exit; -- evita laço infinito
      end if;
    end loop;
  end loop;

  return v_groups;
end;
$$;

comment on function public.form_season_groups(uuid, integer, integer, integer) is
  'Distribui os inscritos SEM grupo de cada categoria em grupos por afinidade social (Q123). Alvo 20, teto 30; grupo final pode ficar abaixo do mínimo (resto — Q104). Idempotente: só atua sobre group_id is null, nunca move quem já tem grupo (congelamento — Q104).';

-- Formação é operação de autoridade (chamada pela abertura programada da
-- temporada, fatia seguinte) ou por admin; não é exposta ao cliente comum.
revoke execute on function public.form_season_groups(uuid, integer, integer, integer) from authenticated;
