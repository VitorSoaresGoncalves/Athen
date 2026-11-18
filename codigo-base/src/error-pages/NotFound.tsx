import ErrorPageLayout from "./ErrorLayout";
import { useDetalhesTecnicos } from "./Referencia-Erro";

/** Página 404: rota inexistente. */
export default function NaoEncontrada() {
  const detalhes = useDetalhesTecnicos("404 Not Found");

  return (
    <ErrorPageLayout
      codigo="404"
      selo="Página não encontrada"
      titulo="Não encontramos esta página"
      descricao="O endereço acessado não existe ou foi movido. Confira o link digitado ou volte para um lugar conhecido."
      detalhes={detalhes}
      acoes={
        <>
          <a className="erro-pagina__botao erro-pagina__botao--primario" href="/">Voltar ao início</a>
          <button className="erro-pagina__botao erro-pagina__botao--secundario" type="button" onClick={() => window.history.back()}>
            Página anterior
          </button>
        </>
      }
    />
  );
}