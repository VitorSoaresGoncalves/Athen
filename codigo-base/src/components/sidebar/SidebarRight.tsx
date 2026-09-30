import { useEffect, useRef } from 'react';
import './SidebarRight.css';

type SidebarRightProps = {
    aberta: boolean;
    onFechar: () => void;
    titulo: string;
    children: React.ReactNode;
}

export function SidebarRight({ aberta, onFechar, titulo, children }: SidebarRightProps) {
    const painelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!aberta) return;

        function cliqueFora(evento: MouseEvent) {
            const alvo = evento.target as HTMLElement;
            if (painelRef.current?.contains(alvo)) return;
            if (alvo.closest('[data-toggle-lousa]')) return;
            onFechar();
        }

        document.addEventListener('mousedown', cliqueFora);
        return () => document.removeEventListener('mousedown', cliqueFora);
    }, [aberta, onFechar]);

    return (
        <div ref={painelRef} className={aberta ? 'lousa aberta' : 'lousa'}>
            <aside className='lousa-painel'>
                <header className='lousa-titulo'>
                    <h3>{titulo}</h3>
                </header>

                <div className='lousa-conteudo'>{children}</div>
            </aside>

            <button className='lousa-rebarba' onClick={onFechar} aria-label='Recolher painel'>
                <span />
            </button>
        </div>
    )
}
