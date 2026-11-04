import type { Database } from "../types/database";

// Rótulos e formatadores compartilhados entre a lista (/missoes) e o detalhe
// (/missoes/:id). Centralizados para evitar duplicação (Q071/Q073).

export type Escopo = Database["public"]["Enums"]["mission_scope"];
export type Objetivo = Database["public"]["Enums"]["mission_objective"];

export const ROTULO_ESCOPO: Record<Escopo, string> = {
  global_daily: "Diária global",
  global_weekly: "Semanal global",
  course_daily: "Diária de curso",
};

export const ROTULO_OBJETIVO: Record<Objetivo, string> = {
  complete_lessons: "Concluir aulas",
  correct_questions: "Acertar questões distintas",
  complete_executions: "Concluir execuções",
  study_days: "Estudar em dias distintos",
};

// Rótulo de contexto do cartão: escopo e, para diária de curso, o nome do curso.
export function rotuloContexto(escopo: Escopo, cursoTitulo: string | null): string {
  const base = ROTULO_ESCOPO[escopo] ?? "Missão";
  return escopo === "course_daily" && cursoTitulo ? `${base} · ${cursoTitulo}` : base;
}

// Prazo relativo curto em pt-BR (ex.: "em 3h", "em 2d", "encerrada").
export function prazoRelativo(fimIso: string, agora: Date = new Date()): string {
  const fim = new Date(fimIso).getTime();
  if (Number.isNaN(fim)) return "";
  const seg = Math.floor((fim - agora.getTime()) / 1000);
  if (seg <= 0) return "encerrada";
  const h = Math.floor(seg / 3600);
  if (h < 1) return `em ${Math.max(1, Math.floor(seg / 60))} min`;
  if (h < 24) return `em ${h}h`;
  return `em ${Math.floor(h / 24)}d`;
}

// Prazo absoluto com fuso visível (Q073): data/hora local pt-BR + America/Sao_Paulo.
export function prazoAbsoluto(fimIso: string): string {
  const d = new Date(fimIso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " (BRT)";
}
