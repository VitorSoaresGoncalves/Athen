import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PageLayout } from "../components/layout/PageLayout";
import { LessonModal } from "../components/lesson/LessonModal";
import { Modal, ModalFechar } from "../components/modal/Modal";
import { Icone } from "../components/salas/Icone";
import { SalaModal } from "../components/salas/SalaModal";
import {
  OPCOES_PAC,
  traduzirErro,
  type AulaAberta,
  type ModuloView,
  type Sala,
  type Tom,
} from "../components/salas/tipos";
import {
  aulaRepository,
  concluiRepository,
  cursoRepository,
  moduloRepository,
  participaRepository,
  salaRepository,
  tentativaRepository,
  usuarioRepository,
} from "../data/repositories";
import { supabase } from "../lib/supabase";
import "./Salas.css";

// ---------------------------------------------------------------------------
// Modelo da tela: tipos e helpers compartilhados com os pop-ups ficam em
// components/salas/tipos.ts; os ícones em components/salas/Icone.tsx.
// ---------------------------------------------------------------------------
const TONS: Tom[] = ["coral", "azul", "violeta", "menta", "rosa", "laranja"];
const CORES_PADRAO = ["#06b6d4", "#22c55e", "#a855f7", "#f97316", "#eab308"];
const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I para não confundir

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

// A trava de rolagem + Esc + devolução do foco agora vivem no componente
// compartilhado src/components/modal/Modal.tsx.

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

  const usandoOsDois = rascunho.alfabetica !== "nenhuma" && rascunho.membros !== "nenhuma";

  return (
    <Modal onFechar={onFechar} largura="estreito" rotuladoPor="salas-filtro-titulo">
        <header className="salas__filtro-topo">
          <div>
            <p className="salas__rotulo">FILTRAR SALAS</p>
            <h2 className="salas__filtro-titulo" id="salas-filtro-titulo">Organizar resultados</h2>
          </div>
          <ModalFechar onFechar={onFechar} rotulo="Fechar filtros" variante="cabecalho">
            <Icone nome="close" tamanho={20} />
          </ModalFechar>
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
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Página (SalaModal vive em components/salas/SalaModal.tsx)
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
    <PageLayout variant="bare">
    <div className="salas">
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
    </PageLayout>
  );
}