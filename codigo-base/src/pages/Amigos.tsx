import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { SidebarLeft } from "../components/sidebar/SidebarLeft";
import { amizadeRepository, medalhaRepository, medalhaUsuarioRepository, usuarioRepository } from "../data/repositories";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type Perfil = Database["public"]["Tables"]["profiles"]["Row"];
type Amizade = Database["public"]["Tables"]["friendships"]["Row"];
type Relacao = "amigo" | "enviado" | "recebido" | "nenhuma";
type Aba = "amigos" | "enviados" | "recebidos";

// O mínimo para desenhar uma linha/card. Vem de "profiles" (amigos e pedidos) ou da busca (search_profiles).
type Pessoa = {
  id: string;
  nome: string; // display_name
  usuario: string; // username
  foto: string | null;
  nivel: number;
};
type MedalhaInfo = { icone: string; nome: string; descricao: string; cor: string };
// Dados carregados ao abrir um perfil (o card da lista não precisa disso).
type Detalhe = { id: string; perfil: Perfil | null; medalhas: string[]; cursos: string[] };
type ResultadoBusca = { termo: string; itens: Pessoa[]; erro: string };

// O catálogo (nome, descrição e ícone) vem da tabela "medals". Só a cor é daqui, porque o banco não guarda cor.
const CORES_MEDALHAS: Record<string, string> = {
  first_lesson: "#6fc3a8",
  on_fire: "#ffcc00",
  bookworm: "#7fb3ff",
  owl: "#a486d5",
};
const COR_MEDALHA_PADRAO = "#a486d5";

const formatXp = (xp: number) => new Intl.NumberFormat("pt-BR").format(xp);

/* Data local de hoje/ontem no formato YYYY-MM-DD */
function localDay(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString("sv-SE");
}

// profiles.streak_count só é zerado quando a pessoa volta a estudar. Se o último dia de estudo
// não foi hoje nem ontem, a sequência já acabou.
function streakAtual(perfil: Perfil) {
  const viva = perfil.last_study_date === localDay() || perfil.last_study_date === localDay(-1);
  return viva ? perfil.streak_count : 0;
}

function tempoRelativo(iso: string) {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} ${horas === 1 ? "hora" : "horas"}`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  if (dias < 30) {
    const semanas = Math.floor(dias / 7);
    return `há ${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
  }
  const meses = Math.floor(dias / 30);
  return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

const perfilParaPessoa = (perfil: Perfil): Pessoa => ({
  id: perfil.id,
  nome: perfil.display_name,
  usuario: perfil.username,
  foto: perfil.avatar_url,
  nivel: perfil.level,
});

const botaoPrimario = "rounded-md bg-[#a486d5] px-3 py-1.5 text-xs font-bold text-[#171628] hover:bg-[#c9b8e8] disabled:cursor-wait disabled:opacity-60";
const botaoSecundario = "rounded-md border border-[#a486d5]/30 px-3 py-1.5 text-xs font-bold text-[#d8c9f2] hover:bg-[#a486d5]/10 disabled:cursor-wait disabled:opacity-60";
const caixaVazia = "rounded-md border border-dashed border-[#a486d5]/35 bg-[#1d1a31]/70 px-6 py-14 text-center";

// Foto do usuário. Sem foto, usa um ícone neutro de pessoa.
function Foto({ src, alt = "", className }: { src: string | null; alt?: string; className: string }) {
  if (src) return <img src={src} alt={alt} className={`${className} object-cover`} />;
  return <span aria-hidden="true" className={`${className} flex items-center justify-center bg-[#33294a] leading-none`}>👤</span>;
}

