import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LessonModal } from "../components/lesson/LessonModal";
import { RankingPodium, type PodiumHeight, type PodiumPlayer, type Tier } from "../components/ranking/RankingPodium";
import { SidebarLeft } from "../components/sidebar/SidebarLeft";
import {
  aulaRepository,
  avisoRepository,
  concluiRepository,
  cursoRepository,
  moduloRepository,
  participaRepository,
  salaRepository,
  tentativaRepository,
  usuarioRepository,
} from "../data/repositories";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";
import "./Salas.css";

// ---------------------------------------------------------------------------
// Ícones (só os que esta página usa)
// ---------------------------------------------------------------------------
type NomeIcone = "search" | "filter" | "plus" | "arrow" | "people" | "close" | "chevron" | "play" | "check";

const caminhos: Record<NomeIcone, ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  filter: <path d="M4 7h16M7 12h10M10 17h4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5.3A3 3 0 0 1 16 11M17 14a5 5 0 0 1 4 4.9V20" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  play: <path d="m9 7 8 5-8 5Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};

function Icone({ nome, tamanho = 20 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {caminhos[nome]}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Modelo da tela (montado a partir das tabelas do Supabase)
// ---------------------------------------------------------------------------
type Tom = "coral" | "azul" | "violeta" | "menta" | "rosa" | "laranja";
type MembroLinha = Database["public"]["Tables"]["room_members"]["Row"];

type AulaView = { id: string; titulo: string; conteudo: string | null; concluida: boolean };
type ModuloView = { id: string; titulo: string; descricao: string; cor: string; aulas: AulaView[] };

type Sala = {
  id: string;
  nome: string;
  codigo: string;
  codigoAtivo: boolean;
  pacVisibilidade: string;
  cursoId: string | null;
  cursoTitulo: string;
  categoria: string;
  educadorId: string;
  educador: string;
  souEducador: boolean;
  membros: number;
  ranking: MembroLinha[]; // membros ativos, do maior para o menor XP interno
  meuMembro: MembroLinha | null;
  tom: Tom;
  simbolo: string;
  modulos: ModuloView[];
  totalAulas: number;
  aulasConcluidas: number;
};

type AulaAberta = { salaId: string; aula: AulaView; modulo: ModuloView };

const TONS: Tom[] = ["coral", "azul", "violeta", "menta", "rosa", "laranja"];
const CORES_PADRAO = ["#06b6d4", "#22c55e", "#a855f7", "#f97316", "#eab308"];
const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I para não confundir

const OPCOES_PAC = [
  { valor: "members", rotulo: "Membros da sala" },
  { valor: "educator_only", rotulo: "Só o educador" },
  { valor: "public", rotulo: "Todos" },
] as const;

const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function hashTexto(texto: string) {
  let hash = 0;
  for (const caractere of texto) hash = (hash * 31 + caractere.charCodeAt(0)) >>> 0;
  return hash;
}

function corDoModulo(cor: string | null, indice: number) {
  const candidata = cor?.trim();
  return candidata && /^#[0-9a-fA-F]{3,8}$/.test(candidata) ? candidata : CORES_PADRAO[indice % CORES_PADRAO.length];
}

function gerarCodigo(tamanho = 6) {
  const bytes = new Uint8Array(tamanho);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALFABETO_CODIGO[byte % ALFABETO_CODIGO.length]).join("");
}

// Mensagens do banco (em inglês) traduzidas para quem usa a tela.
function traduzirErro(erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message : "";
  if (/invalid or inactive access code/i.test(mensagem)) return "Código inválido ou desativado.";
  if (/not authenticated/i.test(mensagem)) return "Entre na sua conta para continuar.";
  if (/row-level security|42501|permission denied/i.test(mensagem)) return "Você não tem permissão para fazer isso.";
  if (/infinite recursion|42P17/i.test(mensagem)) {
    return "O banco recusou a consulta (recursão nas policies de sala). Aplique a migration 0020 no Supabase.";
  }
  return mensagem || "Algo deu errado. Tente novamente.";
}

function tierPorPac(pac: number): Tier {
  if (pac < 60) return "bronze";
  if (pac <= 74) return "silver";
  if (pac <= 84) return "gold";
  if (pac <= 94) return "platinum";
  return "diamond";
}

const ALTURAS: PodiumHeight[] = ["first", "second", "third", "fourth", "fifth"];

// Busca tudo o que a tela precisa em poucas consultas e junta no navegador.
async function carregarSalas(): Promise<{ salas: Sala[]; usuarioId: string; cursos: { id: string; titulo: string }[] }> {
  const { data: autenticacao } = await supabase.auth.getUser();
  const usuario = autenticacao.user;
  if (!usuario) throw new Error("Faça login para ver as suas salas.");

  const [salasBanco, membrosBanco, cursosBanco, modulosBanco, aulasBanco, conclusoes, tentativas] = await Promise.all([
    salaRepository.listar(),
    participaRepository.listar(),
    cursoRepository.listar(),
    moduloRepository.listar(),
    aulaRepository.listar(),
    concluiRepository.listarPorUsuario(usuario.id),
    tentativaRepository.listarPorUsuario(usuario.id),
  ]);

  // Administradores enxergam todas as salas; aqui mostramos só as suas (educador ou membro ativo).
  const minhas = salasBanco.filter(
    (sala) =>
      sala.educator_id === usuario.id ||
      membrosBanco.some((membro) => membro.room_id === sala.id && membro.user_id === usuario.id && membro.status === "active"),
  );

  const idsEducadores = [...new Set(minhas.map((sala) => sala.educator_id))];
  const perfis = await Promise.all(idsEducadores.map((id) => usuarioRepository.obterPorId(id)));
  const nomesEducadores = new Map<string, string>();
  for (const perfil of perfis) {
    if (perfil) nomesEducadores.set(perfil.id, perfil.display_name);
  }

  // Conclusões em contexto de sala: a tentativa diz em qual sala a aula foi feita.
  const salaDaTentativa = new Map(tentativas.map((tentativa) => [tentativa.id, tentativa.room_id] as const));
  const concluidasNaSala = new Set<string>();
  for (const conclusao of conclusoes) {
    if (conclusao.context !== "room" || !conclusao.attempt_id) continue;
    const salaId = salaDaTentativa.get(conclusao.attempt_id);
    if (salaId) concluidasNaSala.add(`${salaId}:${conclusao.lesson_id}`);
  }

  const aulasPorModulo = new Map<string, { id: string; titulo: string; conteudo: string | null }[]>();
  for (const aula of [...aulasBanco].sort((a, b) => a.position - b.position)) {
    const lista = aulasPorModulo.get(aula.module_id) ?? [];
    lista.push({ id: aula.id, titulo: aula.title, conteudo: aula.content });
    aulasPorModulo.set(aula.module_id, lista);
  }

  const modulosPorCurso = new Map<string, typeof modulosBanco>();
  for (const modulo of [...modulosBanco].sort((a, b) => a.position - b.position)) {
    const lista = modulosPorCurso.get(modulo.course_id) ?? [];
    lista.push(modulo);
    modulosPorCurso.set(modulo.course_id, lista);
  }

  const cursosPorId = new Map(cursosBanco.map((curso) => [curso.id, curso] as const));

  const salas = minhas.map<Sala>((sala) => {
    const curso = sala.course_id ? cursosPorId.get(sala.course_id) : undefined;
    const modulos = (sala.course_id ? modulosPorCurso.get(sala.course_id) ?? [] : []).map<ModuloView>((modulo, indice) => ({
      id: modulo.id,
      titulo: modulo.title,
      descricao: modulo.description ?? "",
      cor: corDoModulo(modulo.color, indice),
      aulas: (aulasPorModulo.get(modulo.id) ?? []).map((aula) => ({
        ...aula,
        concluida: concluidasNaSala.has(`${sala.id}:${aula.id}`),
      })),
    }));
    const aulas = modulos.flatMap((modulo) => modulo.aulas);
    const ativos = membrosBanco
      .filter((membro) => membro.room_id === sala.id && membro.status === "active")
      .sort((a, b) => b.xp_internal - a.xp_internal);
    const hash = hashTexto(sala.id);

    return {
      id: sala.id,
      nome: sala.name,
      codigo: sala.access_code,
      codigoAtivo: sala.code_active,
      pacVisibilidade: sala.pac_visibility,
      cursoId: sala.course_id,
      cursoTitulo: curso?.title ?? "",
      categoria: curso?.category?.trim() || "Sala de estudo",
      educadorId: sala.educator_id,
      educador: nomesEducadores.get(sala.educator_id) ?? "Educador",
      souEducador: sala.educator_id === usuario.id,
      membros: ativos.length,
      ranking: ativos,
      meuMembro: ativos.find((membro) => membro.user_id === usuario.id) ?? null,
      tom: TONS[hash % TONS.length],
      simbolo: sala.name.trim().match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? "✦",
      modulos,
      totalAulas: aulas.length,
      aulasConcluidas: aulas.filter((aula) => aula.concluida).length,
    };
  });

  return {
    salas,
    usuarioId: usuario.id,
    cursos: cursosBanco.map((curso) => ({ id: curso.id, titulo: curso.title })),
  };
}

// ---------------------------------------------------------------------------
// Busca, filtros e ordenação
// ---------------------------------------------------------------------------
type OrdemAlfabetica = "nenhuma" | "az" | "za";
type OrdemMembros = "nenhuma" | "maior" | "menor";
type Filtros = { alfabetica: OrdemAlfabetica; membros: OrdemMembros };

const FILTROS_PADRAO: Filtros = { alfabetica: "nenhuma", membros: "nenhuma" };

const contarFiltros = (filtros: Filtros) =>
  (filtros.alfabetica !== "nenhuma" ? 1 : 0) + (filtros.membros !== "nenhuma" ? 1 : 0);

// A quantidade de membros vem primeiro; a ordem alfabética desempata (ou vale sozinha).
function ordenar(lista: Sala[], filtros: Filtros) {
  return [...lista].sort((a, b) => {
    if (filtros.membros !== "nenhuma") {
      const diferenca = filtros.membros === "maior" ? b.membros - a.membros : a.membros - b.membros;
      if (diferenca !== 0) return diferenca;
    }
    if (filtros.alfabetica !== "nenhuma") {
      const comparacao = a.nome.localeCompare(b.nome, "pt-BR");
      return filtros.alfabetica === "az" ? comparacao : -comparacao;
    }
    return 0;
  });
}

// Fecha o pop-up com Esc e trava a rolagem da página enquanto ele está aberto.
function useTravarModal(onFechar: () => void) {
  const fecharRef = useRef(onFechar);
  useEffect(() => {
    fecharRef.current = onFechar;
  });

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") fecharRef.current();
    }

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", aoTeclar);
    };
  }, []);
}

