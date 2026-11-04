-- 0028_season_open_close.sql
-- Abertura e fechamento programados da temporada competitiva.
--
-- Contexto: 0026 criou a estrutura e 0027 a formação de grupos por afinidade.
-- Falta a OPERAÇÃO: abrir a temporada (fotografia de elegibilidade + inscrição +
-- formação) e fechá-la (consolidar XP, ranquear, aplicar cortes/rebaixamento).
--
-- O schema não tem cron/job embutido (0001). Expomos RPCs idempotentes de
-- autoridade (revogadas de authenticated) que um agendador externo chama a cada
-- virada, com alvo de 5 min e retentativa idempotente (Q134/Q141). Chamar duas
-- vezes não duplica inscrição, XP ou movimento.
--
-- Regras aplicadas:
--   Q138: elegível = conta ativa com >= 1 conclusão oficial nos 7 dias anteriores
--         à virada (America/Sao_Paulo), inclusive estudo em sala/revisão.
--   Q139/Q141: categoria inicial = result_category da temporada anterior do
--         usuário, ou bronze na primeira participação.
--   Q102: season_xp = soma de xp_events learning_base/course na janela.
--   Q105/Q106/Q140: XP positivo -> cortes nominais de 20% (promoção no topo,
--         rebaixamento no fundo), empates tratados igualmente; grupo pequeno
--         conserva proteção (sem cortes por posição).
--   Q143: TODO inscrito com zero XP cai uma faixa, piso Bronze, inclusive grupo
--         zerado/pequeno/sozinho (substitui as proteções acima só para zeros).

-- ---------------------------------------------------------------------------
-- user_season_xp(user, from, to): XP competitivo do usuário na janela —
-- learning_base/course somado do livro de eventos (Q102). Versão por user_id
-- (a user_xp_in_window de 0023 usa auth.uid() e serve ao próprio usuário na UI;
-- o fechamento em lote precisa somar para qualquer inscrito).
-- ---------------------------------------------------------------------------
create or replace function public.user_season_xp(
  p_user_id uuid,
  p_from    timestamptz,
  p_to      timestamptz
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(e.amount), 0)::integer
    from public.xp_events e
   where e.user_id = p_user_id
     and e.origin = 'learning_base'
     and e.context = 'course'
     and e.occurred_at >= p_from
     and e.occurred_at <  p_to;
$$;

comment on function public.user_season_xp(uuid, timestamptz, timestamptz) is
  'XP competitivo (learning_base/course) de um usuário em [from, to). Base da pontuação de temporada no fechamento em lote (Q102).';

-- ---------------------------------------------------------------------------
-- is_recently_active(user, from, to): elegibilidade por atividade recente —
-- pelo menos uma conclusão oficial (completions) no intervalo, em qualquer
-- contexto (curso ou sala), inclusive revisão/aula sem questões (Q138).
-- ---------------------------------------------------------------------------
create or replace function public.is_recently_active(
  p_user_id uuid,
  p_from    timestamptz,
  p_to      timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.completions c
     where c.user_id = p_user_id
       and c.completed_at >= p_from
       and c.completed_at <  p_to
  );
$$;

comment on function public.is_recently_active(uuid, timestamptz, timestamptz) is
  'True se o usuário teve >= 1 conclusão oficial em [from, to) (qualquer contexto; inclui revisão e aula sem questões). Critério de atividade recente para a fotografia de abertura (Q138).';

