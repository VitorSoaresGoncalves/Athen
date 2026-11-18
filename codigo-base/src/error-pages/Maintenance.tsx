import ErrorPageLayout from "./ErrorLayout";
import { previsaoRetorno } from "./Manutencao-config";
import { useDetalhesTecnicos, type Detalhe } from "./Referencia-Erro";

const formatarRetorno = (data: Date) =>
  data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Página 503: plataforma em manutenção (ver manutencao-config.ts). */
export default function Manutencao() {
  const retorno = previsaoRetorno();
  const extras: Detalhe[] = retorno ? [{ rotulo: "Retorno previsto", valor: retorno.toISOString() }] : [];
  const detalhes = useDetalhesTecnicos("503 Service Unavailable", extras);

  return (
    <ErrorPageLayout
      codigo="503"
      selo="Manutenção em andamento"
      titulo="Voltamos em breve"
      descricao={
        retorno
          ? `Estamos realizando melhorias na plataforma. Previsão de retorno: ${formatarRetorno(retorno)}.`
          : "Estamos realizando melhorias na plataforma e ela volta em instantes."
      }
      detalhes={detalhes}
      extra={<div className="erro-pagina__progresso" role="presentation" aria-hidden="true" />}
      acoes={
        <button className="erro-pagina__botao erro-pagina__botao--primario" type="button" onClick={() => window.location.reload()}>
          Verificar novamente
        </button>
      }
    />
  );
}