import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { notificacaoRepository, usuarioRepository } from '../../data/repositories';
import { supabase } from '../../lib/supabase';

// Rotas usadas pela sidebar. Ajuste aqui se no seu router forem diferentes.
const PROFILE_ROUTE = '/profile';
const LOGIN_ROUTE = '/login-page';
const DASHBOARD_ROUTE = '/dashboard';
const SALAS_ROUTE = '/salas';
const RANKING_ROUTE = '/ligas';
const AMIGOS_ROUTE = '/amigos';
const NOTEBOOK_ROUTE = '/caderno';
const NOTIFICACOES_ROUTE = '/notificacoes';
const CONFIG_ROUTE = '/configuracoes';
const CATALOGO_ROUTE = '/catalogo';

/** Evento disparado pelo Profile depois de salvar, para a sidebar recarregar o perfil. */
export const PROFILE_UPDATED_EVENT = 'athen:profile-updated';

/** Evento que a página de notificações dispara ao marcar notificações como lidas,
 *  para a bolha de não lidas da sidebar atualizar na hora. */
export const NOTIFICATIONS_READ_EVENT = 'athen:notifications-read';

type SidebarItem = {
    text: string;
    to?: string; // sem "to" = ainda não tem página (mantém href="#")
}

type PerfilUser = {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    banner_url: string | null;
    streak_count: number;
    last_study_date: string | null;
}

/** Data local no formato YYYY-MM-DD (mesmo formato de profiles.last_study_date). */
function diaLocal(offsetDias = 0) {
    const data = new Date();
    data.setDate(data.getDate() + offsetDias);
    return data.toLocaleDateString("sv-SE");
}

/** A sequência só continua viva se a última aula foi hoje ou ontem. */
function streakAtiva(lastStudyDate: string | null) {
    return lastStudyDate === diaLocal() || lastStudyDate === diaLocal(-1);
}

const itens: SidebarItem[] = [
    { text: "Início", to: DASHBOARD_ROUTE },
    { text: "Catálogo", to: CATALOGO_ROUTE },
    { text: "Salas", to: SALAS_ROUTE },
    { text: "Ligas", to: RANKING_ROUTE },
    { text: "Amigos", to: AMIGOS_ROUTE },
    { text: "Cadernos", to: NOTEBOOK_ROUTE },
];

// ---------------------------------------------------------------------------
// Cache do perfil em nível de módulo.
//
// A SidebarLeft é renderizada dentro de cada página, então ela remonta a cada
// troca de rota. Para não buscar o perfil toda vez, guardamos o resultado aqui
// e o compartilhamos entre todas as instâncias: a busca acontece uma única vez
// (no primeiro mount) e só é refeita quando a sessão muda ou o Profile salva
// alterações (PROFILE_UPDATED_EVENT). Ao remontar, a sidebar lê direto o cache.
// ---------------------------------------------------------------------------
type EstadoPerfil = { profile: PerfilUser | null; carregando: boolean };

let perfilCache: EstadoPerfil = { profile: null, carregando: true };
let buscaEmAndamento: Promise<void> | null = null;
let listenersGlobaisRegistrados = false;
const assinantes = new Set<(estado: EstadoPerfil) => void>();

function notificarAssinantes() {
    for (const assinante of assinantes) assinante(perfilCache);
}

async function buscarPerfil() {
    try {
        const atual = await usuarioRepository.obterAtual();
        perfilCache = {
            profile: atual
                ? {
                      display_name: atual.display_name,
                      username: atual.username,
                      avatar_url: atual.avatar_url,
                      banner_url: atual.banner_url,
                      streak_count: atual.streak_count,
                      last_study_date: atual.last_study_date,
                  }
                : null,
            carregando: false,
        };
    } catch (error) {
        console.error("Erro ao buscar perfil:", error);
        perfilCache = { profile: null, carregando: false };
    } finally {
        notificarAssinantes();
    }
}

// Dispara a busca só uma vez enquanto nenhuma estiver em andamento.
function garantirBuscaPerfil() {
    if (buscaEmAndamento) return;
    buscaEmAndamento = buscarPerfil().finally(() => { buscaEmAndamento = null; });
}

// Invalida o cache e refaz a busca (login/logout e após salvar o perfil).
function recarregarPerfil() {
    perfilCache = { ...perfilCache, carregando: true };
    notificarAssinantes();
    buscaEmAndamento = null;
    garantirBuscaPerfil();
}

// Listeners globais registrados uma única vez, independentes do ciclo de vida
// dos componentes, para o cache reagir a login/logout e a edições do perfil.
function registrarListenersGlobais() {
    if (listenersGlobaisRegistrados) return;
    listenersGlobaisRegistrados = true;

    supabase.auth.onAuthStateChange(() => {
        setTimeout(() => recarregarPerfil(), 0);
    });
    window.addEventListener(PROFILE_UPDATED_EVENT, () => recarregarPerfil());
}

/**
 * Perfil do usuário logado (tabela "profiles"), lido de um cache compartilhado.
 * A busca ocorre uma única vez; remontagens da sidebar reaproveitam o cache.
 */
