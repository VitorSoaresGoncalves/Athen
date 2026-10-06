// import './SidebarLeft.css';

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
        <aside className="
            fixed
            z-10
            w-[230px]
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
            <section className="border-[#b5b5eb2a] border-b">
                <h2  className="m-0 text-[32px] tracking-[5px] text-center pt-[20px] pb-[20px]">
                    ATHEN
                </h2>
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