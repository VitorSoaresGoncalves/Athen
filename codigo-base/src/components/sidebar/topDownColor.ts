export function hexToRgba(hex: string, alpha: number) {
  const limpo = hex.trim().replace("#", "");

  const expandido = limpo.length === 3 || limpo.length === 4
    ? limpo.slice(0, 3).split("").map((parte) => `${parte}${parte}`).join("")
    : limpo.slice(0, 6);

  if (expandido.length !== 6) return `rgba(164, 134, 213, ${alpha})`;

  const vermelho = Number.parseInt(expandido.slice(0, 2), 16);
  const verde = Number.parseInt(expandido.slice(2, 4), 16);
  const azul = Number.parseInt(expandido.slice(4, 6), 16);

  return `rgba(${vermelho}, ${verde}, ${azul}, ${alpha})`;
}
