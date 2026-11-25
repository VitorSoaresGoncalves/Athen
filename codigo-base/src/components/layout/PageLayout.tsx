import type { CSSProperties, ReactNode } from "react";
import { SidebarLeft } from "../sidebar/SidebarLeft";
import "./PageLayout.css";

type PageLayoutProps = {
  /** Conteúdo da página (já estilizado pela própria página). */
  children: ReactNode;
  /**
   * Como o <main> trata o conteúdo:
   * - "contained" (padrão): aplica o container utilitário padrão (largura máxima,
   *   padding e centralização) usado pelas páginas escritas em Tailwind.
   * - "bare": não aplica padding nem largura máxima; a própria página cuida do
   *   espaçamento interno pelo seu CSS (Dashboard, Ligas, Salas, Cursos, ...).
   *
   * Em ambos os casos o layout é o único responsável pelo deslocamento da
   * SidebarLeft — as páginas não devem mais aplicar esse offset manualmente.
   */
  variant?: "contained" | "bare";
  /** Classe extra opcional para o elemento raiz. */
  className?: string;
  /** Classe extra opcional para o <main>. */
  mainClassName?: string;
  /** Estilo inline extra opcional para o <main> (ex.: fundo dinâmico). */
  mainStyle?: CSSProperties;
  /**
    * Por padrão reserva --sidebar-left-offset, definido pelo CSS da casca.
    * False transfere apenas a reserva lateral ao chamador, não a navegação.
   */
  offset?: boolean;
  /**
   * Conteúdo renderizado fora do fluxo do <main> (overlays, modais, painéis
   * laterais como a SidebarRight). Fica dentro da raiz do layout, mas não sofre
   * o padding do conteúdo principal.
   */
  overlay?: ReactNode;
};

/**
 * Casca padrão das páginas internas da plataforma.
 *
 * Centraliza a estrutura que antes cada página reimplementava de um jeito
 * diferente: a SidebarLeft e o deslocamento pelo token --sidebar-left-offset
 * à esquerda e o <main> ocupando a altura toda da tela. Assim todas as páginas
 * compartilham o mesmo esqueleto, independentemente de usarem CSS próprio
 * ("bare") ou classes utilitárias do Tailwind ("contained") no conteúdo.
 */
export function PageLayout({
  children,
  variant = "contained",
  className,
  mainClassName,
  mainStyle,
  offset = true,
  overlay,
}: PageLayoutProps) {
  const bare = variant === "bare";

  // "bare": a própria página traz fundo, altura e espaçamento pelo seu CSS, então
  // o layout só reserva o espaço da sidebar. "contained": o layout fornece fundo,
  // tipografia e o container utilitário padrão das páginas em Tailwind.
  const rootClassName = bare
    ? `relative min-h-svh ${className ?? ""}`.trim()
    : `relative min-h-svh bg-canvas font-body text-ink ${className ?? ""}`.trim();

  return (
    <div className={`page-layout${offset ? "" : " page-layout--no-offset"} ${rootClassName}`}>
      <SidebarLeft />

      <main
        className={`page-layout__main ${bare ? "min-h-svh" : "flex min-h-svh flex-col"} ${mainClassName ?? ""}`.trim()}
        style={mainStyle}
      >
        {bare ? (
          children
        ) : (
          <div className="page-layout__container mx-auto w-full max-w-[1320px] px-6 pb-12 pt-8 min-[1440px]:px-10">{children}</div>
        )}
      </main>

      {overlay}
    </div>
  );
}
