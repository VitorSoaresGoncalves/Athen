type DatabaseNotConnectedProps = {
  /**
   * Nome do recurso que apareceria aqui quando o banco estiver conectado
   * (ex.: "os cursos", "seus amigos", "as salas"). Usado só para deixar a
   * mensagem mais específica; se omitido, usa um texto genérico.
   */
  recurso?: string;
  /** Classe extra opcional para ajustar o espaçamento no contexto da página. */
  className?: string;
};

/**
 * Estado padrão exibido onde antes havia conteúdo de exemplo (perfis falsos,
 * cards pré-prontos, rankings fictícios, etc.). Enquanto a integração com o
 * banco não é implementada, nenhuma página deve mostrar dados inventados: no
 * lugar, mostramos esta mensagem única e consistente.
 *
 * Centralizar a mensagem num componente garante que o texto seja igual em toda
 * a plataforma. Quando a conexão for implementada, basta substituir o uso deste
 * componente pela renderização dos dados reais.
 */
export function DatabaseNotConnected({ recurso, className }: DatabaseNotConnectedProps) {
  const descricao = recurso
    ? `A conexão com o banco de dados ainda não foi implementada, então ${recurso} aparecerão aqui assim que a integração estiver pronta.`
    : "A conexão com o banco de dados ainda não foi implementada. O conteúdo aparecerá aqui assim que a integração estiver pronta.";

  return (
    <div
      role="status"
      className={`mx-auto flex max-w-[520px] flex-col items-center rounded-xl border border-dashed border-[#a486d5]/40 bg-[#1d1a31]/70 px-6 py-14 text-center ${className ?? ""}`.trim()}
    >
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-full border border-[#a486d5]/40 bg-[#a486d5]/10 text-2xl"
      >
        🔌
      </span>
      <p className="mt-4 font-display text-lg text-[#f4eeff]">Banco de dados ainda não conectado</p>
      <p className="mt-2 text-sm leading-6 text-[#a99bbb]">{descricao}</p>
    </div>
  );
}
