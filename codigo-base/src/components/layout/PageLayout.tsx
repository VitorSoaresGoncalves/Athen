import type { CSSProperties, ReactNode } from "react";
import { SidebarLeft } from "../sidebar/SidebarLeft";

/**
 * Largura da SidebarLeft (componente fixo). O conteúdo precisa compensar esse
 * espaço à esquerda. Mantido num único lugar para todas as páginas usarem o
 * mesmo valor, em vez de repetir "pl-[230px]" / "ml-[230px]" / "margin-left:
 * 230px" espalhados por cada página e cada CSS.
 */
export const SIDEBAR_LEFT_WIDTH = 230;

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
   * Por padrão (true) o layout reserva {@link SIDEBAR_LEFT_WIDTH}px à esquerda.
   * Passe false quando a própria página precisar controlar esse deslocamento
   * pelo CSS — por exemplo, páginas com comportamento responsivo próprio da
   * sidebar (ConfigPage transforma a sidebar em barra superior no mobile). A
   * sidebar continua sendo renderizada pelo layout; só o offset fica com a
   * página.
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
 * diferente: a SidebarLeft fixa, o deslocamento de {@link SIDEBAR_LEFT_WIDTH}px
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
    <div className={rootClassName}>
      <SidebarLeft />

      <main
        className={`${bare ? "min-h-svh" : "flex min-h-svh flex-col"} ${mainClassName ?? ""}`.trim()}
        style={{ paddingLeft: offset ? SIDEBAR_LEFT_WIDTH : undefined, ...mainStyle }}
      >
        {bare ? (
          children
        ) : (
          <div className="mx-auto w-full max-w-[1320px] px-6 pb-12 pt-8 min-[1440px]:px-10">{children}</div>
        )}
      </main>

      {overlay}
    </div>
  );
}
