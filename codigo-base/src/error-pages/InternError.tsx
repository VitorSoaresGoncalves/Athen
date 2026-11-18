import ErrorPageLayout from "./ErrorLayout";
import { useDetalhesTecnicos, type Detalhe } from "./Referencia-Erro";

type ErroInternoProps = {
  /** Erro capturado pelo ErrorBoundary; a mensagem só é exibida em desenvolvimento. */
  erro?: Error;
  /** Tenta renderizar novamente sem recarregar a página. */
  onTentarNovamente?: () => void;
};

/** Página 500: falha inesperada na aplicação. */
export default function ErroInterno({ erro, onTentarNovamente }: ErroInternoProps) {
  const extras: Detalhe[] = [];
  if (erro && import.meta.env.DEV) {
    extras.push({ rotulo: "Erro", valor: `${erro.name}: ${erro.message}`.slice(0, 200) });
  }
  const detalhes = useDetalhesTecnicos("500 Internal Server Error", extras);

  return (
    <ErrorPageLayout
      codigo="500"
      selo="Erro inesperado"
      titulo="Algo deu errado por aqui"
      descricao="Encontramos um problema inesperado ao carregar esta página. Tente novamente; se continuar, informe a referência abaixo ao suporte."
      detalhes={detalhes}
      acoes={
        <>
          <button
            className="erro-pagina__botao erro-pagina__botao--primario"
            type="button"
            onClick={onTentarNovamente ?? (() => window.location.reload())}
          >
            Tentar novamente
          </button>
          <a className="erro-pagina__botao erro-pagina__botao--secundario" href="/">Voltar ao início</a>
        </>
      }
    />
  );
}