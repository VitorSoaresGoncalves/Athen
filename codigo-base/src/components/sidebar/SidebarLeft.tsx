import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// Rotas usadas pela sidebar. Ajuste aqui se no seu router forem diferentes.
const PROFILE_ROUTE = '/Profile';
const DASHBOARD_ROUTE = '/dashboard';

type SidebarItem = {
    text: string;
    to?: string; // sem "to" = ainda não tem página (mantém href="#")
}

type perfilUser = {
    Nome_Display: string | null;
    Nome_Usuario: string | null;
    Avatar_Url: string | null;
}

type SidebArvatarUrl = {
    /** Opcional: se não for passada, a sidebar busca a foto do usuário logado sozinha. */
    avatar?: string;
}


const itens: SidebarItem[] = [
    {
        text: "Início",
        to: DASHBOARD_ROUTE,
    },
    {
        text: "Cursos",
    },
    {
        text: "Salas",
    },
    {
        text: "Amigos",
    },
    {
        text: "Configuração",
    }
];

/**
 * Foto do usuário logado (user_metadata.avatar_url).
 * Atualiza sozinha quando o perfil é salvo (evento USER_UPDATED do Supabase Auth).
 */
function useUserProfile(overrideAvatar?: string) {
    const [profile, setProfile] = useState<perfilUser | null>(null);
    const [carregando, setCarregando] = useState(true);

    useEffect(() => {
        let cancelado = false;

        async function carregarPerfil() {
            setCarregando(true);

            const {
                data: { user },
                error: erroUsuario,
            } = await supabase.auth.getUser();

            if (erroUsuario || !user) {
                if (!cancelado) {
                    setProfile(null);
                    setCarregando(false);
                }

                return;
            }

            const { data, error } = await supabase
                .from("Usuario")
                .select("ID, Nome_Display, Nome_Usuario, Avatar_Url")
                .eq("ID", user.id)
                .maybeSingle();

            if (cancelado) return;

            if (error) {
                console.error("Erro ao buscar perfil:", error);

                setProfile({
                    Nome_Display:
                        user.user_metadata?.Nome_Display ?? null,

                    Nome_Usuario:
                        user.user_metadata?.Nome_Usuario ?? null,

                    Avatar_Url:
                        user.user_metadata?.Avatar_Url ?? null,
                });

                setCarregando(false);
                return;
            }

            setProfile({
                Nome_Display:
                    data?.Nome_Display ??
                    user.user_metadata?.Nome_Display ??
                    null,

                Nome_Usuario:
                    data?.Nome_Usuario ??
                    user.user_metadata?.Nome_Usuario ??
                    null,

                Avatar_Url:
                    data?.Avatar_Url ??
                    user.user_metadata?.Avatar_Url ??
                    null,
            });

            setCarregando(false);
        }

        void carregarPerfil();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(() => {
            void carregarPerfil();
        });

        return () => {
            cancelado = true;
            subscription.unsubscribe();
        };
    }, []);

    return {
        profile,
        carregando,
        avatarSrc: overrideAvatar ?? profile?.Avatar_Url ?? undefined,
    };
}



export function SidebarLeft({avatar}: SidebArvatarUrl) {
    const userSrc = useUserProfile(avatar);

    return (
        // corpo inteiro da sidebar
        <aside className="
            fixed
            z-10
            w-[230px]
            h-screen
            shrink-0
            box-border
            flex
            flex-col
            gap-[24px]
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
                <h2 className="
                    m-0
                    text-[32px]
                    tracking-[5px]
                    text-center
                    py-[20px]"
                >
                    ATHEN
                </h2>
            </section>

            {/* parte interna da sidebar */}
            <nav className="
                flex
                flex-col
                gap-[4px]
                pb-[16px]
                px-[16px]"
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
                className="block outline-none mt-auto mx-[10px]"
            >
                <div className="
                    group
                    flex
                    w-[80px]
                    h-[80px]
                    mb-[15px]
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-[22px]
                    bg-[#272742]
                    transition-colors
                    hover:bg-[#202036dd]"
                >
                    {userSrc
                        ?   <img 
                                src={userSrc.avatarSrc} 
                                alt="Foto de perfil" 
                                className="block w-full h-full aspect-square object-contain"
                            />
                        :   <span className="
                                text-[44px]
                                transition-opacity
                                group-hover:opacity-70"
                            >
                                🧑‍
                            </span>}
                </div>
            </Link>
        </aside>
    )
}