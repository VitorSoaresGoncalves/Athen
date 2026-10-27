import { useEffect, useRef } from 'react';
import { useTopDownDados } from "./top-down-dados";
import { hexToRgba } from "./topDownColor";


const rebarba = 28;

type SidebarRightProps = {
    aberta: boolean;
    onFechar: () => void;
    cor: string;
    cursoId?: string;
}

type BlocoProps = {
    cor: string;
    titulo: string;
    children: React.ReactNode;
};

const medalhas = ["🥇", "🥈", "🥉"];

function Mensagem({ children }: { children: React.ReactNode }) {
    return <p className="m-0 text-xs text-[#a0a0b8]">{children}</p>;
}


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

export function SidebarRight({ aberta, onFechar, cor, cursoId}: SidebarRightProps) {
    const painelRef = useRef<HTMLDivElement>(null);
    const { ranking, missoes, carregando, erroRanking, erroMissoes } = useTopDownDados(cursoId);
    const temAmigos = ranking.some((amigo) => !amigo.is_self);
    

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
            duration-320ms
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
                border-x-[2px]
                border-b-[2px]
                border-t-0
                bg-[#171421]
                transition-[border-color,box-shadow]
                duration-700"
              style={{
                borderColor: "#2d323a",
                // borderColor: "#171421",
                boxShadow: `0 5px 18px #000000, inset 0 0 30px ${hexToRgba(cor, 0.0)}`,
              }}
            >

                {/* Rank de amigos */}
                <Bloco cor={cor} titulo="Rank de amigos">
                    {carregando ? (
                        <Mensagem>Carregando...</Mensagem>
                    ) : erroRanking ? (
                        <Mensagem>{erroRanking}</Mensagem>
                    ) : !temAmigos ? (
                        <Mensagem>Adicione amigos para competir nesse curso.</Mensagem>
                    ) : (
                        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                            {ranking.map((amigo, index) => (
                                <li key={amigo.user_id} className="flex items-center gap-2.5 text-sm">
                                    <span className="w-5 flex-none text-center text-base">
                                        {medalhas[index] ?? index + 1}
                                    </span>

                                    <span
                                        className={`min-w-0 flex-1 truncate ${amigo.is_self ? "font-bold" : ""}`}
                                        style={{ color: amigo.is_self ? cor : "#eaf2ff" }}
                                    >
                                        {amigo.is_self ? "Você" : amigo.display_name || amigo.username}
                                    </span>
                            
                                    <span className="flex-none text-xs tabular-nums" style={{ color: hexToRgba(cor, 0.95) }}>
                                        {Math.round(Number(amigo.pac))}% PAC
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Bloco>

                    
                {/* Missoes ativas */}
                <Bloco cor={cor} titulo="Missões">
                    {carregando ? (
                        <Mensagem>Carregando...</Mensagem>
                    ) : erroMissoes ? (
                        <Mensagem>{erroMissoes}</Mensagem>
                    ) : missoes.length === 0 ? (
                        <Mensagem>Nenhuma missão ativa nas suas salas.</Mensagem>
                    ) : (
                        <ul className="m-0 flex list-none flex-col gap-4 p-0">
                            {missoes.map((missao) => {
                                const progresso = missao.concluida ? 100 : Math.round(missao.progresso);
                            
                                return (
                                    <li key={missao.id}>
                                        <div className="flex items-start justify-between gap-3">
                                            <strong className="text-sm leading-snug text-[#f4eeff]">
                                                {missao.title}
                                            </strong>
                                
                                            <span
                                                className="flex-none rounded-full border px-2 py-0.5 text-[11px] font-bold"
                                                style={{ borderColor: hexToRgba(cor, 0.6), color: cor }}
                                            >
                                                +{missao.reward_xp} XP
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
                                            {missao.concluida ? "Concluída" : `${progresso}% concluído`}
                                            {missao.deadline && ` · até ${new Date(missao.deadline).toLocaleDateString("pt-BR")}`}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
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
                bg-[#171421]
                rounded-b-[12px]
                border-x-[3px]
                border-b-[3px]
                border-t-0
                cursor-pointer
                transition-[border-color,box-shadow]
                duration-700"
              style={{ 
                height: rebarba,
                borderColor: "#2d323a",
                boxShadow: `0 5px 18px #000000, inset 0 0px 20px ${hexToRgba(cor, 0.00)}`, 
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
