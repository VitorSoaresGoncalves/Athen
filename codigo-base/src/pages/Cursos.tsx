import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { SidebarLeft } from "../components/sidebar/SidebarLeft";
import { cursoRepository } from "../data/repositories";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";
import "./Cursos.css";

type Curso = Database["public"]["Tables"]["Curso"]["Row"];

// ---------------------------------------------------------------------------
// Ícones (só os que esta página usa)
// ---------------------------------------------------------------------------
type NomeIcone = "search" | "filter" | "plus" | "arrow";

const caminhos: Record<NomeIcone, ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  filter: <path d="M4 7h16M7 12h10M10 17h4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
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
// Utilidades
// ---------------------------------------------------------------------------
// Domínio exibido abaixo do nome do curso (mesmo padrão de Salas).
const DOMINIO = "lumina.com";

// Rota da trilha (Dashboard), que lê o curso pelo parâmetro ?curso=
// TODO: ajustar para a rota real do Dashboard
const ROTA_TRILHA = "/";

const COR_PADRAO = "#7c3aed";

function corValida(cor: string | null | undefined) {
  const candidata = cor?.trim();
  return candidata && /^#[0-9a-fA-F]{3,8}$/.test(candidata) ? candidata : COR_PADRAO;
}

// Busca sem diferenciar maiúsculas e acentos.
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Liga/desliga um valor num array de seleção.
const alternar = (lista: string[], valor: string) =>
  lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];

function mensagemDeErro(erro: unknown) {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === "object" && erro && "message" in erro) return String(erro.message);
  return "Não foi possível carregar os cursos.";
}

