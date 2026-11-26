import ErrorPageLayout from "./ErrorLayout";
import { useDetalhesTecnicos } from "./Referencia-Erro";

type AcessoNegadoProps = {
  /**
   * Visitante sem sessão (401 Unauthorized). Sem isto, é um usuário logado sem
   * permissão para o recurso (403 Forbidden).
   */
  semLogin?: boolean;
};

/** Página 401/403: acesso negado por falta de login ou de permissão. */
export default function AcessoNegado({ semLogin = false }: AcessoNegadoProps) {
  const detalhes = useDetalhesTecnicos(semLogin ? "401 Unauthorized" : "403 Forbidden");

  if (semLogin) {
    return (
      <ErrorPageLayout
        codigo="401"
        selo="Login necessário"
        titulo="Entre para acessar esta página"
        descricao="Esta área é exclusiva para usuários logados. Entre na sua conta ou crie uma para continuar."
        detalhes={detalhes}
        acoes={
          <>
            <a className="erro-pagina__botao erro-pagina__botao--primario" href="/login-page">Entrar</a>
            <a className="erro-pagina__botao erro-pagina__botao--secundario" href="/register-page">Criar conta</a>
          </>
        }
      />
    );
  }

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