// ---------------------------------------------------------------------------
// Card da sala
// ---------------------------------------------------------------------------
type SalaCardProps = {
  sala: Sala;
  expandido: boolean;
  onDestacar: () => void;
  onRemoverDestaque: () => void;
  onAbrir: () => void;
};

function SalaCard({ sala, expandido, onDestacar, onRemoverDestaque, onAbrir }: SalaCardProps) {
  return (
    <article
      className={`salas__card${expandido ? " salas__card--expandido" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(evento) => {
        if (evento.key === "Enter" || evento.key === " ") {
          evento.preventDefault();
          onAbrir();
        }
      }}
      onMouseEnter={onDestacar}
      onMouseLeave={onRemoverDestaque}
      onFocus={onDestacar}
      onBlur={onRemoverDestaque}
    >
      <div className={`salas__banner salas__banner--${sala.tom}`}>
        <span className="salas__banner-tag">{sala.categoria}</span>
        <div className="salas__banner-orbita" />
      </div>

      <div className={`salas__icone salas__icone--${sala.tom}`}>{sala.simbolo}</div>

      <div className="salas__conteudo">
        <div className="salas__linha-titulo">
          <div>
            <h2 className="salas__nome">{sala.nome}</h2>
            <p className="salas__slug">{sala.cursoTitulo ? `Curso: ${sala.cursoTitulo}` : "Sem curso vinculado"}</p>
            <p className="salas__slug">Educador: {sala.educador}</p>
          </div>
          <span className="salas__membros" title="Membros ativos">
            <Icone nome="people" tamanho={14} />
            {sala.membros}
          </span>
        </div>

        {expandido && (
          <div className="salas__expandido">
            <p className="salas__descricao-curta">
              {sala.souEducador
                ? <>Você é o educador desta sala. Código de acesso: <strong>{sala.codigo}</strong>{sala.codigoAtivo ? "" : " (desativado)"}</>
                : sala.totalAulas > 0
                  ? `Você concluiu ${sala.aulasConcluidas} de ${sala.totalAulas} aulas nesta sala.`
                  : "Abra a sala para ver o mural e o ranking."}
            </p>
            <div className="salas__rodape-card">
              <span className="salas__nota">{sala.souEducador && <span className="salas__selo salas__selo--ativo">Educador</span>}</span>
              <span className="salas__saiba-mais">
                Abrir sala <Icone nome="arrow" tamanho={17} />
              </span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Estado vazio (usuário ainda não participa de nenhuma sala)
// ---------------------------------------------------------------------------
function EstadoVazio({ onAdicionar }: { onAdicionar: () => void }) {
  return (
    <div className="salas__vazio">
      <div className="salas__vazio-ilustracao" aria-hidden="true">
        <span className="salas__vazio-brilho salas__vazio-brilho--1">✦</span>
        <span className="salas__vazio-brilho salas__vazio-brilho--2">✦</span>
        <div className="salas__vazio-cartao" />
        <div className="salas__vazio-porta">
          <div className="salas__vazio-janela">✦</div>
          <div className="salas__vazio-linha" />
        </div>
        <div className="salas__vazio-figura">
          <span className="salas__vazio-figura-cabeca" />
          <span className="salas__vazio-figura-corpo" />
        </div>
        <div className="salas__vazio-sombra" />
      </div>

      <p className="salas__vazio-chamada">SUA JORNADA COMEÇA AQUI</p>
      <h2 className="salas__vazio-titulo">Você ainda não participa<br />de nenhuma sala</h2>
      <p className="salas__vazio-texto">
        Entre em uma sala com um código de acesso ou crie a sua<br />para aprender com outras pessoas e evoluir todos os dias.
      </p>
      <button className="salas__botao-primario" type="button" onClick={onAdicionar}>
        <Icone nome="plus" tamanho={19} />
        Adicionar sala
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pop-up de filtros
// ---------------------------------------------------------------------------
type OpcaoChip<T extends string> = { valor: T; rotulo: string };

const OPCOES_ALFABETICA: OpcaoChip<OrdemAlfabetica>[] = [
  { valor: "nenhuma", rotulo: "Sem ordem" },
  { valor: "az", rotulo: "A → Z" },
  { valor: "za", rotulo: "Z → A" },
];

const OPCOES_MEMBROS: OpcaoChip<OrdemMembros>[] = [
  { valor: "nenhuma", rotulo: "Sem ordem" },
  { valor: "maior", rotulo: "Mais membros" },
  { valor: "menor", rotulo: "Menos membros" },
];

function GrupoOpcoes<T extends string>({
  rotulo,
  opcoes,
  valor,
  onMudar,
}: {
  rotulo: string;
  opcoes: OpcaoChip<T>[];
  valor: T;
  onMudar: (novoValor: T) => void;
}) {
  return (
    <div className="salas__opcoes" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((opcao) => {
        const ativa = valor === opcao.valor;
        return (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            aria-checked={ativa}
            className={`salas__opcao${ativa ? " salas__opcao--ativa" : ""}`}
            onClick={() => onMudar(opcao.valor)}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}

type FiltroModalProps = {
  valores: Filtros;
  onAplicar: (filtros: Filtros) => void;
  onFechar: () => void;
};

function FiltroModal({ valores, onAplicar, onFechar }: FiltroModalProps) {
  // As escolhas só valem quando a pessoa clica em "Aplicar".
  const [rascunho, setRascunho] = useState<Filtros>(valores);
  useTravarModal(onFechar);

  const usandoOsDois = rascunho.alfabetica !== "nenhuma" && rascunho.membros !== "nenhuma";

  return (
    <div className="salas__modal-camada" role="presentation">
      <div className="salas__modal-fundo" onClick={onFechar} />

      <section className="salas__filtro-modal" role="dialog" aria-modal="true" aria-labelledby="salas-filtro-titulo">
        <header className="salas__filtro-topo">
          <div>
            <p className="salas__rotulo">FILTRAR SALAS</p>
            <h2 className="salas__filtro-titulo" id="salas-filtro-titulo">Organizar resultados</h2>
          </div>
          <button className="salas__filtro-fechar" type="button" onClick={onFechar} aria-label="Fechar filtros">
            <Icone nome="close" tamanho={20} />
          </button>
        </header>

        <div className="salas__filtro-corpo">
          <section>
            <h3 className="salas__filtro-secao-titulo">Ordem alfabética</h3>
            <p className="salas__filtro-secao-texto">Organize as salas pelo nome.</p>
            <GrupoOpcoes
              rotulo="Ordem alfabética"
              opcoes={OPCOES_ALFABETICA}
              valor={rascunho.alfabetica}
              onMudar={(alfabetica) => setRascunho({ ...rascunho, alfabetica })}
            />
          </section>

          <section>
            <h3 className="salas__filtro-secao-titulo">Número de membros</h3>
            <p className="salas__filtro-secao-texto">Organize pela quantidade de membros ativos.</p>
            <GrupoOpcoes
              rotulo="Número de membros"
              opcoes={OPCOES_MEMBROS}
              valor={rascunho.membros}
              onMudar={(membros) => setRascunho({ ...rascunho, membros })}
            />
          </section>

          {usandoOsDois && (
            <p className="salas__filtro-dica">
              Usando os dois, a quantidade de membros vem primeiro e a ordem alfabética desempata salas com o mesmo número.
            </p>
          )}
        </div>

        <footer className="salas__filtro-rodape">
          <button className="salas__botao-secundario" type="button" onClick={() => setRascunho(FILTROS_PADRAO)}>
            Limpar
          </button>
          <button className="salas__botao-primario salas__botao-aplicar" type="button" onClick={() => onAplicar(rascunho)}>
            Aplicar
          </button>
        </footer>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pop-up da sala
// ---------------------------------------------------------------------------
type AvisoLinha = Database["public"]["Tables"]["announcements"]["Row"];

function formatarData(iso: string) {
  const data = new Date(iso);
  const hoje = new Date();
  const mesmoDia = data.toDateString() === hoje.toDateString();
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return mesmoDia ? `Hoje, ${hora}` : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

type SalaModalProps = {
  sala: Sala;
  usuarioId: string;
  aulaAberta: boolean;
  onFechar: () => void;
  onAbrirAula: (aula: AulaView, modulo: ModuloView) => void;
  onAtualizar: () => Promise<void>;
};

function SalaModal({ sala, usuarioId, aulaAberta, onFechar, onAbrirAula, onAtualizar }: SalaModalProps) {
  const [moduloAberto, setModuloAberto] = useState(0);
  const [avisos, setAvisos] = useState<AvisoLinha[] | null>(null);
  const [versaoAvisos, setVersaoAvisos] = useState(0);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [tituloAviso, setTituloAviso] = useState("");
  const [textoAviso, setTextoAviso] = useState("");

  // Enquanto uma aula está aberta por cima, o Esc fecha só a aula.
  useTravarModal(() => {
    if (!aulaAberta) onFechar();
  });

  const top5 = useMemo(() => sala.ranking.slice(0, 5), [sala.ranking]);
  const idsDoRanking = top5.map((membro) => membro.user_id).join(",");
  const totalAulas = sala.totalAulas;
  const progresso = totalAulas > 0 ? Math.round((sala.aulasConcluidas / totalAulas) * 100) : 0;

  // Carrega o mural; publicar um aviso novo só incrementa o contador para recarregar.
  useEffect(() => {
    let cancelado = false;

    async function carregarAvisos() {
      try {
        const lista = await avisoRepository.listarPorSala(sala.id);
        if (!cancelado) setAvisos(lista.filter((aviso) => aviso.status === "published"));
      } catch {
        if (!cancelado) setAvisos([]);
      }
    }

    void carregarAvisos();
    return () => { cancelado = true; };
  }, [sala.id, versaoAvisos]);

  // Nomes de quem aparece no ranking.
  useEffect(() => {
    let cancelado = false;
    const ids = idsDoRanking ? idsDoRanking.split(",") : [];

    async function carregarNomes() {
      const perfis = await Promise.all(ids.map((id) => usuarioRepository.obterPorId(id)));
      if (cancelado) return;
      const mapa = new Map<string, string>();
      for (const perfil of perfis) {
        if (perfil) mapa.set(perfil.id, perfil.display_name);
      }
      setNomes(mapa);
    }

    void carregarNomes();
    return () => { cancelado = true; };
  }, [idsDoRanking]);

  // O PAC dos colegas só aparece se a sala permitir (ou se você for o educador).
  const mostrarPac = sala.souEducador || sala.pacVisibilidade !== "educator_only";

  const jogadores = useMemo(() => {
    const lista: PodiumPlayer[] = top5.map((membro, indice) => {
      const pac = Math.round(Number(membro.pac_internal));
      const ehVoce = membro.user_id === usuarioId;
      const detalhe = mostrarPac || ehVoce ? `${pac}% · ${membro.xp_internal} XP` : `${membro.xp_internal} XP`;
      return {
        position: `${indice + 1}º`,
        name: ehVoce ? "Você" : nomes.get(membro.user_id) ?? "Aluno",
        detail: detalhe,
        tier: tierPorPac(pac),
        height: ALTURAS[indice],
        isYou: ehVoce,
      };
    });
    // Ordem visual do pódio (esquerda → direita): 4º, 2º, 1º, 3º, 5º.
    return [3, 1, 0, 2, 4].filter((posicao) => lista[posicao]).map((posicao) => lista[posicao]);
  }, [top5, nomes, usuarioId, mostrarPac]);

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(sala.codigo);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      setErro("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  }

  async function alternarCodigo() {
    setOcupado(true);
    setErro("");
    try {
      await salaRepository.atualizarCodigoAtivo(sala.id, !sala.codigoAtivo);
      await onAtualizar();
    } catch (error) {
      setErro(traduzirErro(error));
    } finally {
      setOcupado(false);
    }
  }

  async function publicarAviso(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const titulo = tituloAviso.trim();
    if (!titulo) return;

    setOcupado(true);
    setErro("");
    try {
      await avisoRepository.criar({ room_id: sala.id, author_id: usuarioId, title: titulo, content: textoAviso.trim() || null });
      setTituloAviso("");
      setTextoAviso("");
      setVersaoAvisos((versao) => versao + 1);
    } catch (error) {
      setErro(traduzirErro(error));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="salas__modal-camada" role="presentation">
      <div className="salas__modal-fundo" onClick={onFechar} />

      <section className="salas__modal" role="dialog" aria-modal="true" aria-labelledby="salas-modal-titulo">
        <div className="salas__modal-rolagem">
          <div className="salas__modal-banner">
            <span className="salas__modal-categoria">{sala.categoria.toUpperCase()}</span>
            <div className="salas__modal-forma salas__modal-forma--a" />
            <div className="salas__modal-forma salas__modal-forma--b" />
            <div className="salas__modal-brilho">✦</div>
            <button className="salas__modal-fechar" type="button" onClick={onFechar} aria-label="Fechar informações da sala">
              <Icone nome="close" tamanho={22} />
            </button>
          </div>

          <div className="salas__modal-corpo">
            <div className="salas__identidade">
              <div className="salas__modal-icone">{sala.simbolo}</div>
              <div>
                <p className="salas__rotulo">SALA DE APRENDIZAGEM</p>
                <h2 className="salas__modal-titulo" id="salas-modal-titulo">{sala.nome}</h2>
                <p className="salas__modal-slug">Educador: {sala.educador}</p>
              </div>
              <div className="salas__meta">
                <div><span>Curso:</span><strong>{sala.cursoTitulo || "Nenhum"}</strong></div>
                <div><span>Membros:</span><strong>{sala.membros}</strong></div>
                <div>
                  <span>PAC visível para:</span>
                  <strong>{OPCOES_PAC.find((opcao) => opcao.valor === sala.pacVisibilidade)?.rotulo ?? sala.pacVisibilidade}</strong>
                </div>
              </div>
            </div>

            {sala.souEducador && (
              <article className="salas__sobre">
                <div>
                  <p className="salas__rotulo">CÓDIGO DE ACESSO</p>
                  <h3 className="salas__sobre-titulo">Compartilhe com os alunos</h3>
                </div>
                <div className="salas__codigo-linha">
                  <code className="salas__codigo">{sala.codigo}</code>
                  <button className="salas__botao-secundario" type="button" onClick={() => void copiarCodigo()}>
                    {copiado ? "Copiado!" : "Copiar"}
                  </button>
                  <button className="salas__botao-secundario" type="button" disabled={ocupado} onClick={() => void alternarCodigo()}>
                    {sala.codigoAtivo ? "Desativar código" : "Reativar código"}
                  </button>
                </div>
                <p className="salas__sobre-texto">
                  {sala.codigoAtivo
                    ? "Quem tiver o código pode entrar na sala."
                    : "O código está desativado: ninguém novo consegue entrar até você reativá-lo."}
                </p>
              </article>
            )}

            {erro && <p className="salas__erro-inline" role="alert">{erro}</p>}

            <div className="salas__colunas">
              {/* Trilha de aprendizagem (aulas feitas aqui valem só para a sala) */}
              <section className="salas__painel salas__modulos">
                <div className="salas__painel-cabecalho">
                  <div>
                    <p className="salas__rotulo">CONTEÚDO DA SALA</p>
                    <h3 className="salas__painel-titulo">Trilha de aprendizagem</h3>
                  </div>
                  <span className="salas__painel-resumo">{sala.modulos.length} módulos · {totalAulas} aulas</span>
                </div>

                {!sala.cursoId ? (
                  <p className="salas__vazio-painel">Esta sala ainda não tem um curso vinculado.</p>
                ) : sala.modulos.length === 0 ? (
                  <p className="salas__vazio-painel">O curso desta sala ainda não tem módulos, ou o conteúdo não está liberado para você.</p>
                ) : (
                  <>
                    <div className="salas__barra-progresso" role="progressbar" aria-label="Seu progresso na sala" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso}>
                      <span style={{ width: `${progresso}%` }} />
                    </div>
                    <p className="salas__painel-resumo salas__painel-resumo--bloco">{sala.aulasConcluidas} de {totalAulas} aulas concluídas na sala</p>

                    <div className="salas__acordeao">
                      {sala.modulos.map((modulo, indice) => (
                        <div
                          className={`salas__modulo${moduloAberto === indice ? " salas__modulo--aberto" : ""}`}
                          key={modulo.id}
                        >
                          <button
                            className="salas__modulo-botao"
                            type="button"
                            aria-expanded={moduloAberto === indice}
                            onClick={() => setModuloAberto(moduloAberto === indice ? -1 : indice)}
                          >
                            <span className="salas__modulo-numero">{String(indice + 1).padStart(2, "0")}</span>
                            <span>
                              <strong>{modulo.titulo}</strong>
                              {modulo.descricao && <small>{modulo.descricao}</small>}
                            </span>
                            <Icone nome="chevron" tamanho={19} />
                          </button>

                          {moduloAberto === indice && (
                            <div className="salas__aulas">
                              {modulo.aulas.length === 0 && <p className="salas__vazio-painel">Nenhuma aula neste módulo.</p>}
                              {modulo.aulas.map((aula) => (
                                <button
                                  type="button"
                                  className={`salas__aula salas__aula--botao${aula.concluida ? " salas__aula--concluida" : ""}`}
                                  key={aula.id}
                                  onClick={() => onAbrirAula(aula, modulo)}
                                >
                                  <span className="salas__aula-play"><Icone nome={aula.concluida ? "check" : "play"} tamanho={13} /></span>
                                  <span>{aula.titulo}</span>
                                  <small>{aula.concluida ? "Concluída" : "Fazer aula"}</small>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* Desempenho, ranking e mural */}
              <aside className="salas__painel salas__lateral">
                {sala.meuMembro && (
                  <div className="salas__desempenho">
                    <p className="salas__rotulo">SEU DESEMPENHO NA SALA</p>
                    <div className="salas__nota-resumo">
                      <strong className="salas__nota-numero">{sala.meuMembro.xp_internal}</strong>
                      <span className="salas__nota-estrela">XP</span>
                    </div>
                    <p className="salas__nota-legenda">
                      PAC {Math.round(Number(sala.meuMembro.pac_internal))}% · progresso {Math.round(Number(sala.meuMembro.progress))}%
                    </p>
                    <p className="salas__nota-legenda">O XP da sala não soma no seu XP global.</p>
                  </div>
                )}

                <div className="salas__ranking">
                  <p className="salas__rotulo">RANKING DA SALA</p>
                  <h3 className="salas__ranking-titulo">Top 5 da sala</h3>
                  {jogadores.length > 0
                    ? <RankingPodium players={jogadores} compact width="compact" ariaLabel="Top 5 da sala" />
                    : <p className="salas__vazio-painel">Ainda não há alunos no ranking.</p>}
                </div>

                <div className="salas__mural-cabecalho">
                  <div>
                    <p className="salas__rotulo">MURAL DA SALA</p>
                    <strong className="salas__mural-titulo">Avisos recentes</strong>
                  </div>
                  {avisos && avisos.length > 0 && <span className="salas__mural-novos">{avisos.length}</span>}
                </div>

                {avisos === null && <p className="salas__vazio-painel">Carregando avisos...</p>}
                {avisos?.length === 0 && <p className="salas__vazio-painel">Nenhum aviso por enquanto.</p>}
                {avisos?.map((aviso, indice) => (
                  <div className={`salas__aviso${indice === 0 ? " salas__aviso--destaque" : ""}`} key={aviso.id}>
                    <div className="salas__aviso-topo">
                      <span className="salas__aviso-tipo">{indice === 0 ? "DESTAQUE" : "AVISO"}</span>
                      <small className="salas__aviso-data">{formatarData(aviso.created_at)}</small>
                    </div>
                    <strong className="salas__aviso-titulo">{aviso.title}</strong>
                    {aviso.content && <p className="salas__aviso-texto">{aviso.content}</p>}
                  </div>
                ))}

                {sala.souEducador && (
                  <form className="salas__form-aviso" onSubmit={(evento) => void publicarAviso(evento)}>
                    <p className="salas__rotulo">NOVO AVISO</p>
                    <input required maxLength={120} placeholder="Título do aviso" value={tituloAviso} onChange={(e) => setTituloAviso(e.target.value)} />
                    <textarea rows={3} maxLength={500} placeholder="Mensagem (opcional)" value={textoAviso} onChange={(e) => setTextoAviso(e.target.value)} />
                    <button className="salas__botao-primario salas__botao-pequeno" type="submit" disabled={ocupado || !tituloAviso.trim()}>
                      Publicar aviso
                    </button>
                  </form>
                )}
              </aside>
            </div>
          </div>
        </div>

        <footer className="salas__modal-rodape">
          <p>
            <Icone nome="people" tamanho={17} />
            <strong>{sala.membros} {sala.membros === 1 ? "pessoa" : "pessoas"}</strong> {sala.membros === 1 ? "está aprendendo" : "estão aprendendo"} nesta sala
          </p>
          <div className="salas__modal-acoes">
            <button className="salas__botao-secundario" type="button" onClick={onFechar}>Fechar</button>
          </div>
        </footer>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
const FORMULARIO_VAZIO = { nome: "", cursoId: "", pac: "members" };

export default function Salas() {
  const [salas, setSalas] = useState<Sala[]>([]);
  const [cursos, setCursos] = useState<{ id: string; titulo: string }[]>([]);
  const [usuarioId, setUsuarioId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_PADRAO);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [salaEmDestaque, setSalaEmDestaque] = useState<string | null>(null);
  const [salaAbertaId, setSalaAbertaId] = useState<string | null>(null);
  const [aulaAberta, setAulaAberta] = useState<AulaAberta | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [novaSala, setNovaSala] = useState(FORMULARIO_VAZIO);
  const [erroPainel, setErroPainel] = useState("");
  const [enviando, setEnviando] = useState<"" | "entrar" | "criar">("");

  const aplicar = useCallback((dados: Awaited<ReturnType<typeof carregarSalas>>) => {
    setSalas(dados.salas);
    setCursos(dados.cursos);
    setUsuarioId(dados.usuarioId);
  }, []);

  const recarregar = useCallback(async () => {
    try {
      aplicar(await carregarSalas());
    } catch {
      // Se a recarga falhar, a tela continua com os dados que já tinha.
    }
  }, [aplicar]);

  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      try {
        const dados = await carregarSalas();
        if (!cancelado) aplicar(dados);
      } catch (error) {
        if (!cancelado) setErro(traduzirErro(error));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void iniciar();
    return () => { cancelado = true; };
  }, [aplicar]);

  const termo = normalizar(busca.trim());
  const totalFiltros = contarFiltros(filtros);

  const salasFiltradas = useMemo(() => {
    const encontradas = salas.filter(
      (sala) =>
        !termo ||
        normalizar(sala.nome).includes(termo) ||
        normalizar(sala.categoria).includes(termo) ||
        normalizar(sala.cursoTitulo).includes(termo) ||
        normalizar(sala.educador).includes(termo),
    );
    return ordenar(encontradas, filtros);
  }, [salas, termo, filtros]);

  const salaAberta = salas.find((sala) => sala.id === salaAbertaId) ?? null;
  const salaDaAula = aulaAberta ? salas.find((sala) => sala.id === aulaAberta.salaId) ?? null : null;

  // Entra na sala com o código (função join_room do banco).
  async function entrarComCodigo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const digitado = codigoDigitado.trim();
    if (!digitado) return;

    setEnviando("entrar");
    setErroPainel("");
    setAviso("");

    try {
      // O banco compara o código exatamente como foi gravado: tenta como digitado e em maiúsculas.
      const tentativas = [...new Set([digitado, digitado.toUpperCase()])];
      let ultimoErro: unknown = null;
      let entrou = false;

      for (const codigo of tentativas) {
        try {
          await salaRepository.entrarPorCodigo(codigo);
          entrou = true;
          break;
        } catch (error) {
          ultimoErro = error;
        }
      }

      if (!entrou) throw ultimoErro;

      await recarregar();
      setCodigoDigitado("");
      setPainelAberto(false);
      setAviso("Você entrou na sala. Clique no card para abri-la.");
    } catch (error) {
      setErroPainel(traduzirErro(error));
    } finally {
      setEnviando("");
    }
  }

  // Cria a sala de verdade (tabela rooms). Quem cria vira o educador.
  async function criarSala(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nome = novaSala.nome.trim();
    if (!nome) return;

    setEnviando("criar");
    setErroPainel("");
    setAviso("");

    try {
      let codigoCriado = "";

      // O código é único no banco: se por azar repetir, sorteia outro.
      for (let tentativa = 0; tentativa < 5 && !codigoCriado; tentativa += 1) {
        const codigo = gerarCodigo();
        try {
          await salaRepository.criar({
            educator_id: usuarioId,
            name: nome,
            course_id: novaSala.cursoId || null,
            access_code: codigo,
            pac_visibility: novaSala.pac,
          });
          codigoCriado = codigo;
        } catch (error) {
          if (!/duplicate|unique/i.test(error instanceof Error ? error.message : "")) throw error;
        }
      }

      if (!codigoCriado) throw new Error("Não foi possível gerar um código de acesso. Tente novamente.");

      await recarregar();
      setNovaSala(FORMULARIO_VAZIO);
      setPainelAberto(false);
      setAviso(`Sala criada! Código de acesso: ${codigoCriado}. Compartilhe com os alunos.`);
    } catch (error) {
      setErroPainel(traduzirErro(error));
    } finally {
      setEnviando("");
    }
  }

  return (
    <div className="salas">
      <SidebarLeft />

      <main className="salas__main">
        <div className="salas__brilho" />

        <header className="salas__cabecalho">
          <div>
            <p className="salas__caminho">PLATAFORMA / <span>SALAS</span></p>
            <h1 className="salas__titulo">Salas</h1>
            <p className="salas__subtitulo">Aprenda em comunidade, compartilhe conquistas.</p>
          </div>
          <button className="salas__botao-primario" type="button" disabled={!usuarioId} onClick={() => setPainelAberto((aberto) => !aberto)}>
            <Icone nome="plus" tamanho={19} />
            Adicionar sala
          </button>
        </header>

        {aviso && <p className="salas__aviso-info" role="status">{aviso}</p>}

        {painelAberto && (
          <section className="salas__painel-acoes" aria-label="Adicionar sala">
            <form className="salas__form" onSubmit={(evento) => void entrarComCodigo(evento)}>
              <h2>Entrar com código</h2>
              <p>Peça o código de acesso ao educador da sala.</p>
              <input
                required
                autoComplete="off"
                placeholder="Código de acesso"
                value={codigoDigitado}
                onChange={(e) => setCodigoDigitado(e.target.value)}
              />
              <button className="salas__botao-primario salas__botao-pequeno" type="submit" disabled={enviando !== "" || !codigoDigitado.trim()}>
                {enviando === "entrar" ? "Entrando..." : "Entrar na sala"}
              </button>
            </form>

            <form className="salas__form" onSubmit={(evento) => void criarSala(evento)}>
              <h2>Criar sala</h2>
              <p>Você será o educador e receberá um código para compartilhar.</p>
              <input required maxLength={80} placeholder="Nome da sala" value={novaSala.nome} onChange={(e) => setNovaSala({ ...novaSala, nome: e.target.value })} />
              <label className="salas__campo">
                <span>Curso da sala (opcional)</span>
                <select value={novaSala.cursoId} onChange={(e) => setNovaSala({ ...novaSala, cursoId: e.target.value })}>
                  <option value="">Sem curso</option>
                  {cursos.map((curso) => <option key={curso.id} value={curso.id}>{curso.titulo}</option>)}
                </select>
              </label>
              <label className="salas__campo">
                <span>Quem pode ver o PAC dos alunos</span>
                <select value={novaSala.pac} onChange={(e) => setNovaSala({ ...novaSala, pac: e.target.value })}>
                  {OPCOES_PAC.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
                </select>
              </label>
              <button className="salas__botao-primario salas__botao-pequeno" type="submit" disabled={enviando !== "" || !novaSala.nome.trim()}>
                {enviando === "criar" ? "Criando..." : "Criar sala"}
              </button>
            </form>

            {erroPainel && <p className="salas__erro-inline salas__erro-inline--largo" role="alert">{erroPainel}</p>}
          </section>
        )}

        <section className="salas__ferramentas" aria-label="Busca e filtros">
          <label className="salas__busca">
            <Icone nome="search" tamanho={21} />
            <input
              type="search"
              placeholder="Buscar por nome, curso ou educador..."
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </label>
          <button
            className="salas__filtro"
            type="button"
            aria-label="Filtrar salas"
            aria-haspopup="dialog"
            onClick={() => setFiltroAberto(true)}
          >
            <Icone nome="filter" />
            <span>Filtrar</span>
            {totalFiltros > 0 && <span className="salas__filtro-contagem">{totalFiltros}</span>}
          </button>
        </section>

        <p className="salas__contador">
          Suas salas <span>{salasFiltradas.length}</span>
        </p>

        {carregando ? (
          <p className="salas__sem-resultado">Carregando salas...</p>
        ) : erro ? (
          <p className="salas__sem-resultado salas__sem-resultado--erro" role="alert">{erro}</p>
        ) : salas.length === 0 ? (
          <EstadoVazio onAdicionar={() => setPainelAberto(true)} />
        ) : salasFiltradas.length === 0 ? (
          <p className="salas__sem-resultado">Nenhuma sala encontrada para “{busca.trim()}”.</p>
        ) : (
          <section className="salas__grade">
            {salasFiltradas.map((sala) => (
              <SalaCard
                key={sala.id}
                sala={sala}
                expandido={salaEmDestaque === sala.id}
                onDestacar={() => setSalaEmDestaque(sala.id)}
                onRemoverDestaque={() => setSalaEmDestaque(null)}
                onAbrir={() => setSalaAbertaId(sala.id)}
              />
            ))}
          </section>
        )}
      </main>

      {filtroAberto && (
        <FiltroModal
          valores={filtros}
          onAplicar={(novosFiltros) => {
            setFiltros(novosFiltros);
            setFiltroAberto(false);
          }}
          onFechar={() => setFiltroAberto(false)}
        />
      )}

      {salaAberta && (
        <SalaModal
          key={salaAberta.id}
          sala={salaAberta}
          usuarioId={usuarioId}
          aulaAberta={aulaAberta !== null}
          onFechar={() => setSalaAbertaId(null)}
          onAbrirAula={(aula, modulo) => setAulaAberta({ salaId: salaAberta.id, aula, modulo })}
          onAtualizar={recarregar}
        />
      )}

      {/* A aula aberta aqui conta como atividade da sala: o XP vai para a sala, não para o XP global. */}
      {aulaAberta && salaDaAula?.cursoId && (
        <LessonModal
          key={aulaAberta.aula.id}
          aula={{ id: aulaAberta.aula.id, title: aulaAberta.aula.titulo, content: aulaAberta.aula.conteudo, module_id: aulaAberta.modulo.id, position: 0, status: "published", created_at: "", updated_at: "" }}
          moduloTitulo={aulaAberta.modulo.titulo}
          cursoId={salaDaAula.cursoId}
          salaId={salaDaAula.id}
          cor={aulaAberta.modulo.cor}
          jaConcluida={aulaAberta.aula.concluida}
          onFechar={() => setAulaAberta(null)}
          onConcluida={() => void recarregar()}
        />
      )}
    </div>
  );
}
