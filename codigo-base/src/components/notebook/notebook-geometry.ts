export type NotebookRect = { x: number; y: number; width: number; height: number };
export type NotebookViewport = { left: number; top: number; width: number; height: number };

/** Pixels CSS de posição fixed: dimensão primeiro, depois posição, margem de 8px. */
export function clampNotebookRect(rect: NotebookRect, area: NotebookViewport): NotebookRect {
  const availableWidth = Math.max(0, area.width - 16);
  const availableHeight = Math.max(0, area.height - 16);
  const width = Math.min(availableWidth, Math.max(Math.min(240, availableWidth), rect.width));
  const height = Math.min(availableHeight, Math.max(Math.min(200, availableHeight), rect.height));
  return {
    x: Math.min(Math.max(rect.x, area.left + 8), area.left + area.width - 8 - width),
    y: Math.min(Math.max(rect.y, area.top + 8), area.top + area.height - 8 - height),
    width, height,
  };
}
