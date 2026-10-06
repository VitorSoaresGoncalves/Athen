import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import './SidebarLeft.css';

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
        <aside className='sidebarL'>
            <section className='titulo'>
                <h2>ATHEN</h2>
            </section>

            <nav className='nav-sidebar'>
                <Link
                    to={PROFILE_ROUTE}
                    aria-label="Ir para o perfil"
                    title="Meu perfil"
                    style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
                >
                    <div className='avatar'>
                        {avatarSrc
                            ? <img
                                src={avatarSrc}
                                alt="Foto de perfil"
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    height: '100%',
                                    aspectRatio: '1 / 1',
                                    objectFit: 'contain', // mostra a foto inteira, sem cortar
                                }}
                              />
                            : <span className='avatar-padrao'>🧑‍</span>}
                    </div>
                </Link>

                {itens.map((item) =>
                    item.to ? (
                        <NavLink
                            to={item.to}
                            className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}
                            key={item.text}
                        >
                            <span className="menu-icon">{item.icone}</span>
                            <span className='menu-text'>{item.text}</span>
                        </NavLink>
                    ) : (
                        <a href="#" className="menu-item" key={item.text}>
                            <span className="menu-icon">{item.icone}</span>
                            <span className='menu-text'>{item.text}</span>
                        </a>
                    )
                )}
            </nav>
        </aside>
    )
}