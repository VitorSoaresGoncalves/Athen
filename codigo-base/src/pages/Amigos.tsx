import { useState, type ReactNode } from "react";
import { SidebarLeft } from "../components/sidebar/SidebarLeft";

type Relacao = "amigo" | "enviado" | "recebido" | "nenhuma";
type Aba = "amigos" | "enviados" | "recebidos";

type Usuario = {
  id: number;
  nome: string; // displayName
  usuario: string; // username
  foto: string;
  banner: string;
  bannerCor?: string;
  nivel: number;
  xp: number;
  streakAtual: number;
  maiorStreak: number;
  streakConjunto?: number;
  cursos: string[];
  medalhas: string[];
  rel: Relacao; // relação inicial com você, usada apenas no mock
  quando?: string; // momento do pedido, usado apenas no mock
};

// Dados temporários para montar a interface enquanto as tabelas sociais não
// existem. No futuro, substituir por chamadas de usuários, amizades, pedidos
// e conquistas; a estrutura do componente pode continuar igual.
const medalhasCatalogo: Record<string, { icone: string; nome: string; descricao: string; cor: string }> = {
  chama: { icone: "🔥", nome: "Em chamas", descricao: "Estudou 30 dias seguidos.", cor: "#ffcc00" },
  coruja: { icone: "🦉", nome: "Coruja", descricao: "Concluiu uma aula depois da meia-noite.", cor: "#a486d5" },
  primeira: { icone: "🎓", nome: "Primeira aula", descricao: "Concluiu a primeira aula na plataforma.", cor: "#6fc3a8" },
  dupla: { icone: "🤝", nome: "Dupla dinâmica", descricao: "Fez uma streak conjunta de 10 dias.", cor: "#f08fb0" },
  biblioteca: { icone: "📚", nome: "Rato de biblioteca", descricao: "Estudou em 5 cursos diferentes.", cor: "#7fb3ff" },
  topo: { icone: "🏆", nome: "Top da semana", descricao: "Ficou entre os 3 que mais ganharam XP em uma semana.", cor: "#ffb25c" },
};

