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
  tom: Tom;
  simbolo: string;
  nota: number;       // média de estrelas, de 0 a 5
  avaliacoes: number; // quantidade de avaliações
};

// Domínio exibido abaixo do nome da sala (vem do Figma).
const DOMINIO = "lumina.com";

const salas: Sala[] = [
  { nome: "Clube da Criatividade", slug: "clube-criatividade", assunto: "Design & criatividade", membros: 28, tom: "coral", simbolo: "✦", nota: 4.5, avaliacoes: 28 },
  { nome: "Inglês sem Fronteiras", slug: "ingles-sem-fronteiras", assunto: "Idiomas", membros: 42, tom: "azul", simbolo: "A", nota: 4.8, avaliacoes: 51 },
  { nome: "Código para o Futuro", slug: "codigo-para-o-futuro", assunto: "Tecnologia", membros: 34, tom: "violeta", simbolo: "</>", nota: 4.5, avaliacoes: 37 },
  { nome: "Matemática Descomplicada", slug: "matematica-facil", assunto: "Matemática", membros: 19, tom: "menta", simbolo: "π", nota: 4.2, avaliacoes: 16 },
  { nome: "Ciência em Movimento", slug: "ciencia-em-movimento", assunto: "Ciências", membros: 31, tom: "rosa", simbolo: "⚛", nota: 4.9, avaliacoes: 44 },
  { nome: "Histórias do Mundo", slug: "historias-do-mundo", assunto: "Humanidades", membros: 25, tom: "laranja", simbolo: "◈", nota: 4.0, avaliacoes: 22 },
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

// ---------------------------------------------------------------------------
// Busca, filtros e ordenação
// ---------------------------------------------------------------------------
type OrdemAlfabetica = "nenhuma" | "az" | "za";
type OrdemEstrelas = "nenhuma" | "maior" | "menor";
type Filtros = { alfabetica: OrdemAlfabetica; estrelas: OrdemEstrelas };

const FILTROS_PADRAO: Filtros = { alfabetica: "nenhuma", estrelas: "nenhuma" };

const contarFiltros = (filtros: Filtros) =>
  (filtros.alfabetica !== "nenhuma" ? 1 : 0) + (filtros.estrelas !== "nenhuma" ? 1 : 0);

// Estrelas vêm primeiro; a ordem alfabética desempata (ou vale sozinha).
function ordenar(lista: Sala[], filtros: Filtros) {
  return [...lista].sort((a, b) => {
    if (filtros.estrelas !== "nenhuma") {
      const diferenca = filtros.estrelas === "maior" ? b.nota - a.nota : a.nota - b.nota;
      if (diferenca !== 0) return diferenca;
    }
    if (filtros.alfabetica !== "nenhuma") {
      const comparacao = a.nome.localeCompare(b.nome, "pt-BR");
      return filtros.alfabetica === "az" ? comparacao : -comparacao;
    }
    return 0;
  });
}

// Busca sem diferenciar maiúsculas e acentos.
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const descreverNota = (nota: number) => {
  if (nota >= 4.5) return "Excelente";
  if (nota >= 4) return "Muito boa";
  if (nota >= 3) return "Boa";
  return "Regular";
};

// Fecha o pop-up com Esc e trava a rolagem da página enquanto ele está aberto.
function useTravarModal(onFechar: () => void) {
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
        <span className="salas__banner-tag">{sala.assunto}</span>
        <div className="salas__banner-orbita" />
      </div>

      <div className={`salas__icone salas__icone--${sala.tom}`}>{sala.simbolo}</div>

      <div className="salas__conteudo">
        <div className="salas__linha-titulo">
          <div>
            <h2 className="salas__nome">{sala.nome}</h2>
            <p className="salas__slug">{DOMINIO}/{sala.slug}</p>
          </div>
          <span className="salas__membros">
            <Icone nome="people" tamanho={14} />
            {sala.membros}
          </span>
        </div>

        {expandido && (
          <div className="salas__expandido">
            <p className="salas__descricao-curta">
              Um espaço para trocar ideias, aprender em conjunto e transformar curiosidade em projetos incríveis.
            </p>
            <div className="salas__rodape-card">
              <span className="salas__nota">
                <strong>{sala.nota.toFixed(1)}/5</strong> <span>★</span>
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
function EstadoVazio() {
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
      <button className="salas__botao-primario" type="button">
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

const OPCOES_ESTRELAS: OpcaoChip<OrdemEstrelas>[] = [
  { valor: "nenhuma", rotulo: "Sem ordem" },
  { valor: "maior", rotulo: "Mais estrelas" },
  { valor: "menor", rotulo: "Menos estrelas" },
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

  const usandoOsDois = rascunho.alfabetica !== "nenhuma" && rascunho.estrelas !== "nenhuma";

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
            <h3 className="salas__filtro-secao-titulo">Número de estrelas</h3>
            <p className="salas__filtro-secao-texto">Organize pela nota das avaliações, de 0 a 5.</p>
            <GrupoOpcoes
              rotulo="Número de estrelas"
              opcoes={OPCOES_ESTRELAS}
              valor={rascunho.estrelas}
              onMudar={(estrelas) => setRascunho({ ...rascunho, estrelas })}
            />
          </section>

          {usandoOsDois && (
            <p className="salas__filtro-dica">
              Usando os dois, as estrelas vêm primeiro e a ordem alfabética desempata salas com a mesma nota.
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
// Pop-up com as informações da sala
// ---------------------------------------------------------------------------
function SalaModal({ sala, onFechar }: { sala: Sala; onFechar: () => void }) {
  const [moduloAberto, setModuloAberto] = useState(0);
  const totalAulas = modulos.reduce((soma, modulo) => soma + modulo.aulas.length, 0);
  useTravarModal(onFechar);

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
                <div className="salas__nota-resumo">
                  <strong className="salas__nota-numero">{sala.nota.toFixed(1)}</strong>
                  <span className="salas__nota-estrela">★</span>
                </div>
                <p className="salas__nota-legenda">{descreverNota(sala.nota)} · {sala.avaliacoes} avaliações</p>
                <div className="salas__nota-barra"><span style={{ width: `${(sala.nota / 5) * 100}%` }} /></div>

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
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_PADRAO);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [salaEmDestaque, setSalaEmDestaque] = useState<string | null>(null);
  const [salaAberta, setSalaAberta] = useState<Sala | null>(null);

  const termo = normalizar(busca.trim());
  const totalFiltros = contarFiltros(filtros);

  const salasFiltradas = useMemo(() => {
    const encontradas = salas.filter(
      (sala) => !termo || normalizar(sala.nome).includes(termo) || normalizar(sala.assunto).includes(termo),
    );
    return ordenar(encontradas, filtros);
  }, [termo, filtros]);

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
          <button className="salas__botao-primario" type="button">
            <Icone nome="plus" tamanho={19} />
            Adicionar sala
          </button>
        </header>

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

        {salas.length === 0 ? (
          <EstadoVazio />
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

      {salaAberta && <SalaModal sala={salaAberta} onFechar={() => setSalaAberta(null)} />}
    </div>
  );
}