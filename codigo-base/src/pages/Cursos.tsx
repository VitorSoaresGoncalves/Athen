import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SidebarLeft } from "../components/sidebar/SidebarLeft";
import { RankingPodium, type PodiumPlayer } from "../components/ranking/RankingPodium";
import "./Cursos.css";
 



// ---------------------------------------------------------------------------
// Ícones (só os que esta página usa)
// ---------------------------------------------------------------------------
type NomeIcone = "search" | "filter" | "plus" | "arrow" | "people" | "close" | "chevron" | "play" | "clock";

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
// Dados de exemplo — trocar pelas consultas ao Supabase depois
// ---------------------------------------------------------------------------
type Tom = "coral" | "azul" | "violeta" | "menta" | "rosa" | "laranja";

type Curso = {
  nome: string;
  slug: string;
  assunto: string;
  membros: number;
  participantes: string[];
  curso: string;
  educador: string;
  aulasConcluidas: number;
  totalAulas: number;
  competitivo: boolean;
  missao: string;
  tom: Tom;
  simbolo: string;
};

// Domínio exibido abaixo do nome da curso (vem do Figma).
const DOMINIO = "lumina.com";

const cursos: Curso[] = [
  
  { nome: "Clube da Criatividade", slug: "clube-criatividade", assunto: "Design & criatividade", membros: 28, participantes: ["Helena", "Caio", "Beatriz"], curso: "Fundamentos de Design", educador: "Marina Costa", aulasConcluidas: 8, totalAulas: 12, competitivo: true, missao: "Criar um cartaz com três cores", tom: "coral", simbolo: "✦" },
  { nome: "Inglês sem Fronteiras", slug: "ingles-sem-fronteiras", assunto: "Idiomas", membros: 42, participantes: ["Ravi", "Lia", "Caio"], curso: "Inglês para conversação", educador: "Lucas Almeida", aulasConcluidas: 5, totalAulas: 10, competitivo: false, missao: "", tom: "azul", simbolo: "A" },
  { nome: "Código para o Futuro", slug: "codigo-para-o-futuro", assunto: "Tecnologia", membros: 34, participantes: ["Beatriz", "Helena", "Ravi"], curso: "Lógica de programação", educador: "Pedro Santos", aulasConcluidas: 6, totalAulas: 9, competitivo: true, missao: "Construir uma calculadora simples", tom: "violeta", simbolo: "</>" },
  { nome: "Matemática Descomplicada", slug: "matematica-facil", assunto: "Matemática", membros: 19, participantes: ["Lia", "Caio", "Ravi"], curso: "Matemática essencial", educador: "Ana Ribeiro", aulasConcluidas: 3, totalAulas: 8, competitivo: false, missao: "", tom: "menta", simbolo: "π" },
  { nome: "Ciência em Movimento", slug: "ciencia-em-movimento", assunto: "Ciências", membros: 31, participantes: ["Helena", "Lia", "Beatriz"], curso: "Ciências na prática", educador: "João Martins", aulasConcluidas: 7, totalAulas: 10, competitivo: true, missao: "Registrar uma observação científica", tom: "rosa", simbolo: "⚛" },
  { nome: "Histórias do Mundo", slug: "historias-do-mundo", assunto: "Humanidades", membros: 25, participantes: ["Ravi", "Caio", "Lia"], curso: "História e sociedade", educador: "Carla Souza", aulasConcluidas: 4, totalAulas: 8, competitivo: false, missao: "", tom: "laranja", simbolo: "◈" },
];

const modulos = [
  { titulo: "Módulo 1", subtitulo: "Fundamentos da criatividade", aulas: ["Aula 1 · O olhar criativo", "Aula 2 · Repertório e referências", "Aula 3 · Tirando ideias do papel", "Aula 4 · Desafio de aquecimento"] },
  { titulo: "Módulo 2", subtitulo: "Ideias que ganham forma", aulas: ["Aula 1 · Mapa de possibilidades", "Aula 2 · Criando em conjunto", "Aula 3 · Protótipos rápidos", "Aula 4 · Compartilhe seu projeto"] },
  { titulo: "Módulo 3", subtitulo: "Projeto final em comunidade", aulas: ["Aula 1 · Escolha do desafio", "Aula 2 · Construção do projeto", "Aula 3 · Rodada de feedback", "Aula 4 · Apresentação final"] },
];

// Ordem visual do pódio (esquerda → direita): 4º, 2º, 1º, 3º, 5º.
const rankingDaCurso: PodiumPlayer[] = [
  { position: "4º", name: "Caio", detail: "72% · 8 aulas", tier: "gold", height: "fourth" },
  { position: "2º", name: "Beatriz", detail: "91% · 11 aulas", tier: "diamond", height: "second" },
  { position: "1º", name: "Helena", detail: "96% · 12 aulas", tier: "master", height: "first" },
  { position: "3º", name: "Ravi", detail: "87,5% · 10 aulas", tier: "platinum", height: "third" },
  { position: "5º", name: "Lia", detail: "68% · 7 aulas", tier: "silver", height: "fifth" },
];

