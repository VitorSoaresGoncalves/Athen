// Modo de manutenção controlado por variáveis de ambiente do Vite:
//   VITE_MAINTENANCE_MODE=true              exibe a página de manutenção em todas as rotas
//   VITE_MAINTENANCE_UNTIL=2026-11-20T03:00:00-03:00   (opcional) previsão de retorno, ISO 8601
//
// O Vite embute essas variáveis no build: para ligar ou desligar a manutenção é
// preciso gerar um novo deploy com o valor alterado.

export const MODO_MANUTENCAO = import.meta.env.VITE_MAINTENANCE_MODE === "true";

/** Previsão de retorno informada em VITE_MAINTENANCE_UNTIL, ou null se ausente/inválida. */
export function previsaoRetorno(): Date | null {
  const bruto = import.meta.env.VITE_MAINTENANCE_UNTIL;
  if (!bruto) return null;
  const data = new Date(bruto);
  return Number.isNaN(data.getTime()) ? null : data;
}