-- ---------------------------------------------------------------------------
-- open_season(starts_at): abre (ou avança para) a temporada da semana iniciada
-- em starts_at. Idempotente:
--   1. cria/recupera a season da semana [starts_at, starts_at+7d);
--   2. inscreve toda conta ativa elegível (atividade nos 7 dias anteriores),
--      com categoria = result_category anterior ou bronze (sem reinscrever);
--   3. forma os grupos dos recém-inscritos (form_season_groups, 0027);
--   4. marca a season como 'open'.
-- Retorna o id da season. Reexecutar não duplica entradas nem move grupos.
-- ---------------------------------------------------------------------------
create or replace function public.open_season(p_starts_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start  timestamptz := public.mission_week_start(p_starts_at);
  v_end    timestamptz;
  v_prev   timestamptz;
  v_season uuid;
begin
  v_end  := v_start + interval '7 days';
  v_prev := v_start - interval '7 days';  -- janela de atividade recente (Q138)

  -- (1) season da semana (idempotente por starts_at).
  insert into public.seasons (starts_at, ends_at, status)
  values (v_start, v_end, 'open')
  on conflict (starts_at) do update set status = 'open', updated_at = now()
  returning id into v_season;

  if v_season is null then
    select id into v_season from public.seasons where starts_at = v_start;
  end if;

  -- (2) inscreve elegíveis ainda não inscritos. Categoria inicial = categoria
  -- resultante da participação anterior mais recente do usuário, ou bronze.
  insert into public.season_entries (season_id, user_id, category)
  select v_season, p.user_id, p.category
    from (
      select pr.id as user_id,
             coalesce(
               (
                 select se.result_category
                   from public.season_entries se
                   join public.seasons s2 on s2.id = se.season_id
                  where se.user_id = pr.id
                    and se.result_category is not null
                    and s2.ends_at <= v_start
                  order by s2.ends_at desc
                  limit 1
               ),
               'bronze'::public.season_category
             ) as category
        from public.profiles pr
       where pr.account_status = 'active'
         and public.is_recently_active(pr.id, v_prev, v_start)
    ) p
  on conflict (season_id, user_id) do nothing;

  -- (3) forma grupos dos inscritos sem grupo (idempotente).
  perform public.form_season_groups(v_season, 20, 10, 30);

  return v_season;
end;
$$;

comment on function public.open_season(timestamptz) is
  'Abre a temporada da semana de starts_at (America/Sao_Paulo): cria a season, inscreve contas ativas com atividade nos 7 dias anteriores (Q138) na categoria herdada/bronze (Q139), e forma os grupos (Q123). Idempotente: não reinscreve nem move grupos.';

revoke execute on function public.open_season(timestamptz) from authenticated;

-- ---------------------------------------------------------------------------
-- close_season(season_id): fecha a temporada e aplica os movimentos.
-- Idempotente: só age quando a season ainda não está 'closed'. Passos:
--   1. consolida season_xp de cada entrada (user_season_xp na janela);
--   2. por GRUPO:
--      a. ZEROS (season_xp = 0): result_category = categoria - 1 faixa, piso
--         bronze (Q143), sempre — independe do tamanho do grupo.
--      b. POSITIVOS (season_xp > 0): se o grupo tem >= p_min positivos, aplica
--         cortes nominais de 20%: topo promove (+1 faixa), fundo rebaixa
--         (-1 faixa), meio mantém; empates na fronteira tratados igualmente
--         (todos sobem/descem juntos — Q106/Q140). Grupo pequeno conserva a
--         categoria (proteção Q105). final_rank = posição por season_xp desc.
--   3. status = 'closed', closed_at = now().
-- ---------------------------------------------------------------------------
create or replace function public.close_season(
  p_season_id uuid,
  p_min       integer default 10
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.seasons%rowtype;
  v_group  record;
begin
  select * into v_season from public.seasons where id = p_season_id for update;
  if not found then
    raise exception 'season % not found', p_season_id;
  end if;
  if v_season.status = 'closed' then
    return; -- idempotente: já fechada
  end if;

  update public.seasons set status = 'closing', updated_at = now() where id = p_season_id;

  -- (1) consolida o XP competitivo de cada entrada.
  update public.season_entries se
     set season_xp = public.user_season_xp(se.user_id, v_season.starts_at, v_season.ends_at),
         updated_at = now()
   where se.season_id = p_season_id;

  -- (2) aplica os movimentos por grupo.
  for v_group in
    select id, category from public.season_groups where season_id = p_season_id
  loop
    declare
      v_n_pos       integer;
      v_promote_cut integer;  -- score na fronteira de promoção (inclusive)
      v_demote_cut  integer;  -- score na fronteira de rebaixamento (inclusive)
      v_promote_n   integer;
      v_demote_n    integer;
    begin
      -- final_rank por season_xp desc (todos do grupo, estável por joined_at).
      with ranked as (
        select se.id,
               row_number() over (order by se.season_xp desc, se.joined_at asc, se.user_id asc) as rn
          from public.season_entries se
         where se.group_id = v_group.id
      )
      update public.season_entries se
         set final_rank = ranked.rn
        from ranked
       where se.id = ranked.id;

      -- ZEROS: caem uma faixa sempre (piso bronze). Q143.
      update public.season_entries se
         set result_category = public.season_category_from_rank(
                                 public.season_category_rank(se.category) - 1
                               ),
             updated_at = now()
       where se.group_id = v_group.id
         and se.season_xp = 0;

      -- POSITIVOS: contagem e cortes só quando o grupo é grande o suficiente.
      select count(*) into v_n_pos
        from public.season_entries
       where group_id = v_group.id and season_xp > 0;

      if v_n_pos >= p_min then
        v_promote_n := ceil(v_n_pos * 0.20)::integer;
        v_demote_n  := ceil(v_n_pos * 0.20)::integer;

        -- Score na posição de corte de promoção (o v_promote_n-ésimo maior).
        select season_xp into v_promote_cut
          from public.season_entries
         where group_id = v_group.id and season_xp > 0
         order by season_xp desc
         offset greatest(v_promote_n - 1, 0) limit 1;

        -- Score na posição de corte de rebaixamento (o v_demote_n-ésimo menor).
        select season_xp into v_demote_cut
          from public.season_entries
         where group_id = v_group.id and season_xp > 0
         order by season_xp asc
         offset greatest(v_demote_n - 1, 0) limit 1;

        -- PROMOÇÃO: todos com score >= corte de promoção sobem uma faixa.
        -- Empates na fronteira sobem juntos (Q106/Q140).
        update public.season_entries se
           set result_category = public.season_category_from_rank(
                                   public.season_category_rank(se.category) + 1
                                 ),
               updated_at = now()
         where se.group_id = v_group.id
           and se.season_xp > 0
           and se.season_xp >= v_promote_cut;

        -- REBAIXAMENTO: todos com score <= corte de rebaixamento descem uma
        -- faixa, exceto quem já foi promovido (grupos pequenos onde as zonas
        -- se sobrepõem: promoção tem precedência, sem mover duas vezes — Q143).
        update public.season_entries se
           set result_category = public.season_category_from_rank(
                                   public.season_category_rank(se.category) - 1
                                 ),
               updated_at = now()
         where se.group_id = v_group.id
           and se.season_xp > 0
           and se.season_xp <= v_demote_cut
           and se.season_xp < v_promote_cut;  -- não rebaixar quem está na zona de promoção

        -- MEIO: quem não entrou em nenhuma zona mantém a categoria.
        update public.season_entries se
           set result_category = se.category,
               updated_at = now()
         where se.group_id = v_group.id
           and se.season_xp > 0
           and se.result_category is null;
      else
        -- Grupo pequeno: positivos conservam a categoria (proteção Q105).
        update public.season_entries se
           set result_category = se.category,
               updated_at = now()
         where se.group_id = v_group.id
           and se.season_xp > 0
           and se.result_category is null;
      end if;
    end;
  end loop;

  -- (3) fecha.
  update public.seasons
     set status = 'closed', closed_at = now(), updated_at = now()
   where id = p_season_id;
end;
$$;

comment on function public.close_season(uuid, integer) is
  'Fecha a temporada e aplica os movimentos. Idempotente (não refaz se já closed). Consolida season_xp (Q102); zeros caem uma faixa com piso bronze sempre (Q143); positivos em grupo grande sofrem cortes nominais de 20% (promoção no topo, rebaixamento no fundo, empates juntos — Q106/Q140), e promoção tem precedência sobre rebaixamento; grupo pequeno conserva a categoria dos positivos (Q105). Persiste result_category (base da próxima temporada) e final_rank.';

revoke execute on function public.close_season(uuid, integer) from authenticated;
