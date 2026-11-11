import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Ícones usados pela página de Salas e seus pop-ups.
//
// Extraído de pages/Salas.tsx para que a página e os componentes de modal
// compartilhem o mesmo conjunto sem depender um do outro.
// ---------------------------------------------------------------------------
export type NomeIcone =
  | "search"
  | "filter"
  | "plus"
  | "arrow"
  | "people"
  | "close"
  | "chevron"
  | "play"
  | "check";

const caminhos: Record<NomeIcone, ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  filter: <path d="M4 7h16M7 12h10M10 17h4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5.3A3 3 0 0 1 16 11M17 14a5 5 0 0 1 4 4.9V20" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  play: <path d="m9 7 8 5-8 5Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};

export function Icone({ nome, tamanho = 20 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {caminhos[nome]}
    </svg>
  );
}
