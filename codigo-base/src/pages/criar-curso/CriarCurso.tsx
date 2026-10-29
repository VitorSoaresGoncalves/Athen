import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "../../components/layout/PageLayout";
import {
  aulaRepository,
  cursoRepository,
  moduloRepository,
  questaoRepository,
} from "../../data/repositories";
import { supabase } from "../../lib/supabase";
import type { Database } from "../../types/database";
import { EditorConfigQuestao } from "./EditarConfigQuestao";
import {
  configVaziaPara,
  gerarSlug,
  ROTULOS_TIPO,
  validarConfigQuestao,
  xpPadraoPara,
  type TipoQuestao,
} from "./questionConfig";
import "./CriarCurso.css";

type Json = Database["public"]["Tables"]["questions"]["Row"]["config"];
type StatusCurso = Database["public"]["Enums"]["course_status"];

// ---------------------------------------------------------------------------
// Rascunhos em memória do formulário (ainda não gravados no banco).
// ---------------------------------------------------------------------------
type RascunhoQuestao = { tipo: TipoQuestao; enunciado: string; config: Json; xp: number };
type RascunhoAula = { titulo: string; conteudo: string; questoes: RascunhoQuestao[] };
type RascunhoModulo = { titulo: string; descricao: string; cor: string; aulas: RascunhoAula[] };

const COR_PADRAO = "#54318c";

function questaoVazia(tipo: TipoQuestao): RascunhoQuestao {
  return { tipo, enunciado: "", config: configVaziaPara(tipo), xp: xpPadraoPara(tipo) };
}
function aulaVazia(): RascunhoAula {
  return { titulo: "", conteudo: "", questoes: [] };
}
function moduloVazio(): RascunhoModulo {
  return { titulo: "", descricao: "", cor: COR_PADRAO, aulas: [aulaVazia()] };
}

// ---------------------------------------------------------------------------
// Ícones (mesmo padrão inline das demais páginas internas)
// ---------------------------------------------------------------------------
type NomeIcone = "arrow" | "plus" | "trash" | "check";
const caminhos: Record<NomeIcone, ReactNode> = {
  arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" /></>,
  check: <path d="m5 12 4 4L19 6" />,
};
function Icone({ nome, tamanho = 18 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {caminhos[nome]}
    </svg>
  );
}

const mensagemDoErro = (erro: unknown) => (erro instanceof Error ? erro.message : "Algo deu errado. Tente novamente.");

