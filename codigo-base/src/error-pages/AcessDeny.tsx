import ErrorPageLayout from "./ErrorLayout";
import { useDetalhesTecnicos } from "./Referencia-Erro";

/** Página 403: usuário sem permissão para o recurso. */
export default function AcessoNegado() {
  const detalhes = useDetalhesTecnicos("403 Forbidden");

  return (
    <ErrorPageLayout
      codigo="403"
      selo="Acesso negado"
      titulo="Você não tem acesso a este conteúdo"
      descricao="Sua conta não tem permissão para abrir esta página. Entre com outra conta ou volte para o início."
      detalhes={detalhes}
      acoes={
        <>
          <a className="erro-pagina__botao erro-pagina__botao--primario" href="/login-page">Entrar com outra conta</a>
          <a className="erro-pagina__botao erro-pagina__botao--secundario" href="/">Voltar ao início</a>
        </>
      }
    />
  );
}