// Busca sem diferenciar maiúsculas e acentos.
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// ---------------------------------------------------------------------------
// Card da curso
// ---------------------------------------------------------------------------
type CursoCardProps = {
  curso: Curso;
  expandido: boolean;
  onDestacar: () => void;
  onRemoverDestaque: () => void;
  onAbrir: () => void;
};

function CursoCard({ curso, expandido, onDestacar, onRemoverDestaque, onAbrir }: CursoCardProps) {
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
        <span className="cursos__banner-tag">{curso.assunto}</span>
        <div className="cursos__banner-orbita" />
      </div>

      <div className={`cursos__icone cursos__icone--${curso.tom}`}>{curso.simbolo}</div>

      <div className="cursos__conteudo">
        <div className="cursos__linha-titulo">
          <div>
            <h2 className="cursos__nome">{curso.nome}</h2>
            <p className="cursos__slug">{DOMINIO}/{curso.slug}</p>
            <p>Curso: <strong>{curso.curso}</strong></p>
            <p>Educador: {curso.educador}</p>
          </div>
          <span className="cursos__membros">
            <Icone nome="people" tamanho={14} />
            {curso.membros}
          </span>
        </div>

        <div className="cursos__dados-curso">
          <p><strong>Participantes:</strong> {curso.participantes.join(", ")}{curso.membros > curso.participantes.length ? ` e mais ${curso.membros - curso.participantes.length}` : ""}</p>
          <p><strong>Progresso:</strong> {curso.aulasConcluidas}/{curso.totalAulas} aulas concluídas</p>
          {curso.competitivo && <p><strong>Missão:</strong> {curso.missao}</p>}
        </div>

        {expandido && (
          <div className="cursos__expandido">
            <p className="cursos__descricao-curta">
              Um espaço para trocar ideias, aprender em conjunto e transformar curiosidade em projetos incríveis.
            </p>
            <div className="cursos__rodape-card">
              <span className="cursos__nota">
                <strong>4.5/5</strong> <span>★</span>
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
// Estado vazio (usuário ainda não participa de nenhuma curso)
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
      <h2 className="cursos__vazio-titulo">Você ainda não participa<br />de nenhuma curso</h2>
      <p className="cursos__vazio-texto">
        Entre em uma curso para aprender com outras pessoas,<br />cumprir desafios e evoluir todos os dias.
      </p>
      <button className="cursos__botao-primario" type="button" onClick={onCriar}>
        <Icone nome="plus" tamanho={19} />
        Adicionar curso
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pop-up com as informações da curso
// ---------------------------------------------------------------------------
function CursoModal({ curso, onFechar }: { curso: Curso; onFechar: () => void }) {
  const [moduloAberto, setModuloAberto] = useState(0);
  const totalAulas = modulos.reduce((soma, modulo) => soma + modulo.aulas.length, 0);

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

  return (
    <div className="cursos__modal-camada" role="presentation">
      <div className="cursos__modal-fundo" onClick={onFechar} />

      <section className="cursos__modal" role="dialog" aria-modal="true" aria-labelledby="cursos-modal-titulo">
        <div className="cursos__modal-rolagem">
          <div className="cursos__modal-banner">
            <span className="cursos__modal-categoria">{curso.assunto.toUpperCase()}</span>
            <div className="cursos__modal-forma cursos__modal-forma--a" />
            <div className="cursos__modal-forma cursos__modal-forma--b" />
            <div className="cursos__modal-brilho">✦</div>
            <button className="cursos__modal-fechar" type="button" onClick={onFechar} aria-label="Fechar informações da curso">
              <Icone nome="close" tamanho={22} />
            </button>
          </div>

          <div className="cursos__modal-corpo">
            <div className="cursos__identidade">
              <div className="cursos__modal-icone">{curso.simbolo}</div>
              <div>
                <p className="cursos__rotulo">CURSO DE APRENDIZAGEM</p>
                <h2 className="cursos__modal-titulo" id="cursos-modal-titulo">{curso.nome}</h2>
                <p className="cursos__modal-slug">{DOMINIO}/{curso.slug}</p>
              </div>
              <div className="cursos__meta">
                <div><span>Categoria:</span><strong>{curso.assunto}</strong></div>
                <div>
                  <span>Tags:</span>
                  <span className="cursos__tag">Design</span>
                  <span className="cursos__tag">Projetos</span>
                  <span className="cursos__tag">Comunidade</span>
                </div>
              </div>
            </div>

            <article className="cursos__sobre">
              <div>
                <p className="cursos__rotulo">SOBRE ESTE CURSO</p>
                <h3 className="cursos__sobre-titulo">Descrição completa</h3>
              </div>
              <p className="cursos__sobre-texto">
                Um espaço para despertar sua criatividade, trocar ideias e transformar curiosidade em projetos reais.
                Aprenda no seu ritmo, participe de desafios semanais e evolua junto com uma comunidade que acredita no
                poder de criar.
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
                  <span className="cursos__painel-resumo">{modulos.length} módulos · {totalAulas} aulas</span>
                </div>

                <div className="cursos__acordeao">
                  {modulos.map((modulo, indice) => (
                    <div
                      className={`cursos__modulo${moduloAberto === indice ? " cursos__modulo--aberto" : ""}`}
                      key={modulo.titulo}
                    >
                      <button
                        className="cursos__modulo-botao"
                        type="button"
                        aria-expanded={moduloAberto === indice}
                        onClick={() => setModuloAberto(moduloAberto === indice ? -1 : indice)}
                      >
                        <span className="cursos__modulo-numero">0{indice + 1}</span>
                        <span>
                          <strong>{modulo.titulo}</strong>
                          <small>{modulo.subtitulo}</small>
                        </span>
                        <Icone nome="chevron" tamanho={19} />
                      </button>

                      {moduloAberto === indice && (
                        <div className="cursos__aulas">
                          {modulo.aulas.map((aula, indiceAula) => (
                            <div className="cursos__aula" key={aula}>
                              <span className="cursos__aula-play"><Icone nome="play" tamanho={13} /></span>
                              <span>{aula}</span>
                              <small><Icone nome="clock" tamanho={12} />{8 + indiceAula * 3} min</small>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Avaliações, ranking e mural */}
              <aside className="cursos__painel cursos__lateral">
                <p className="cursos__rotulo">AVALIAÇÕES</p>
                <div className="cursos__nota-resumo"><strong className="cursos__nota-numero">4.5</strong><span className="cursos__nota-estrela">★</span></div>
                <p className="cursos__nota-legenda">Excelente · 28 avaliações</p>
                <div className="cursos__nota-barra"><span /></div>

                {/* Ranking logo abaixo das avaliações */}
                <div className="cursos__ranking">
                  <p className="cursos__rotulo">RANKING DO CURSO</p>
                  <h3 className="cursos__ranking-titulo">Top 5 da curso</h3>
                  <RankingPodium players={rankingDaCurso} compact width="compact" ariaLabel="Top 5 da curso" />
                </div>

                <div className="cursos__mural-cabecalho">
                  <div>
                    <p className="cursos__rotulo">MURAL DO CURSO</p>
                    <strong className="cursos__mural-titulo">Avisos recentes</strong>
                  </div>
                  <span className="cursos__mural-novos">2 novos</span>
                </div>

                <div className="cursos__aviso cursos__aviso--destaque">
                  <div className="cursos__aviso-topo"><span className="cursos__aviso-tipo">DESTAQUE</span><small className="cursos__aviso-data">Hoje, 14:30</small></div>
                  <strong className="cursos__aviso-titulo">Desafio criativo da semana</strong>
                  <p className="cursos__aviso-texto">Crie um cartaz usando apenas três cores e compartilhe no encontro de sexta-feira.</p>
                </div>
                <div className="cursos__aviso">
                  <div className="cursos__aviso-topo"><span className="cursos__aviso-tipo">ENCONTRO</span><small className="cursos__aviso-data">18 jun</small></div>
                  <strong className="cursos__aviso-titulo">Roda de feedback ao vivo</strong>
                  <p className="cursos__aviso-texto">Reserve seu lugar para apresentar o projeto e trocar ideias com a turma.</p>
                </div>
              </aside>
            </div>
          </div>
        </div>

        <footer className="cursos__modal-rodape">
          <p>
            <Icone nome="people" tamanho={17} />
            <strong>{curso.membros} pessoas</strong> já estão aprendendo nesta curso
          </p>
          <div className="cursos__modal-acoes">
            <button className="cursos__botao-secundario" type="button" onClick={onFechar}>Fechar</button>
            {/* TODO: navegar para a curso quando a rota existir */}
            <button className="cursos__botao-primario cursos__botao-entrar" type="button">
              Entrar na curso <Icone nome="arrow" tamanho={18} />
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
export default function Cursos() {
  const [busca, setBusca] = useState("");
  const [cursoEmDestaque, setCursoEmDestaque] = useState<string | null>(null);
  const [cursoAberta, setCursoAberta] = useState<Curso | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [somenteCompetitivas, setSomenteCompetitivas] = useState(false);
  const [novaCurso, setNovaCurso] = useState({ nome: "", curso: "", educador: "", assunto: "", missao: "", competitivo: false });
  const [cursosLocais, setCursosLocais] = useState<Curso[]>(cursos);

  const termo = normalizar(busca.trim());
  const cursosFiltradas = useMemo(
    () =>
      cursosLocais.filter(
        (curso) => (!termo || normalizar(curso.nome).includes(termo) || normalizar(curso.assunto).includes(termo) || normalizar(curso.curso).includes(termo))
          && (!filtroCategoria || curso.assunto === filtroCategoria)
          && (!somenteCompetitivas || curso.competitivo),
      ),
    [termo, cursosLocais, filtroCategoria, somenteCompetitivas],
  );

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
          <button className="cursos__botao-primario" type="button" onClick={() => setMostrarFormulario((aberto) => !aberto)}>
            <Icone nome="plus" tamanho={19} />
            Criar curso
          </button>
        </header>

        {mostrarFormulario && (
          <form className="cursos__form-criar" onSubmit={(evento) => {
            evento.preventDefault();
            const slug = normalizar(novaCurso.nome).trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            if (!slug || cursosLocais.some((s) => s.slug === slug)) return;
            setCursosLocais((atuais) => [{ nome: novaCurso.nome.trim(), slug, assunto: novaCurso.assunto.trim() || "Geral", membros: 1,
              participantes: ["Você"], curso: novaCurso.curso.trim(), educador: novaCurso.educador.trim(), aulasConcluidas: 0,
              totalAulas: 0, competitivo: novaCurso.competitivo, missao: novaCurso.competitivo ? novaCurso.missao.trim() : "",
              tom: "azul", simbolo: "✦" }, ...atuais]);
            setNovaCurso({ nome: "", curso: "", educador: "", assunto: "", missao: "", competitivo: false });
            setMostrarFormulario(false);
          }}>
            <h2>Criar curso</h2>
            <input required placeholder="Nome da curso" value={novaCurso.nome} onChange={(e) => setNovaCurso({ ...novaCurso, nome: e.target.value })} />
            <input required placeholder="Curso relacionado" value={novaCurso.curso} onChange={(e) => setNovaCurso({ ...novaCurso, curso: e.target.value })} />
            <input required placeholder="Nome do educador" value={novaCurso.educador} onChange={(e) => setNovaCurso({ ...novaCurso, educador: e.target.value })} />
            <input placeholder="Categoria/assunto" value={novaCurso.assunto} onChange={(e) => setNovaCurso({ ...novaCurso, assunto: e.target.value })} />
            <label><input type="checkbox" checked={novaCurso.competitivo} onChange={(e) => setNovaCurso({ ...novaCurso, competitivo: e.target.checked })} /> Habilitar modo competitivo</label>
            {novaCurso.competitivo && <input required placeholder="Missão ou tarefa" value={novaCurso.missao} onChange={(e) => setNovaCurso({ ...novaCurso, missao: e.target.value })} />}
            <button className="cursos__botao-primario" type="submit">Salvar curso</button>
            <button type="button" onClick={() => setMostrarFormulario(false)}>Cancelar</button>
          </form>
        )}

        <section className="cursos__ferramentas" aria-label="Busca e filtros">
          <label className="cursos__busca">
            <Icone nome="search" tamanho={21} />
            <input
              type="search"
              placeholder="Buscar por nome ou assunto..."
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </label>
          <label className="cursos__filtro">
            <Icone nome="filter" />
            <span className="sr-only">Filtrar por categoria</span>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
              <option value="">Todas as categorias</option>
              {[...new Set(cursosLocais.map((curso) => curso.assunto))].map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
            </select>
          </label>
          <label><input type="checkbox" checked={somenteCompetitivas} onChange={(e) => setSomenteCompetitivas(e.target.checked)} /> Competitivas</label>
        </section>

        <p className="cursos__contador">
          Suas cursos <span>{cursosFiltradas.length}</span>
        </p>

        {cursosLocais.length === 0 ? (
          <EstadoVazio onCriar={() => setMostrarFormulario(true)} />
        ) : cursosFiltradas.length === 0 ? (
          <p className="cursos__sem-resultado">Nenhuma curso encontrada para “{busca.trim()}”.</p>
        ) : (
          <section className="cursos__grade">
            {cursosFiltradas.map((curso) => (
              <CursoCard
                key={curso.slug}
                curso={curso}
                expandido={cursoEmDestaque === curso.slug}
                onDestacar={() => setCursoEmDestaque(curso.slug)}
                onRemoverDestaque={() => setCursoEmDestaque(null)}
                onAbrir={() => setCursoAberta(curso)}
              />
            ))}
          </section>
        )}
      </main>

      {cursoAberta && <CursoModal curso={cursoAberta} onFechar={() => setCursoAberta(null)} />}
    </div>
  );
}
