import { SalaModalAluno } from "./SalaModalAluno";
import { SalaModalEducador } from "./SalaModalEducador";
import type { AulaView, ModuloView, Sala } from "./tipos";

// ---------------------------------------------------------------------------
// Pop-up da sala — seletor por papel.
//
// Mantém a assinatura de props que a página (pages/Salas.tsx) já usa e escolhe
// entre o modal do aluno e o do educador por `sala.souEducador`, repassando as
// mesmas props. Separação sem mudança de comportamento.
// ---------------------------------------------------------------------------

export type SalaModalProps = {
  sala: Sala;
  usuarioId: string;
  aulaAberta: boolean;
  onFechar: () => void;
  onAbrirAula: (aula: AulaView, modulo: ModuloView) => void;
  onAtualizar: () => Promise<void>;
};

export function SalaModal({ sala, usuarioId, aulaAberta, onFechar, onAbrirAula, onAtualizar }: SalaModalProps) {
  if (sala.souEducador) {
    return (
      <SalaModalEducador
        sala={sala}
        usuarioId={usuarioId}
        aulaAberta={aulaAberta}
        onFechar={onFechar}
        onAbrirAula={onAbrirAula}
        onAtualizar={onAtualizar}
      />
    );
  }

  return (
    <SalaModalAluno
      sala={sala}
      usuarioId={usuarioId}
      aulaAberta={aulaAberta}
      onFechar={onFechar}
      onAbrirAula={onAbrirAula}
    />
  );
}