function useUserProfile() {
    const [estado, setEstado] = useState<EstadoPerfil>(perfilCache);

    useEffect(() => {
        registrarListenersGlobais();
        // Assina antes de disparar a busca: qualquer atualização do cache chega
        // por notificarAssinantes (de forma assíncrona), sem setState síncrono.
        assinantes.add(setEstado);
        garantirBuscaPerfil();

        return () => { assinantes.delete(setEstado); };
    }, []);

    return estado;
}

/**
 * Quantidade de notificações não lidas do usuário, exibida como bolha no ícone de
 * correio. É recarregada ao trocar de rota (ao sair da página de notificações, as
 * que foram abertas já viraram lidas) e ao receber NOTIFICATIONS_READ_EVENT, que a
 * própria página dispara quando marca tudo como lido — assim a bolha some na hora.
 */
function useUnreadNotifications() {
    const { pathname } = useLocation();
    const [naoLidas, setNaoLidas] = useState(0);

    useEffect(() => {
        let cancelado = false;

        async function carregar() {
            try {
                const total = await notificacaoRepository.contarNaoLidas();
                if (!cancelado) setNaoLidas(total);
            } catch (error) {
                console.error('Erro ao contar notificações não lidas:', error);
                if (!cancelado) setNaoLidas(0);
            }
        }

        void carregar();
        window.addEventListener(NOTIFICATIONS_READ_EVENT, carregar);
        return () => {
            cancelado = true;
            window.removeEventListener(NOTIFICATIONS_READ_EVENT, carregar);
        };
    }, [pathname]);

    return naoLidas;
}

/** Ícone de correio (envelope) no padrão de SVG inline da plataforma. */
function MailIcon({ className = 'h-5 w-5' }: { className?: string }) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
        >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
        </svg>
    );
}

