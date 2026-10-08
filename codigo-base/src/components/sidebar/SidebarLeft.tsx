import { NavLink } from 'react-router-dom';
import './SidebarLeft.css';


type SidebarItem = {
    text: string;
    icone: string;
    to?: string; // rota da página; sem "to", o item continua apontando para "#"
}

// TODO: confirmar as rotas com as do seu router
const itens: SidebarItem[] = [
    {
        text: "Meus Cursos",
        icone: "🦁 ",
    },
    {
        text: "Pesquisa",
        icone: "🐘 ",
    },
    {
        text: "Salas",
        icone: "🐼 ",
        to: "/salas",
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

export function SidebarLeft({ avatar }: avatarUrl) {
    return (
        <aside className='sidebarL'>
            <section className='titulo'>
                <h2>ATHEN</h2>
            </section>

            <nav className='nav-sidebar'>
                <div className='avatar'>
                    {avatar
                        ? <img src={avatar} alt="Foto de perfil" />
                        : <span className='avatar-padrao'>🧑‍</span>}
                </div>

                {itens.map((item) => {
                    const conteudo = (
                        <>
                            <span className="menu-icon">{item.icone}</span>
                            <span className='menu-text'>{item.text}</span>
                        </>
                    );

                    // Itens com rota viram link de verdade e ganham destaque na página atual.
                    return item.to ? (
                        <NavLink
                            to={item.to}
                            key={item.text}
                            className={({ isActive }) => isActive ? 'menu-item menu-item--ativo' : 'menu-item'}
                        >
                            {conteudo}
                        </NavLink>
                    ) : (
                        <a href="#" className="menu-item" key={item.text}>
                            {conteudo}
                        </a>
                    );
                })}
            </nav>
        </aside>
    )
}