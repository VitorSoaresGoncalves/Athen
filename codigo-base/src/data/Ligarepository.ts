import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Ligas semanais (migração 0023_leagues.sql).
//
// Tudo é lido por funções do banco que só devolvem o PRÓPRIO grupo do usuário.
// As funções são novas e ainda não estão em src/types/database.ts; por isso as chamadas passam
// por `rpc()` abaixo, tipada à mão. Depois de aplicar a migração, rode
// `supabase gen types typescript` e, se quiser, troque `rpc()` por `supabase.rpc(...)` tipado.
// ---------------------------------------------------------------------------

/** Categoria 1..7 = Bronze, Prata, Ouro, Platina, Diamante, Mestre, Lendário. */
export type CategoriaLiga = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** promoted = zona de promoção · demoted = zona de rebaixamento · stayed = mantém. */
export type MovimentoLiga = 'promoted' | 'demoted' | 'stayed';

export type ResumoLiga = {
  idTemporada: string;
  inicio: string;
  fim: string;
  inscrito: boolean;
  tipoEntrada: 'snapshot' | 'late' | null;
  categoria: CategoriaLiga | null;
  numeroGrupo: number | null;
  tamanhoGrupo: number | null;
  pontos: number;
  posicao: number | null;
  /** Projeção ao vivo com a pontuação de agora (só vira definitivo no fechamento). */
  projecao: MovimentoLiga | null;
  categoriaProjetada: CategoriaLiga | null;
};

export type ParticipanteLiga = {
  idUsuario: string;
  /** null quando a conta foi desativada (identidade não é exibida). */
  nome: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  ativo: boolean;
  pontos: number;
  posicao: number;
  movimento: MovimentoLiga | null;
  voce: boolean;
};

export type TemporadaFechada = {
  idTemporada: string;
  inicio: string;
  fim: string;
  categoria: CategoriaLiga;
  categoriaDepois: CategoriaLiga | null;
  pontos: number;
  posicao: number;
  tamanhoGrupo: number;
  movimento: MovimentoLiga;
};

type RpcResposta<T> = { data: T | null; error: { message: string } | null };

async function rpc<T>(nome: string, args?: Record<string, unknown>): Promise<T> {
  const cliente = supabase as unknown as {
    rpc: (fn: string, params?: Record<string, unknown>) => PromiseLike<RpcResposta<T>>;
  };
  const { data, error } = await cliente.rpc(nome, args);
  if (error) throw new Error(error.message);
  return data as T;
}

type LinhaResumo = {
  season_id: string;
  starts_at: string;
  ends_at: string;
  entered: boolean | null;
  entry_kind: 'snapshot' | 'late' | null;
  tier: number | null;
  group_number: number | null;
  group_size: number | null;
  score: number | null;
  position: number | null;
  projected: MovimentoLiga | null;
  projected_tier: number | null;
};

type LinhaGrupo = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  active: boolean;
  score: number;
  position: number;
  movement: MovimentoLiga | null;
  is_self: boolean;
};

type LinhaHistorico = {
  season_id: string;
  starts_at: string;
  ends_at: string;
  tier: number;
  tier_after: number | null;
  final_score: number | null;
  final_position: number | null;
  group_size: number | null;
  movement: MovimentoLiga;
};

const comoCategoria = (valor: number | null): CategoriaLiga | null =>
  valor === null ? null : (Math.min(7, Math.max(1, valor)) as CategoriaLiga);

export const ligaRepository = {
  /**
   * Vira a semana quando preciso (fecha a anterior e forma os grupos da nova). É idempotente e barata
   * quando não há nada a fazer; chame antes de ler.
   */
  async sincronizar(): Promise<void> {
    await rpc<void>('league_sync');
  },

  /** Resumo pessoal da temporada atual. null = ainda não existe temporada. */
  async obterResumo(): Promise<ResumoLiga | null> {
    const linhas = (await rpc<LinhaResumo[]>('league_overview')) ?? [];
    const l = linhas[0];
    if (!l) return null;
    return {
      idTemporada: l.season_id,
      inicio: l.starts_at,
      fim: l.ends_at,
      inscrito: Boolean(l.entered),
      tipoEntrada: l.entry_kind,
      categoria: comoCategoria(l.tier),
      numeroGrupo: l.group_number,
      tamanhoGrupo: l.group_size,
      pontos: l.score ?? 0,
      posicao: l.position,
      projecao: l.projected,
      categoriaProjetada: comoCategoria(l.projected_tier),
    };
  },

  /** Classificação do próprio grupo (temporada atual, ou a informada). */
  async listarMeuGrupo(idTemporada?: string): Promise<ParticipanteLiga[]> {
    const linhas = (await rpc<LinhaGrupo[]>('league_my_group', { p_season_id: idTemporada ?? null })) ?? [];
    return linhas.map((l) => ({
      idUsuario: l.user_id,
      nome: l.display_name,
      avatarUrl: l.avatar_url,
      bannerUrl: l.banner_url,
      ativo: l.active,
      pontos: l.score,
      posicao: l.position,
      movimento: l.movement,
      voce: l.is_self,
    }));
  },

  /** Temporadas já fechadas em que o usuário participou (mais recente primeiro). */
  async listarHistorico(limite = 12): Promise<TemporadaFechada[]> {
    const linhas = (await rpc<LinhaHistorico[]>('league_my_history', { p_limit: limite })) ?? [];
    return linhas.map((l) => ({
      idTemporada: l.season_id,
      inicio: l.starts_at,
      fim: l.ends_at,
      categoria: comoCategoria(l.tier) ?? 1,
      categoriaDepois: comoCategoria(l.tier_after),
      pontos: l.final_score ?? 0,
      posicao: l.final_position ?? 0,
      tamanhoGrupo: l.group_size ?? 0,
      movimento: l.movement,
    }));
  },
};