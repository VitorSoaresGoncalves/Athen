import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "../components/layout/PageLayout";
import { Modal, ModalFechar } from "../components/modal/Modal";
import { LessonModal } from "../components/lesson/LessonModal";
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
type NomeIcone = "search" | "sliders" | "plus" | "close" | "arrow" | "play" | "chevron" | "check" | "clock" | "grid" | "rows" | "prev" | "next";

const caminhos: Record<NomeIcone, ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  sliders: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  rows: <><rect x="3" y="5" width="18" height="5.5" rx="1.5" /><rect x="3" y="13.5" width="18" height="5.5" rx="1.5" /></>,
  prev: <path d="m15 6-6 6 6 6" />,
  next: <path d="m9 6 6 6-6 6" />,
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

// Cor de destaque de cada módulo na aula (igual às Salas). Usa a cor do banco
// quando ela é um hex válido; senão, cai numa paleta fixa por posição.
const CORES_MODULO = ["#a855f7", "#38bdf8", "#f59e0b", "#34d399", "#f472b6", "#f97316"];
function corDoModulo(cor: string | null, indice: number) {
  const candidata = cor?.trim();
  return candidata && /^#[0-9a-fA-F]{3,8}$/.test(candidata) ? candidata : CORES_MODULO[indice % CORES_MODULO.length];
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
  // Aula aberta por cima do pop-up do curso (roda como atividade do curso).
  const [aulaAberta, setAulaAberta] = useState<{ aula: AulaView; modulo: ModuloComAulas; indice: number } | null>(null);
  // Recarrega a trilha/desempenho sem piscar o "Carregando" (ex.: após concluir uma aula).
  const [recarregarToken, setRecarregarToken] = useState(0);

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

  // Carrega módulos/aulas (com conclusões), matrícula, avaliação própria e desempenho.
  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      // Só mostra o "Carregando" na primeira vez; recargas (após concluir uma
      // aula) atualizam a trilha em silêncio.
      if (recarregarToken === 0) setCarregando(true);
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
  }, [curso.id, recarregarToken]);

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
    <>
    <Modal
      onFechar={onFechar}
      rotuladoPor="catalogo-modal-titulo"
      /* Com uma aula aberta por cima, o Esc fecha só a aula (o LessonModal cuida
         do fechamento); o pop-up do curso ignora o Esc nesse momento. */
      fecharComEsc={aulaAberta === null}
    >
        <div className="modal__rolagem">
          <div className="modal__banner">
            <span className="modal__categoria">{(curso.category || "Geral").toUpperCase()}</span>
            <div className="modal__forma modal__forma--a" />
            <div className="modal__forma modal__forma--b" />
            <div className="modal__brilho">✦</div>
            <ModalFechar onFechar={onFechar} rotulo="Fechar informações do curso">
              <Icone nome="close" tamanho={22} />
            </ModalFechar>
          </div>

          <div className="modal__corpo">
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
                <div className="catalogo__meta-tags">
                  <span>Tags:</span>
                  {curso.tags.length > 0
                    ? <span className="catalogo__meta-chips">{curso.tags.map((tag) => <span className="catalogo__tag" key={tag}>{tag}</span>)}</span>
                    : <strong>—</strong>}
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
                              <button
                                type="button"
                                className={`catalogo__aula catalogo__aula--botao${aula.concluida ? " catalogo__aula--concluida" : ""}`}
                                key={aula.id}
                                onClick={() => setAulaAberta({ aula, modulo, indice })}
                              >
                                <span className="catalogo__aula-play"><Icone nome={aula.concluida ? "check" : "play"} tamanho={13} /></span>
                                <span>{aula.title}</span>
                                <small>{aula.concluida ? "Concluída" : "Fazer aula"}</small>
                              </button>
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

        <footer className="modal__rodape">
          <p>
            <Icone nome="clock" tamanho={17} />
            <strong>{totalAulas} {totalAulas === 1 ? "aula" : "aulas"}</strong> em {modulos.length} {modulos.length === 1 ? "módulo" : "módulos"}
          </p>
          <div className="modal__acoes">
            <button className="catalogo__botao-secundario" type="button" onClick={onFechar}>Fechar</button>
            <button className="catalogo__botao-primario catalogo__botao-entrar" type="button" onClick={() => void entrar()} disabled={entrando}>
              {entrando ? "Abrindo..." : matriculado ? "Continuar curso" : "Matricular-se"} <Icone nome="arrow" tamanho={18} />
            </button>
          </div>
        </footer>
    </Modal>

    {/* Aula aberta por cima: roda como atividade do curso (sem salaId, então o
        XP vai para o XP global). Ao concluir, a trilha recarrega em silêncio. */}
    {aulaAberta && (
      <LessonModal
        key={aulaAberta.aula.id}
        aula={aulaAberta.aula}
        moduloTitulo={aulaAberta.modulo.title}
        cursoId={curso.id}
        cor={corDoModulo(aulaAberta.modulo.color, aulaAberta.indice)}
        jaConcluida={aulaAberta.aula.concluida}
        onFechar={() => setAulaAberta(null)}
        onConcluida={() => {
          setRecarregarToken((token) => token + 1);
          onAtualizar();
        }}
      />
    )}
    </>
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

