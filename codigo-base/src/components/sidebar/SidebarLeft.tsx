import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// Rotas usadas pela sidebar. Ajuste aqui se no seu router forem diferentes.
const PROFILE_ROUTE = '/Profile';
const DASHBOARD_ROUTE = '/dashboard';

type SidebarItem = {
    text: string;
    icone: string;
    to?: string; // sem "to" = ainda não tem página (mantém href="#")
}

const itens: SidebarItem[] = [
    {
        text: "Meus Cursos",
        icone: "🦁 ",
        to: DASHBOARD_ROUTE,
    },
    {
        text: "Pesquisa",
        icone: "🐘 ",
    },
    {
        text: "Salas",
        icone: "🐼 ",
    },
    {
        text: "Ligas",
        icone: "🦊 ",
    },
    {
        text: "Config",
        icone: "🐧 ",
    }
];

type avatarUrl = {
    /** Opcional: se não for passada, a sidebar busca a foto do usuário logado sozinha. */
    avatar?: string;
}

/**
 * Foto do usuário logado (user_metadata.avatar_url).
 * Atualiza sozinha quando o perfil é salvo (evento USER_UPDATED do Supabase Auth).
 */
function useUserAvatar(override?: string) {
    const [url, setUrl] = useState<string | undefined>();

    useEffect(() => {
        let cancelled = false;

        void supabase.auth.getUser().then(({ data }) => {
            if (!cancelled) setUrl(data.user?.user_metadata?.avatar_url || undefined);
        });

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUrl(session?.user?.user_metadata?.avatar_url || undefined);
        });

        return () => {
            cancelled = true;
            listener.subscription.unsubscribe();
        };
    }, []);

    return override ?? url;
}

export function SidebarLeft({avatar}: avatarUrl) {
    const avatarSrc = useUserAvatar(avatar);

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
                {/* Link para o perfil e avatar do usuário */}
                <Link
                    to={PROFILE_ROUTE}
                    aria-label="Ir para o perfil"
                    title="Meu perfil"
                    className="block outline-none"
                >
                    <div className="
                        group
                        mb-[3vh]
                        mt-[2vh]
                        flex
                        h-[96px]
                        items-center
                        justify-center
                        overflow-hidden
                        rounded-[22px]
                        bg-[#272742]
                        transition-colors
                        hover:bg-[#202036dd]"
                    >
                            {avatarSrc
                                ?   <img 
                                        src={avatarSrc} 
                                        alt="Foto de perfil" 
                                        className="block w-full h-full aspect-square object-contain"
                                    />
                                :   <span className="
                                        text-[44px]
                                        transition-opacity
                                        group-hover:opacity-70"
                                    >🧑‍</span>}
                    </div>
                </Link>

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
                            <span className="text-[30px]">{item.icone}</span>
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
                            <span className="text-[30px]">{item.icone}</span>
                            <span className="text-[20px]">{item.text}</span>
                        </a>
                    );
                })}
            </nav>
        </aside>
    )
}