import './SidebarLeft.css';

type SidebarItem = {
    text: string;
    icone: string;
}


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
        <aside>
            <section className='titulo'>
                <h2>ATHEN</h2>
            </section>

            <nav className='nav-sidebar'>
                <div className='avatar'>
                        {avatar
                            ? <img src={avatar} alt="Foto de perfil" />
                            : <span className='avatar-padrao'>🧑‍</span>}
                </div>

                {itens.map((item) => (
                    <a href="#" className="menu-item" key={item.text}>
                        <span className="menu-icon">{item.icone}</span>
                        <span className='menu-text'>{item.text}</span>
                    </a>
                ))}
            </nav>
        </aside>
    )
}