export function SidebarLeft() {
    const navigate = useNavigate();
    const userSrc = useUserProfile();
    const naoLidas = useUnreadNotifications();
    const perfil = userSrc.profile;
    const picture = perfil?.avatar_url ?? null;
    const banner = perfil?.banner_url ?? null;
    const temStreakAtiva = Boolean(perfil && perfil.streak_count > 0 && streakAtiva(perfil.last_study_date));
    const streakValor = temStreakAtiva ? perfil?.streak_count ?? 0 : 0;

    // Menu (popover) do botão de perfil: "Ver perfil" e "Sair da conta".
    const [menuAberto, setMenuAberto] = useState(false);
    const perfilRef = useRef<HTMLDivElement>(null);

    // Fecha o menu ao clicar fora ou pressionar Esc.
    useEffect(() => {
        if (!menuAberto) return;

        function aoClicarFora(evento: MouseEvent) {
            if (!(evento.target instanceof Node)) return;
            if (perfilRef.current?.contains(evento.target)) return;
            setMenuAberto(false);
        }
        function aoTeclar(evento: KeyboardEvent) {
            if (evento.key === "Escape") setMenuAberto(false);
        }

        document.addEventListener("mousedown", aoClicarFora);
        document.addEventListener("keydown", aoTeclar);
        return () => {
            document.removeEventListener("mousedown", aoClicarFora);
            document.removeEventListener("keydown", aoTeclar);
        };
    }, [menuAberto]);

    function verPerfil() {
        setMenuAberto(false);
        navigate(PROFILE_ROUTE);
    }

    function abrirConfiguracoes() {
        setMenuAberto(false);
        navigate(CONFIG_ROUTE);
    }

    async function sairDaConta() {
        setMenuAberto(false);
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Erro ao sair da conta:", error);
        } finally {
            navigate(LOGIN_ROUTE);
        }
    }

    return (
        // corpo inteiro da sidebar — fundo e bordas seguem os tokens da plataforma
        <aside className="
            sidebarL
            fixed
            z-10
            w-57.5
            h-screen
            shrink-0
            box-border
            flex
            flex-col
            border-r
            border-line
            bg-canvas
            font-body
            text-ink"
        >
            {/* Cabeçalho: ícone do app + nome "athen" e, à direita, atalho de correio
                (notificações) com bolha de não lidas. */}
            <section className="flex items-center justify-between gap-2 border-b border-line px-4 py-5">
                <Link
                    to={DASHBOARD_ROUTE}
                    className="flex min-w-0 items-center gap-3 no-underline transition-opacity hover:opacity-90"
                    aria-label="Ir para o Dashboard"
                >
                    <img src="/Athen.png" alt="" aria-hidden="true" className="h-10 w-10 shrink-0 rounded-[10px] object-cover" />
                    <span className="font-display text-[28px] lowercase leading-none tracking-[2px] text-gold">athen</span>
                </Link>

                <NavLink
                    to={NOTIFICACOES_ROUTE}
                    className={({ isActive }) =>
                        `relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-line transition-colors ${isActive
                            ? 'bg-violet/40 text-ink'
                            : 'bg-transparent text-muted hover:bg-surface hover:text-ink'
                        }`
                    }
                    aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} não lida(s)` : 'Notificações'}
                >
                    <MailIcon />
                    {naoLidas > 0 && (
                        <span
                            className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-canvas bg-[#c2455a] px-1 text-[11px] font-bold leading-none text-white"
                            aria-hidden="true"
                        >
                            {naoLidas > 99 ? '99+' : naoLidas}
                        </span>
                    )}
                </NavLink>
            </section>

            {/* Navegação principal */}
            <nav className="flex flex-col gap-1 px-4 pt-4 pb-4">
                {itens.map((item) => {
                    const baseItemClass =
                        "flex items-center gap-[12px] w-full px-[12px] py-[10px] border-0 rounded-[10px] text-left text-[16px] cursor-pointer transition-colors";

                    return item.to ? (
                        <NavLink
                            to={item.to}
                            key={item.text}
                            className={({ isActive }) =>
                                `${baseItemClass} ${isActive
                                    ? 'bg-violet/40 font-bold text-ink'
                                    : 'bg-transparent text-muted hover:bg-surface hover:text-ink'
                                }`
                            }
                        >
                            <span>{item.text}</span>
                        </NavLink>
                    ) : (
                        <a
                            href="#"
                            key={item.text}
                            className={`${baseItemClass} bg-transparent text-muted hover:bg-surface hover:text-ink`}
                        >
                            <span>{item.text}</span>
                        </a>
                    );
                })}
            </nav>

            {/* Botão de perfil no rodapé: avatar, nome/usuário e streak na mesma
                linha. Clicar abre um menu com "Ver perfil" e "Sair da conta". */}
            <div ref={perfilRef} className="relative mx-3 mb-4 mt-auto">
                {/* Menu popover acima do botão */}
                {menuAberto && (
                    <div
                        role="menu"
                        aria-label="Opções de conta"
                        className="absolute bottom-[calc(100%+8px)] left-0 right-0 overflow-hidden rounded-[12px] border border-line bg-surface shadow-xl shadow-black/40"
                    >
                        <button
                            type="button"
                            role="menuitem"
                            onClick={verPerfil}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[14px] text-ink transition-colors hover:bg-violet/40"
                        >
                            <span aria-hidden="true">👤</span>
                            Ver perfil
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={abrirConfiguracoes}
                            className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-left text-[14px] text-ink transition-colors hover:bg-violet/40"
                        >
                            <span aria-hidden="true">⚙️</span>
                            Configuração
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => void sairDaConta()}
                            className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-left text-[14px] text-[#e8909e] transition-colors hover:bg-[#c2455a]/20"
                        >
                            <span aria-hidden="true">↩</span>
                            Sair da conta
                        </button>
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => setMenuAberto((aberto) => !aberto)}
                    aria-haspopup="menu"
                    aria-expanded={menuAberto}
                    aria-label="Abrir opções de conta"
                    className="flex w-full flex-col overflow-hidden rounded-[16px] border border-line bg-surface text-left outline-none transition-colors hover:border-violet-mid focus-visible:ring-2 focus-visible:ring-gold"
                >
                    {/* Banner no topo do botão */}
                    <div className="h-[52px] w-full shrink-0">
                        {banner
                            ? <img src={banner} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                            : <div className="h-full w-full bg-gradient-to-r from-violet via-violet-mid/60 to-violet" />
                        }
                    </div>

                    {/* Linha: avatar + nomes + streak (mesmas posições de antes) */}
                    <div className="flex w-full items-center gap-3 px-3 py-2.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-line bg-[#1a0f35]">
                            {userSrc.carregando
                                ? <span aria-hidden="true" className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-violet-mid/40 border-t-violet-pale" />
                                : picture
                                    ? <img src={picture} alt="Foto de perfil" className="h-full w-full object-cover" />
                                    : <span className="flex h-full w-full items-center justify-center text-[22px]">🙈</span>
                            }
                        </div>

                        {/* Nome e usuário */}
                        <div className="min-w-0 flex-1">
                            {userSrc.carregando ? (
                                <span className="block h-[15px] w-2/3 animate-pulse rounded bg-violet-mid/30" />
                            ) : (
                                <>
                                    <span className="block truncate text-[15px] font-bold leading-tight text-ink">
                                        {perfil?.display_name ?? "Estudante"}
                                    </span>
                                    <span className="block truncate text-[12px] leading-tight text-violet-pale">
                                        {perfil?.username ? `@${perfil.username}` : ""}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Streak à direita dos nomes */}
                        {!userSrc.carregando && (
                            <span
                                className={`inline-flex shrink-0 items-center gap-1 text-[13px] font-bold ${temStreakAtiva ? "text-gold" : "text-muted"}`}
                                title={temStreakAtiva ? `Streak de ${streakValor} dia(s)` : "Sem streak ativa"}
                                aria-label={temStreakAtiva ? `Streak ativa de ${streakValor} dias` : "Sem streak ativa"}
                            >
                                <span aria-hidden="true" className={temStreakAtiva ? "" : "grayscale opacity-60"}>🔥</span>
                                {streakValor}
                            </span>
                        )}
                    </div>
                </button>
            </div>
        </aside>
    )
}