// ---------------------------------------------------------------------------
// Persistência do curso completo (curso + módulos + aulas + questões).
// Fluxo de criação: insere tudo em cascata usando os repositórios do projeto.
// ---------------------------------------------------------------------------
async function salvarCurso(input: {
  criadorId: string;
  titulo: string;
  slug: string;
  descricao: string;
  categoria: string;
  tags: string[];
  visibilidade: "public" | "private";
  status: StatusCurso;
  modulos: RascunhoModulo[];
}) {
  const curso = await cursoRepository.criar({
    creator_id: input.criadorId,
    title: input.titulo,
    slug: input.slug,
    description: input.descricao || null,
    category: input.categoria || null,
    tags: input.tags,
    visibility: input.visibilidade,
    status: input.status,
  });

  for (const [mi, modulo] of input.modulos.entries()) {
    const moduloCriado = await moduloRepository.criar({
      course_id: curso.id,
      title: modulo.titulo,
      description: modulo.descricao || null,
      color: modulo.cor,
      position: mi,
    });

    for (const [li, aula] of modulo.aulas.entries()) {
      const aulaCriada = await aulaRepository.criar({
        module_id: moduloCriado.id,
        title: aula.titulo,
        content: aula.conteudo || null,
        position: li,
      });

      for (const [qi, questao] of aula.questoes.entries()) {
        await questaoRepository.criar({
          lesson_id: aulaCriada.id,
          type: questao.tipo,
          prompt: questao.enunciado,
          position: qi,
          config: questao.config,
          xp_value: questao.xp,
        });
      }
    }
  }

  return curso;
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default function CriarCurso() {
  const navigate = useNavigate();

  const [titulo, setTitulo] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [tagsTexto, setTagsTexto] = useState("");
  const [visibilidade, setVisibilidade] = useState<"public" | "private">("public");
  const [modulos, setModulos] = useState<RascunhoModulo[]>([moduloVazio()]);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const slugEfetivo = useMemo(() => (slugEditado ? slug : gerarSlug(titulo)), [slug, slugEditado, titulo]);

  // ----- Atualizadores imutáveis de módulos/aulas/questões -----
  function atualizarModulo(mi: number, patch: Partial<RascunhoModulo>) {
    setModulos((prev) => prev.map((m, i) => (i === mi ? { ...m, ...patch } : m)));
  }
  function atualizarAula(mi: number, li: number, patch: Partial<RascunhoAula>) {
    setModulos((prev) =>
      prev.map((m, i) => (i === mi ? { ...m, aulas: m.aulas.map((a, j) => (j === li ? { ...a, ...patch } : a)) } : m)),
    );
  }
  function atualizarQuestao(mi: number, li: number, qi: number, patch: Partial<RascunhoQuestao>) {
    setModulos((prev) =>
      prev.map((m, i) =>
        i === mi
          ? {
              ...m,
              aulas: m.aulas.map((a, j) =>
                j === li ? { ...a, questoes: a.questoes.map((q, k) => (k === qi ? { ...q, ...patch } : q)) } : a,
              ),
            }
          : m,
      ),
    );
  }

  function validar(): string | null {
    if (!titulo.trim()) return "Informe o título do curso.";
    if (!slugEfetivo) return "O slug não pode ficar vazio.";
    if (modulos.length === 0) return "Adicione ao menos um módulo.";
    for (const [mi, m] of modulos.entries()) {
      if (!m.titulo.trim()) return `Informe o título do módulo ${mi + 1}.`;
      if (m.aulas.length === 0) return `O módulo "${m.titulo}" precisa de ao menos uma aula.`;
      for (const [li, a] of m.aulas.entries()) {
        if (!a.titulo.trim()) return `Informe o título da aula ${li + 1} do módulo "${m.titulo}".`;
        for (const [qi, q] of a.questoes.entries()) {
          if (!q.enunciado.trim()) return `Informe o enunciado da questão ${qi + 1} da aula "${a.titulo}".`;
          const erroConfig = validarConfigQuestao(q.tipo, q.config);
          if (erroConfig) return `Questão ${qi + 1} da aula "${a.titulo}": ${erroConfig}`;
        }
      }
    }
    return null;
  }

  async function handleSalvar(status: StatusCurso) {
    setErroForm(null);
    const erro = validar();
    if (erro) {
      setErroForm(erro);
      return;
    }

    setSalvando(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const criadorId = userData.user?.id;
      if (!criadorId) throw new Error("Sessão expirada. Faça login novamente.");

      const tags = tagsTexto.split(",").map((t) => t.trim()).filter(Boolean);
      const curso = await salvarCurso({
        criadorId,
        titulo: titulo.trim(),
        slug: slugEfetivo,
        descricao: descricao.trim(),
        categoria: categoria.trim(),
        tags,
        visibilidade,
        status,
        modulos,
      });

      navigate("/catalogo", { state: { cursoCriadoId: curso.id } });
    } catch (err) {
      const causa = mensagemDoErro(err);
      setErroForm(/duplicate|unique/i.test(causa) ? "Já existe um curso com esse slug. Escolha outro." : `Não foi possível salvar o curso: ${causa}`);
      setSalvando(false);
    }
  }

  return (
    <PageLayout variant="bare">
      <div className="criar-curso">
        <main className="criar-curso__main">
          <div className="criar-curso__brilho" />

          <header className="criar-curso__cabecalho">
            <div>
              <p className="criar-curso__caminho">PLATAFORMA / CATÁLOGO / <span>CRIAR CURSO</span></p>
              <h1 className="criar-curso__titulo">Criar curso</h1>
              <p className="criar-curso__subtitulo">Monte seus módulos, aulas e questões. Salve como rascunho ou publique no catálogo.</p>
            </div>
          </header>

          {/* ----- Informações gerais ----- */}
          <section className="criar-curso__cartao">
            <h2 className="criar-curso__cartao-titulo">Informações gerais</h2>
            <div className="criar-curso__grade-campos">
              <label className="criar-curso__campo">
                <span className="criar-curso__rotulo-campo">Título</span>
                <input className="criar-curso__input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Introdução à Programação" />
              </label>

              <label className="criar-curso__campo">
                <span className="criar-curso__rotulo-campo">Slug</span>
                <input
                  className="criar-curso__input"
                  value={slugEfetivo}
                  onChange={(e) => { setSlugEditado(true); setSlug(gerarSlug(e.target.value)); }}
                />
                <small className="criar-curso__dica">Sugerido a partir do título; usado na URL do curso.</small>
              </label>

              <label className="criar-curso__campo">
                <span className="criar-curso__rotulo-campo">Descrição</span>
                <textarea className="criar-curso__area" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Resumo do que o aluno vai aprender." />
              </label>

              <label className="criar-curso__campo">
                <span className="criar-curso__rotulo-campo">Categoria</span>
                <input className="criar-curso__input" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex.: Tecnologia" />
              </label>

              <label className="criar-curso__campo">
                <span className="criar-curso__rotulo-campo">Tags</span>
                <input className="criar-curso__input" value={tagsTexto} onChange={(e) => setTagsTexto(e.target.value)} placeholder="python, iniciante" />
                <small className="criar-curso__dica">Separe por vírgulas.</small>
              </label>

              <label className="criar-curso__campo">
                <span className="criar-curso__rotulo-campo">Visibilidade</span>
                <select className="criar-curso__select" value={visibilidade} onChange={(e) => setVisibilidade(e.target.value as "public" | "private")}>
                  <option value="public">Pública (aparece no catálogo)</option>
                  <option value="private">Privada (somente você)</option>
                </select>
              </label>
            </div>
          </section>

          {/* ----- Módulos ----- */}
          {modulos.map((modulo, mi) => (
            <section key={mi} className="criar-curso__cartao criar-curso__modulo" style={{ borderLeft: `4px solid ${modulo.cor || COR_PADRAO}` }}>
              <div className="criar-curso__cartao-cabecalho">
                <h2 className="criar-curso__cartao-titulo">Módulo {mi + 1}</h2>
                {modulos.length > 1 && (
                  <button type="button" className="criar-curso__remover" onClick={() => setModulos((prev) => prev.filter((_, i) => i !== mi))}>
                    <Icone nome="trash" tamanho={15} /> Remover módulo
                  </button>
                )}
              </div>

              <div className="criar-curso__grade-campos">
                <label className="criar-curso__campo">
                  <span className="criar-curso__rotulo-campo">Título do módulo</span>
                  <input className="criar-curso__input" value={modulo.titulo} onChange={(e) => atualizarModulo(mi, { titulo: e.target.value })} />
                </label>
                <label className="criar-curso__campo">
                  <span className="criar-curso__rotulo-campo">Descrição do módulo</span>
                  <input className="criar-curso__input" value={modulo.descricao} onChange={(e) => atualizarModulo(mi, { descricao: e.target.value })} />
                </label>
                <label className="criar-curso__campo criar-curso__campo--cor">
                  <span className="criar-curso__rotulo-campo">Cor</span>
                  <input type="color" className="criar-curso__cor" value={modulo.cor || COR_PADRAO} onChange={(e) => atualizarModulo(mi, { cor: e.target.value })} />
                </label>
              </div>

              {/* Aulas */}
              {modulo.aulas.map((aula, li) => (
                <div key={li} className="criar-curso__aula">
                  <div className="criar-curso__aula-cabecalho">
                    <strong className="criar-curso__aula-titulo-rotulo">Aula {li + 1}</strong>
                    {modulo.aulas.length > 1 && (
                      <button type="button" className="criar-curso__remover" onClick={() => atualizarModulo(mi, { aulas: modulo.aulas.filter((_, j) => j !== li) })}>
                        <Icone nome="trash" tamanho={14} /> Remover aula
                      </button>
                    )}
                  </div>

                  <label className="criar-curso__campo">
                    <span className="criar-curso__rotulo-campo">Título da aula</span>
                    <input className="criar-curso__input" value={aula.titulo} onChange={(e) => atualizarAula(mi, li, { titulo: e.target.value })} />
                  </label>
                  <label className="criar-curso__campo">
                    <span className="criar-curso__rotulo-campo">Conteúdo (texto)</span>
                    <textarea className="criar-curso__area" rows={3} value={aula.conteudo} onChange={(e) => atualizarAula(mi, li, { conteudo: e.target.value })} />
                  </label>

                  {/* Questões */}
                  {aula.questoes.map((questao, qi) => (
                    <div key={qi} className="criar-curso__questao">
                      <div className="criar-curso__questao-cabecalho">
                        <strong className="criar-curso__questao-rotulo">Questão {qi + 1}</strong>
                        <span className="criar-curso__xp">{questao.xp} XP</span>
                        <button type="button" className="criar-curso__remover" onClick={() => atualizarAula(mi, li, { questoes: aula.questoes.filter((_, k) => k !== qi) })}>
                          Remover
                        </button>
                      </div>

                      <label className="criar-curso__campo">
                        <span className="criar-curso__rotulo-campo">Tipo</span>
                        <select
                          className="criar-curso__select"
                          value={questao.tipo}
                          onChange={(e) => {
                            const tipo = e.target.value as TipoQuestao;
                            atualizarQuestao(mi, li, qi, { tipo, config: configVaziaPara(tipo), xp: xpPadraoPara(tipo) });
                          }}
                        >
                          {(Object.keys(ROTULOS_TIPO) as TipoQuestao[]).map((t) => (
                            <option key={t} value={t}>{ROTULOS_TIPO[t]}</option>
                          ))}
                        </select>
                      </label>

                      <label className="criar-curso__campo">
                        <span className="criar-curso__rotulo-campo">Enunciado</span>
                        <input className="criar-curso__input" value={questao.enunciado} onChange={(e) => atualizarQuestao(mi, li, qi, { enunciado: e.target.value })} />
                      </label>

                      <EditorConfigQuestao
                        tipo={questao.tipo}
                        config={questao.config}
                        onChange={(config) => atualizarQuestao(mi, li, qi, { config })}
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    className="criar-curso__botao-leve"
                    onClick={() => atualizarAula(mi, li, { questoes: [...aula.questoes, questaoVazia("multiple_choice")] })}
                  >
                    <Icone nome="plus" tamanho={15} /> Adicionar questão
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="criar-curso__botao-leve"
                onClick={() => atualizarModulo(mi, { aulas: [...modulo.aulas, aulaVazia()] })}
              >
                <Icone nome="plus" tamanho={15} /> Adicionar aula
              </button>
            </section>
          ))}

          <button type="button" className="criar-curso__botao-secundario criar-curso__add-modulo" onClick={() => setModulos((prev) => [...prev, moduloVazio()])}>
            <Icone nome="plus" tamanho={16} /> Adicionar módulo
          </button>

          {erroForm && <p className="criar-curso__erro" role="alert">{erroForm}</p>}

          <div className="criar-curso__acoes">
            <button type="button" className="criar-curso__botao-secundario" disabled={salvando} onClick={() => navigate("/catalogo")}>
              Cancelar
            </button>
            <button type="button" className="criar-curso__botao-secundario" disabled={salvando} onClick={() => void handleSalvar("draft")}>
              Salvar rascunho
            </button>
            <button type="button" className="criar-curso__botao-primario" disabled={salvando} onClick={() => void handleSalvar("published")}>
              {salvando ? "Salvando..." : "Publicar"} <Icone nome="arrow" tamanho={17} />
            </button>
          </div>
        </main>
      </div>
    </PageLayout>
  );
}