function MedalhaIcone({ medalha, tamanho = "sm", focavel = false }: { medalha: MedalhaInfo | undefined; tamanho?: "sm" | "md"; focavel?: boolean }) {
  const [aberto, setAberto] = useState(false);
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
function LinhaUsuario({ usuario, detalhe, destaque = false, onAbrir, children }: { usuario: Pessoa; detalhe: string; destaque?: boolean; onAbrir: () => void; children: ReactNode }) {
  return (
    <li className={`flex items-center gap-3 rounded-md border-l-[3px] bg-[#1d1a31] py-2.5 pl-3 pr-3 ${destaque ? "border-l-[#ffcc00]" : "border-l-[#4a4260]"}`}>
      <button type="button" onClick={onAbrir} aria-label={`Ver perfil de ${usuario.nome}`} className="group flex min-w-0 flex-1 items-center gap-3 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a486d5]">
        <Foto src={usuario.foto} className="h-12 w-12 shrink-0 rounded-sm text-2xl" />
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

const Vazio = ({ titulo, texto, children }: { titulo: string; texto?: string; children?: ReactNode }) => (
  <div className={caixaVazia}>
    <p className="font-display text-lg text-[#f4eeff]">{titulo}</p>
    {texto && <p className="mt-2 text-sm text-[#a99bbb]">{texto}</p>}
    {children}
  </div>
);

// Bio do perfil. Mostra 2 linhas por padrão; se houver mais, "ver mais" expande o texto todo.
// O estado é resetado a cada perfil porque o pai passa key={perfilId} (remonta o componente).
function Bio({ texto }: { texto: string }) {
  const [expandido, setExpandido] = useState(false);
  const [truncado, setTruncado] = useState(false);
  const ref = useRef<HTMLParagraphElement | null>(null);

  // Só oferece "ver mais" quando o texto realmente passa de 2 linhas (scrollHeight > clientHeight).
  useEffect(() => {
    const el = ref.current;
    if (el) setTruncado(el.scrollHeight - el.clientHeight > 1);
  }, []);

  return (
    <div className="mt-3">
      <p
        ref={ref}
        className={`whitespace-pre-line break-words text-sm leading-relaxed text-[#b8aacb] ${expandido ? "" : "line-clamp-2"}`}
      >
        {texto}
      </p>
      {truncado && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="mt-1 rounded text-xs font-bold text-[#a486d5] hover:text-[#c9b8e8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a486d5]"
        >
          {expandido ? "ver menos" : "ver mais"}
        </button>
      )}
    </div>
  );
}

export default function Amigos() {
  // Quem está logado e as amizades dele. "amizades" já vem filtrada: o administrador enxerga todas pela RLS.
  const [meId, setMeId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState("");
  const [amizades, setAmizades] = useState<Amizade[]>([]);
  const [perfis, setPerfis] = useState<Record<string, Perfil>>({});
  const [catalogo, setCatalogo] = useState<Record<string, MedalhaInfo>>({});
  const [medalhasDestaque, setMedalhasDestaque] = useState<Record<string, string[]>>({});

  const [aba, setAba] = useState<Aba>("amigos");
  const [search, setSearch] = useState("");
  const [busca, setBusca] = useState<ResultadoBusca | null>(null);
  const [perfilAberto, setPerfilAberto] = useState<Pessoa | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [cutucados, setCutucados] = useState<string[]>([]);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState("");
  const erroTimer = useRef<number | undefined>(undefined);

  // Busca amizades, perfis das pessoas envolvidas, catálogo de medalhas e as medalhas em destaque dos amigos.
  const carregar = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const usuario = userData.user;
      if (!usuario) {
        setMeId(null);
        return;
      }

      const todas = await amizadeRepository.listar();
      const minhas = todas.filter((item) => item.requester_id === usuario.id || item.addressee_id === usuario.id);
      const outroLado = (item: Amizade) => (item.requester_id === usuario.id ? item.addressee_id : item.requester_id);

      const idsAmigos = minhas.filter((item) => item.status === "accepted").map(outroLado);
      const idsPedidos = minhas.filter((item) => item.status === "pending").map(outroLado);
      const idsPerfis = [...new Set([...idsAmigos, ...idsPedidos])];

      // Uma consulta para todos os perfis e uma para todas as medalhas em destaque,
      // não importa quantos amigos a pessoa tenha.
      const [lista, destaques, medalhas] = await Promise.all([
        usuarioRepository.listarPorIds(idsPerfis),
        medalhaUsuarioRepository.listarEmDestaquePorUsuarios(idsAmigos),
        medalhaRepository.listar(),
      ]);

      const porUsuario: Record<string, string[]> = {};
      for (const destaque of destaques) (porUsuario[destaque.user_id] ??= []).push(destaque.medal_code);

      setMeId(usuario.id);
      setAmizades(minhas);
      setPerfis(Object.fromEntries(lista.map((perfil) => [perfil.id, perfil])));
      setMedalhasDestaque(porUsuario);
      setCatalogo(
        Object.fromEntries(
          medalhas.map((medalha) => [
            medalha.code,
            { icone: medalha.icon ?? "🏅", nome: medalha.name, descricao: medalha.description, cor: CORES_MEDALHAS[medalha.code] ?? COR_MEDALHA_PADRAO },
          ]),
        ),
      );
      setErroCarga("");
    } catch (error) {
      setErroCarga(error instanceof Error ? error.message : "Não foi possível carregar seus amigos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  // O setTimeout evita setState síncrono no corpo do effect (mesmo padrão do CursoNotebook).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void carregar();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [carregar]);

  useEffect(() => () => window.clearTimeout(erroTimer.current), []);

  // Busca em todos os usuários cadastrados (função search_profiles), com debounce para não consultar a cada tecla.
  const termo = search.trim();
  const buscando = termo.length >= 2;
  useEffect(() => {
    if (termo.length < 2) return;

    let cancelado = false;
    const timer = window.setTimeout(async () => {
      try {
        const encontrados = await usuarioRepository.buscar(termo);
        if (cancelado) return;
        setBusca({
          termo,
          erro: "",
          itens: encontrados.map((item) => ({ id: item.id, nome: item.display_name, usuario: item.username, foto: item.avatar_url || null, nivel: item.level })),
        });
      } catch (error) {
        if (!cancelado) setBusca({ termo, itens: [], erro: error instanceof Error ? error.message : "Não foi possível pesquisar agora." });
      }
    }, 300);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [termo]);

  // Ao abrir um perfil, carrega XP/streak/banner, as conquistas em destaque e os cursos (só amigos).
  const perfilId = perfilAberto?.id;
  useEffect(() => {
    if (!perfilId) return;

    let cancelado = false;
    async function carregarDetalhe(id: string) {
      const [perfil, destaques] = await Promise.all([
        usuarioRepository.obterPorId(id),
        medalhaUsuarioRepository.listarEmDestaque(id).catch(() => []),
      ]);

      // TODO (cursos do amigo): precisa da função friend_courses no banco e do
      // método matriculaRepository.listarCursosDoAmigo. Quando existirem, descomentar aqui e na seção
      // "Cursos que ... faz" mais abaixo, e trocar "cursos: []" por "cursos: cursos.map((curso) => curso.title)".
      // const cursos = await matriculaRepository.listarCursosDoAmigo(id).catch(() => []);

      if (!cancelado) setDetalhe({ id, perfil, medalhas: destaques.map((item) => item.medal_code), cursos: [] });
    }

    void carregarDetalhe(perfilId);
    return () => {
      cancelado = true;
    };
  }, [perfilId]);

  // Relação de cada pessoa com você. Pedidos recusados/cancelados ficam em "antigas": o par é único no banco,
  // então um novo pedido precisa apagar o registro antigo antes.
  const relacoes = new Map<string, { relacao: Relacao; amizade: Amizade }>();
  const antigas = new Map<string, Amizade>();
  for (const item of amizades) {
    const outro = item.requester_id === meId ? item.addressee_id : item.requester_id;
    if (item.status === "accepted") relacoes.set(outro, { relacao: "amigo", amizade: item });
    else if (item.status === "pending") relacoes.set(outro, { relacao: item.requester_id === meId ? "enviado" : "recebido", amizade: item });
    else antigas.set(outro, item);
  }
  const relacaoDe = (id: string): Relacao => relacoes.get(id)?.relacao ?? "nenhuma";

  const por = (relacao: Relacao) =>
    [...relacoes]
      .filter(([, valor]) => valor.relacao === relacao)
      .flatMap(([id, valor]) => (perfis[id] ? [{ pessoa: perfilParaPessoa(perfis[id]), perfil: perfis[id], amizade: valor.amizade }] : []));
  const amigos = por("amigo").sort((a, b) => a.pessoa.nome.localeCompare(b.pessoa.nome, "pt-BR", { sensitivity: "base" }));
  const recebidos = por("recebido");
  const enviados = por("enviado");
  const listaPedidos = aba === "recebidos" ? recebidos : enviados;

  const resultadoBusca = busca && busca.termo === termo ? busca : null;
  const detalheAberto = detalhe && detalhe.id === perfilId ? detalhe : null;
  const ehAmigo = perfilAberto ? relacaoDe(perfilAberto.id) === "amigo" : false;

  const fecharPerfil = () => {
    setConfirmandoRemocao(false);
    setPerfilAberto(null);
  };

  // Executa uma ação no banco e recarrega tudo no fim, para a tela sempre refletir o que está salvo.
  async function executar(id: string, acao: () => Promise<unknown>) {
    setOcupadoId(id);
    setErroAcao("");
    window.clearTimeout(erroTimer.current);

    try {
      await acao();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
      erroTimer.current = window.setTimeout(() => setErroAcao(""), 6000);
    } finally {
      await carregar();
      setOcupadoId(null);
    }
  }

  const adicionar = (id: string) =>
    executar(id, async () => {
      const antiga = antigas.get(id);
      if (antiga) await amizadeRepository.deletar(antiga.id);
      await amizadeRepository.enviarPedido(id);
    });
  const cancelarPedido = (id: string) => executar(id, () => amizadeRepository.cancelar(relacoes.get(id)!.amizade.id));
  const responder = (id: string, status: "accepted" | "declined") => executar(id, () => amizadeRepository.responder(relacoes.get(id)!.amizade.id, status));
  const removerAmigo = (id: string) => executar(id, () => amizadeRepository.deletar(relacoes.get(id)!.amizade.id));

  async function cutucar(id: string) {
    await executar(id, async () => {
      await amizadeRepository.enviarLembreteEstudo(id);
      setCutucados((atuais) => (atuais.includes(id) ? atuais : [...atuais, id]));
    });
  }

  const acoes = (u: Pessoa) => {
    const ocupado = ocupadoId === u.id;
    return {
      amigo: null,
      nenhuma: <button type="button" disabled={ocupado} onClick={() => void adicionar(u.id)} className={botaoPrimario}>Adicionar</button>,
      enviado: <button type="button" disabled={ocupado} onClick={() => void cancelarPedido(u.id)} className={botaoSecundario}>Cancelar pedido</button>,
      recebido: (
        <>
          <button type="button" disabled={ocupado} onClick={() => void responder(u.id, "accepted")} className={botaoPrimario}>Aceitar</button>
          <button type="button" disabled={ocupado} onClick={() => void responder(u.id, "declined")} className={botaoSecundario}>Recusar</button>
        </>
      ),
    }[relacaoDe(u.id)];
  };

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
    <div className="min-h-svh bg-[#140a2b] font-body text-[#f4eeff]">
      <SidebarLeft />

      <main className="relative isolate min-h-svh pl-[230px]">
        <div className="pointer-events-none fixed -right-[120px] -top-[200px] -z-10 h-[560px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(120,63,220,0.2),rgba(20,10,43,0)_68%)]" />

        <div className="mx-auto max-w-[1320px] px-[56px] pb-[48px] pt-[42px]">
          <header className="mb-[32px]">
            <p className="mb-[10px] text-[10px] font-bold uppercase tracking-[1.4px] text-[#c9b8e8]/50">PLATAFORMA / <span className="text-[#ffcc00]">AMIGOS</span></p>
            <h1 className="font-display text-[36px] leading-[1.05] tracking-[-0.8px] text-[#f4eeff] min-[760px]:text-[46px]">Amigos</h1>
            <p className="mt-[9px] text-[14px] text-[#b8aacb]">Encontre pessoas e acompanhe sua rede de estudos.</p>
          </header>

          {carregando ? (
            <div className="mt-6"><Vazio titulo="Carregando seus amigos..." /></div>
          ) : !meId ? (
            <div className="mt-6">
              <Vazio titulo="Entre na sua conta" texto="Você precisa estar logado para ver e adicionar amigos.">
                <Link to="/login-page" className={`mt-4 inline-block ${botaoPrimario}`}>Entrar</Link>
              </Vazio>
            </div>
          ) : erroCarga ? (
            <div className="mt-6">
              <Vazio titulo="Não foi possível carregar seus amigos" texto={erroCarga}>
                <button type="button" onClick={() => void carregar()} className={`mt-4 ${botaoPrimario}`}>Tentar de novo</button>
              </Vazio>
            </div>
          ) : (
            <>
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

              {erroAcao && (
                <p role="alert" className="mt-4 rounded-md border border-[#c2455a]/50 bg-[#c2455a]/10 px-4 py-2.5 text-sm text-[#e8b4b4]">{erroAcao}</p>
              )}

              <div className="mt-6">
                {/* Resultados da busca: todos os usuários cadastrados */}
                {buscando && (
                  <section aria-label="Resultados da busca">
                    {!resultadoBusca ? (
                      <p className="mb-3 text-xs text-[#9f91b0]">Buscando...</p>
                    ) : resultadoBusca.erro ? (
                      <Vazio titulo="Não foi possível pesquisar" texto={resultadoBusca.erro} />
                    ) : (
                      <>
                        <p className="mb-3 text-xs text-[#9f91b0]">
                          {resultadoBusca.itens.length} {resultadoBusca.itens.length === 1 ? "usuário encontrado" : "usuários encontrados"}
                        </p>

                        {resultadoBusca.itens.length > 0 ? (
                          <ul className="grid grid-cols-1 gap-2 min-[900px]:grid-cols-2 min-[1280px]:grid-cols-3">
                            {resultadoBusca.itens.map((u) => {
                              const relacao = relacaoDe(u.id);
                              const rotulo = { amigo: " · Amigo", enviado: " · Pedido enviado", recebido: " · Quer ser seu amigo", nenhuma: "" }[relacao];
                              return (
                                <LinhaUsuario key={u.id} usuario={u} onAbrir={() => setPerfilAberto(u)} destaque={relacao === "recebido"} detalhe={`Nv. ${u.nivel}${rotulo}`}>
                                  {acoes(u)}
                                </LinhaUsuario>
                              );
                            })}
                          </ul>
                        ) : (
                          <Vazio titulo="Nenhum usuário encontrado" texto="Confira se o nome ou usuário está correto." />
                        )}
                      </>
                    )}
                  </section>
                )}

                {/* Meus amigos */}
                {!buscando && aba === "amigos" && (
                  <ul className="grid grid-cols-1 gap-2 min-[900px]:grid-cols-2 min-[1280px]:grid-cols-3">
                    {amigos.map(({ pessoa, perfil }) => {
                      const streak = streakAtual(perfil);
                      const ativa = streak > 0;
                      const cutucado = cutucados.includes(pessoa.id);
                      return (
                        <li key={pessoa.id}>
                          <div
                            className={`flex h-full w-full items-center gap-3 rounded-md border-l-[3px] bg-[#1d1a31] py-2.5 pl-3 pr-3 transition hover:bg-[#28223f] ${ativa ? "border-l-[#ffcc00]" : "border-l-[#4a4260]"}`}
                          >
                            <button
                              type="button"
                              onClick={() => setPerfilAberto(pessoa)}
                              aria-label={`Ver perfil de ${pessoa.nome}`}
                              className="flex min-w-0 flex-1 items-center gap-3 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a486d5]"
                            >
                              <Foto src={pessoa.foto} className="h-12 w-12 shrink-0 rounded-sm text-2xl" />
                              <div className="min-w-0 flex-1">
                                <h3 className="break-words text-sm font-bold leading-snug text-[#f4eeff]">{pessoa.nome}</h3>
                                <p className="break-all text-xs text-[#9f91b0]">{pessoa.usuario}</p>
                                <div className="mt-1.5 flex gap-1">
                                  {(medalhasDestaque[pessoa.id] ?? []).slice(0, 3).map((codigo) => <MedalhaIcone key={codigo} medalha={catalogo[codigo]} />)}
                                </div>
                              </div>
                            </button>
                            <button
                              type="button"
                              disabled={ocupadoId === pessoa.id}
                              onClick={() => void cutucar(pessoa.id)}
                              aria-label={cutucado ? `Você já lembrou ${pessoa.nome}` : `Lembrar ${pessoa.nome} de fazer uma aula`}
                              title={cutucado ? "Amigo incomodado!" : "Lembrar de fazer uma aula"}
                              className="shrink-0 rounded-md border border-[#a486d5]/50 bg-[#a486d5]/10 px-2.5 py-2 text-lg leading-none transition hover:bg-[#a486d5]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a486d5] disabled:cursor-wait disabled:opacity-60"
                            >
                              <span aria-hidden="true">{cutucado ? "😁" : "👆"}</span>
                            </button>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="rounded-sm bg-[#54318c]/60 px-1.5 py-0.5 text-[11px] font-bold text-[#e6dafa]">Nv. {pessoa.nivel}</span>
                              <span className={`text-xs font-bold ${ativa ? "text-[#ffcc00]" : "text-[#918b9a]"}`} title={ativa ? "Streak atual" : "Sem streak ativa"}>
                                {ativa ? "🔥" : "❄"} {streak}d
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Pedidos recebidos e enviados */}
                {!buscando && aba !== "amigos" && (
                  <ul className="grid grid-cols-1 gap-2 min-[900px]:grid-cols-2 min-[1280px]:grid-cols-3">
                    {listaPedidos.map(({ pessoa, amizade }) => (
                      <LinhaUsuario key={pessoa.id} usuario={pessoa} onAbrir={() => setPerfilAberto(pessoa)} destaque={aba === "recebidos"} detalhe={`Nv. ${pessoa.nivel} · ${aba === "recebidos" ? "pediu" : "enviado"} ${tempoRelativo(amizade.created_at)}`}>
                        {acoes(pessoa)}
                      </LinhaUsuario>
                    ))}
                  </ul>
                )}

                {!buscando && (aba === "amigos" ? amigos : listaPedidos).length === 0 && <Vazio titulo={vazio[aba][0]} texto={vazio[aba][1]} />}
              </div>
            </>
          )}
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
                style={detalheAberto?.perfil?.banner_url ? { backgroundImage: `url(${detalheAberto.perfil.banner_url})` } : { backgroundImage: "linear-gradient(135deg, #54318c, #2a2342)" }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-[#211d37] to-transparent" />
                <button type="button" onClick={fecharPerfil} className="absolute right-3 top-3 rounded-lg bg-[#171628]/70 px-2.5 py-0.5 text-lg text-[#f4eeff] hover:bg-[#171628]" aria-label="Fechar perfil">×</button>
              </div>

              <div className="relative z-10 px-5 pb-5">
                <div className="relative z-20 -mt-6 flex items-end gap-3">
                  <Foto src={perfilAberto.foto} alt={`Foto de ${perfilAberto.nome}`} className="h-16 w-16 shrink-0 rounded-md border-4 border-[#211d37] text-3xl" />
                  <div className="min-w-0 pb-0.5">
                    <h2 id="friend-profile-title" className="break-words text-lg font-bold leading-tight text-[#f4eeff]">{perfilAberto.nome}</h2>
                    <p className="break-all text-xs text-[#a99bbb]">{perfilAberto.usuario}</p>
                  </div>
                </div>

                {detalheAberto?.perfil?.bio && <Bio key={perfilAberto.id} texto={detalheAberto.perfil.bio} />}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    ["Nível", detalheAberto?.perfil?.level ?? perfilAberto.nivel, "text-[#e6dafa]"],
                    ["XP", detalheAberto ? (detalheAberto.perfil ? formatXp(detalheAberto.perfil.xp_global) : "—") : "…", "text-[#d8c9f2]"],
                    ["Streak atual", detalheAberto ? (detalheAberto.perfil ? `${streakAtual(detalheAberto.perfil)} dias` : "—") : "…", "text-[#ffcc00]"],
                  ].map(([label, valor, cor]) => (
                    <div key={label} className="rounded-lg bg-[#171628] px-3 py-2">
                      <p className="text-[11px] text-[#9f91b0]">{label}</p>
                      <strong className={`block text-base ${cor}`}>{valor}</strong>
                    </div>
                  ))}
                </div>

                {detalheAberto && detalheAberto.medalhas.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <h3 className="text-sm font-bold text-[#f4eeff]">Conquistas</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {detalheAberto.medalhas.map((codigo) => <MedalhaIcone key={codigo} medalha={catalogo[codigo]} tamanho="md" focavel />)}
                    </div>
                  </div>
                )}

                {/* TODO (cursos do amigo): descomentar junto com a busca em carregarDetalhe (ver comentário lá).
                {detalheAberto && detalheAberto.cursos.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-bold text-[#f4eeff]">Cursos que {perfilAberto.nome} faz</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {detalheAberto.cursos.map((curso) => (
                        <span key={curso} className="rounded-md border border-[#a486d5]/25 bg-[#171628] px-2.5 py-1 text-xs text-[#d8c9f2]">{curso}</span>
                      ))}
                    </div>
                  </div>
                )}
                */}

                {ehAmigo && (
                  <>
                    <button
                      type="button"
                      disabled={ocupadoId === perfilAberto.id}
                      onClick={() => void cutucar(perfilAberto.id)}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-[#a486d5]/50 bg-[#a486d5]/10 px-4 py-2.5 text-sm font-bold text-[#d8c9f2] transition hover:bg-[#a486d5]/20 disabled:cursor-wait disabled:opacity-60"
                    >
                      <span className="text-lg" aria-hidden="true">{cutucados.includes(perfilAberto.id) ? "😁" : "👆"}</span>
                      <span>{cutucados.includes(perfilAberto.id) ? "Amigo incomodado!" : "Lembrar de fazer uma aula"}</span>
                    </button>

                    {erroAcao && <p role="alert" className="mt-3 text-xs text-[#e8b4b4]">{erroAcao}</p>}

                    <div className="mt-4 border-t border-[#a486d5]/15 pt-3">
                      {confirmandoRemocao ? (
                        <div className="flex flex-col gap-3 min-[460px]:flex-row min-[460px]:items-center min-[460px]:justify-between">
                          <p className="text-sm text-[#e8b4b4]">Remover {perfilAberto.nome} dos seus amigos?</p>
                          <div className="flex shrink-0 gap-2">
                            <button type="button" onClick={() => setConfirmandoRemocao(false)} className={botaoSecundario}>Cancelar</button>
                            <button
                              type="button"
                              disabled={ocupadoId === perfilAberto.id}
                              onClick={() => {
                                void removerAmigo(perfilAberto.id);
                                fecharPerfil();
                              }}
                              className="rounded-md bg-[#c2455a] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#d4566b] disabled:cursor-wait disabled:opacity-60"
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
