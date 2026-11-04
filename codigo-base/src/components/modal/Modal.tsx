import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import "./Modal.css";

// ---------------------------------------------------------------------------
// Casca compartilhada de pop-up (modal)
//
// Centraliza o que antes cada página reimplementava: a camada fixa, o fundo
// com desfoque, o painel rolável, a tecla Esc, a trava de rolagem do body, o
// fechamento por clique no fundo e a devolução do foco ao fechar.
//
// O conteúdo (banner, corpo e rodapé) chega por props, então cada página só
// descreve o que é específico dela. A aparência vem de Modal.css.
// ---------------------------------------------------------------------------

export type ModalWidth = "detalhe" | "estreito";

// Camadas de empilhamento. A aula abre por cima da sala, então precisa de um
// nível acima do pop-up comum.
export type ModalCamada = "base" | "acima";

type ModalProps = {
  /** Fecha o pop-up (Esc, clique no fundo ou botão de fechar). */
  onFechar: () => void;
  /** Liga o Esc e o clique no fundo ao fechamento. Por padrão, ligado. */
  fecharComEsc?: boolean;
  fecharNoFundo?: boolean;
  /** Largura do painel: "detalhe" (padrão, largo) ou "estreito" (filtros). */
  largura?: ModalWidth;
  /** Nível de empilhamento. "acima" fica sobre um modal "base" já aberto. */
  camada?: ModalCamada;
  /** id do elemento que rotula o diálogo (aria-labelledby). */
  rotuladoPor?: string;
  ariaLabel?: string;
  /** Classe extra aplicada ao painel, para ajustes pontuais da página. */
  className?: string;
  children: ReactNode;
};

export function Modal({
  onFechar,
  fecharComEsc = true,
  fecharNoFundo = true,
  largura = "detalhe",
  camada = "base",
  rotuladoPor,
  ariaLabel,
  className,
  children,
}: ModalProps) {
  // Mantém a última versão de onFechar sem reinstalar os efeitos a cada render.
  const fecharRef = useRef(onFechar);
  useEffect(() => {
    fecharRef.current = onFechar;
  });

  // Esc fecha; a rolagem do body fica travada enquanto o modal está aberto;
  // o foco volta para quem abriu o modal quando ele fecha.
  useEffect(() => {
    const elementoAnterior = document.activeElement as HTMLElement | null;

    function aoTeclar(evento: KeyboardEvent) {
      if (fecharComEsc && evento.key === "Escape") fecharRef.current();
    }

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", aoTeclar);
      // Devolve o foco ao gatilho, se ele ainda estiver na página.
      if (elementoAnterior && document.contains(elementoAnterior)) {
        elementoAnterior.focus();
      }
    };
  }, [fecharComEsc]);

  // Fecha só quando o gesto começa E termina no próprio fundo. Usar onClick
  // puro fecharia o modal quando o usuário solta o mouse no fundo depois de
  // arrastar a partir de dentro do painel (ex.: selecionando texto).
  const inicioNoFundo = useRef(false);

  const aoApertarNoFundo = useCallback((evento: MouseEvent<HTMLDivElement>) => {
    inicioNoFundo.current = evento.target === evento.currentTarget;
  }, []);

  const aoSoltarNoFundo = useCallback(
    (evento: MouseEvent<HTMLDivElement>) => {
      if (!fecharNoFundo) return;
      if (inicioNoFundo.current && evento.target === evento.currentTarget) {
        fecharRef.current();
      }
      inicioNoFundo.current = false;
    },
    [fecharNoFundo],
  );

  return (
    <div
      className={`modal__camada${camada === "acima" ? " modal__camada--acima" : ""}`}
      role="presentation"
      onMouseDown={aoApertarNoFundo}
      onMouseUp={aoSoltarNoFundo}
    >
      <div className="modal__fundo" aria-hidden="true" />

      <section
        className={`modal__painel modal__painel--${largura}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={rotuladoPor}
        aria-label={rotuladoPor ? undefined : ariaLabel}
      >
        {children}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Botão de fechar reutilizável (o "X" no canto do banner ou do cabeçalho).
// ---------------------------------------------------------------------------
export function ModalFechar({
  onFechar,
  rotulo,
  variante = "banner",
  children,
}: {
  onFechar: () => void;
  rotulo: string;
  /** "banner": sobre o banner colorido; "cabecalho": sobre fundo liso. */
  variante?: "banner" | "cabecalho";
  children: ReactNode;
}) {
  return (
    <button
      className={`modal__fechar modal__fechar--${variante}`}
      type="button"
      onClick={onFechar}
      aria-label={rotulo}
    >
      {children}
    </button>
  );
}
