import { useEffect, useRef } from 'react';
import { hexToRgba } from "./topDownColor";

const rebarba = 28;

type SidebarRightProps = {
    aberta: boolean;
    onFechar: () => void;
    cor: string;
}

type Amigo = {
    nome: string;
    xp: number;
    eu?: boolean;
};

type BlocoProps = {
    cor: string;
    titulo: string;
    children: React.ReactNode;
};

const amigos: Amigo[] = [
    { nome: "Luna Silva", xp: 2340 },
    { nome: "Pedro Costa", xp: 1890 },
    { nome: "Ana Reis", xp: 1450 },
    { nome: "Você", xp: 1120, eu: true },
];

const medalhas = ["🥇", "🥈", "🥉"];

const quest = {
    titulo: "Complete 3 aulas hoje", 
    xp: 150, 
    feito: 1, 
    total: 3
};


function Bloco({ cor, titulo, children }: BlocoProps) {
    return (
        <div
            className="
                rounded-2xl
                border
                p-4
                backdrop-blur-[2px]
                transition-[border-color,box-shadow]
                duration-700"
            style={{
                borderColor: hexToRgba(cor, 0.55),
                backgroundColor: hexToRgba("#090512", 0.9),
                boxShadow: `0 0 16px ${hexToRgba(cor, 0.2)}, inset 0 0 18px ${hexToRgba(cor, 0.08)}`,
            }}
        >
            <h4
                className="
                    m-0
                    mb-3
                    text-[11px]
                    uppercase
                    tracking-[0.18em]"
                style={{ color: hexToRgba(cor, 0.95) }}
            >
                {titulo}
            </h4>

            {children}
        </div>
    );
}

export function SidebarRight({ aberta, onFechar, cor}: SidebarRightProps) {
    const painelRef = useRef<HTMLDivElement>(null);
    const progresso = Math.round((quest.feito / quest.total) * 100);

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
                flex
                flex-col
                gap-3
                p-4
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

                {/* Rank de amigos */}
                <Bloco cor={cor} titulo="Rank de amigos">
                    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                        {amigos.map((amigo, index) => (
                            <li key={amigo.nome} className="flex items-center gap-2.5 text-sm">
                                <span className="w-5 flex-none text-center text-base">
                                    {medalhas[index] ?? index + 1}
                                </span>
                        
                                <span
                                    className={`min-w-0 flex-1 truncate ${amigo.eu ? "font-bold" : ""}`}
                                    style={{ color: amigo.eu ? cor : "#eaf2ff" }}
                                >
                                    {amigo.nome}
                                </span>
                        
                                <span className="flex-none text-xs tabular-nums" style={{ color: hexToRgba(cor, 0.95) }}>
                                    {amigo.xp.toLocaleString("pt-BR")} xp
                                </span>
                            </li>
                        ))}
                    </ul>
                </Bloco>
                    
                {/* Quest diaria */}
                <Bloco cor={cor} titulo="Quest diária">
                    <div className="flex items-start justify-between gap-3">
                        <strong className="text-sm leading-snug text-[#f4eeff]">
                            {quest.titulo}
                        </strong>
                    
                        <span
                            className="flex-none rounded-full border px-2 py-0.5 text-[11px] font-bold"
                            style={{ borderColor: hexToRgba(cor, 0.6), color: cor }}
                        >
                            +{quest.xp} XP
                        </span>
                    </div>
                    
                    <div
                        className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
                        style={{ backgroundColor: hexToRgba(cor, 0.15) }}
                    >
                        <div
                            className="h-full rounded-full transition-[width] duration-500"
                            style={{
                                width: `${progresso}%`,
                                backgroundColor: cor,
                                boxShadow: `0 0 10px ${hexToRgba(cor, 0.8)}`,
                            }}
                        />
                    </div>
                        
                    <span className="mt-2 block text-xs" style={{ color: hexToRgba(cor, 0.9) }}>
                        {quest.feito}/{quest.total} concluídas
                    </span>
                </Bloco>
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
