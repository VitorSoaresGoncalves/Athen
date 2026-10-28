import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarLeft } from "../components/sidebar/SidebarLeft";
import {
  aulaRepository,
  avaliacaoRepository,
  concluiRepository,
  cursoRepository,
  matriculaRepository,
  moduloRepository,
  tentativaRepository,
  usuarioRepository,
} from "../data/repositories";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";
import "./Cursos.css";


// ---------------------------------------------------------------------------
// Ícones (só os que esta página usa)
// ---------------------------------------------------------------------------
type NomeIcone = "search" | "filter" | "plus" | "arrow" | "people" | "close" | "chevron" | "play" | "clock" | "check";

const caminhos: Record<NomeIcone, ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  filter: <path d="M4 7h16M7 12h10M10 17h4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5.3A3 3 0 0 1 16 11M17 14a5 5 0 0 1 4 4.9V20" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  play: <path d="m9 7 8 5-8 5Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
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
type CursoLinha = Database["public"]["Tables"]["courses"]["Row"];
type StatusMatricula = Database["public"]["Enums"]["enrollment_status"];

type AulaView = { id: string; titulo: string; concluida: boolean };
type ModuloView = { id: string; titulo: string; descricao: string; aulas: AulaView[] };

type Curso = {
  id: string;
  titulo: string;
  slug: string;
  descricao: string;
  categoria: string;
  tags: string[];
  status: CursoLinha["status"];
  visibilidade: CursoLinha["visibility"];
  educador: string;
  tom: Tom;
  simbolo: string;
  modulos: ModuloView[];
  totalAulas: number;
  aulasConcluidas: number;
  statusMatricula: StatusMatricula | null;
  nota: number;       // média de estrelas, de 0 a 5
  avaliacoes: number; // quantidade de avaliações
};

// Domínio exibido abaixo do nome do curso (vem do Figma).
const DOMINIO = "lumina.com";

const TONS: Tom[] = ["coral", "azul", "violeta", "menta", "rosa", "laranja"];
const SIMBOLOS = ["✦", "A", "</>", "π", "⚛", "◈"];

// Busca sem diferenciar maiúsculas e acentos.
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const descreverNota = (nota: number) => {
  if (nota >= 4.5) return "Excelente";
  if (nota >= 4) return "Muito boa";
  if (nota >= 3) return "Boa";
  return "Regular";
};

const mensagemDoErro = (erro: unknown) => (erro instanceof Error ? erro.message : "Algo deu errado. Tente novamente.");

const estaMatriculado = (curso: Curso) => curso.statusMatricula === "active" || curso.statusMatricula === "completed";

// Mesmo curso → mesma cor e símbolo (o banco não guarda isso).
function hashTexto(texto: string) {
  let hash = 0;
  for (const caractere of texto) hash = (hash * 31 + caractere.charCodeAt(0)) >>> 0;
  return hash;
}

type DadosCatalogo = { cursos: Curso[]; usuarioId: string };

