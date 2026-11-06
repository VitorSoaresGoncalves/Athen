// ---------------------------------------------------------------------------
// Configuração das questões (adaptado do upstream embertoni/kiro-athen).
//
// Cada tipo de questão guarda em `questions.config` (jsonb) um formato que o
// corretor do servidor (grade_answer, nas migrações SQL) sabe ler. Este módulo
// concentra os formatos vazios, o XP padrão e a validação, sem depender de
// React — assim pode ser testado isoladamente.
// ---------------------------------------------------------------------------

import type { Database } from "../../types/database";

export type TipoQuestao = Database["public"]["Enums"]["question_type"];
type Json = Database["public"]["Tables"]["questions"]["Row"]["config"];

// Formatos de cada config (espelham o que o corretor SQL espera).
export type ConfigAssociacao = { pairs: { left: string; right: string }[] };
export type OpcaoMultipla = { id: string; text: string; correct: boolean };
export type ConfigMultipla = { options: OpcaoMultipla[] };
export type ConfigLacuna = { answers: string[] };
export type ConfigSomatorio = { statements: { value: number; correct: boolean }[] };

// Rótulos em pt-BR para o seletor de tipo.
export const ROTULOS_TIPO: Record<TipoQuestao, string> = {
  match: "Associação (pares)",
  multiple_choice: "Múltipla escolha",
  fill_blank: "Preencher lacuna",
  sum_alternatives: "Somatório",
};

// XP por tipo de questão (match 2, multiple_choice 4, fill_blank 6, sum 8),
// igual às constantes canônicas do servidor.
const XP_POR_TIPO: Record<TipoQuestao, number> = {
  match: 2,
  multiple_choice: 4,
  fill_blank: 6,
  sum_alternatives: 8,
};

let contadorOpcoes = 0;
/** Id estável o suficiente para uma nova alternativa dentro do editor. */
export function novoIdOpcao(): string {
  contadorOpcoes += 1;
  return `opt-${Date.now().toString(36)}-${contadorOpcoes}`;
}

/** Config inicial (vazia) para um tipo de questão recém-criada. */
export function configVaziaPara(tipo: TipoQuestao): Json {
  switch (tipo) {
    case "match":
      return { pairs: [{ left: "", right: "" }] } satisfies ConfigAssociacao as unknown as Json;
    case "multiple_choice":
      return {
        options: [
          { id: novoIdOpcao(), text: "", correct: true },
          { id: novoIdOpcao(), text: "", correct: false },
        ],
      } satisfies ConfigMultipla as unknown as Json;
    case "fill_blank":
      return { answers: [""] } satisfies ConfigLacuna as unknown as Json;
    case "sum_alternatives":
      return {
        statements: [
          { value: 1, correct: false },
          { value: 2, correct: false },
          { value: 4, correct: false },
        ],
      } satisfies ConfigSomatorio as unknown as Json;
    default: {
      const _exaustivo: never = tipo;
      return _exaustivo;
    }
  }
}

/** XP padrão de um tipo de questão. */
export function xpPadraoPara(tipo: TipoQuestao): number {
  return XP_POR_TIPO[tipo];
}

/**
 * Valida o formato da config antes de salvar. Retorna uma mensagem em pt-BR
 * quando há problema, ou null quando está tudo certo.
 */
export function validarConfigQuestao(tipo: TipoQuestao, config: Json): string | null {
  switch (tipo) {
    case "match": {
      const c = config as unknown as ConfigAssociacao;
      if (!c.pairs?.length) return "Adicione ao menos um par.";
      if (c.pairs.some((p) => !p.left.trim() || !p.right.trim())) return "Preencha os dois lados de cada par.";
      return null;
    }
    case "multiple_choice": {
      const c = config as unknown as ConfigMultipla;
      if (!c.options?.length || c.options.length < 2) return "Adicione ao menos duas alternativas.";
      if (c.options.some((o) => !o.text.trim())) return "Preencha o texto de todas as alternativas.";
      if (!c.options.some((o) => o.correct)) return "Marque ao menos uma alternativa correta.";
      return null;
    }
    case "fill_blank": {
      const c = config as unknown as ConfigLacuna;
      const respostas = (c.answers ?? []).filter((a) => a.trim());
      if (respostas.length === 0) return "Informe ao menos uma resposta aceita.";
      return null;
    }
    case "sum_alternatives": {
      const c = config as unknown as ConfigSomatorio;
      if (!c.statements?.length) return "Adicione ao menos uma afirmativa.";
      if (!c.statements.some((s) => s.correct)) return "Marque ao menos uma afirmativa correta.";
      return null;
    }
    default:
      return null;
  }
}

/** Soma esperada de um somatório, a partir das afirmativas marcadas como corretas. */
export function somaEsperada(config: ConfigSomatorio): number {
  return config.statements.filter((s) => s.correct).reduce((acc, s) => acc + s.value, 0);
}

/**
 * Transforma um título em um slug seguro para URL:
 * minúsculas, sem acentos, com hífens no lugar de sequências não alfanuméricas.
 */
export function gerarSlug(entrada: string): string {
  return entrada
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}