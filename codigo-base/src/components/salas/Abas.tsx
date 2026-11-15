import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Abas acessíveis (padrão WAI-ARIA tabs).
//
// Usado pelo pop-up do educador para separar Visão geral, Alunos, Conteúdo e
// Mural. A navegação é por teclado: ←/→ movem entre as abas, Home/End vão para
// a primeira/última. O painel ativo é o único renderizado, para o trap de Tab
// do Modal compartilhado percorrer só o conteúdo visível.
// ---------------------------------------------------------------------------

export type Aba = {
  id: string;       // sufixo estável, ex.: "visao-geral"
  rotulo: string;   // texto da aba
  painel: ReactNode;
};

export type AbasProps = {
  abas: Aba[];
  inicial?: string; // id da aba inicial; cai na primeira se não bater
  ariaLabel: string;
};

export function Abas({ abas, inicial, ariaLabel }: AbasProps) {
  const base = useId();
  const indiceInicial = Math.max(0, abas.findIndex((aba) => aba.id === inicial));
  const [ativa, setAtiva] = useState(indiceInicial === -1 ? 0 : indiceInicial);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function focar(indice: number) {
    setAtiva(indice);
    refs.current[indice]?.focus();
  }

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const ultimo = abas.length - 1;
    if (evento.key === "ArrowRight") { evento.preventDefault(); focar(indice === ultimo ? 0 : indice + 1); }
    else if (evento.key === "ArrowLeft") { evento.preventDefault(); focar(indice === 0 ? ultimo : indice - 1); }
    else if (evento.key === "Home") { evento.preventDefault(); focar(0); }
    else if (evento.key === "End") { evento.preventDefault(); focar(ultimo); }
  }

  const idAba = (id: string) => `${base}-aba-${id}`;
  const idPainel = (id: string) => `${base}-painel-${id}`;

  return (
    <>
      <div className="salas__abas" role="tablist" aria-label={ariaLabel}>
        {abas.map((aba, indice) => {
          const selecionada = indice === ativa;
          return (
            <button
              key={aba.id}
              ref={(el) => { refs.current[indice] = el; }}
              className={`salas__aba${selecionada ? " salas__aba--ativa" : ""}`}
              type="button"
              role="tab"
              id={idAba(aba.id)}
              aria-selected={selecionada}
              aria-controls={idPainel(aba.id)}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => setAtiva(indice)}
              onKeyDown={(evento) => aoTeclar(evento, indice)}
            >
              {aba.rotulo}
            </button>
          );
        })}
      </div>

      {abas.map((aba, indice) => (
        <div
          key={aba.id}
          className="salas__tabpanel"
          role="tabpanel"
          id={idPainel(aba.id)}
          aria-labelledby={idAba(aba.id)}
          hidden={indice !== ativa}
        >
          {indice === ativa && aba.painel}
        </div>
      ))}
    </>
  );
}
