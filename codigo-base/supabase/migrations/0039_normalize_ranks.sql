-- 0039_normalize_ranks.sql
-- Normaliza os patamares de liga e de PAC de sala num vocabulário único.
--
-- Decisões:
--  * Patamares unificados (6): bronze, silver, gold, platinum, diamond, master.
--    O mesmo vocabulário vale para as ligas (season_category) e para o PAC das
--    salas (division_for_pac). O rótulo em português (Bronze/Prata/Ouro/Platina/
--    Diamante/Mestre) fica só na camada visual (RankingPodium.label).
--  * Lendário (legendary) deixa de ser usado na plataforma: o teto passa a ser
--    MESTRE. O valor legendary permanece no enum season_category (remover valor
--    de enum no Postgres é inseguro/irreversível), mas nenhuma lógica promove
--    até ele e a UI não o exibe.
--  * division_for_pac passa a retornar as CHAVES de tier em inglês (iguais a
--    Tier/season_category), em vez do mix PT/EN anterior. Nenhuma tela consome
--    a string de divisão (a UI usa o PAC numérico), então a mudança é segura.
--
-- Nova escala de PAC (6 faixas):
--   bronze  < 50
--   silver  50–64
--   gold    65–74
--   platinum 75–84
--   diamond 85–94
--   master  95–100

-- ---------------------------------------------------------------------------
-- division_for_pac(pac): chave de tier em inglês para a faixa de PAC (6 faixas).
-- ---------------------------------------------------------------------------
create or replace function public.division_for_pac(p_pac numeric)
returns text
language sql
immutable
as $$
  select case
    when p_pac is null or p_pac < 50 then 'bronze'
    when p_pac <= 64 then 'silver'
    when p_pac <= 74 then 'gold'
    when p_pac <= 84 then 'platinum'
    when p_pac <= 94 then 'diamond'
    else 'master'   -- 95..100 (e acima, por clamp)
  end;
$$;

comment on function public.division_for_pac(numeric) is
  'Chave de tier (bronze/silver/gold/platinum/diamond/master) para a faixa de PAC: <50 bronze, 50-64 silver, 65-74 gold, 75-84 platinum, 85-94 diamond, 95-100 master. Vocabulário unificado com season_category; rótulo PT fica na camada visual.';

-- ---------------------------------------------------------------------------
-- season_category_from_rank(rank): teto MESTRE (clamp em [1,6]); não promove a
-- legendary. season_category_rank mantém o mapeamento (legendary=7 continua
-- definido por segurança, mas nunca é alvo porque o clamp é 6).
-- ---------------------------------------------------------------------------
create or replace function public.season_category_from_rank(p_rank integer)
returns public.season_category
language sql
immutable
as $$
  select case greatest(1, least(6, p_rank))
    when 1 then 'bronze'::public.season_category
    when 2 then 'silver'::public.season_category
    when 3 then 'gold'::public.season_category
    when 4 then 'platinum'::public.season_category
    when 5 then 'diamond'::public.season_category
    when 6 then 'master'::public.season_category
  end;
$$;

comment on function public.season_category_from_rank(integer) is
  'Categoria a partir do ordinal, com clamp em [1,6] (piso Bronze, teto Mestre). Lendário foi removido da plataforma; a promoção não passa de Mestre.';

-- ---------------------------------------------------------------------------
-- Normaliza eventuais inscrições já em legendary (defensivo): rebaixa para
-- master, para nenhuma entrada ficar num patamar que a plataforma não usa mais.
-- Idempotente; afeta apenas linhas legadas em legendary, se existirem.
-- ---------------------------------------------------------------------------
update public.season_entries set category = 'master'
 where category = 'legendary';
update public.season_entries set result_category = 'master'
 where result_category = 'legendary';
update public.season_groups set category = 'master'
 where category = 'legendary';
