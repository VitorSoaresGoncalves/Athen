import { useState } from "react";

/** Par rótulo/valor exibido no bloco de diagnóstico das páginas de erro. */
export type Detalhe = { rotulo: string; valor: string };

/** Código curto para o usuário informar ao suporte (ex.: ATH-4F9A2C). */
export function gerarReferencia(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return `ATH-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * Diagnóstico técnico da ocorrência: status, caminho acessado, horário (UTC) e
 * referência. Calculado uma única vez por montagem da página, para não mudar a
 * cada renderização. Não depende do React Router, então também funciona quando a
 * página é exibida fora dele (modo de manutenção).
 */
export function useDetalhesTecnicos(status: string, extras: Detalhe[] = []): Detalhe[] {
  const [base] = useState(() => ({
    caminho: `${window.location.pathname}${window.location.search}`,
    horario: new Date().toISOString(),
    referencia: gerarReferencia(),
  }));

  return [
    { rotulo: "Status", valor: status },
    { rotulo: "Caminho", valor: base.caminho },
    ...extras,
    { rotulo: "Horário", valor: base.horario },
    { rotulo: "Referência", valor: base.referencia },
  ];
}