// Diretório visual com todos os usuários cadastrados.
// Futuramente, trocar por uma busca na API/banco com debounce, filtrando por
// displayName e username sem carregar todos os usuários de uma vez.
const diretorioMock: Usuario[] = [
  { id: 1, rel: "amigo", nome: "Raluca", usuario: "Raluca.m", foto: "https://i.pravatar.cc/160?img=47", banner: "", bannerCor: "#e8c9d8", nivel: 18, xp: 7420, streakAtual: 24, maiorStreak: 31, streakConjunto: 12, cursos: ["Inglês", "História", "UX Design"], medalhas: ["chama", "dupla", "primeira", "coruja"] },
  { id: 2, rel: "amigo", nome: "Ademar Bananilson", usuario: "ademarb", foto: "https://i.pravatar.cc/160?img=12", banner: "", bannerCor: "#c9dced", nivel: 24, xp: 10860, streakAtual: 8, maiorStreak: 42, cursos: ["Programação", "Matemática"], medalhas: ["topo", "primeira", "biblioteca"] },
  { id: 3, rel: "amigo", nome: "Stonia Farora", usuario: "stonia.farora", foto: "https://i.pravatar.cc/160?img=32", banner: "", bannerCor: "#d7d0ec", nivel: 12, xp: 4860, streakAtual: 0, maiorStreak: 19, cursos: ["Biologia", "Redação", "Inglês"], medalhas: ["primeira", "coruja"] },
  { id: 4, rel: "amigo", nome: "Celbit Nunes", usuario: "celbit.nunes", foto: "https://i.pravatar.cc/160?img=68", banner: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80", nivel: 31, xp: 16420, streakAtual: 56, maiorStreak: 56, streakConjunto: 28, cursos: ["Física", "Cálculo"], medalhas: ["chama", "topo", "dupla", "primeira", "coruja"] },
  { id: 5, rel: "amigo", nome: "Japa", usuario: "japa.a", foto: "https://i.pravatar.cc/160?img=25", banner: "https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=900&q=80", nivel: 9, xp: 2910, streakAtual: 3, maiorStreak: 14, cursos: ["Literatura", "Filosofia"], medalhas: ["primeira"] },
  { id: 6, rel: "amigo", nome: "Gustavo Rocha Lima", usuario: "gurocha", foto: "https://i.pravatar.cc/160?img=53", banner: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=80", nivel: 27, xp: 13280, streakAtual: 17, maiorStreak: 23, cursos: ["Geografia", "Programação", "Inglês"], medalhas: ["topo", "chama", "biblioteca", "primeira"] },
  { id: 101, rel: "recebido", quando: "há 2 horas", nome: "Hinata Hyuuga", usuario: "hinata.h", foto: "https://i.pravatar.cc/160?img=5", banner: "", bannerCor: "#cfe3d4", nivel: 15, xp: 6120, streakAtual: 9, maiorStreak: 20, cursos: ["Química", "Inglês"], medalhas: ["primeira", "coruja"] },
  { id: 102, rel: "recebido", quando: "ontem", nome: "Renato Cariane", usuario: "renacriana", foto: "https://i.pravatar.cc/160?img=15", banner: "", bannerCor: "#e9d9bd", nivel: 7, xp: 2140, streakAtual: 0, maiorStreak: 6, cursos: ["Matemática"], medalhas: ["primeira"] },
  { id: 103, rel: "enviado", quando: "há 3 dias", nome: "Larissa Prato", usuario: "lari.prato", foto: "https://i.pravatar.cc/160?img=44", banner: "", bannerCor: "#e3c9e8", nivel: 21, xp: 9050, streakAtual: 33, maiorStreak: 40, cursos: ["Redação", "História"], medalhas: ["chama", "primeira"] },
  { id: 104, rel: "enviado", quando: "há 1 semana", nome: "Peugeot 206 da Lacerda", usuario: "peugeotfudido", foto: "https://i.pravatar.cc/160?img=59", banner: "", bannerCor: "#c9d6ed", nivel: 5, xp: 1480, streakAtual: 2, maiorStreak: 5, cursos: ["Programação"], medalhas: ["primeira"] },
  { id: 201, rel: "nenhuma", nome: "John Cena", usuario: "john.c", foto: "https://i.pravatar.cc/160?img=1", banner: "", bannerCor: "#d9e5c9", nivel: 14, xp: 5600, streakAtual: 6, maiorStreak: 15, cursos: ["Biologia"], medalhas: ["primeira"] },
  { id: 202, rel: "nenhuma", nome: "Oscar Niemeyer", usuario: "oscarnie", foto: "https://i.pravatar.cc/160?img=33", banner: "", bannerCor: "#e8d2c9", nivel: 22, xp: 9800, streakAtual: 0, maiorStreak: 27, cursos: ["Física", "Programação"], medalhas: ["topo", "primeira"] },
  { id: 203, rel: "nenhuma", nome: "Bruna Marquezine", usuario: "bruna.mz", foto: "https://i.pravatar.cc/160?img=9", banner: "", bannerCor: "#c9e8e3", nivel: 19, xp: 7900, streakAtual: 12, maiorStreak: 21, cursos: ["Inglês", "Redação"], medalhas: ["coruja", "primeira"] },
];

const formatXp = (xp: number) => new Intl.NumberFormat("pt-BR").format(xp);

// Permite pesquisar sem diferenciar acentos ou letras maiúsculas.
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();

const botaoPrimario = "rounded-md bg-[#a486d5] px-3 py-1.5 text-xs font-bold text-[#171628] hover:bg-[#c9b8e8]";
const botaoSecundario = "rounded-md border border-[#a486d5]/30 px-3 py-1.5 text-xs font-bold text-[#d8c9f2] hover:bg-[#a486d5]/10";
const caixaVazia = "rounded-md border border-dashed border-[#a486d5]/35 bg-[#1d1a31]/70 px-6 py-14 text-center";

function MedalhaIcone({ id, tamanho = "sm", focavel = false }: { id: string; tamanho?: "sm" | "md"; focavel?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const medalha = medalhasCatalogo[id];
  if (!medalha) return null;

  return (
    <span className="relative inline-flex" onMouseEnter={() => setAberto(true)} onMouseLeave={() => setAberto(false)} onFocus={() => setAberto(true)} onBlur={() => setAberto(false)}>
      <span
        role="img"
        aria-label={`${medalha.nome}: ${medalha.descricao}`}
        tabIndex={focavel ? 0 : undefined}
        className={`inline-flex items-center justify-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-[#a486d5] ${tamanho === "md" ? "h-9 w-9 text-base" : "h-6 w-6 text-xs"}`}
        style={{ backgroundColor: `${medalha.cor}26`, borderColor: `${medalha.cor}66` }}
      >
        <span aria-hidden="true">{medalha.icone}</span>
      </span>
      {aberto && (
        <span role="tooltip" className={`pointer-events-none absolute bottom-full z-50 mb-2 block w-max max-w-[220px] rounded-md border border-[#a486d5]/30 bg-[#171628] px-3 py-2 text-left text-xs shadow-lg shadow-black/40 ${tamanho === "md" ? "left-1/2 -translate-x-1/2" : "left-0"}`}>
          <strong className="block text-[#f4eeff]">{medalha.nome}</strong>
          <span className="mt-0.5 block text-[#b8aacb]">{medalha.descricao}</span>
        </span>
      )}
    </span>
  );
}

// Linha reutilizada nos pedidos e nos resultados de busca.
// Foto e nome abrem o perfil; os botões variam conforme a relação.
function LinhaUsuario({ usuario, detalhe, destaque = false, onAbrir, children }: { usuario: Usuario; detalhe: string; destaque?: boolean; onAbrir: () => void; children: ReactNode }) {
  return (
    <li className={`flex items-center gap-3 rounded-md border-l-[3px] bg-[#1d1a31] py-2.5 pl-3 pr-3 ${destaque ? "border-l-[#ffcc00]" : "border-l-[#4a4260]"}`}>
      <button type="button" onClick={onAbrir} aria-label={`Ver perfil de ${usuario.nome}`} className="group flex min-w-0 flex-1 items-center gap-3 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a486d5]">
        <img src={usuario.foto} alt="" className="h-12 w-12 shrink-0 rounded-sm object-cover" />
        <span className="min-w-0 flex-1">
          <h3 className="break-words text-sm font-bold leading-snug text-[#f4eeff] group-hover:underline">{usuario.nome}</h3>
          <p className="break-all text-xs text-[#9f91b0]">{usuario.usuario}</p>
          <p className="mt-1 text-[11px] text-[#8f829f]">{detalhe}</p>
        </span>
      </button>
      <div className="flex shrink-0 flex-col gap-1.5">{children}</div>
    </li>
  );
}

const Vazio = ({ titulo, texto }: { titulo: string; texto: string }) => (
  <div className={caixaVazia}>
    <p className="font-display text-lg text-[#f4eeff]">{titulo}</p>
    <p className="mt-2 text-sm text-[#a99bbb]">{texto}</p>
  </div>
);

export default function Amigos() {
  // Uma única fonte de verdade para as relações locais.
  // No futuro, cada mudança deverá chamar a API de amizade correspondente.
  const [rel, setRel] = useState<Record<string, Relacao>>(() => Object.fromEntries(diretorioMock.map((u) => [u.id, u.rel])));
  const [aba, setAba] = useState<Aba>("amigos");
  const [search, setSearch] = useState("");
  const [perfilId, setPerfilId] = useState<number | null>(null);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [streaksIniciadas, setStreaksIniciadas] = useState<number[]>([]);
  const [cutucados, setCutucados] = useState<number[]>([]);

  const por = (r: Relacao) => diretorioMock.filter((u) => rel[u.id] === r);
  const [amigos, recebidos, enviados] = [por("amigo"), por("recebido"), por("enviado")];
  const listaPedidos = aba === "recebidos" ? recebidos : enviados;

  const perfilAberto = diretorioMock.find((u) => u.id === perfilId) ?? null;
  const ehAmigo = rel[perfilId ?? -1] === "amigo";

  const termo = normalizar(search.trim());
  const buscando = termo.length > 0;
  const resultados = buscando ? diretorioMock.filter((u) => normalizar(`${u.nome} ${u.usuario}`).includes(termo)) : [];

  const mudar = (id: number, nova: Relacao) => setRel((r) => ({ ...r, [id]: nova }));

  const fecharPerfil = () => {
    setConfirmandoRemocao(false);
    setPerfilId(null);
  };

  const acoes = (u: Usuario) =>
    ({
      amigo: null,
      nenhuma: <button type="button" onClick={() => mudar(u.id, "enviado")} className={botaoPrimario}>Adicionar</button>,
      enviado: <button type="button" onClick={() => mudar(u.id, "nenhuma")} className={botaoSecundario}>Cancelar pedido</button>,
      recebido: (
        <>
          <button type="button" onClick={() => mudar(u.id, "amigo")} className={botaoPrimario}>Aceitar</button>
          <button type="button" onClick={() => mudar(u.id, "nenhuma")} className={botaoSecundario}>Recusar</button>
        </>
      ),
    })[rel[u.id]];

  const abas: { id: Aba; label: string; total: number; destaque?: boolean }[] = [
    { id: "amigos", label: "Meus amigos", total: amigos.length },
    { id: "enviados", label: "Pedidos enviados", total: enviados.length },
    { id: "recebidos", label: "Pedidos recebidos", total: recebidos.length, destaque: recebidos.length > 0 },
  ];

  const vazio: Record<Aba, [string, string]> = {
    amigos: ["Você ainda não tem amigos", "Pesquise pelo nome ou usuário para encontrar pessoas."],
    enviados: ["Nenhum pedido enviado", "Os pedidos de amizade que você fizer aparecem aqui."],
    recebidos: ["Nenhum pedido recebido", "Quando alguém pedir sua amizade, o pedido aparece aqui."],
  };

  return (
    <div className="min-h-svh bg-[#141322] font-body text-[#f4eeff]">
      <SidebarLeft />

      <main className="min-h-svh pl-[230px]">
        <div className="mx-auto max-w-[1320px] px-6 pb-12 pt-8 min-[1440px]:px-10">
          <header>
            <h1 className="font-display text-3xl text-[#f4eeff] min-[1280px]:text-4xl">Amigos</h1>
            <p className="mt-2 text-sm text-[#b8aacb]">Sua lista de amigos</p>
          </header>

          {/* Seletor + busca na mesma linha */}
          <div className="mt-6 flex flex-col gap-3 min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:justify-between">
            <div role="tablist" aria-label="Seções de amigos" className="flex w-full gap-1 overflow-x-auto rounded-md border border-[#a486d5]/20 bg-[#1d1a31] p-1 min-[1100px]:w-auto">
              {abas.map((item) => {
                const ativa = !buscando && aba === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={ativa}
                    onClick={() => {
                      setSearch("");
                      setAba(item.id);
                    }}
                    className={`flex shrink-0 items-center gap-2 rounded px-3 py-2 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a486d5] ${
                      ativa ? "bg-[#a486d5] text-[#171628]" : "text-[#b8aacb] hover:bg-[#a486d5]/10 hover:text-[#f4eeff]"
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className={`rounded-sm px-1.5 py-0.5 text-[11px] ${ativa ? "bg-[#171628]/20 text-[#171628]" : item.destaque ? "bg-[#ffcc00] text-[#171628]" : "bg-[#a486d5]/15 text-[#d8c9f2]"}`}>
                      {item.total}
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="relative block w-full min-[1100px]:max-w-[360px]" htmlFor="friends-search">
              <span className="sr-only">Pesquisar usuários cadastrados</span>
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-xl text-[#a486d5]" aria-hidden="true">⌕</span>
              <input
                id="friends-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar usuários por nome ou usuário"
                className="w-full rounded-md border border-[#a486d5]/30 bg-[#1d1a31] px-11 py-2.5 text-sm text-[#f4eeff] outline-none transition placeholder:text-[#8f829f] focus:border-[#a486d5] focus:ring-2 focus:ring-[#a486d5]/25"
              />
            </label>
          </div>

          <div className="mt-6">
            {/* Resultados da busca: todos os usuários cadastrados */}
            {buscando && (
              <section aria-label="Resultados da busca">
                <p className="mb-3 text-xs text-[#9f91b0]">
                  {resultados.length} {resultados.length === 1 ? "usuário encontrado" : "usuários encontrados"}
                </p>

                {resultados.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-2 min-[900px]:grid-cols-2 min-[1280px]:grid-cols-3">
                    {resultados.map((u) => {
                      const rotulo = { amigo: " · Amigo", enviado: " · Pedido enviado", recebido: " · Quer ser seu amigo", nenhuma: "" }[rel[u.id]];
                      return (
                        <LinhaUsuario key={u.id} usuario={u} onAbrir={() => setPerfilId(u.id)} destaque={rel[u.id] === "recebido"} detalhe={`Nv. ${u.nivel}${rotulo}`}>
                          {acoes(u)}
                        </LinhaUsuario>
                      );
                    })}
                  </ul>
                ) : (
                  <Vazio titulo="Nenhum usuário encontrado" texto="Confira se o nome ou usuário está correto." />
                )}
              </section>
            )}

            {/* Meus amigos */}
            {!buscando && aba === "amigos" && (
              <ul className="grid grid-cols-1 gap-2 min-[900px]:grid-cols-2 min-[1280px]:grid-cols-3">
                {amigos.map((amigo) => {
                  const ativa = amigo.streakAtual > 0;
                  return (
                    <li key={amigo.id}>
                      <button
                        type="button"
                        onClick={() => setPerfilId(amigo.id)}
                        className={`flex h-full w-full items-center gap-3 rounded-md border-l-[3px] bg-[#1d1a31] py-2.5 pl-3 pr-3 text-left transition hover:bg-[#28223f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a486d5] ${ativa ? "border-l-[#ffcc00]" : "border-l-[#4a4260]"}`}
                      >
                        <img src={amigo.foto} alt="" className="h-12 w-12 shrink-0 rounded-sm object-cover" />
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-sm font-bold leading-snug text-[#f4eeff]">{amigo.nome}</h3>
                          <p className="break-all text-xs text-[#9f91b0]">{amigo.usuario}</p>
                          <div className="mt-1.5 flex gap-1">
                            {amigo.medalhas.slice(0, 3).map((id) => <MedalhaIcone key={id} id={id} />)}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="rounded-sm bg-[#54318c]/60 px-1.5 py-0.5 text-[11px] font-bold text-[#e6dafa]">Nv. {amigo.nivel}</span>
                          <span className={`text-xs font-bold ${ativa ? "text-[#ffcc00]" : "text-[#918b9a]"}`} title={ativa ? "Streak atual" : "Maior streak"}>
                            {ativa ? "🔥" : "❄"} {ativa ? amigo.streakAtual : amigo.maiorStreak}d
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Pedidos recebidos e enviados */}
            {!buscando && aba !== "amigos" && (
              <ul className="grid grid-cols-1 gap-2 min-[900px]:grid-cols-2">
                {listaPedidos.map((u) => (
                  <LinhaUsuario key={u.id} usuario={u} onAbrir={() => setPerfilId(u.id)} destaque={aba === "recebidos"} detalhe={`Nv. ${u.nivel} · ${aba === "recebidos" ? "pediu" : "enviado"} ${u.quando ?? "agora"}`}>
                    {acoes(u)}
                  </LinhaUsuario>
                ))}
              </ul>
            )}

            {!buscando && (aba === "amigos" ? amigos : listaPedidos).length === 0 && <Vazio titulo={vazio[aba][0]} texto={vazio[aba][1]} />}
          </div>
        </div>

        {/* Perfil. Itens de amigo só aparecem para amigos. */}
        {perfilAberto && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-[#080711]/75 px-5 py-6 backdrop-blur-sm"
            role="presentation"
            onMouseDown={(event) => event.target === event.currentTarget && fecharPerfil()}
          >
            <section className="w-full max-w-[500px] rounded-xl border border-[#a486d5]/35 bg-[#211d37] shadow-2xl shadow-black/50" role="dialog" aria-modal="true" aria-labelledby="friend-profile-title">
              <div
                className="relative h-20 overflow-hidden rounded-t-xl bg-cover bg-center"
                style={perfilAberto.bannerCor ? { backgroundColor: perfilAberto.bannerCor } : { backgroundImage: `url(${perfilAberto.banner})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-[#211d37] to-transparent" />
                <button type="button" onClick={fecharPerfil} className="absolute right-3 top-3 rounded-lg bg-[#171628]/70 px-2.5 py-0.5 text-lg text-[#f4eeff] hover:bg-[#171628]" aria-label="Fechar perfil">×</button>
              </div>

              <div className="relative z-10 px-5 pb-5">
                <div className="relative z-20 -mt-6 flex items-end gap-3">
                  <img src={perfilAberto.foto} alt={`Foto de ${perfilAberto.nome}`} className="h-16 w-16 shrink-0 rounded-md border-4 border-[#211d37] bg-[#33294a] object-cover" />
                  <div className="min-w-0 pb-0.5">
                    <h2 id="friend-profile-title" className="break-words text-lg font-bold leading-tight text-[#f4eeff]">{perfilAberto.nome}</h2>
                    <p className="break-all text-xs text-[#a99bbb]">{perfilAberto.usuario}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 min-[460px]:grid-cols-4">
                  {[
                    ["Nível", perfilAberto.nivel, "text-[#e6dafa]"],
                    ["XP", formatXp(perfilAberto.xp), "text-[#d8c9f2]"],
                    ["Streak atual", `${perfilAberto.streakAtual} dias`, "text-[#ffcc00]"],
                    ["Maior streak", `${perfilAberto.maiorStreak} dias`, "text-[#918b9a]"],
                  ].map(([label, valor, cor]) => (
                    <div key={label} className="rounded-lg bg-[#171628] px-3 py-2">
                      <p className="text-[11px] text-[#9f91b0]">{label}</p>
                      <strong className={`block text-base ${cor}`}>{valor}</strong>
                    </div>
                  ))}
                </div>

                {perfilAberto.medalhas.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <h3 className="text-sm font-bold text-[#f4eeff]">Conquistas</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {perfilAberto.medalhas.map((id) => <MedalhaIcone key={id} id={id} tamanho="md" focavel />)}
                    </div>
                  </div>
                )}

                {ehAmigo && (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[#a486d5]/20 bg-[#2a2342] px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-[#f4eeff]">Streak conjunto</p>
                      <p className="text-xs text-[#c8bdd5]">Estudem juntos todos os dias.</p>
                    </div>
                    {perfilAberto.streakConjunto || streaksIniciadas.includes(perfilAberto.id) ? (
                      <strong className="text-lg text-[#ffcc00]">🔥 {perfilAberto.streakConjunto ?? 0}</strong>
                    ) : (
                      <button type="button" onClick={() => setStreaksIniciadas((c) => [...c, perfilAberto.id])} className={`shrink-0 ${botaoPrimario}`}>Fazer streak juntos</button>
                    )}
                  </div>
                )}

                <div className="mt-4">
                  <h3 className="text-sm font-bold text-[#f4eeff]">Cursos que {perfilAberto.nome} faz</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {perfilAberto.cursos.map((curso) => (
                      <span key={curso} className="rounded-md border border-[#a486d5]/25 bg-[#171628] px-2.5 py-1 text-xs text-[#d8c9f2]">{curso}</span>
                    ))}
                  </div>
                </div>

                {ehAmigo && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCutucados((c) => (c.includes(perfilAberto.id) ? c : [...c, perfilAberto.id]))}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-[#a486d5]/50 bg-[#a486d5]/10 px-4 py-2.5 text-sm font-bold text-[#d8c9f2] transition hover:bg-[#a486d5]/20"
                    >
                      <span className="text-lg" aria-hidden="true">{cutucados.includes(perfilAberto.id) ? "😁" : "👆"}</span>
                      <span>{cutucados.includes(perfilAberto.id) ? "Amigo incomodado!" : "Lembrar de fazer uma aula"}</span>
                    </button>

                    <div className="mt-4 border-t border-[#a486d5]/15 pt-3">
                      {confirmandoRemocao ? (
                        <div className="flex flex-col gap-3 min-[460px]:flex-row min-[460px]:items-center min-[460px]:justify-between">
                          <p className="text-sm text-[#e8b4b4]">Remover {perfilAberto.nome} dos seus amigos?</p>
                          <div className="flex shrink-0 gap-2">
                            <button type="button" onClick={() => setConfirmandoRemocao(false)} className={botaoSecundario}>Cancelar</button>
                            <button
                              type="button"
                              onClick={() => {
                                mudar(perfilAberto.id, "nenhuma");
                                fecharPerfil();
                              }}
                              className="rounded-md bg-[#c2455a] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#d4566b]"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmandoRemocao(true)} className="w-full rounded-lg border border-[#c2455a]/50 bg-[#c2455a]/10 px-4 py-2.5 text-sm font-bold text-[#e8909e] transition hover:bg-[#c2455a]/20">
                          Remover amigo
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}