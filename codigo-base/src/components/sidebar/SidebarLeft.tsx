import './SidebarLeft.css';
import { NavLink } from "react-router-dom";

type SidebarItem = {
    text: string;
    icone: string;
    to?: string; // sem "to" = página que ainda não existe
};

// TODO: confirmar as rotas com as do seu router
const itens: SidebarItem[] = [
    { text: "Meus Cursos", icone: "🦁 ", to: "/Cursos" },
    { text: "Pesquisa", icone: "🐘 " },
    { text: "Salas", icone: "🐼 ", to: "/salas" },
    { text: "Ligas", icone: "🦊 " },
    { text: "Config", icone: "🐧 " },
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

                    return item.to ? (
                        <NavLink
                            to={item.to}
                            key={item.text}
                            className={({ isActive }) => `menu-item${isActive ? " menu-item--ativo" : ""}`}
                        >
                            {conteudo}
                        </NavLink>
                    ) : (
                        <a href="#" className="menu-item" key={item.text}>{conteudo}</a>
                    );
                })}
            </nav>
        </aside>
    )
}