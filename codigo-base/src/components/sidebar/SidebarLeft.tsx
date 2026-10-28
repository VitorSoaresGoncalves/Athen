import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { usuarioRepository } from '../../data/repositories';
import { supabase } from '../../lib/supabase';

// Rotas usadas pela sidebar. Ajuste aqui se no seu router forem diferentes.
const PROFILE_ROUTE = '/profile';
const DASHBOARD_ROUTE = '/dashboard';
const SALAS_ROUTE = '/salas';
const LIGA_ROUTE = '/ligas';
const AMIGOS_ROUTE = '/amigos';
const NOTEBOOK_ROUTE = '/caderno';
const CONFIG_ROUTE = '/configuracoes';
const CATALOGO_ROUTE = '/catalogo';

/** Evento disparado pelo Profile depois de salvar, para a sidebar recarregar o perfil. */
export const PROFILE_UPDATED_EVENT = 'athen:profile-updated';

type SidebarItem = {
    text: string;
    to?: string; // sem "to" = ainda não tem página (mantém href="#")
}

type PerfilUser = {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
}

const itens: SidebarItem[] = [
    { text: "Início", to: DASHBOARD_ROUTE },
    { text: "Catálogo", to: CATALOGO_ROUTE },
    { text: "Salas", to: SALAS_ROUTE },
    { text: "Ligas", to: LIGA_ROUTE },
    { text: "Amigos", to: AMIGOS_ROUTE },
    { text: "Cadernos", to: NOTEBOOK_ROUTE },
    { text: "Configuração", to: CONFIG_ROUTE },
];

/**
 * Perfil do usuário logado (tabela "profiles").
 * Recarrega quando a sessão muda (login/logout) e quando o Profile salva alterações.
 */
function useUserProfile() {
    const [profile, setProfile] = useState<PerfilUser | null>(null);
    const [carregando, setCarregando] = useState(true);

    useEffect(() => {
        let cancelado = false;

        async function carregarPerfil() {
            try {
                const atual = await usuarioRepository.obterAtual();
                if (cancelado) return;

                setProfile(
                    atual
                        ? {
                              display_name: atual.display_name,
                              username: atual.username,
                              avatar_url: atual.avatar_url,
                          }
                        : null,
                );
            } catch (error) {
                console.error("Erro ao buscar perfil:", error);
                if (!cancelado) setProfile(null);
            } finally {
                if (!cancelado) setCarregando(false);
            }
        }

        void carregarPerfil();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(() => {
            // adiado para não chamar o Supabase dentro do callback de auth
            setTimeout(() => { void carregarPerfil(); }, 0);
        });

        const aoAtualizarPerfil = () => { void carregarPerfil(); };
        window.addEventListener(PROFILE_UPDATED_EVENT, aoAtualizarPerfil);

        return () => {
            cancelado = true;
            subscription.unsubscribe();
            window.removeEventListener(PROFILE_UPDATED_EVENT, aoAtualizarPerfil);
        };
    }, []);

    return { profile, carregando };
}

export function SidebarLeft() {
    // objeto com informacoes do usuario
    const userSrc = useUserProfile();
    const picture: string | null = userSrc.profile?.avatar_url ?? null;

    return (
        // corpo inteiro da sidebar
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
            gap-6
            border-r
            border-[#b5b5eb2a]
            bg-[#0e1420]
            text-[#e6e6f0]"
        >
            {/* titulo no topo */}
            <section className="
                border-[#b5b5eb2a]
                border-b"
            >
                <Link
                    to={DASHBOARD_ROUTE}
                    className="block no-underline hover:opacity-90 transition-opacity"
                    aria-label="Ir para o Dashboard"
                >
                    <h2 className="
                        m-0
                        text-[32px]
                        tracking-[5px]
                        text-center
                        py-5"
                        >
                        ATHEN
                    </h2>
                </Link>
            </section>

            {/* parte interna da sidebar */}
            <nav className="
                flex
                flex-col
                gap-1
                pb-4
                px-4"
            >
                {/* itens do menu */}
                {itens.map((item) => {
                    // Classes base compartilhadas entre NavLink e a (Links inativos)
                    const baseItemClass = `
                        flex
                        items-center
                        gap-[12px]
                        w-full
                        px-[12px]
                        py-[12px]
                        border-0
                        rounded-[8px]
                        text-left
                        cursor-pointer
                        transition-colors
                    `;

                    return item.to ? (
                        <NavLink
                            to={item.to}
                            key={item.text}
                            className={({ isActive }) =>
                                `${baseItemClass} ${isActive
                                    ? 'bg-[#22223a] text-white'
                                    : 'bg-transparent text-[#a0a0b8] hover:bg-[#22223a] hover:text-white'
                                }`
                            }
                        >
                            <span className="text-[20px]">{item.text}</span>
                        </NavLink>
                    ) : (
                        <a
                            href="#"
                            key={item.text}
                            className={`
                                ${baseItemClass}
                                bg-transparent
                                text-[#a0a0b8]
                                hover:bg-[#22223a]
                                hover:text-white
                            `}
                        >
                            <span className="text-[20px]">{item.text}</span>
                        </a>
                    );
                })}
            </nav>

            {/* Link para o perfil e avatar do usuário */}
            <Link
                to={PROFILE_ROUTE}
                aria-label="Ir para o perfil"
                title="Meu perfil"
                className="block outline-none mt-auto mx-2.5"
            >
                <div className="
                    flex
                    mb-3.75
                    items-center
                    justify-start
                    gap-2
                    p-1"
                >
                    {/* Foto do usuario */}
                    <div className="
                        flex
                        w-17.5
                        h-17.5
                        shrink-0
                        items-center
                        overflow-hidden
                        rounded-[22px]
                        border
                        border-violet"
                    style={{
                        boxShadow: "0 0px 30px rgba(84, 49, 140, 0.6)"
                    }}
                    >
                        {picture
                            ?   <img
                                    src={picture}
                                    alt="Foto de perfil"
                                    className="w-full h-full object-cover"
                                />
                            :   <span className="
                                    flex
                                    w-full
                                    h-full
                                    text-[44px]
                                    items-center
                                    justify-center"
                                >
                                    🙈
                                </span>
                        }
                    </div>

                    {/* Nome display e do usuario */}
                    <div className="min-w-0 flex flex-col gap-1.75">
                        <span className="block truncate text-[22px] leading-none text-gold">
                            {userSrc.profile?.display_name ?? (userSrc.carregando ? "..." : "Estudante")}
                        </span>

                        <span className="block truncate text-[13px] leading-none text-purple-400">
                            {userSrc.profile?.username ? `@${userSrc.profile.username}` : ""}
                        </span>
                    </div>
                </div>
            </Link>
        </aside>
    )
}