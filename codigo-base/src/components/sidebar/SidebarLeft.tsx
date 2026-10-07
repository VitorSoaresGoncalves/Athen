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
            gap-[24]
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
                {/* avatar do usuario */}
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
                    hover:bg-[#202036dd]"
                >
                        {avatar
                            ?   <img src={avatar} alt="Foto de perfil" />
                            :   <span className="
                                    text-[44px]
                                    transition-opacity
                                    group-hover:opacity-70"
                                >🧑‍</span>}
                </div>

                {/* itens do menu */}
                {itens.map((item) => (
                    <a href="#" type="button" className="
                        flex
                        items-center
                        gap-[12px]
                        w-full
                        px-[12px]
                        py-[12px]
                        bg-transparent
                        border-0
                        rounded-[8px]
                        text-[#a0a0b8]
                        text-left
                        cursor-pointer
                        hover:bg-[#22223a]
                        hover:text-white"
                    key={item.text}
                    >
                        <span className="text-[30px]">{item.icone}</span>
                        <span className="text-[20px]">{item.text}</span>
                    </a>
                ))}
            </nav>
        </aside>
    )
}