import { useEffect, type ReactNode } from "react";
import "./ErrorLayout.css";
import type { Detalhe } from "./Referencia-Erro";

const LOGO_COR = "/Athen.png";
const LOGO_FANTASMA = "/Athen_ghost.png";

type ErrorPageLayoutProps = {
  /** Código exibido em destaque (ex.: "404"). */
  codigo: string;
  /** Texto curto do selo acima do código (ex.: "Página não encontrada"). */
  selo: string;
  titulo: string;
  descricao: string;
  /** Linhas do bloco de diagnóstico técnico. */
  detalhes: Detalhe[];
  /** Botões/links de ação. */
  acoes: ReactNode;
  /** Conteúdo opcional entre a descrição e as ações (ex.: barra de progresso). */
  extra?: ReactNode;
};

/**
 * Casca compartilhada das páginas de erro e manutenção. Standalone: não usa a
 * sidebar nem o React Router, para renderizar mesmo quando o restante da
 * aplicação não está disponível. Usa os tokens globais de design (index.css).
 */
export default function ErrorPageLayout({ codigo, selo, titulo, descricao, detalhes, acoes, extra }: ErrorPageLayoutProps) {
  useEffect(() => {
    const anterior = document.title;
    document.title = `${codigo} · ${titulo} · Athen`;
    return () => {
      document.title = anterior;
    };
  }, [codigo, titulo]);

  return (
    <div className="erro-pagina">
      <div className="erro-pagina__brilho erro-pagina__brilho--violeta" aria-hidden="true" />
      <div className="erro-pagina__brilho erro-pagina__brilho--dourado" aria-hidden="true" />
      <img className="erro-pagina__marca-dagua" src={LOGO_FANTASMA} alt="" aria-hidden="true" />

      <header className="erro-pagina__topo">
        <a className="erro-pagina__marca" href="/" aria-label="Athen, ir para o início">
          <img src={LOGO_COR} alt="" />
          <span>athen</span>
        </a>
      </header>

      <main className="erro-pagina__conteudo">
        <p className="erro-pagina__selo">
          <span className="erro-pagina__ponto" aria-hidden="true" />
          {selo}
        </p>
        <p className="erro-pagina__codigo" aria-hidden="true">{codigo}</p>
        <h1 className="erro-pagina__titulo">{titulo}</h1>
        <p className="erro-pagina__descricao">{descricao}</p>

        {extra}

        <div className="erro-pagina__acoes">{acoes}</div>

        <section className="erro-pagina__diagnostico" aria-label="Detalhes técnicos">
          <div className="erro-pagina__diagnostico-topo" aria-hidden="true">
            <span /><span /><span />
            <strong>diagnóstico</strong>
          </div>
          <dl className="erro-pagina__detalhes">
            {detalhes.map((detalhe) => (
              <div className="erro-pagina__detalhe" key={detalhe.rotulo}>
                <dt>{detalhe.rotulo}</dt>
                <dd>{detalhe.valor}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="erro-pagina__rodape">athen</footer>
    </div>
  );
}