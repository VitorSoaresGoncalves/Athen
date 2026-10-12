import { useEffect, useRef } from 'react';

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
            const alvo = evento.target;

            if (!(alvo instanceof Element)) return;
            if (painelRef.current?.contains(alvo)) return;
            if (alvo.closest("[data-toggle-lousa]")) return;

            onFechar();
        }

        document.addEventListener("mousedown", cliqueFora);
        return () => {document.removeEventListener("mousedown", cliqueFora)};
    }, [aberta, onFechar]);

    return (
        // janela inteira da sidebar
        <div ref={painelRef} className={`
            fixed
            top-0
            right-[24px]
            z-20
            w-[300px]
            flex
            flex-col
            items-center
            ransition-transform
            duration-[320ms]
            ease-in-out
            ${aberta ? "translate-y-0" : "-translate-y-full"}`}
        >
            {/* caixa da top down*/}
            <aside className="
                relatieve
                w-full
                max-h-[80vh]
                overflow-y-auto
                box-border
                rounded-b-[14px]
                border
                border-t-0
                border-[#1e2a3d]
                bg-[#0e1420]
                "
            >
                {/* titulo */}
                <header className="
                    px-[18px]
                    py-[16px]
                    border-b
                    border-[#1e2a3d]"
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
            <button className="
                w-[64px]
                h-[20px]
                flex
                items-center
                justify-center
                bg-[#0e1420]
                rounded-b-[10px]
                border
                border-t-0
                border-[#1e2a3d]
                cursor-pointer"
                onClick={onFechar} aria-label="Recolher painel"
            >
                <span className="h-[3px] w-[26px] rounded-[2px] bg-[#3d5a80]"/>
            </button>
        </div>
    )
}
