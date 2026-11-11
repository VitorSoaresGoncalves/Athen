import type { PodiumHeight, Tier } from "../ranking/RankingPodium";
import type { Database } from "../../types/database";

// ---------------------------------------------------------------------------
// Modelo de tela e helpers compartilhados entre a página de Salas
// (pages/Salas.tsx) e os pop-ups de sala (components/salas/*).
//
// Extraído de pages/Salas.tsx sem mudança de comportamento, para que página e
// modais importem do mesmo lugar em vez de a página reexportar tudo.
// ---------------------------------------------------------------------------

export type Tom = "coral" | "azul" | "violeta" | "menta" | "rosa" | "laranja";

export type MembroLinha = Database["public"]["Tables"]["room_members"]["Row"];
export type AvisoLinha = Database["public"]["Tables"]["announcements"]["Row"];

export type AulaView = { id: string; titulo: string; conteudo: string | null; concluida: boolean };
export type ModuloView = { id: string; titulo: string; descricao: string; cor: string; aulas: AulaView[] };

export type Sala = {
  id: string;
  nome: string;
  codigo: string;
  codigoAtivo: boolean;
  pacVisibilidade: string;
  cursoId: string | null;
  cursoTitulo: string;
  categoria: string;
  educadorId: string;
  educador: string;
  souEducador: boolean;
  membros: number;
  ranking: MembroLinha[]; // membros ativos, do maior para o menor XP interno
  meuMembro: MembroLinha | null;
  tom: Tom;
  simbolo: string;
  modulos: ModuloView[];
  totalAulas: number;
  aulasConcluidas: number;
};

export type AulaAberta = { salaId: string; aula: AulaView; modulo: ModuloView };

export const OPCOES_PAC = [
  { valor: "members", rotulo: "Membros da sala" },
  { valor: "educator_only", rotulo: "Só o educador" },
  { valor: "public", rotulo: "Todos" },
] as const;

export const ALTURAS: PodiumHeight[] = ["first", "second", "third", "fourth", "fifth"];

// Mensagens do banco (em inglês) traduzidas para quem usa a tela.
export function traduzirErro(erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message : "";
  if (/invalid or inactive access code/i.test(mensagem)) return "Código inválido ou desativado.";
  if (/not authenticated/i.test(mensagem)) return "Entre na sua conta para continuar.";
  if (/row-level security|42501|permission denied/i.test(mensagem)) return "Você não tem permissão para fazer isso.";
  if (/infinite recursion|42P17/i.test(mensagem)) {
    return "O banco recusou a consulta (recursão nas policies de sala). Aplique a migration 0020 no Supabase.";
  }
  return mensagem || "Algo deu errado. Tente novamente.";
}

// Faixas de PAC alinhadas a division_for_pac (migração 0039): 6 patamares.
export function tierPorPac(pac: number): Tier {
  if (pac < 50) return "bronze";
  if (pac <= 64) return "silver";
  if (pac <= 74) return "gold";
  if (pac <= 84) return "platinum";
  if (pac <= 94) return "diamond";
  return "master";
}

export function formatarData(iso: string) {
  const data = new Date(iso);
  const hoje = new Date();
  const mesmoDia = data.toDateString() === hoje.toDateString();
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return mesmoDia ? `Hoje, ${hora}` : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
