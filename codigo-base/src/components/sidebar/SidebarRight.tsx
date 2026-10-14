import { useEffect, useRef } from 'react';
import { hexToRgba } from "./topDownColor";


const rebarba = 28;

type SidebarRightProps = {
    aberta: boolean;
    onFechar: () => void;
    cor: string;
    titulo: string;
    children: React.ReactNode;
}

export function SidebarRight({ aberta, onFechar, cor, titulo, children }: SidebarRightProps) {
    const painelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!aberta) return;

        function cliqueFora(evento: MouseEvent) {
            const alvo = evento.target;

            if (!(alvo instanceof Element)) return;
            if (painelRef.current?.contains(alvo)) return;

            onFechar();
        }

        document.addEventListener("mousedown", cliqueFora);
        return () => {document.removeEventListener("mousedown", cliqueFora)};
    }, [aberta, onFechar]);

    return (
        // janela inteira da sidebar
        <div ref={painelRef} className="
            fixed
            top-0
            right-[24px]
            z-20
            w-[300px]
            flex
            flex-col
            items-center
            transition-transform
            duration-[320ms]
            ease-in-out"
        style={{transform: aberta ? "translateY(0)" : `translateY(calc(-100% + ${rebarba}px))`}}
        >
            {/* caixa da top down*/}
            <aside className="
                relative
                box-border
                max-h-[80vh]
                w-full
                overflow-y-auto
                rounded-b-[20px]
                border
                border-t-0
                bg-transparent
                backdrop-blur-[3px]
                transition-[border-color,box-shadow]
                duration-700"
              style={{
                borderColor: cor,
                boxShadow: `0 0px 12px ${hexToRgba(cor, 0.35)}, inset 0 0 26px ${hexToRgba(cor, 0.12)}`,
              }}
            >
                {/* titulo */}
                <header className="
                    px-[18px]
                    py-[16px]
                    border-b"
                  style={{ borderColor: hexToRgba(cor, 0.35) }}
                >
                    <h3 className="
                        m-0
                        text-[24px]
                        text-[#e6e6f0]"
                    >
                        {titulo}
                    </h3>
                </header>

                {/* elementos da top down */}
                <div className="
                    text-[#eaf2ff]
                    [&>section]:border-b
                    [&>section]:border-[#1e2a3d]
                    [&>section]:px-[18px]
                    [&>section]:py-4"
                >
                    {children}
                </div>
            </aside>

            {/* rebarba da janela TopDown */}
            <button
              type="button"
              onClick={onFechar}
              aria-expanded={aberta}
              aria-label={aberta ? "Recolher painel" : "Abrir painel"}
              className="
                group
                w-[88px]
                flex
                flex-none
                items-center
                justify-center
                bg-transparent
                backdrop-blur-[3px]
                rounded-b-[12px]
                border
                border-t-0
                cursor-pointer
                transition-[border-color,box-shadow]
                duration-700"
              style={{ 
                height: rebarba,
                borderColor: cor,
                boxShadow: `0 0px 12px ${hexToRgba(cor, 0.4)}, inset 0 -6px 14px ${hexToRgba(cor, 0.15)}`, 
              }}
            >
                <span 
                  className="h-[3px] w-7 rounded-full transition-all duration-200 group-hover:w-10"
                  style={{ backgroundColor: cor, boxShadow: `0 0 8px ${hexToRgba(cor, 0.9)}` }}
                />
            </button>
        </div>
    )
}
