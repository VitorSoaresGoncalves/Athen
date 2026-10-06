import { Link, NavLink } from 'react-router-dom';
import './SidebarLeft.css';

// Rotas usadas pela sidebar. Ajuste aqui se no seu router forem diferentes.
const PROFILE_ROUTE = '/profile';
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
    avatar?: string;
}

export function SidebarLeft({avatar}: avatarUrl) {
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
                        {avatar
                            ? <img src={avatar} alt="Foto de perfil" />
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