// ---------------------------------------------------------------------------
// Card do curso
// ---------------------------------------------------------------------------
function CursoCard({ curso, onSaibaMais }: { curso: Curso; onSaibaMais: () => void }) {
  return (
    <article className="cursos__card" style={{ "--cor": corValida(curso.Cor_Capa) } as CSSProperties}>
      <div className="cursos__banner">
        {curso.Categoria && <span className="cursos__banner-tag">{curso.Categoria}</span>}
        <div className="cursos__banner-orbita" />
      </div>

      <div className="cursos__icone">{curso.Icone}</div>

      <div className="cursos__conteudo">
        <h3 className="cursos__nome">{curso.Titulo}</h3>
        <p className="cursos__slug">{DOMINIO}/{curso.Slug}</p>

        {curso.Tags.length > 0 && (
          <div className="cursos__tags">
            {curso.Tags.map((tag) => (
              <span className="cursos__tag" key={tag}>#{tag}</span>
            ))}
          </div>
        )}

        <div className="cursos__rodape-card">
          <span className="cursos__nota">
            <span className="cursos__nota-estrela">★</span>
            <strong>{Number(curso.Avaliacao).toFixed(1)}</strong>
            <small>({curso.Contagem_Avaliacao})</small>
          </span>
          <button className="cursos__saiba-mais" type="button" onClick={onSaibaMais}>
            Saiba mais <Icone nome="arrow" tamanho={17} />
          </button>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Seção (título + contador + grade)
// ---------------------------------------------------------------------------
type SecaoProps = {
  titulo: string;
  lista: Curso[];
  vazio: string;
  onSaibaMais: (curso: Curso) => void;
};

function Secao({ titulo, lista, vazio, onSaibaMais }: SecaoProps) {
  return (
    <section className="cursos__secao">
      <p className="cursos__contador">
        {titulo} <span>{lista.length}</span>
      </p>
      {lista.length === 0 ? (
        <p className="cursos__sem-resultado">{vazio}</p>
      ) : (
        <div className="cursos__grade">
          {lista.map((curso) => (
            <CursoCard key={curso.ID} curso={curso} onSaibaMais={() => onSaibaMais(curso)} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default function MeusCursos() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [inscritosIds, setInscritosIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [categoriasSel, setCategoriasSel] = useState<string[]>([]);
  const [tagsSel, setTagsSel] = useState<string[]>([]);

  // Busca os cursos publicados e as matrículas do usuário logado.
  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setLoading(true);
      setErro("");

      try {
        const [todos, { data: userData }] = await Promise.all([
          cursoRepository.listar(),
          supabase.auth.getUser(),
        ]);

        let ids = new Set<string>();
        if (userData.user) {
          const { data, error } = await supabase
            .from("matricula")
            .select("fk_Curso_ID")
            .eq("fk_Usuario_ID", userData.user.id);
          if (error) throw error;
          ids = new Set((data ?? []).map((linha) => linha.fk_Curso_ID));
        }

        if (cancelado) return;
        setCursos(todos.filter((curso) => curso.Status === "published"));
        setInscritosIds(ids);
      } catch (e) {
        if (!cancelado) setErro(mensagemDeErro(e));
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    void carregar();
    return () => { cancelado = true; };
  }, []);

  const categorias = useMemo(
    () => [...new Set(cursos.map((curso) => curso.Categoria).filter(Boolean))].sort(),
    [cursos],
  );
  const tags = useMemo(() => [...new Set(cursos.flatMap((curso) => curso.Tags))].sort(), [cursos]);

  const termo = normalizar(busca.trim());
  const filtrados = useMemo(
    () =>
      cursos.filter(
        (curso) =>
          (!termo ||
            normalizar(curso.Titulo).includes(termo) ||
            normalizar(curso.Categoria).includes(termo) ||
            curso.Tags.some((tag) => normalizar(tag).includes(termo))) &&
          (categoriasSel.length === 0 || categoriasSel.includes(curso.Categoria)) &&
          (tagsSel.length === 0 || curso.Tags.some((tag) => tagsSel.includes(tag))),
      ),
    [cursos, termo, categoriasSel, tagsSel],
  );

  const inscritos = filtrados.filter((curso) => inscritosIds.has(curso.ID));
  const novos = filtrados.filter((curso) => !inscritosIds.has(curso.ID));
  const totalFiltros = categoriasSel.length + tagsSel.length;

  function abrirCurso(curso: Curso) {
    window.location.assign(`${ROTA_TRILHA}?curso=${encodeURIComponent(curso.ID)}`);
  }

  return (
    <div className="tela cursos">
      <SidebarLeft />

      <main className="cursos__main">
        <div className="cursos__brilho" />

        <header className="cursos__cabecalho">
          <div>
            <p className="cursos__caminho">PLATAFORMA / <span>MEUS CURSOS</span></p>
            <h1 className="cursos__titulo">Meus Cursos</h1>
            <p className="cursos__subtitulo">Continue aprendendo e descubra novos caminhos.</p>
          </div>
          {/* TODO: abrir o fluxo de adicionar curso */}
          <button className="cursos__botao-primario" type="button">
            <Icone nome="plus" tamanho={19} />
            Adicionar curso
          </button>
        </header>

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
          <button
            className="cursos__filtro"
            type="button"
            aria-expanded={filtroAberto}
            aria-controls="cursos-painel-filtros"
            onClick={() => setFiltroAberto((aberto) => !aberto)}
          >
            <Icone nome="filter" />
            <span>Filtrar</span>
            <span className="cursos__filtro-contagem">{totalFiltros}</span>
          </button>
        </section>

        {filtroAberto && (
          <section className="cursos__painel-filtros" id="cursos-painel-filtros" aria-label="Filtros">
            <p className="cursos__rotulo">CATEGORIA</p>
            <div className="cursos__chips">
              {categorias.map((categoria) => (
                <button
                  key={categoria}
                  type="button"
                  className={`cursos__chip${categoriasSel.includes(categoria) ? " cursos__chip--ativo" : ""}`}
                  aria-pressed={categoriasSel.includes(categoria)}
                  onClick={() => setCategoriasSel((atual) => alternar(atual, categoria))}
                >
                  {categoria}
                </button>
              ))}
            </div>

            <p className="cursos__rotulo">TAGS</p>
            <div className="cursos__chips">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`cursos__chip${tagsSel.includes(tag) ? " cursos__chip--ativo" : ""}`}
                  aria-pressed={tagsSel.includes(tag)}
                  onClick={() => setTagsSel((atual) => alternar(atual, tag))}
                >
                  {tag}
                </button>
              ))}
            </div>

            {totalFiltros > 0 && (
              <button
                className="cursos__limpar"
                type="button"
                onClick={() => {
                  setCategoriasSel([]);
                  setTagsSel([]);
                }}
              >
                Limpar filtros
              </button>
            )}
          </section>
        )}

        {loading ? (
          <p className="cursos__estado">Carregando seus cursos...</p>
        ) : erro ? (
          <p className="cursos__estado">{erro}</p>
        ) : (
          <>
            <Secao
              titulo="Cursos inscritos"
              lista={inscritos}
              vazio="Nenhum curso inscrito encontrado."
              onSaibaMais={abrirCurso}
            />
            <Secao
              titulo="Novos cursos"
              lista={novos}
              vazio="Nenhum novo curso encontrado."
              onSaibaMais={abrirCurso}
            />
          </>
        )}
      </main>
    </div>
  );
}