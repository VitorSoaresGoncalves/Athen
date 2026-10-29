import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "../components/layout/PageLayout";
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
import "./Catalogo.css";

type Curso = Database["public"]["Tables"]["courses"]["Row"];
type Modulo = Database["public"]["Tables"]["modules"]["Row"];
type Aula = Database["public"]["Tables"]["lessons"]["Row"];
type StatusMatricula = Database["public"]["Enums"]["enrollment_status"];
type AulaView = Aula & { concluida: boolean };
type ModuloComAulas = Modulo & { aulas: AulaView[] };

// ---------------------------------------------------------------------------
// Ícones (só os que esta página usa)
// ---------------------------------------------------------------------------
type NomeIcone = "search" | "filter" | "plus" | "close" | "arrow" | "play" | "chevron" | "check" | "clock";

const caminhos: Record<NomeIcone, ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  filter: <path d="M4 7h16M7 12h10M10 17h4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
  play: <path d="m9 7 8 5-8 5Z" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};

function Icone({ nome, tamanho = 20 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {caminhos[nome]}
    </svg>
  );
}

const DEFAULT_COURSE_ICON = "📚";

// Mesmo curso → mesma cor e símbolo (o banco não guarda isso), igual ao upstream.
const SIMBOLOS = ["✦", "A", "</>", "π", "⚛", "◈"];
function hashTexto(texto: string) {
  let hash = 0;
  for (const caractere of texto) hash = (hash * 31 + caractere.charCodeAt(0)) >>> 0;
  return hash;
}

// Busca sem diferenciar maiúsculas e acentos.
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const mensagemDoErro = (erro: unknown) => (erro instanceof Error ? erro.message : "Algo deu errado. Tente novamente.");
const descreverNota = (nota: number) => (nota >= 4.5 ? "Excelente" : nota >= 4 ? "Muito boa" : nota >= 3 ? "Boa" : "Regular");