// Busca tudo o que o catálogo precisa em poucas consultas e junta no navegador.
async function carregarCatalogo(): Promise<DadosCatalogo> {
  const { data: autenticacao } = await supabase.auth.getUser();
  const usuario = autenticacao.user;
  if (!usuario) throw new Error("Faça login para ver os cursos.");

  const [cursosBanco, modulosBanco, aulasBanco, matriculas, conclusoes, avaliacoesBanco] = await Promise.all([
    cursoRepository.listar(),
    moduloRepository.listar(),
    aulaRepository.listar(),
    matriculaRepository.listarPorUsuario(usuario.id),
    concluiRepository.listarPorUsuario(usuario.id),
    // Se a leitura das avaliações falhar, o catálogo continua funcionando sem notas.
    avaliacaoRepository.listar().catch(() => []),
  ]);

  const idsCriadores = [...new Set(cursosBanco.map((curso) => curso.creator_id))];
  const perfis = await Promise.all(idsCriadores.map((id) => usuarioRepository.obterPorId(id)));
  const nomesEducadores = new Map<string, string>();
  for (const perfil of perfis) {
    if (perfil) nomesEducadores.set(perfil.id, perfil.display_name);
  }

  const aulasConcluidas = new Set(conclusoes.filter((conclusao) => conclusao.context === "course").map((conclusao) => conclusao.lesson_id));
  const statusPorCurso = new Map(matriculas.map((matricula) => [matricula.course_id, matricula.status] as const));

  const aulasPorModulo = new Map<string, AulaView[]>();
  for (const aula of [...aulasBanco].sort((a, b) => a.position - b.position)) {
    const lista = aulasPorModulo.get(aula.module_id) ?? [];
    lista.push({ id: aula.id, titulo: aula.title, concluida: aulasConcluidas.has(aula.id) });
    aulasPorModulo.set(aula.module_id, lista);
  }

  const modulosPorCurso = new Map<string, ModuloView[]>();
  for (const modulo of [...modulosBanco].sort((a, b) => a.position - b.position)) {
    const lista = modulosPorCurso.get(modulo.course_id) ?? [];
    lista.push({
      id: modulo.id,
      titulo: modulo.title,
      descricao: modulo.description ?? "",
      aulas: aulasPorModulo.get(modulo.id) ?? [],
    });
    modulosPorCurso.set(modulo.course_id, lista);
  }

  const notasPorCurso = new Map<string, { soma: number; total: number }>();
  for (const avaliacao of avaliacoesBanco) {
    if (avaliacao.status !== "published") continue;
    const atual = notasPorCurso.get(avaliacao.course_id) ?? { soma: 0, total: 0 };
    notasPorCurso.set(avaliacao.course_id, { soma: atual.soma + avaliacao.rating, total: atual.total + 1 });
  }

  const cursos = cursosBanco.map<Curso>((curso) => {
    const modulos = modulosPorCurso.get(curso.id) ?? [];
    const aulas = modulos.flatMap((modulo) => modulo.aulas);
    const nota = notasPorCurso.get(curso.id);
    const hash = hashTexto(curso.id);
    const inicial = curso.title.trim().match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase();

    return {
      id: curso.id,
      titulo: curso.title,
      slug: curso.slug,
      descricao: curso.description ?? "",
      categoria: curso.category?.trim() || "Geral",
      tags: curso.tags,
      status: curso.status,
      visibilidade: curso.visibility,
      educador: nomesEducadores.get(curso.creator_id) ?? "Educador",
      tom: TONS[hash % TONS.length],
      simbolo: inicial ?? SIMBOLOS[hash % SIMBOLOS.length],
      modulos,
      totalAulas: aulas.length,
      aulasConcluidas: aulas.filter((aula) => aula.concluida).length,
      statusMatricula: statusPorCurso.get(curso.id) ?? null,
      nota: nota && nota.total > 0 ? nota.soma / nota.total : 0,
      avaliacoes: nota?.total ?? 0,
    };
  });

  // Cursos em que o usuário está matriculado aparecem primeiro (a ordenação é estável).
  cursos.sort((a, b) => Number(estaMatriculado(b)) - Number(estaMatriculado(a)));

  return { cursos, usuarioId: usuario.id };
}

// ---------------------------------------------------------------------------
// Card do curso
// ---------------------------------------------------------------------------
type CursoCardProps = {
  curso: Curso;
  expandido: boolean;
  onDestacar: () => void;
  onRemoverDestaque: () => void;
  onAbrir: () => void;
};

