import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SidebarLeft } from "../components/sidebar/SidebarLeft";
import { RankingPodium, type PodiumPlayer } from "../components/ranking/RankingPodium";
import "./Salas.css";
 



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

type Sala = {
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

// Domínio exibido abaixo do nome da sala (vem do Figma).
const DOMINIO = "lumina.com";

const salas: Sala[] = [
  
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
const rankingDaSala: PodiumPlayer[] = [
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
        <span className="salas__banner-tag">{sala.assunto}</span>
        <div className="salas__banner-orbita" />
      </div>

      <div className={`salas__icone salas__icone--${sala.tom}`}>{sala.simbolo}</div>

      <div className="salas__conteudo">
        <div className="salas__linha-titulo">
          <div>
            <h2 className="salas__nome">{sala.nome}</h2>
            <p className="salas__slug">{DOMINIO}/{sala.slug}</p>
            <p>Curso: <strong>{sala.curso}</strong></p>
            <p>Educador: {sala.educador}</p>
          </div>
          <span className="salas__membros">
            <Icone nome="people" tamanho={14} />
            {sala.membros}
          </span>
        </div>

        <div className="salas__dados-sala">
          <p><strong>Participantes:</strong> {sala.participantes.join(", ")}{sala.membros > sala.participantes.length ? ` e mais ${sala.membros - sala.participantes.length}` : ""}</p>
          <p><strong>Progresso:</strong> {sala.aulasConcluidas}/{sala.totalAulas} aulas concluídas</p>
          {sala.competitivo && <p><strong>Missão:</strong> {sala.missao}</p>}
        </div>

        {expandido && (
          <div className="salas__expandido">
            <p className="salas__descricao-curta">
              Um espaço para trocar ideias, aprender em conjunto e transformar curiosidade em projetos incríveis.
            </p>
            <div className="salas__rodape-card">
              <span className="salas__nota">
                <strong>4.5/5</strong> <span>★</span>
              </span>
              <span className="salas__saiba-mais">
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
// Estado vazio (usuário ainda não participa de nenhuma sala)
// ---------------------------------------------------------------------------
function EstadoVazio({ onCriar }: { onCriar: () => void }) {
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
        Entre em uma sala para aprender com outras pessoas,<br />cumprir desafios e evoluir todos os dias.
      </p>
      <button className="salas__botao-primario" type="button" onClick={onCriar}>
        <Icone nome="plus" tamanho={19} />
        Adicionar sala
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pop-up com as informações da sala
// ---------------------------------------------------------------------------
function SalaModal({ sala, onFechar }: { sala: Sala; onFechar: () => void }) {
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
    <div className="salas__modal-camada" role="presentation">
      <div className="salas__modal-fundo" onClick={onFechar} />

      <section className="salas__modal" role="dialog" aria-modal="true" aria-labelledby="salas-modal-titulo">
        <div className="salas__modal-rolagem">
          <div className="salas__modal-banner">
            <span className="salas__modal-categoria">{sala.assunto.toUpperCase()}</span>
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
                <p className="salas__modal-slug">{DOMINIO}/{sala.slug}</p>
              </div>
              <div className="salas__meta">
                <div><span>Categoria:</span><strong>{sala.assunto}</strong></div>
                <div>
                  <span>Tags:</span>
                  <span className="salas__tag">Design</span>
                  <span className="salas__tag">Projetos</span>
                  <span className="salas__tag">Comunidade</span>
                </div>
              </div>
            </div>

            <article className="salas__sobre">
              <div>
                <p className="salas__rotulo">SOBRE ESTA SALA</p>
                <h3 className="salas__sobre-titulo">Descrição completa</h3>
              </div>
              <p className="salas__sobre-texto">
                Um espaço para despertar sua criatividade, trocar ideias e transformar curiosidade em projetos reais.
                Aprenda no seu ritmo, participe de desafios semanais e evolua junto com uma comunidade que acredita no
                poder de criar.
              </p>
            </article>

            <div className="salas__colunas">
              {/* Trilha de aprendizagem */}
              <section className="salas__painel salas__modulos">
                <div className="salas__painel-cabecalho">
                  <div>
                    <p className="salas__rotulo">CONTEÚDO DA SALA</p>
                    <h3 className="salas__painel-titulo">Trilha de aprendizagem</h3>
                  </div>
                  <span className="salas__painel-resumo">{modulos.length} módulos · {totalAulas} aulas</span>
                </div>

                <div className="salas__acordeao">
                  {modulos.map((modulo, indice) => (
                    <div
                      className={`salas__modulo${moduloAberto === indice ? " salas__modulo--aberto" : ""}`}
                      key={modulo.titulo}
                    >
                      <button
                        className="salas__modulo-botao"
                        type="button"
                        aria-expanded={moduloAberto === indice}
                        onClick={() => setModuloAberto(moduloAberto === indice ? -1 : indice)}
                      >
                        <span className="salas__modulo-numero">0{indice + 1}</span>
                        <span>
                          <strong>{modulo.titulo}</strong>
                          <small>{modulo.subtitulo}</small>
                        </span>
                        <Icone nome="chevron" tamanho={19} />
                      </button>

                      {moduloAberto === indice && (
                        <div className="salas__aulas">
                          {modulo.aulas.map((aula, indiceAula) => (
                            <div className="salas__aula" key={aula}>
                              <span className="salas__aula-play"><Icone nome="play" tamanho={13} /></span>
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
              <aside className="salas__painel salas__lateral">
                <p className="salas__rotulo">AVALIAÇÕES</p>
                <div className="salas__nota-resumo"><strong className="salas__nota-numero">4.5</strong><span className="salas__nota-estrela">★</span></div>
                <p className="salas__nota-legenda">Excelente · 28 avaliações</p>
                <div className="salas__nota-barra"><span /></div>

                {/* Ranking logo abaixo das avaliações */}
                <div className="salas__ranking">
                  <p className="salas__rotulo">RANKING DA SALA</p>
                  <h3 className="salas__ranking-titulo">Top 5 da sala</h3>
                  <RankingPodium players={rankingDaSala} compact width="compact" ariaLabel="Top 5 da sala" />
                </div>

                <div className="salas__mural-cabecalho">
                  <div>
                    <p className="salas__rotulo">MURAL DA SALA</p>
                    <strong className="salas__mural-titulo">Avisos recentes</strong>
                  </div>
                  <span className="salas__mural-novos">2 novos</span>
                </div>

                <div className="salas__aviso salas__aviso--destaque">
                  <div className="salas__aviso-topo"><span className="salas__aviso-tipo">DESTAQUE</span><small className="salas__aviso-data">Hoje, 14:30</small></div>
                  <strong className="salas__aviso-titulo">Desafio criativo da semana</strong>
                  <p className="salas__aviso-texto">Crie um cartaz usando apenas três cores e compartilhe no encontro de sexta-feira.</p>
                </div>
                <div className="salas__aviso">
                  <div className="salas__aviso-topo"><span className="salas__aviso-tipo">ENCONTRO</span><small className="salas__aviso-data">18 jun</small></div>
                  <strong className="salas__aviso-titulo">Roda de feedback ao vivo</strong>
                  <p className="salas__aviso-texto">Reserve seu lugar para apresentar o projeto e trocar ideias com a turma.</p>
                </div>
              </aside>
            </div>
          </div>
        </div>

        <footer className="salas__modal-rodape">
          <p>
            <Icone nome="people" tamanho={17} />
            <strong>{sala.membros} pessoas</strong> já estão aprendendo nesta sala
          </p>
          <div className="salas__modal-acoes">
            <button className="salas__botao-secundario" type="button" onClick={onFechar}>Fechar</button>
            {/* TODO: navegar para a sala quando a rota existir */}
            <button className="salas__botao-primario salas__botao-entrar" type="button">
              Entrar na sala <Icone nome="arrow" tamanho={18} />
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
export default function Salas() {
  const [busca, setBusca] = useState("");
  const [salaEmDestaque, setSalaEmDestaque] = useState<string | null>(null);
  const [salaAberta, setSalaAberta] = useState<Sala | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [somenteCompetitivas, setSomenteCompetitivas] = useState(false);
  const [novaSala, setNovaSala] = useState({ nome: "", curso: "", educador: "", assunto: "", missao: "", competitivo: false });
  const [salasLocais, setSalasLocais] = useState<Sala[]>(salas);

  const termo = normalizar(busca.trim());
  const salasFiltradas = useMemo(
    () =>
      salasLocais.filter(
        (sala) => (!termo || normalizar(sala.nome).includes(termo) || normalizar(sala.assunto).includes(termo) || normalizar(sala.curso).includes(termo))
          && (!filtroCategoria || sala.assunto === filtroCategoria)
          && (!somenteCompetitivas || sala.competitivo),
      ),
    [termo, salasLocais, filtroCategoria, somenteCompetitivas],
  );

  return (
    <div className="salas">
      <SidebarLeft />

      <main className="salas__main">
        <div className="salas__brilho" />

        <header className="salas__cabecalho">
          <div>
            <p className="salas__caminho">PLATAFORMA / <span>Cursos</span></p>
            <h1 className="salas__titulo">Cursos</h1>
            <p className="salas__subtitulo">Aprenda em comunidade, compartilhe conquistas.</p>
          </div>
          <button className="salas__botao-primario" type="button" onClick={() => setMostrarFormulario((aberto) => !aberto)}>
            <Icone nome="plus" tamanho={19} />
            Criar sala
          </button>
        </header>

        {mostrarFormulario && (
          <form className="salas__form-criar" onSubmit={(evento) => {
            evento.preventDefault();
            const slug = normalizar(novaSala.nome).trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            if (!slug || salasLocais.some((s) => s.slug === slug)) return;
            setSalasLocais((atuais) => [{ nome: novaSala.nome.trim(), slug, assunto: novaSala.assunto.trim() || "Geral", membros: 1,
              participantes: ["Você"], curso: novaSala.curso.trim(), educador: novaSala.educador.trim(), aulasConcluidas: 0,
              totalAulas: 0, competitivo: novaSala.competitivo, missao: novaSala.competitivo ? novaSala.missao.trim() : "",
              tom: "azul", simbolo: "✦" }, ...atuais]);
            setNovaSala({ nome: "", curso: "", educador: "", assunto: "", missao: "", competitivo: false });
            setMostrarFormulario(false);
          }}>
            <h2>Criar sala</h2>
            <input required placeholder="Nome da sala" value={novaSala.nome} onChange={(e) => setNovaSala({ ...novaSala, nome: e.target.value })} />
            <input required placeholder="Curso relacionado" value={novaSala.curso} onChange={(e) => setNovaSala({ ...novaSala, curso: e.target.value })} />
            <input required placeholder="Nome do educador" value={novaSala.educador} onChange={(e) => setNovaSala({ ...novaSala, educador: e.target.value })} />
            <input placeholder="Categoria/assunto" value={novaSala.assunto} onChange={(e) => setNovaSala({ ...novaSala, assunto: e.target.value })} />
            <label><input type="checkbox" checked={novaSala.competitivo} onChange={(e) => setNovaSala({ ...novaSala, competitivo: e.target.checked })} /> Habilitar modo competitivo</label>
            {novaSala.competitivo && <input required placeholder="Missão ou tarefa" value={novaSala.missao} onChange={(e) => setNovaSala({ ...novaSala, missao: e.target.value })} />}
            <button className="salas__botao-primario" type="submit">Salvar sala</button>
            <button type="button" onClick={() => setMostrarFormulario(false)}>Cancelar</button>
          </form>
        )}

        <section className="salas__ferramentas" aria-label="Busca e filtros">
          <label className="salas__busca">
            <Icone nome="search" tamanho={21} />
            <input
              type="search"
              placeholder="Buscar por nome ou assunto..."
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </label>
          <label className="salas__filtro">
            <Icone nome="filter" />
            <span className="sr-only">Filtrar por categoria</span>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
              <option value="">Todas as categorias</option>
              {[...new Set(salasLocais.map((sala) => sala.assunto))].map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
            </select>
          </label>
          <label><input type="checkbox" checked={somenteCompetitivas} onChange={(e) => setSomenteCompetitivas(e.target.checked)} /> Competitivas</label>
        </section>

        <p className="salas__contador">
          Suas salas <span>{salasFiltradas.length}</span>
        </p>

        {salasLocais.length === 0 ? (
          <EstadoVazio onCriar={() => setMostrarFormulario(true)} />
        ) : salasFiltradas.length === 0 ? (
          <p className="salas__sem-resultado">Nenhuma sala encontrada para “{busca.trim()}”.</p>
        ) : (
          <section className="salas__grade">
            {salasFiltradas.map((sala) => (
              <SalaCard
                key={sala.slug}
                sala={sala}
                expandido={salaEmDestaque === sala.slug}
                onDestacar={() => setSalaEmDestaque(sala.slug)}
                onRemoverDestaque={() => setSalaEmDestaque(null)}
                onAbrir={() => setSalaAberta(sala)}
              />
            ))}
          </section>
        )}
      </main>

      {salaAberta && <SalaModal sala={salaAberta} onFechar={() => setSalaAberta(null)} />}
    </div>
  );
}