// Seletor de estrelas (1 a 5) para a avaliação do próprio usuário.
function EstrelasNota({ valor, desabilitado, onEscolher }: { valor: number; desabilitado: boolean; onEscolher: (nota: number) => void }) {
  const [previa, setPrevia] = useState(0);
  const mostrado = previa || valor;
  return (
    <div className="catalogo__estrelas" role="radiogroup" aria-label="Sua nota para o curso" onMouseLeave={() => setPrevia(0)}>
      {[1, 2, 3, 4, 5].map((nota) => (
        <button
          key={nota}
          type="button"
          role="radio"
          aria-checked={valor === nota}
          aria-label={`${nota} de 5`}
          disabled={desabilitado}
          className={`catalogo__estrela${nota <= mostrado ? " catalogo__estrela--ativa" : ""}`}
          onMouseEnter={() => setPrevia(nota)}
          onClick={() => onEscolher(nota)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de detalhes do curso (estilo upstream, só com dados reais do banco):
// trilha de módulos/aulas, avaliação média, avaliação do próprio usuário,
// progresso e desempenho. Só campos que existem no banco são exibidos.
// ---------------------------------------------------------------------------
type CursoModalProps = {
  curso: Curso;
  educador: string;
  nota: number;
  avaliacoes: number;
  onFechar: () => void;
  onAtualizar: () => void;
};

function CursoModal({ curso, educador, nota, avaliacoes, onFechar, onAtualizar }: CursoModalProps) {
  const navigate = useNavigate();
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [modulos, setModulos] = useState<ModuloComAulas[]>([]);
  const [statusMatricula, setStatusMatricula] = useState<StatusMatricula | null>(null);
  const [moduloAberto, setModuloAberto] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  // Avaliação do próprio usuário (undefined = carregando, null = ainda não avaliou).
  const [minhaAvaliacao, setMinhaAvaliacao] = useState<{ rating: number; comment: string } | null | undefined>(undefined);
  const [notaEscolhida, setNotaEscolhida] = useState(0);
  const [comentario, setComentario] = useState("");
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [mensagemNota, setMensagemNota] = useState("");
  // Desempenho (undefined = carregando, null = sem tentativas finalizadas).
  const [desempenho, setDesempenho] = useState<{ pac: number; respostas: number } | null | undefined>(undefined);

  const matriculado = statusMatricula === "active" || statusMatricula === "completed";
  const totalAulas = modulos.reduce((soma, modulo) => soma + modulo.aulas.length, 0);
  const aulasConcluidas = modulos.reduce((soma, modulo) => soma + modulo.aulas.filter((aula) => aula.concluida).length, 0);
  const progresso = totalAulas > 0 ? Math.round((aulasConcluidas / totalAulas) * 100) : 0;

  // Esc + trava de rolagem.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) { if (evento.key === "Escape") onFechar(); }
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [onFechar]);

  // Carrega módulos/aulas (com conclusões), matrícula, avaliação própria e desempenho.
  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro("");
      try {
        const { data: userData } = await supabase.auth.getUser();
        const idUsuario = userData.user?.id ?? null;

        const [listaModulos, matricula, conclusoes, minha, tentativas] = await Promise.all([
          moduloRepository.listarPorCurso(curso.id),
          idUsuario ? matriculaRepository.obter(curso.id, idUsuario) : Promise.resolve(null),
          idUsuario ? concluiRepository.listarPorContexto("course") : Promise.resolve([]),
          idUsuario ? avaliacaoRepository.obter(curso.id, idUsuario) : Promise.resolve(null),
          idUsuario ? tentativaRepository.listarPorUsuario(idUsuario) : Promise.resolve([]),
        ]);

        const idsConcluidas = new Set(conclusoes.map((c) => c.lesson_id));
        const comAulas = await Promise.all(
          listaModulos.map(async (modulo) => ({
            ...modulo,
            aulas: (await aulaRepository.listarPorModulo(modulo.id)).map((aula) => ({ ...aula, concluida: idsConcluidas.has(aula.id) })),
          })),
        );

        // Desempenho: só tentativas de curso (sem sala) já finalizadas.
        const doCurso = tentativas.filter((t) => t.course_id === curso.id && t.room_id === null && t.finished_at !== null);
        const acertos = doCurso.reduce((s, t) => s + t.correct_count, 0);
        const respostas = doCurso.reduce((s, t) => s + t.total_count, 0);

        if (cancelado) return;
        setUsuarioId(idUsuario);
        setModulos(comAulas);
        setStatusMatricula(matricula?.status ?? null);
        setMinhaAvaliacao(minha ? { rating: minha.rating, comment: minha.comment ?? "" } : null);
        setNotaEscolhida(minha?.rating ?? 0);
        setComentario(minha?.comment ?? "");
        setDesempenho(respostas > 0 ? { pac: Math.round((acertos / respostas) * 100), respostas } : null);
      } catch (error) {
        if (!cancelado) setErro(mensagemDoErro(error));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();
    return () => { cancelado = true; };
  }, [curso.id]);

  // Matricula (se preciso) e abre a trilha no Dashboard.
  async function entrar() {
    setEntrando(true);
    setErro("");
    try {
      if (statusMatricula === null) {
        await matriculaRepository.matricular(curso.id);
      } else if (statusMatricula === "dropped" && usuarioId) {
        await matriculaRepository.atualizarStatus(curso.id, usuarioId, "active");
      }
      onAtualizar();
      navigate(`/dashboard?curso=${curso.id}`);
    } catch (error) {
      setErro(`Não foi possível entrar no curso: ${mensagemDoErro(error)}`);
      setEntrando(false);
    }
  }

  async function salvarAvaliacao() {
    if (!usuarioId || notaEscolhida < 1) return;
    setSalvandoNota(true);
    setMensagemNota("");
    try {
      const texto = comentario.trim();
      await avaliacaoRepository.salvar({ user_id: usuarioId, course_id: curso.id, rating: notaEscolhida, comment: texto || null });
      setMinhaAvaliacao({ rating: notaEscolhida, comment: texto });
      setMensagemNota(minhaAvaliacao ? "Avaliação atualizada." : "Obrigado pela avaliação!");
      onAtualizar();
    } catch (error) {
      setMensagemNota(`Não foi possível salvar: ${mensagemDoErro(error)}`);
    } finally {
      setSalvandoNota(false);
    }
  }

  async function removerAvaliacao() {
    if (!usuarioId) return;
    setSalvandoNota(true);
    setMensagemNota("");
    try {
      await avaliacaoRepository.deletar(curso.id, usuarioId);
      setMinhaAvaliacao(null);
      setNotaEscolhida(0);
      setComentario("");
      setMensagemNota("Avaliação removida.");
      onAtualizar();
    } catch (error) {
      setMensagemNota(`Não foi possível remover: ${mensagemDoErro(error)}`);
    } finally {
      setSalvandoNota(false);
    }
  }

  // Símbolo do ícone, estável por curso (mesma lógica do upstream).
  const inicial = curso.title.trim().match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase();
  const simbolo = inicial ?? SIMBOLOS[hashTexto(curso.id) % SIMBOLOS.length];

  return (
    <div className="catalogo__modal-camada" role="presentation">
      <div className="catalogo__modal-fundo" onClick={onFechar} />

      <section className="catalogo__modal" role="dialog" aria-modal="true" aria-labelledby="catalogo-modal-titulo">
        <div className="catalogo__modal-rolagem">
          <div className="catalogo__modal-banner">
            <span className="catalogo__modal-categoria">{(curso.category || "Geral").toUpperCase()}</span>
            <div className="catalogo__modal-forma catalogo__modal-forma--a" />
            <div className="catalogo__modal-forma catalogo__modal-forma--b" />
            <div className="catalogo__modal-brilho">✦</div>
            <button className="catalogo__modal-fechar" type="button" onClick={onFechar} aria-label="Fechar informações do curso">
              <Icone nome="close" tamanho={22} />
            </button>
          </div>

          <div className="catalogo__modal-corpo">
            <div className="catalogo__identidade">
              <div className="catalogo__modal-icone">{simbolo}</div>
              <div>
                <p className="catalogo__rotulo">CURSO DE APRENDIZAGEM</p>
                <h2 className="catalogo__modal-titulo" id="catalogo-modal-titulo">{curso.title}</h2>
                <p className="catalogo__modal-slug">{curso.slug}</p>
              </div>
              <div className="catalogo__meta">
                <div><span>Categoria:</span><strong>{curso.category || "Geral"}</strong></div>
                <div><span>Educador:</span><strong>{educador}</strong></div>
                <div>
                  <span>Tags:</span>
                  {curso.tags.length > 0 ? curso.tags.map((tag) => <span className="catalogo__tag" key={tag}>{tag}</span>) : <strong>—</strong>}
                </div>
              </div>
            </div>

            <article className="catalogo__sobre">
              <div>
                <p className="catalogo__rotulo">SOBRE ESTE CURSO</p>
                <h3 className="catalogo__sobre-titulo">Descrição completa</h3>
              </div>
              <p className="catalogo__sobre-texto">{curso.description || "Este curso ainda não tem uma descrição."}</p>
            </article>

            <div className="catalogo__colunas">
              {/* Trilha de aprendizagem */}
              <section className="catalogo__painel catalogo__modulos">
                <div className="catalogo__painel-cabecalho">
                  <div>
                    <p className="catalogo__rotulo">CONTEÚDO DO CURSO</p>
                    <h3 className="catalogo__painel-titulo">Trilha de aprendizagem</h3>
                  </div>
                  <span className="catalogo__painel-resumo">{carregando ? "..." : `${modulos.length} módulos · ${totalAulas} aulas`}</span>
                </div>

                {carregando ? (
                  <p className="catalogo__vazio-modulos">Carregando conteúdo...</p>
                ) : modulos.length === 0 ? (
                  <p className="catalogo__vazio-modulos">Este curso ainda não tem módulos.</p>
                ) : (
                  <div className="catalogo__acordeao">
                    {modulos.map((modulo, indice) => (
                      <div className={`catalogo__modulo${moduloAberto === indice ? " catalogo__modulo--aberto" : ""}`} key={modulo.id}>
                        <button className="catalogo__modulo-botao" type="button" aria-expanded={moduloAberto === indice} onClick={() => setModuloAberto(moduloAberto === indice ? -1 : indice)}>
                          <span className="catalogo__modulo-numero">{String(indice + 1).padStart(2, "0")}</span>
                          <span>
                            <strong>{modulo.title}</strong>
                            {modulo.description && <small>{modulo.description}</small>}
                          </span>
                          <Icone nome="chevron" tamanho={19} />
                        </button>
                        {moduloAberto === indice && (
                          <div className="catalogo__aulas">
                            {modulo.aulas.length === 0 && <p className="catalogo__vazio-modulos">Nenhuma aula neste módulo.</p>}
                            {modulo.aulas.map((aula) => (
                              <div className={`catalogo__aula${aula.concluida ? " catalogo__aula--concluida" : ""}`} key={aula.id}>
                                <span className="catalogo__aula-play"><Icone nome={aula.concluida ? "check" : "play"} tamanho={13} /></span>
                                <span>{aula.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Avaliações, avaliação própria, progresso e desempenho */}
              <aside className="catalogo__painel catalogo__lateral">
                <p className="catalogo__rotulo">AVALIAÇÕES</p>
                {avaliacoes > 0 ? (
                  <>
                    <div className="catalogo__nota-resumo"><strong className="catalogo__nota-numero">{nota.toFixed(1)}</strong><span className="catalogo__nota-estrela">★</span></div>
                    <p className="catalogo__nota-legenda">{descreverNota(nota)} · {avaliacoes} {avaliacoes === 1 ? "avaliação" : "avaliações"}</p>
                    <div className="catalogo__nota-barra"><span style={{ width: `${(nota / 5) * 100}%` }} /></div>
                  </>
                ) : (
                  <p className="catalogo__nota-legenda">Este curso ainda não foi avaliado.</p>
                )}

                <div className="catalogo__taxa-acerto">
                  <p className="catalogo__rotulo">SUA AVALIAÇÃO</p>
                  {matriculado ? (
                    <>
                      <h3 className="catalogo__taxa-titulo">{minhaAvaliacao ? "Você avaliou este curso" : "Que nota você dá?"}</h3>
                      <EstrelasNota valor={notaEscolhida} desabilitado={salvandoNota || minhaAvaliacao === undefined} onEscolher={setNotaEscolhida} />
                      <textarea
                        className="catalogo__comentario"
                        rows={3}
                        maxLength={500}
                        placeholder="Comentário (opcional)"
                        value={comentario}
                        disabled={salvandoNota || minhaAvaliacao === undefined}
                        onChange={(evento) => setComentario(evento.target.value)}
                      />
                      <div className="catalogo__avaliacao-acoes">
                        <button
                          className="catalogo__botao-primario catalogo__botao-avaliar"
                          type="button"
                          disabled={salvandoNota || notaEscolhida < 1 || (minhaAvaliacao?.rating === notaEscolhida && minhaAvaliacao.comment === comentario.trim())}
                          onClick={() => void salvarAvaliacao()}
                        >
                          {salvandoNota ? "Salvando..." : minhaAvaliacao ? "Atualizar" : "Enviar avaliação"}
                        </button>
                        {minhaAvaliacao && (
                          <button className="catalogo__link-remover" type="button" disabled={salvandoNota} onClick={() => void removerAvaliacao()}>Remover</button>
                        )}
                      </div>
                      {mensagemNota && <p className="catalogo__taxa-legenda" role="status">{mensagemNota}</p>}
                    </>
                  ) : (
                    <p className="catalogo__taxa-legenda">Matricule-se no curso para poder avaliá-lo.</p>
                  )}
                </div>

                {matriculado && (
                  <div className="catalogo__taxa-acerto">
                    <p className="catalogo__rotulo">SEU PROGRESSO</p>
                    <h3 className="catalogo__taxa-titulo">Aulas concluídas</h3>
                    <div className="catalogo__taxa-resumo"><strong>{progresso}%</strong><span>{aulasConcluidas} de {totalAulas} aulas</span></div>
                    <div className="catalogo__taxa-barra" role="progressbar" aria-label="Progresso no curso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso}><span style={{ width: `${progresso}%` }} /></div>
                  </div>
                )}

                <div className="catalogo__taxa-acerto">
                  <p className="catalogo__rotulo">SEU DESEMPENHO</p>
                  <h3 className="catalogo__taxa-titulo">Sua taxa de acerto atual</h3>
                  {desempenho ? (
                    <>
                      <div className="catalogo__taxa-resumo"><strong>{desempenho.pac}%</strong><span>das respostas corretas</span></div>
                      <div className="catalogo__taxa-barra" role="progressbar" aria-label="Taxa de acerto atual" aria-valuemin={0} aria-valuemax={100} aria-valuenow={desempenho.pac}><span style={{ width: `${desempenho.pac}%` }} /></div>
                      <p className="catalogo__taxa-legenda">Com base em {desempenho.respostas} {desempenho.respostas === 1 ? "resposta" : "respostas"} neste curso</p>
                    </>
                  ) : (
                    <p className="catalogo__taxa-legenda">{desempenho === undefined ? "Calculando..." : "Você ainda não respondeu atividades deste curso."}</p>
                  )}
                </div>
              </aside>
            </div>

            {erro && <p className="catalogo__erro-inline" role="alert">{erro}</p>}
          </div>
        </div>

        <footer className="catalogo__modal-rodape">
          <p>
            <Icone nome="clock" tamanho={17} />
            <strong>{totalAulas} {totalAulas === 1 ? "aula" : "aulas"}</strong> em {modulos.length} {modulos.length === 1 ? "módulo" : "módulos"}
          </p>
          <div className="catalogo__modal-acoes">
            <button className="catalogo__botao-secundario" type="button" onClick={onFechar}>Fechar</button>
            <button className="catalogo__botao-primario catalogo__botao-entrar" type="button" onClick={() => void entrar()} disabled={entrando}>
              {entrando ? "Abrindo..." : matriculado ? "Continuar curso" : "Matricular-se"} <Icone nome="arrow" tamanho={18} />
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

// Paleta de "tons" dos cards (puramente decorativa, atribuída por índice —
// não representa nenhum dado do banco).
const TONS = ["coral", "azul", "violeta", "menta", "rosa", "laranja"] as const;
type Tom = (typeof TONS)[number];

// Curso + metadados reais calculados para o card (contagens, educador, nota).
type CursoComMeta = {
  curso: Curso;
  tom: Tom;
  modulos: number;
  aulas: number;
  educador: string;
  nota: number;
  avaliacoes: number;
  matriculado: boolean;
};

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default function Catalogo() {
  const navigate = useNavigate();
  const [itens, setItens] = useState<CursoComMeta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [somenteMatriculados, setSomenteMatriculados] = useState(false);
  const [cursoAberto, setCursoAberto] = useState<CursoComMeta | null>(null);
  const [recarregarToken, setRecarregarToken] = useState(0);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro("");
      try {
        const { data: userData } = await supabase.auth.getUser();
        const meuId = userData.user?.id ?? null;
        const lista = await cursoRepository.listarPublicados();

        // Para cada curso, calcula os metadados reais exibidos no card.
        const comMeta = await Promise.all(
          lista.map(async (curso, indice): Promise<CursoComMeta> => {
            const [modulos, educador, media, matricula] = await Promise.all([
              moduloRepository.listarPorCurso(curso.id),
              usuarioRepository.obterPorId(curso.creator_id),
              avaliacaoRepository.obterMediaPorCurso(curso.id),
              meuId ? matriculaRepository.obter(curso.id, meuId) : Promise.resolve(null),
            ]);
            const aulasPorModulo = await Promise.all(modulos.map((m) => aulaRepository.listarPorModulo(m.id)));
            const aulas = aulasPorModulo.reduce((soma, lista) => soma + lista.length, 0);

            return {
              curso,
              tom: TONS[indice % TONS.length],
              modulos: modulos.length,
              aulas,
              educador: educador?.display_name || "Educador",
              nota: media.media,
              avaliacoes: media.total,
              matriculado: matricula?.status === "active" || matricula?.status === "completed",
            };
          }),
        );

        if (!cancelado) {
          setItens(comMeta);
          // Mantém o modal aberto sincronizado com os dados recém-carregados.
          setCursoAberto((atual) => (atual ? comMeta.find((item) => item.curso.id === atual.curso.id) ?? atual : null));
        }
      } catch (error) {
        if (!cancelado) setErro(error instanceof Error ? error.message : "Não foi possível carregar os cursos.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();
    return () => { cancelado = true; };
  }, [recarregarToken]);

  const categorias = useMemo(
    () => [...new Set(itens.map((item) => item.curso.category).filter((c): c is string => Boolean(c)))].sort(),
    [itens],
  );

  const termo = normalizar(busca.trim());
  const itensFiltrados = useMemo(
    () => itens.filter(
      ({ curso, matriculado }) =>
        (!termo || normalizar(curso.title).includes(termo) || normalizar(curso.category ?? "").includes(termo))
        && (!categoria || curso.category === categoria)
        && (!somenteMatriculados || matriculado),
    ),
    [itens, termo, categoria, somenteMatriculados],
  );

  return (
    <PageLayout variant="bare">
      <div className="catalogo">
        <main className="catalogo__main">
          <div className="catalogo__brilho" />

          <header className="catalogo__cabecalho">
            <div>
              <p className="catalogo__caminho">PLATAFORMA / <span>CATÁLOGO</span></p>
              <h1 className="catalogo__titulo">Catálogo</h1>
              <p className="catalogo__subtitulo">Explore os cursos da comunidade e comece a aprender.</p>
            </div>
            <button className="catalogo__botao-primario" type="button" onClick={() => navigate("/criar-curso")}>
              <Icone nome="plus" tamanho={19} />
              Criar curso
            </button>
          </header>

          <section className="catalogo__ferramentas" aria-label="Busca e filtros">
            <label className="catalogo__busca">
              <Icone nome="search" tamanho={21} />
              <input
                type="search"
                placeholder="Buscar por nome ou assunto..."
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
              />
            </label>
            <label className="catalogo__filtro">
              <Icone nome="filter" />
              <span className="sr-only">Filtrar por categoria</span>
              <select value={categoria} onChange={(evento) => setCategoria(evento.target.value)} disabled={categorias.length === 0}>
                <option value="">Todas as categorias</option>
                {categorias.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </label>
            <button
              type="button"
              className={`catalogo__botao-filtro${somenteMatriculados ? " catalogo__botao-filtro--ativo" : ""}`}
              aria-pressed={somenteMatriculados}
              onClick={() => setSomenteMatriculados((atual) => !atual)}
            >
              <Icone nome="check" tamanho={16} />
              Meus cursos
            </button>
          </section>

          <p className="catalogo__contador">
            Cursos disponíveis <span>{carregando ? "..." : itensFiltrados.length}</span>
          </p>

          {carregando ? (
            <p className="catalogo__estado">Carregando cursos...</p>
          ) : erro ? (
            <p className="catalogo__estado catalogo__estado--erro">{erro}</p>
          ) : itens.length === 0 ? (
            <p className="catalogo__estado">Nenhum curso publicado ainda.</p>
          ) : itensFiltrados.length === 0 ? (
            <p className="catalogo__estado">
              {somenteMatriculados && !busca && !categoria
                ? "Você ainda não está matriculado em nenhum curso."
                : "Nenhum curso encontrado para a busca."}
            </p>
          ) : (
            <section className="catalogo__grade">
              {itensFiltrados.map((item) => {
                const { curso } = item;
                return (
                  <button
                    key={curso.id}
                    type="button"
                    className={`catalogo__card catalogo__card--${item.tom}`}
                    onClick={() => setCursoAberto(item)}
                  >
                    <div className={`catalogo__card-banner catalogo__card-banner--${item.tom}`}>
                      {curso.cover_url && <img src={curso.cover_url} alt="" className="catalogo__card-img" />}
                      {curso.category && <span className="catalogo__card-tag">{curso.category}</span>}
                      <span className="catalogo__card-aulas" title="Aulas do curso">
                        <Icone nome="play" tamanho={13} /> {item.aulas}
                      </span>
                    </div>
                    <div className={`catalogo__card-icone catalogo__card-icone--${item.tom}`} aria-hidden="true">{DEFAULT_COURSE_ICON}</div>
                    <div className="catalogo__card-corpo">
                      <h2 className="catalogo__card-titulo">{curso.title}</h2>
                      <p className="catalogo__card-educador">Educador: <strong>{item.educador}</strong></p>

                      <div className="catalogo__card-dados">
                        <p><strong>Conteúdo:</strong> {item.modulos} {item.modulos === 1 ? "módulo" : "módulos"} · {item.aulas} {item.aulas === 1 ? "aula" : "aulas"}</p>
                        <p className="catalogo__card-selos">
                          {item.matriculado && <span className="catalogo__selo catalogo__selo--ativo">Matriculado</span>}
                          {item.avaliacoes > 0
                            ? <span className="catalogo__selo"><strong>{item.nota.toFixed(1)}</strong> ★ ({item.avaliacoes})</span>
                            : <span className="catalogo__selo">Sem avaliações</span>}
                        </p>
                      </div>

                      {curso.description && <p className="catalogo__card-desc">{curso.description}</p>}
                      <span className="catalogo__card-mais">Ver curso <Icone nome="arrow" tamanho={16} /></span>
                    </div>
                  </button>
                );
              })}
            </section>
          )}
        </main>
      </div>

      {cursoAberto && (
        <CursoModal
          curso={cursoAberto.curso}
          educador={cursoAberto.educador}
          nota={cursoAberto.nota}
          avaliacoes={cursoAberto.avaliacoes}
          onFechar={() => setCursoAberto(null)}
          onAtualizar={() => setRecarregarToken((t) => t + 1)}
        />
      )}
    </PageLayout>
  );
}