function CursoCard({ curso, expandido, onDestacar, onRemoverDestaque, onAbrir }: CursoCardProps) {
  const matriculado = estaMatriculado(curso);

  return (
    <article
      className={`cursos__card${expandido ? " cursos__card--expandido" : ""}`}
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
      <div className={`cursos__banner cursos__banner--${curso.tom}`}>
        <span className="cursos__banner-tag">{curso.categoria}</span>
        <div className="cursos__banner-orbita" />
      </div>

      <div className={`cursos__icone cursos__icone--${curso.tom}`}>{curso.simbolo}</div>

      <div className="cursos__conteudo">
        <div className="cursos__linha-titulo">
          <div>
            <h2 className="cursos__nome">{curso.titulo}</h2>
            <p className="cursos__slug">{DOMINIO}/{curso.slug}</p>
            <p>Educador: <strong>{curso.educador}</strong></p>
          </div>
          <span className="cursos__membros" title="Aulas do curso">
            <Icone nome="play" tamanho={14} />
            {curso.totalAulas}
          </span>
        </div>

        <div className="cursos__dados-curso">
          <p><strong>Categoria:</strong> {curso.categoria}</p>
          {matriculado ? (
            <p><strong>Progresso:</strong> {curso.aulasConcluidas}/{curso.totalAulas} aulas concluídas</p>
          ) : (
            <p><strong>Conteúdo:</strong> {curso.modulos.length} {curso.modulos.length === 1 ? "módulo" : "módulos"} · {curso.totalAulas} {curso.totalAulas === 1 ? "aula" : "aulas"}</p>
          )}
          <p>
            {matriculado && <span className="cursos__selo cursos__selo--ativo">Matriculado</span>}
            {curso.status === "draft" && <span className="cursos__selo">Rascunho</span>}
          </p>
        </div>

        {expandido && (
          <div className="cursos__expandido">
            <p className="cursos__descricao-curta">
              {curso.descricao || "Este curso ainda não tem uma descrição."}
            </p>
            <div className="cursos__rodape-card">
              <span className="cursos__nota">
                {curso.avaliacoes > 0 ? <><strong>{curso.nota.toFixed(1)}/5</strong> <span>★</span></> : <strong>Sem avaliações</strong>}
              </span>
              <span className="cursos__saiba-mais">
                Saiba mais <Icone nome="arrow" tamanho={17} />
              </span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Estado vazio (ainda não há cursos para mostrar)
// ---------------------------------------------------------------------------
function EstadoVazio({ onCriar }: { onCriar: () => void }) {
  return (
    <div className="cursos__vazio">
      <div className="cursos__vazio-ilustracao" aria-hidden="true">
        <span className="cursos__vazio-brilho cursos__vazio-brilho--1">✦</span>
        <span className="cursos__vazio-brilho cursos__vazio-brilho--2">✦</span>
        <div className="cursos__vazio-cartao" />
        <div className="cursos__vazio-porta">
          <div className="cursos__vazio-janela">✦</div>
          <div className="cursos__vazio-linha" />
        </div>
        <div className="cursos__vazio-figura">
          <span className="cursos__vazio-figura-cabeca" />
          <span className="cursos__vazio-figura-corpo" />
        </div>
        <div className="cursos__vazio-sombra" />
      </div>

      <p className="cursos__vazio-chamada">SUA JORNADA COMEÇA AQUI</p>
      <h2 className="cursos__vazio-titulo">Ainda não há cursos<br />publicados por aqui</h2>
      <p className="cursos__vazio-texto">
        Crie o primeiro curso para começar a aprender<br />e compartilhar conhecimento.
      </p>
      <button className="cursos__botao-primario" type="button" onClick={onCriar}>
        <Icone nome="plus" tamanho={19} />
        Criar curso
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pop-up com as informações do curso
// ---------------------------------------------------------------------------
type CursoModalProps = {
  curso: Curso;
  usuarioId: string;
  onFechar: () => void;
  // Pede para a página recarregar o catálogo (nota média, matrícula etc.).
  onAtualizar: () => Promise<void>;
};

// Estrelas de 1 a 5 (a nota de 0 do banco só existe para "sem nota").
function EstrelasNota({ valor, desabilitado, onEscolher }: { valor: number; desabilitado: boolean; onEscolher: (nota: number) => void }) {
  const [previa, setPrevia] = useState(0);
  const mostrado = previa || valor;

  return (
    <div className="cursos__estrelas" role="radiogroup" aria-label="Sua nota para o curso" onMouseLeave={() => setPrevia(0)}>
      {[1, 2, 3, 4, 5].map((nota) => (
        <button
          key={nota}
          type="button"
          role="radio"
          aria-checked={valor === nota}
          aria-label={`${nota} ${nota === 1 ? "estrela" : "estrelas"}`}
          disabled={desabilitado}
          className={`cursos__estrela${nota <= mostrado ? " cursos__estrela--cheia" : ""}`}
          onMouseEnter={() => setPrevia(nota)}
          onFocus={() => setPrevia(nota)}
          onBlur={() => setPrevia(0)}
          onClick={() => onEscolher(nota)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function CursoModal({ curso, usuarioId, onFechar, onAtualizar }: CursoModalProps) {
  const navigate = useNavigate();
  const [moduloAberto, setModuloAberto] = useState(0);
  const [entrando, setEntrando] = useState(false);
  const [erroEntrada, setErroEntrada] = useState("");
  // Avaliação do próprio usuário (undefined = carregando, null = ainda não avaliou).
  const [minhaAvaliacao, setMinhaAvaliacao] = useState<{ rating: number; comment: string } | null | undefined>(undefined);
  const [notaEscolhida, setNotaEscolhida] = useState(0);
  const [comentario, setComentario] = useState("");
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [mensagemNota, setMensagemNota] = useState("");
  const [erroNota, setErroNota] = useState("");
  // undefined = carregando, null = ainda sem tentativas finalizadas neste curso.
  const [desempenho, setDesempenho] = useState<{ pac: number; respostas: number } | null | undefined>(undefined);

  const matriculado = estaMatriculado(curso);
  const progresso = curso.totalAulas > 0 ? Math.round((curso.aulasConcluidas / curso.totalAulas) * 100) : 0;

  // Fecha com Esc e trava a rolagem da página enquanto o pop-up está aberto.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onFechar();
    }

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [onFechar]);

  // Taxa de acerto do usuário neste curso (só tentativas de curso já finalizadas).
  useEffect(() => {
    let cancelado = false;

    async function carregarDesempenho() {
      try {
        const tentativas = await tentativaRepository.listarPorUsuario(usuarioId);
        const doCurso = tentativas.filter((tentativa) => tentativa.course_id === curso.id && tentativa.room_id === null && tentativa.finished_at !== null);
        const acertos = doCurso.reduce((soma, tentativa) => soma + tentativa.correct_count, 0);
        const respostas = doCurso.reduce((soma, tentativa) => soma + tentativa.total_count, 0);
        if (!cancelado) setDesempenho(respostas > 0 ? { pac: Math.round((acertos / respostas) * 100), respostas } : null);
      } catch {
        if (!cancelado) setDesempenho(null);
      }
    }

    void carregarDesempenho();
    return () => { cancelado = true; };
  }, [curso.id, usuarioId]);

  // Carrega a avaliação que o próprio usuário já deu a este curso.
  useEffect(() => {
    let cancelado = false;

    async function carregarMinhaAvaliacao() {
      const avaliacao = await avaliacaoRepository.obter(curso.id, usuarioId);
      if (cancelado) return;
      setMinhaAvaliacao(avaliacao ? { rating: avaliacao.rating, comment: avaliacao.comment ?? "" } : null);
      setNotaEscolhida(avaliacao?.rating ?? 0);
      setComentario(avaliacao?.comment ?? "");
    }

    void carregarMinhaAvaliacao();
    return () => { cancelado = true; };
  }, [curso.id, usuarioId]);

  // Matricula (se ainda não estiver) e abre a trilha do curso no Dashboard.
  // Quem decide se pode é o banco: curso público e publicado, ou curso criado por você (rascunho incluso).
  async function entrar() {
    setEntrando(true);
    setErroEntrada("");

    try {
      if (curso.statusMatricula === null) {
        await matriculaRepository.matricular(curso.id);
      } else if (curso.statusMatricula === "dropped") {
        await matriculaRepository.atualizarStatus(curso.id, usuarioId, "active");
      }
      await onAtualizar();
      navigate(`/dashboard?curso=${curso.id}`);
    } catch (error) {
      setErroEntrada(`Não foi possível entrar no curso: ${mensagemDoErro(error)}`);
      setEntrando(false);
    }
  }

  // Cria ou substitui a sua avaliação (uma por usuário por curso).
  async function salvarAvaliacao() {
    if (notaEscolhida < 1) return;
    setSalvandoNota(true);
    setErroNota("");
    setMensagemNota("");

    try {
      const texto = comentario.trim();
      await avaliacaoRepository.salvar({ user_id: usuarioId, course_id: curso.id, rating: notaEscolhida, comment: texto || null });
      setMinhaAvaliacao({ rating: notaEscolhida, comment: texto });
      setMensagemNota(minhaAvaliacao ? "Avaliação atualizada." : "Obrigado pela avaliação!");
      await onAtualizar();
    } catch (error) {
      setErroNota(`Não foi possível salvar a avaliação: ${mensagemDoErro(error)}`);
    } finally {
      setSalvandoNota(false);
    }
  }

  async function removerAvaliacao() {
    setSalvandoNota(true);
    setErroNota("");
    setMensagemNota("");

    try {
      await avaliacaoRepository.deletar(curso.id, usuarioId);
      setMinhaAvaliacao(null);
      setNotaEscolhida(0);
      setComentario("");
      setMensagemNota("Avaliação removida.");
      await onAtualizar();
    } catch (error) {
      setErroNota(`Não foi possível remover a avaliação: ${mensagemDoErro(error)}`);
    } finally {
      setSalvandoNota(false);
    }
  }

  return (
    <div className="cursos__modal-camada" role="presentation">
      <div className="cursos__modal-fundo" onClick={onFechar} />

      <section className="cursos__modal" role="dialog" aria-modal="true" aria-labelledby="cursos-modal-titulo">
        <div className="cursos__modal-rolagem">
          <div className="cursos__modal-banner">
            <span className="cursos__modal-categoria">{curso.categoria.toUpperCase()}</span>
            <div className="cursos__modal-forma cursos__modal-forma--a" />
            <div className="cursos__modal-forma cursos__modal-forma--b" />
            <div className="cursos__modal-brilho">✦</div>
            <button className="cursos__modal-fechar" type="button" onClick={onFechar} aria-label="Fechar informações do curso">
              <Icone nome="close" tamanho={22} />
            </button>
          </div>

          <div className="cursos__modal-corpo">
            <div className="cursos__identidade">
              <div className="cursos__modal-icone">{curso.simbolo}</div>
              <div>
                <p className="cursos__rotulo">CURSO DE APRENDIZAGEM</p>
                <h2 className="cursos__modal-titulo" id="cursos-modal-titulo">{curso.titulo}</h2>
                <p className="cursos__modal-slug">{DOMINIO}/{curso.slug}</p>
              </div>
              <div className="cursos__meta">
                <div><span>Categoria:</span><strong>{curso.categoria}</strong></div>
                <div><span>Educador:</span><strong>{curso.educador}</strong></div>
                <div>
                  <span>Tags:</span>
                  {curso.tags.length > 0
                    ? curso.tags.map((tag) => <span className="cursos__tag" key={tag}>{tag}</span>)
                    : <strong>—</strong>}
                </div>
              </div>
            </div>

            <article className="cursos__sobre">
              <div>
                <p className="cursos__rotulo">SOBRE ESTE CURSO</p>
                <h3 className="cursos__sobre-titulo">Descrição completa</h3>
              </div>
              <p className="cursos__sobre-texto">
                {curso.descricao || "Este curso ainda não tem uma descrição."}
              </p>
            </article>

            <div className="cursos__colunas">
              {/* Trilha de aprendizagem */}
              <section className="cursos__painel cursos__modulos">
                <div className="cursos__painel-cabecalho">
                  <div>
                    <p className="cursos__rotulo">CONTEÚDO DO CURSO</p>
                    <h3 className="cursos__painel-titulo">Trilha de aprendizagem</h3>
                  </div>
                  <span className="cursos__painel-resumo">{curso.modulos.length} módulos · {curso.totalAulas} aulas</span>
                </div>

                {curso.modulos.length === 0 ? (
                  <p className="cursos__vazio-modulos">Este curso ainda não tem módulos.</p>
                ) : (
                  <div className="cursos__acordeao">
                    {curso.modulos.map((modulo, indice) => (
                      <div
                        className={`cursos__modulo${moduloAberto === indice ? " cursos__modulo--aberto" : ""}`}
                        key={modulo.id}
                      >
                        <button
                          className="cursos__modulo-botao"
                          type="button"
                          aria-expanded={moduloAberto === indice}
                          onClick={() => setModuloAberto(moduloAberto === indice ? -1 : indice)}
                        >
                          <span className="cursos__modulo-numero">{String(indice + 1).padStart(2, "0")}</span>
                          <span>
                            <strong>{modulo.titulo}</strong>
                            {modulo.descricao && <small>{modulo.descricao}</small>}
                          </span>
                          <Icone nome="chevron" tamanho={19} />
                        </button>

                        {moduloAberto === indice && (
                          <div className="cursos__aulas">
                            {modulo.aulas.length === 0 && <p className="cursos__vazio-modulos">Nenhuma aula neste módulo.</p>}
                            {modulo.aulas.map((aula) => (
                              <div className={`cursos__aula${aula.concluida ? " cursos__aula--concluida" : ""}`} key={aula.id}>
                                <span className="cursos__aula-play">
                                  <Icone nome={aula.concluida ? "check" : "play"} tamanho={13} />
                                </span>
                                <span>{aula.titulo}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Avaliações, progresso e desempenho */}
              <aside className="cursos__painel cursos__lateral">
                <p className="cursos__rotulo">AVALIAÇÕES</p>
                {curso.avaliacoes > 0 ? (
                  <>
                    <div className="cursos__nota-resumo"><strong className="cursos__nota-numero">{curso.nota.toFixed(1)}</strong><span className="cursos__nota-estrela">★</span></div>
                    <p className="cursos__nota-legenda">{descreverNota(curso.nota)} · {curso.avaliacoes} {curso.avaliacoes === 1 ? "avaliação" : "avaliações"}</p>
                    <div className="cursos__nota-barra"><span style={{ width: `${(curso.nota / 5) * 100}%` }} /></div>
                  </>
                ) : (
                  <p className="cursos__nota-legenda">Este curso ainda não foi avaliado.</p>
                )}

                {/* Avaliar: só quem está matriculado (o banco aceita qualquer usuário logado). */}
                <div className="cursos__taxa-acerto">
                  <p className="cursos__rotulo">SUA AVALIAÇÃO</p>
                  {matriculado ? (
                    <>
                      <h3 className="cursos__taxa-titulo">{minhaAvaliacao ? "Você avaliou este curso" : "Que nota você dá?"}</h3>
                      <EstrelasNota valor={notaEscolhida} desabilitado={salvandoNota || minhaAvaliacao === undefined} onEscolher={setNotaEscolhida} />
                      <textarea
                        className="cursos__comentario"
                        rows={3}
                        maxLength={500}
                        placeholder="Comentário (opcional)"
                        value={comentario}
                        disabled={salvandoNota || minhaAvaliacao === undefined}
                        onChange={(evento) => setComentario(evento.target.value)}
                      />
                      <div className="cursos__avaliacao-acoes">
                        <button
                          className="cursos__botao-primario cursos__botao-avaliar"
                          type="button"
                          disabled={salvandoNota || notaEscolhida < 1 || (minhaAvaliacao?.rating === notaEscolhida && minhaAvaliacao.comment === comentario.trim())}
                          onClick={() => void salvarAvaliacao()}
                        >
                          {salvandoNota ? "Salvando..." : minhaAvaliacao ? "Atualizar" : "Enviar avaliação"}
                        </button>
                        {minhaAvaliacao && (
                          <button className="cursos__link-remover" type="button" disabled={salvandoNota} onClick={() => void removerAvaliacao()}>
                            Remover
                          </button>
                        )}
                      </div>
                      {mensagemNota && <p className="cursos__taxa-legenda" role="status">{mensagemNota}</p>}
                      {erroNota && <p className="cursos__erro-inline" role="alert">{erroNota}</p>}
                    </>
                  ) : (
                    <p className="cursos__taxa-legenda">Matricule-se no curso para poder avaliá-lo.</p>
                  )}
                </div>

                {matriculado && (
                  <div className="cursos__taxa-acerto">
                    <p className="cursos__rotulo">SEU PROGRESSO</p>
                    <h3 className="cursos__taxa-titulo">Aulas concluídas</h3>
                    <div className="cursos__taxa-resumo">
                      <strong>{progresso}%</strong>
                      <span>{curso.aulasConcluidas} de {curso.totalAulas} aulas</span>
                    </div>
                    <div className="cursos__taxa-barra" role="progressbar" aria-label="Progresso no curso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso}>
                      <span style={{ width: `${progresso}%` }} />
                    </div>
                  </div>
                )}

                <div className="cursos__taxa-acerto">
                  <p className="cursos__rotulo">SEU DESEMPENHO</p>
                  <h3 className="cursos__taxa-titulo">Sua taxa de acerto atual</h3>
                  {desempenho ? (
                    <>
                      <div className="cursos__taxa-resumo">
                        <strong>{desempenho.pac}%</strong>
                        <span>das respostas corretas</span>
                      </div>
                      <div className="cursos__taxa-barra" role="progressbar" aria-label="Taxa de acerto atual" aria-valuemin={0} aria-valuemax={100} aria-valuenow={desempenho.pac}>
                        <span style={{ width: `${desempenho.pac}%` }} />
                      </div>
                      <p className="cursos__taxa-legenda">Com base em {desempenho.respostas} {desempenho.respostas === 1 ? "resposta" : "respostas"} neste curso</p>
                    </>
                  ) : (
                    <p className="cursos__taxa-legenda">{desempenho === undefined ? "Calculando..." : "Você ainda não respondeu atividades deste curso."}</p>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </div>

        <footer className="cursos__modal-rodape">
          <p>
            <Icone nome="clock" tamanho={17} />
            <strong>{curso.totalAulas} {curso.totalAulas === 1 ? "aula" : "aulas"}</strong> em {curso.modulos.length} {curso.modulos.length === 1 ? "módulo" : "módulos"}
          </p>
          <div className="cursos__modal-acoes">
            {erroEntrada && <span className="cursos__erro-inline" role="alert">{erroEntrada}</span>}
            <button className="cursos__botao-secundario" type="button" onClick={onFechar}>Fechar</button>
            <button
              className="cursos__botao-primario cursos__botao-entrar"
              type="button"
              disabled={entrando}
              onClick={() => void entrar()}
            >
              {entrando ? "Abrindo..." : matriculado ? "Continuar curso" : "Matricular-se"} <Icone nome="arrow" tamanho={18} />
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
const FORMULARIO_VAZIO = { titulo: "", categoria: "", descricao: "", tags: "", publicar: false };

export default function Cursos() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [usuarioId, setUsuarioId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [cursoEmDestaque, setCursoEmDestaque] = useState<string | null>(null);
  const [cursoAbertoId, setCursoAbertoId] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [somenteMatriculados, setSomenteMatriculados] = useState(false);
  const [novoCurso, setNovoCurso] = useState(FORMULARIO_VAZIO);
  const [erroFormulario, setErroFormulario] = useState("");
  const [salvando, setSalvando] = useState(false);

  const aplicarCatalogo = useCallback((dados: DadosCatalogo) => {
    setCursos(dados.cursos);
    setUsuarioId(dados.usuarioId);
  }, []);

  // Recarrega o catálogo depois de matrícula ou avaliação (mantém o popup aberto).
  const recarregarCatalogo = useCallback(async () => {
    try {
      aplicarCatalogo(await carregarCatalogo());
    } catch {
      // Se a recarga falhar, a tela continua com os dados que já tinha.
    }
  }, [aplicarCatalogo]);

  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      try {
        const dados = await carregarCatalogo();
        if (!cancelado) aplicarCatalogo(dados);
      } catch (error) {
        if (!cancelado) setErro(mensagemDoErro(error));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void iniciar();
    return () => { cancelado = true; };
  }, [aplicarCatalogo]);

  const termo = normalizar(busca.trim());
  const categorias = useMemo(() => [...new Set(cursos.map((curso) => curso.categoria))].sort((a, b) => a.localeCompare(b, "pt-BR")), [cursos]);
  const cursosFiltrados = useMemo(
    () =>
      cursos.filter(
        (curso) => (!termo || normalizar(curso.titulo).includes(termo) || normalizar(curso.categoria).includes(termo) || normalizar(curso.educador).includes(termo))
          && (!filtroCategoria || curso.categoria === filtroCategoria)
          && (!somenteMatriculados || estaMatriculado(curso)),
      ),
    [termo, cursos, filtroCategoria, somenteMatriculados],
  );
  const cursoAberto = cursos.find((curso) => curso.id === cursoAbertoId) ?? null;

  // Cria o curso de verdade (tabela courses). Começa como rascunho, visível só para o criador.
  async function criarCurso(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroFormulario("");

    const titulo = novoCurso.titulo.trim();
    const slugBase = normalizar(titulo).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slugBase) {
      setErroFormulario("Use letras ou números no nome do curso.");
      return;
    }

    const dados = {
      creator_id: usuarioId,
      title: titulo,
      description: novoCurso.descricao.trim() || null,
      category: novoCurso.categoria.trim() || null,
      tags: novoCurso.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 8),
      status: novoCurso.publicar ? "published" : "draft",
      visibility: "public",
    } as const;

    setSalvando(true);
    try {
      try {
        await cursoRepository.criar({ ...dados, slug: cursos.some((curso) => curso.slug === slugBase) ? `${slugBase}-${Math.random().toString(36).slice(2, 6)}` : slugBase });
      } catch (error) {
        // O slug é único em todo o banco (inclusive cursos que não aparecem para você): tenta de novo com sufixo.
        if (!/duplicate|unique/i.test(mensagemDoErro(error))) throw error;
        await cursoRepository.criar({ ...dados, slug: `${slugBase}-${Math.random().toString(36).slice(2, 6)}` });
      }

      aplicarCatalogo(await carregarCatalogo());
      setNovoCurso(FORMULARIO_VAZIO);
      setMostrarFormulario(false);
      setAviso(novoCurso.publicar ? "Curso criado e publicado." : "Curso criado como rascunho: só você consegue vê-lo até ele ser publicado.");
    } catch (error) {
      setErroFormulario(mensagemDoErro(error));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="cursos">
      <SidebarLeft />

      <main className="cursos__main">
        <div className="cursos__brilho" />

        <header className="cursos__cabecalho">
          <div>
            <p className="cursos__caminho">PLATAFORMA / <span>CURSOS</span></p>
            <h1 className="cursos__titulo">Cursos</h1>
            <p className="cursos__subtitulo">Aprenda em comunidade, compartilhe conquistas.</p>
          </div>
          <button className="cursos__botao-primario" type="button" disabled={!usuarioId} onClick={() => setMostrarFormulario((aberto) => !aberto)}>
            <Icone nome="plus" tamanho={19} />
            Criar curso
          </button>
        </header>

        {aviso && <p className="cursos__aviso-info" role="status">{aviso}</p>}

        {mostrarFormulario && (
          <form className="cursos__form-criar" onSubmit={(evento) => void criarCurso(evento)}>
            <h2>Criar curso</h2>
            <input required placeholder="Nome do curso" value={novoCurso.titulo} onChange={(e) => setNovoCurso({ ...novoCurso, titulo: e.target.value })} />
            <input placeholder="Categoria/assunto" value={novoCurso.categoria} onChange={(e) => setNovoCurso({ ...novoCurso, categoria: e.target.value })} />
            <input placeholder="Descrição curta" value={novoCurso.descricao} onChange={(e) => setNovoCurso({ ...novoCurso, descricao: e.target.value })} />
            <input placeholder="Tags separadas por vírgula" value={novoCurso.tags} onChange={(e) => setNovoCurso({ ...novoCurso, tags: e.target.value })} />
            <label><input type="checkbox" checked={novoCurso.publicar} onChange={(e) => setNovoCurso({ ...novoCurso, publicar: e.target.checked })} /> Publicar agora (visível para todos)</label>
            {erroFormulario && <p className="cursos__erro-inline" role="alert">{erroFormulario}</p>}
            <button className="cursos__botao-primario" type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Salvar curso"}</button>
            <button type="button" onClick={() => setMostrarFormulario(false)}>Cancelar</button>
          </form>
        )}

        <section className="cursos__ferramentas" aria-label="Busca e filtros">
          <label className="cursos__busca">
            <Icone nome="search" tamanho={21} />
            <input
              type="search"
              placeholder="Buscar por nome, assunto ou educador..."
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </label>
          <label className="cursos__filtro">
            <Icone nome="filter" />
            <span className="sr-only">Filtrar por categoria</span>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
              <option value="">Todas as categorias</option>
              {categorias.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
            </select>
          </label>
          <label><input type="checkbox" checked={somenteMatriculados} onChange={(e) => setSomenteMatriculados(e.target.checked)} /> Meus cursos</label>
        </section>

        <p className="cursos__contador">
          Cursos disponíveis <span>{cursosFiltrados.length}</span>
        </p>

        {carregando ? (
          <p className="cursos__sem-resultado">Carregando cursos...</p>
        ) : erro ? (
          <p className="cursos__sem-resultado cursos__sem-resultado--erro" role="alert">{erro}</p>
        ) : cursos.length === 0 ? (
          <EstadoVazio onCriar={() => setMostrarFormulario(true)} />
        ) : cursosFiltrados.length === 0 ? (
          <p className="cursos__sem-resultado">Nenhum curso encontrado com esses filtros.</p>
        ) : (
          <section className="cursos__grade">
            {cursosFiltrados.map((curso) => (
              <CursoCard
                key={curso.id}
                curso={curso}
                expandido={cursoEmDestaque === curso.id}
                onDestacar={() => setCursoEmDestaque(curso.id)}
                onRemoverDestaque={() => setCursoEmDestaque(null)}
                onAbrir={() => setCursoAbertoId(curso.id)}
              />
            ))}
          </section>
        )}
      </main>

      {cursoAberto && (
        <CursoModal
          key={cursoAberto.id}
          curso={cursoAberto}
          usuarioId={usuarioId}
          onFechar={() => setCursoAbertoId(null)}
          onAtualizar={recarregarCatalogo}
        />
      )}
    </div>
  );
}