type ModoExibicao = "carrosseis" | "todos";

// ---------------------------------------------------------------------------
// Card de curso (usado na grade e nos carrosséis)
// ---------------------------------------------------------------------------
function CartaoCurso({ item, onAbrir }: { item: CursoComMeta; onAbrir: (item: CursoComMeta) => void }) {
  const { curso } = item;
  return (
    <button type="button" className={`catalogo__card catalogo__card--${item.tom}`} onClick={() => onAbrir(item)}>
      <div className={`catalogo__card-banner catalogo__card-banner--${item.tom}`}>
        {curso.cover_url && <img src={curso.cover_url} alt="" className="catalogo__card-img" />}
        {curso.category && <span className="catalogo__card-tag">{curso.category}</span>}
        <span className="catalogo__card-aulas" title="Aulas do curso">
          <Icone nome="play" tamanho={13} /> {item.aulas}
        </span>
      </div>
      <div className={`catalogo__card-icone catalogo__card-icone--${item.tom}`} aria-hidden="true">{DEFAULT_COURSE_ICON}</div>
      <div className="catalogo__card-corpo">
        <h3 className="catalogo__card-titulo">{curso.title}</h3>
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
}

// ---------------------------------------------------------------------------
// Carrossel horizontal (rolagem com snap + setas nas laterais)
// ---------------------------------------------------------------------------
type CarrosselProps = {
  titulo: string;
  descricao: string;
  itens: CursoComMeta[];
  onAbrir: (item: CursoComMeta) => void;
};

function Carrossel({ titulo, descricao, itens, onAbrir }: CarrosselProps) {
  const idTitulo = useId();
  const trilhaRef = useRef<HTMLDivElement>(null);
  const [limites, setLimites] = useState({ inicio: true, fim: true });

  const atualizarLimites = useCallback(() => {
    const trilha = trilhaRef.current;
    if (!trilha) return;
    setLimites({
      inicio: trilha.scrollLeft <= 4,
      fim: trilha.scrollLeft + trilha.clientWidth >= trilha.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    atualizarLimites();
    const trilha = trilhaRef.current;
    if (!trilha || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(atualizarLimites);
    observador.observe(trilha);
    return () => observador.disconnect();
  }, [atualizarLimites, itens.length]);

  function rolar(direcao: 1 | -1) {
    const trilha = trilhaRef.current;
    if (!trilha) return;
    trilha.scrollBy({ left: direcao * trilha.clientWidth * 0.85, behavior: "smooth" });
  }

  return (
    <section className="catalogo__secao" aria-labelledby={idTitulo}>
      <div className="catalogo__secao-topo">
        <h2 className="catalogo__secao-titulo" id={idTitulo}>{titulo}</h2>
        <p className="catalogo__secao-desc">{descricao}</p>
      </div>

      <div className="catalogo__carrossel">
        {!limites.inicio && (
          <button type="button" className="catalogo__seta catalogo__seta--prev" aria-label={`Anterior: ${titulo}`} onClick={() => rolar(-1)}>
            <Icone nome="prev" tamanho={20} />
          </button>
        )}
        <div className="catalogo__trilha" ref={trilhaRef} onScroll={atualizarLimites} role="list">
          {itens.map((item) => (
            <div className="catalogo__trilha-item" role="listitem" key={item.curso.id}>
              <CartaoCurso item={item} onAbrir={onAbrir} />
            </div>
          ))}
        </div>
        {!limites.fim && (
          <button type="button" className="catalogo__seta catalogo__seta--next" aria-label={`Próximo: ${titulo}`} onClick={() => rolar(1)}>
            <Icone nome="next" tamanho={20} />
          </button>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Painel de filtros (botão + pop-over)
// ---------------------------------------------------------------------------
type FiltrosProps = {
  categorias: string[];
  categoria: string;
  verTodos: boolean;
  // Com "Meus cursos" ativo a exibição é sempre em grade; a opção some do painel.
  mostrarExibicao: boolean;
  onCategoria: (categoria: string) => void;
  onVerTodos: (valor: boolean) => void;
  onLimpar: () => void;
};

function PainelFiltros({ categorias, categoria, verTodos, mostrarExibicao, onCategoria, onVerTodos, onLimpar }: FiltrosProps) {
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const idPainel = useId();
  const ativos = (categoria ? 1 : 0) + (mostrarExibicao && verTodos ? 1 : 0);

  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: MouseEvent) => {
      if (raizRef.current && !raizRef.current.contains(evento.target as Node)) setAberto(false);
    };
    const esc = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div className="catalogo__filtros" ref={raizRef}>
      <button
        type="button"
        className={`catalogo__botao-ferramenta${aberto || ativos > 0 ? " catalogo__botao-ferramenta--ativo" : ""}`}
        aria-expanded={aberto}
        aria-controls={idPainel}
        onClick={() => setAberto((atual) => !atual)}
      >
        <Icone nome="sliders" tamanho={18} />
        Filtros
        {ativos > 0 && <span className="catalogo__filtros-contagem" aria-label={`${ativos} ${ativos === 1 ? "filtro ativo" : "filtros ativos"}`}>{ativos}</span>}
        <span className={`catalogo__filtros-seta${aberto ? " catalogo__filtros-seta--aberta" : ""}`}><Icone nome="chevron" tamanho={16} /></span>
      </button>

      {aberto && (
        <div className="catalogo__filtros-painel" id={idPainel} role="dialog" aria-label="Filtros do catálogo">
          <div className="catalogo__filtros-topo">
            <strong>Filtros</strong>
            <button type="button" className="catalogo__filtros-limpar" disabled={ativos === 0} onClick={onLimpar}>Limpar filtros</button>
          </div>

          <div className="catalogo__filtros-grupo">
            <p className="catalogo__rotulo">CATEGORIA</p>
            <div className="catalogo__chips" role="group" aria-label="Filtrar por categoria">
              <button type="button" className={`catalogo__chip${categoria === "" ? " catalogo__chip--ativo" : ""}`} aria-pressed={categoria === ""} onClick={() => onCategoria("")}>
                Todas as categorias
              </button>
              {categorias.map((cat) => (
                <button type="button" key={cat} className={`catalogo__chip${categoria === cat ? " catalogo__chip--ativo" : ""}`} aria-pressed={categoria === cat} onClick={() => onCategoria(cat)}>
                  {cat}
                </button>
              ))}
            </div>
            {categorias.length === 0 && <p className="catalogo__filtros-vazio">Nenhuma categoria disponível.</p>}
          </div>

          {mostrarExibicao && (
            <div className="catalogo__filtros-grupo">
              <p className="catalogo__rotulo">EXIBIÇÃO</p>
              <button type="button" className="catalogo__opcao" aria-pressed={verTodos} onClick={() => onVerTodos(!verTodos)}>
                <span>Ver todos os cursos</span>
                <span className={`catalogo__interruptor${verTodos ? " catalogo__interruptor--ativo" : ""}`} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [modo, setModo] = useState<ModoExibicao>("carrosseis");
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

  // TODO (próxima etapa, com banco): os três grupos abaixo são provisórios e
  // só definem a ordem visual. Recomendados, Em alta e Melhor avaliados passarão
  // a vir de regras próprias no banco.
  const recomendados = itensFiltrados;
  const emAlta = useMemo(
    () => [...itensFiltrados].sort((a, b) => b.avaliacoes - a.avaliacoes || b.aulas - a.aulas),
    [itensFiltrados],
  );
  const melhorAvaliados = useMemo(
    () => [...itensFiltrados].sort((a, b) => b.nota - a.nota || b.avaliacoes - a.avaliacoes),
    [itensFiltrados],
  );

  // "Meus cursos" força a exibição em grade, sem carrosséis.
  const modoEfetivo: ModoExibicao = somenteMatriculados ? "todos" : modo;
  const limparFiltros = () => {
    setCategoria("");
    setModo("carrosseis");
  };

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

            <PainelFiltros
              categorias={categorias}
              categoria={categoria}
              verTodos={modo === "todos"}
              mostrarExibicao={!somenteMatriculados}
              onCategoria={setCategoria}
              onVerTodos={(valor) => setModo(valor ? "todos" : "carrosseis")}
              onLimpar={limparFiltros}
            />

            <button
              type="button"
              className={`catalogo__botao-ferramenta${somenteMatriculados ? " catalogo__botao-ferramenta--ativo" : ""}`}
              aria-pressed={somenteMatriculados}
              onClick={() => setSomenteMatriculados((atual) => !atual)}
            >
              <Icone nome="check" tamanho={18} />
              Meus cursos
            </button>
          </section>

          {categoria && (
            <div className="catalogo__ativos" aria-label="Filtros aplicados">
              <button type="button" className="catalogo__chip-ativo" aria-label={`Remover filtro de categoria ${categoria}`} onClick={() => setCategoria("")}>
                {categoria} <Icone nome="close" tamanho={13} />
              </button>
            </div>
          )}

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
          ) : modoEfetivo === "carrosseis" ? (
            <div className="catalogo__secoes">
              <Carrossel titulo="Recomendados para você" descricao="Uma seleção para continuar sua jornada de aprendizagem." itens={recomendados} onAbrir={setCursoAberto} />
              <Carrossel titulo="Cursos em alta" descricao="Os cursos que mais estão chamando a atenção da comunidade." itens={emAlta} onAbrir={setCursoAberto} />
              <Carrossel titulo="Melhor avaliados" descricao="Os cursos com as melhores notas dos estudantes." itens={melhorAvaliados} onAbrir={setCursoAberto} />
            </div>
          ) : (
            <section className="catalogo__grade">
              {itensFiltrados.map((item) => <CartaoCurso key={item.curso.id} item={item} onAbrir={setCursoAberto} />)}
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