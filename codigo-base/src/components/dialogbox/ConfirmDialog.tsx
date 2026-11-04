import { useEffect, useId, useRef, type ReactNode } from "react";

// Caixa de confirmação (sim/não) no lugar do window.confirm do navegador.
// A acessibilidade (Esc, foco, trava de rolagem, clique fora) fica embutida 
// para não repetir em cada tela.

export type ConfirmDialogProps = {
  /** Controla a exibição do diálogo. */
  open: boolean;
  /** Título do diálogo. */
  title: string;
  /** Texto/descrição opcional. Aceita JSX. */
  message?: ReactNode;
  /** Rótulo do botão de confirmar (padrão: "Confirmar"). */
  confirmLabel?: string;
  /** Rótulo do botão de cancelar (padrão: "Cancelar"). */
  cancelLabel?: string;
  /**
   * Rótulo de uma terceira ação opcional (ex.: "Descartar e criar"). Só
   * aparece quando passado junto de onTertiary; sem ela, o diálogo fica com os
   * dois botões de sempre.
   */
  tertiaryLabel?: string;
  /** Chamado ao acionar a terceira ação. Exige tertiaryLabel para aparecer. */
  onTertiary?: () => void;
  /**
   * Cor do botão de confirmar:
   * - "default": ação comum (botão no gold da plataforma).
   * - "danger": ação destrutiva, como apagar (botão vermelho).
   */
  tone?: "default" | "danger";
  /** Chamado quando o usuário confirma. */
  onConfirm: () => void;
  /** Chamado ao cancelar, pressionar Esc ou clicar fora. */
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tertiaryLabel,
  onTertiary,
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Mantém o callback atual sem reassinar os listeners a cada render.
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  const cancelarRef = useRef<HTMLButtonElement>(null);

  // useId evita colisão caso dois diálogos coexistam na página.
  const idBase = useId();
  const tituloId = `${idBase}-title`;
  const mensagemId = `${idBase}-message`;

  // Enquanto aberto: fecha no Esc, trava a rolagem e foca o cancelar.
  useEffect(() => {
    if (!open) return;

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onCancelRef.current();
    }
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", aoTeclar);
    cancelarRef.current?.focus();

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [open]);

  if (!open) return null;

  // Vermelho local de estado; não há família semântica global para destrutivo.
  const botaoConfirmar =
    tone === "danger"
      ? "bg-[#c2455a] text-[#fff5f6] hover:bg-[#a83a4c]"
      : "bg-gold text-violet hover:bg-gold-light";

  return (
    // Fundo: fecha só no clique nele, não ao soltar o mouse dentro do painel.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#090512]/70 px-5 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={message ? mensagemId : undefined}
        className="w-full max-w-[26rem] rounded-2xl border border-violet-mid/35 bg-surface p-6 text-ink shadow-2xl shadow-black/50"
      >
        <h2 id={tituloId} className="font-display text-xl text-ink">
          {title}
        </h2>
        {message && (
          <p id={mensagemId} className="mt-2 text-sm leading-6 text-muted">
            {message}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          {tertiaryLabel && onTertiary && (
            <button
              type="button"
              onClick={onTertiary}
              className="rounded-md border border-violet-mid/40 px-4 py-2 text-sm font-bold text-violet-pale outline-none hover:bg-violet-mid/10 focus-visible:ring-2 focus-visible:ring-violet-mid"
            >
              {tertiaryLabel}
            </button>
          )}
          <button
            ref={cancelarRef}
            type="button"
            onClick={onCancel}
            className="rounded-md border border-violet-mid/40 px-4 py-2 text-sm font-bold text-violet-pale outline-none hover:bg-violet-mid/10 focus-visible:ring-2 focus-visible:ring-violet-mid"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-gold ${botaoConfirmar}`}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
