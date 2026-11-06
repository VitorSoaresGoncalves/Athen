-- 0030_account_season_retention.sql
-- Desativação de conta e sua interação com as temporadas (Q070/Q085).
--
-- Contexto: deactivate_account (0016) faz soft-delete — marca a conta como
-- deactivated, limpa PII, cancela amizades pendentes e tira o usuário das salas
-- ativas. Com as temporadas (0026–0029), falta um passo: a desativação após a
-- inscrição deve OCULTAR a identidade corrente na temporada, mas PRESERVAR a
-- participação e o movimento normal (posição/XP/cortes) — Q070. A reativação
-- não reinicia categoria/grupo (o congelamento de 0026 já garante isso; a
-- reativação é tratada em fatia/UX própria de conta).
--
-- Esta fatia redefine deactivate_account PRESERVANDO todo o comportamento de
-- 0016 e apenas ACRESCENTANDO a marcação identity_hidden nas entradas de
-- temporadas ainda não fechadas. As leituras da 0029 (my_season_group) já
-- respeitam identity_hidden, então a identidade some das projeções sem remover
-- a linha competitiva.
--
-- Exclusão definitiva (Q085): a retirada da identidade das projeções usa o mesmo
-- identity_hidden; a eliminação de dados pessoais em Auth/Storage é operação
-- privilegiada fora de uma migração SQL pura (precisa de service role / job),
-- e não é executada aqui — fica registrada como passo operacional.

create or replace function public.deactivate_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me  uuid := auth.uid();
  v_tag text;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  v_tag := 'deleted_' || substr(replace(v_me::text, '-', ''), 1, 10);

  update public.profiles
     set account_status = 'deactivated',
         username       = v_tag,
         display_name   = 'Usuário removido',
         bio            = null,
         avatar_url     = null,
         banner_url     = null
   where id = v_me;

  -- Clean up pending social state without destroying history.
  update public.friendships
     set status = 'cancelled', responded_at = now()
   where (requester_id = v_me or addressee_id = v_me)
     and status = 'pending';

  -- Remove the user from active room rosters (history retained via removed).
  update public.room_members
     set status = 'removed', removed_at = now()
   where user_id = v_me and status = 'active';

  -- TEMPORADAS (Q070): oculta a identidade corrente nas temporadas ainda não
  -- fechadas (open/closing), preservando a linha competitiva — posição, XP e
  -- cortes seguem normais. Temporadas já fechadas mantêm o histórico como está.
  update public.season_entries se
     set identity_hidden = true, updated_at = now()
    from public.seasons s
   where se.season_id = s.id
     and se.user_id = v_me
     and s.status in ('open', 'closing');
end;
$$;

comment on function public.deactivate_account is
  'Soft account deletion: set account_status=deactivated e limpa PII, cancela amizades pendentes e remove o usuário das salas ativas. Sem cascade destrutivo; attempts/cursos/histórico de sala preservados. Nas temporadas ainda abertas/em apuração marca identity_hidden (Q070): identidade oculta nas projeções, mas participação/XP/cortes preservados. A reativação não reinicia categoria/grupo (congelados em 0026).';

-- O grant já existe de 0016; mantido por idempotência da redefinição.
grant execute on function public.deactivate_account() to authenticated;
