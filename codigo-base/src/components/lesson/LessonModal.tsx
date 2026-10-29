import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  dominioRepository,
  questaoRepository,
  respostaRepository,
  tentativaRepository,
} from "../../data/repositories";
import type { Database } from "../../types/database";
import "./LessonModal.css";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
type Aula = Database["public"]["Tables"]["lessons"]["Row"];
type Questao = Database["public"]["Tables"]["questions"]["Row"];
type ResultadoTentativa = Awaited<ReturnType<typeof tentativaRepository.finalizar>>;
type Correcao = { is_correct: boolean; xp: number };

type LessonModalProps = {
  aula: Aula;
  moduloTitulo: string;
  cursoId: string;
  // Quando existe, a atividade conta como "da sala" (XP interno da sala, nunca o XP global).
  salaId?: string;
  cor: string;
  jaConcluida: boolean;
  onFechar: () => void;
  // Chamado quando o servidor finaliza a tentativa (a conclusão já foi gravada).
  onConcluida: (aulaId: string) => void;
};

// O que o aluno está marcando/digitando na questão atual (estado de tela).
type Entrada =
  | { tipo: "multiple_choice"; ids: string[] }
  | { tipo: "fill_blank"; texto: string }
  | { tipo: "sum_alternatives"; marcados: number[] }
  | { tipo: "match"; ligacoes: Record<string, string> };

type Opcao = { id: string; texto: string };
type Afirmativa = { valor: number; texto: string };
type Par = { esquerda: string; direita: string };

const ROTULO_TIPO: Record<Questao["type"], string> = {
  multiple_choice: "Múltipla escolha",
  fill_blank: "Preencha a lacuna",
  sum_alternatives: "Somatória",
  match: "Associação",
};

const DICA_TIPO: Record<Questao["type"], string> = {
  multiple_choice: "Marque todas as alternativas corretas.",
  fill_blank: "Digite a resposta. Acentos e maiúsculas não importam.",
  sum_alternatives: "Marque as afirmativas corretas; a resposta é a soma dos valores marcados.",
  match: "Associe cada item da esquerda à opção correspondente.",
};

// ---------------------------------------------------------------------------
// Leitura do `config` (jsonb) de cada tipo de questão
// ---------------------------------------------------------------------------
type Obj = Record<string, unknown>;
const comoObjeto = (valor: unknown): Obj =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor) ? (valor as Obj) : {};
const comoLista = (valor: unknown): unknown[] => (Array.isArray(valor) ? valor : []);
const comoTexto = (valor: unknown, padrao = ""): string =>
  typeof valor === "string" ? valor : typeof valor === "number" ? String(valor) : padrao;
const comoNumero = (valor: unknown): number => (typeof valor === "number" ? valor : Number(valor) || 0);

function lerOpcoes(questao: Questao): Opcao[] {
  return comoLista(comoObjeto(questao.config).options).map((bruto, indice) => {
    const opcao = comoObjeto(bruto);
    const id = comoTexto(opcao.id, String(indice));
    return { id, texto: comoTexto(opcao.text, id) };
  });
}

function lerAfirmativas(questao: Questao): Afirmativa[] {
  return comoLista(comoObjeto(questao.config).statements).map((bruto) => {
    const afirmativa = comoObjeto(bruto);
    const valor = comoNumero(afirmativa.value);
    return { valor, texto: comoTexto(afirmativa.text) || `Afirmativa de valor ${valor}` };
  });
}

function lerPares(questao: Questao): Par[] {
  return comoLista(comoObjeto(questao.config).pairs).map((bruto) => {
    const par = comoObjeto(bruto);
    return { esquerda: comoTexto(par.left), direita: comoTexto(par.right) };
  });
}

// Embaralha sempre do mesmo jeito para a mesma questão (não muda a cada render).
function embaralhar<T>(lista: T[], semente: string): T[] {
  let estado = 0;
  for (const caractere of semente) estado = (estado * 31 + caractere.charCodeAt(0)) >>> 0;
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    const j = estado % (i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function entradaVazia(questao: Questao): Entrada {
  switch (questao.type) {
    case "multiple_choice": return { tipo: "multiple_choice", ids: [] };
    case "fill_blank": return { tipo: "fill_blank", texto: "" };
    case "sum_alternatives": return { tipo: "sum_alternatives", marcados: [] };
    case "match": return { tipo: "match", ligacoes: {} };
  }
}

function entradaCompleta(questao: Questao, entrada: Entrada): boolean {
  switch (entrada.tipo) {
    case "multiple_choice": return entrada.ids.length > 0;
    case "fill_blank": return entrada.texto.trim().length > 0;
    case "sum_alternatives": return entrada.marcados.length > 0;
    case "match": return lerPares(questao).every((par) => Boolean(entrada.ligacoes[par.esquerda]));
  }
}

// Monta o `submitted` no formato que o grade_answer do banco espera.
function montarResposta(questao: Questao, entrada: Entrada) {
  switch (entrada.tipo) {
    case "multiple_choice":
      return { selected: entrada.ids };
    case "fill_blank":
      return { text: entrada.texto };
    case "sum_alternatives": {
      const afirmativas = lerAfirmativas(questao);
      return { sum: entrada.marcados.reduce((soma, indice) => soma + (afirmativas[indice]?.valor ?? 0), 0) };
    }
    case "match":
      return {
        pairs: lerPares(questao).map((par) => ({ left: par.esquerda, right: entrada.ligacoes[par.esquerda] ?? "" })),
      };
  }
}

// Texto mostrado quando o aluno erra.
function respostaEsperada(questao: Questao): string {
  const config = comoObjeto(questao.config);
  switch (questao.type) {
    case "multiple_choice":
      return comoLista(config.options)
        .map(comoObjeto)
        .filter((opcao) => opcao.correct === true)
        .map((opcao) => comoTexto(opcao.text, comoTexto(opcao.id)))
        .join(", ");
    case "fill_blank":
      return comoTexto(comoLista(config.answers)[0]);
    case "sum_alternatives": {
      if (config.expected !== undefined && config.expected !== null) return String(comoNumero(config.expected));
      const soma = comoLista(config.statements)
        .map(comoObjeto)
        .filter((afirmativa) => afirmativa.correct === true)
        .reduce((total, afirmativa) => total + comoNumero(afirmativa.value), 0);
      return String(soma);
    }
    case "match":
      return lerPares(questao).map((par) => `${par.esquerda} → ${par.direita}`).join("; ");
  }
}

const mensagemDoErro = (erro: unknown) => (erro instanceof Error ? erro.message : "Algo deu errado. Tente novamente.");

// ---------------------------------------------------------------------------
// Campos de resposta de cada tipo de questão
// ---------------------------------------------------------------------------
type CamposProps = {
  questao: Questao;
  entrada: Entrada;
  bloqueado: boolean;
  onChange: (entrada: Entrada) => void;
  onEnviar: () => void;
};

function CamposQuestao({ questao, entrada, bloqueado, onChange, onEnviar }: CamposProps) {
  const opcoes = useMemo(() => (questao.type === "multiple_choice" ? lerOpcoes(questao) : []), [questao]);
  const afirmativas = useMemo(() => (questao.type === "sum_alternatives" ? lerAfirmativas(questao) : []), [questao]);
  const pares = useMemo(() => (questao.type === "match" ? lerPares(questao) : []), [questao]);
  const direitas = useMemo(
    () => embaralhar([...new Set(pares.map((par) => par.direita))], questao.id),
    [pares, questao.id],
  );

  if (questao.type === "multiple_choice" && entrada.tipo === "multiple_choice") {
    return (
      <div className="lesson-modal__opcoes" role="group" aria-label="Alternativas">
        {opcoes.map((opcao) => {
          const marcada = entrada.ids.includes(opcao.id);
          return (
            <button
              key={opcao.id}
              type="button"
              role="checkbox"
              aria-checked={marcada}
              disabled={bloqueado}
              className={`lesson-modal__opcao${marcada ? " lesson-modal__opcao--marcada" : ""}`}
              onClick={() =>
                onChange({
                  tipo: "multiple_choice",
                  ids: marcada ? entrada.ids.filter((id) => id !== opcao.id) : [...entrada.ids, opcao.id],
                })
              }
            >
              <span className="lesson-modal__caixa">{marcada ? "✓" : ""}</span>
              <span>{opcao.texto}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (questao.type === "fill_blank" && entrada.tipo === "fill_blank") {
    return (
      <input
        className="lesson-modal__input"
        type="text"
        autoFocus
        autoComplete="off"
        placeholder="Digite sua resposta"
        value={entrada.texto}
        disabled={bloqueado}
        onChange={(evento) => onChange({ tipo: "fill_blank", texto: evento.target.value })}
        onKeyDown={(evento) => {
          if (evento.key === "Enter") onEnviar();
        }}
      />
    );
  }

  if (questao.type === "sum_alternatives" && entrada.tipo === "sum_alternatives") {
    const soma = entrada.marcados.reduce((total, indice) => total + (afirmativas[indice]?.valor ?? 0), 0);
    return (
      <div className="lesson-modal__opcoes" role="group" aria-label="Afirmativas">
        {afirmativas.map((afirmativa, indice) => {
          const marcada = entrada.marcados.includes(indice);
          return (
            <button
              key={indice}
              type="button"
              role="checkbox"
              aria-checked={marcada}
              disabled={bloqueado}
              className={`lesson-modal__opcao${marcada ? " lesson-modal__opcao--marcada" : ""}`}
              onClick={() =>
                onChange({
                  tipo: "sum_alternatives",
                  marcados: marcada ? entrada.marcados.filter((i) => i !== indice) : [...entrada.marcados, indice],
                })
              }
            >
              <span className="lesson-modal__caixa">{marcada ? "✓" : ""}</span>
              <span className="lesson-modal__valor">{afirmativa.valor}</span>
              <span>{afirmativa.texto}</span>
            </button>
          );
        })}
        <p className="lesson-modal__soma">
          Soma marcada: <strong>{soma}</strong>
        </p>
      </div>
    );
  }

  if (questao.type === "match" && entrada.tipo === "match") {
    return (
      <div className="lesson-modal__pares">
        {pares.map((par) => (
          <label className="lesson-modal__par" key={par.esquerda}>
            <span className="lesson-modal__par-esquerda">{par.esquerda}</span>
            <select
              className="lesson-modal__select"
              value={entrada.ligacoes[par.esquerda] ?? ""}
              disabled={bloqueado}
              onChange={(evento) =>
                onChange({ tipo: "match", ligacoes: { ...entrada.ligacoes, [par.esquerda]: evento.target.value } })
              }
            >
              <option value="">Escolha…</option>
              {direitas.map((direita) => (
                <option key={direita} value={direita}>{direita}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Pop-up da aula
// ---------------------------------------------------------------------------
type Fase = "carregando" | "intro" | "questoes" | "resultado";

export function LessonModal({ aula, moduloTitulo, cursoId, salaId, cor, jaConcluida, onFechar, onConcluida }: LessonModalProps) {
  const [fase, setFase] = useState<Fase>("carregando");
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [indice, setIndice] = useState(0);
  const [entrada, setEntrada] = useState<Entrada | null>(null);
  const [tentativaId, setTentativaId] = useState<string | null>(null);
  const [correcao, setCorrecao] = useState<Correcao | null>(null);
  const [verificada, setVerificada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<ResultadoTentativa | null>(null);
  const [questoesCarregadas, setQuestoesCarregadas] = useState(false);
  const [concluidaSemQuestoes, setConcluidaSemQuestoes] = useState(false);

  // Mantém o handler mais recente sem religar os listeners do teclado.
  const fecharRef = useRef(onFechar);
  useEffect(() => {
    fecharRef.current = onFechar;
  });

  // Fecha com Esc e trava a rolagem da página enquanto o pop-up está aberto.
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

  // Carrega as questões da aula.
  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        const lista = await questaoRepository.listarPorAula(aula.id);
        if (cancelado) return;
        setQuestoes(lista);
        setQuestoesCarregadas(true);
      } catch (error) {
        if (!cancelado) setErro(mensagemDoErro(error));
      } finally {
        if (!cancelado) setFase("intro");
      }
    }

    void carregar();
    return () => { cancelado = true; };
  }, [aula.id]);

  const questao = questoes[indice];
  const xpTotal = questoes.reduce((soma, item) => soma + item.xp_value, 0);

  function irParaQuestao(posicao: number) {
    setIndice(posicao);
    setEntrada(questoes[posicao] ? entradaVazia(questoes[posicao]) : null);
    setVerificada(false);
    setCorrecao(null);
  }

  // A tentativa só é criada quando o aluno decide começar a atividade.
  async function comecar() {
    if (questoes.length === 0) return;
    setOcupado(true);
    setErro("");

    try {
      const tentativa = await tentativaRepository.iniciar(aula.id, { idCurso: cursoId, idSala: salaId });
      setTentativaId(tentativa.id);
      irParaQuestao(0);
      setFase("questoes");
    } catch (error) {
      setErro(mensagemDoErro(error));
    } finally {
      setOcupado(false);
    }
  }

  // A RPC valida acesso e ausência de questões e persiste a conclusão sem XP.
  async function concluirSemQuestoes() {
    if (ocupado || !questoesCarregadas || questoes.length > 0 || salaId) return;
    setOcupado(true);
    setErro("");
    try {
      await dominioRepository.concluirAulaSemQuestoes(aula.id);
      setConcluidaSemQuestoes(true);
      setFase("resultado");
      onConcluida(aula.id);
    } catch (error) {
      setErro(mensagemDoErro(error));
    } finally {
      setOcupado(false);
    }
  }

  // Salva a resposta e mostra se acertou (correção simulada, sem gravar nada).
  async function verificar() {
    if (!questao || !entrada || !tentativaId || !entradaCompleta(questao, entrada)) return;
    setOcupado(true);
    setErro("");

    const resposta = montarResposta(questao, entrada);

    try {
      await respostaRepository.salvar({ attempt_id: tentativaId, question_id: questao.id, submitted: resposta });

      try {
        const corrigida = await dominioRepository.corrigirResposta(questao.type, questao.config, resposta, questao.xp_value);
        setCorrecao({ is_correct: corrigida.is_correct, xp: corrigida.xp });
      } catch {
        // O feedback imediato é só um bônus: a correção oficial acontece ao finalizar.
        setCorrecao(null);
      }

      setVerificada(true);
    } catch (error) {
      setErro(mensagemDoErro(error));
    } finally {
      setOcupado(false);
    }
  }

  async function avancar() {
    if (indice < questoes.length - 1) {
      irParaQuestao(indice + 1);
      return;
    }

    if (!tentativaId) return;
    setOcupado(true);
    setErro("");

    try {
      const final = await tentativaRepository.finalizar(tentativaId);
      setResultado(final);
      setFase("resultado");
      onConcluida(aula.id);
    } catch (error) {
      setErro(mensagemDoErro(error));
    } finally {
      setOcupado(false);
    }
  }

  const pac = resultado && resultado.total_count > 0
    ? Math.round((resultado.correct_count / resultado.total_count) * 100)
    : 0;
  const ultimaQuestao = indice === questoes.length - 1;
  const progresso = fase === "questoes" && questoes.length > 0
    ? ((indice + (verificada ? 1 : 0)) / questoes.length) * 100
    : fase === "resultado" ? 100 : 0;

  return (
    <div className="lesson-modal__camada" role="presentation" style={{ "--lesson-accent": cor } as CSSProperties}>
      <div className="lesson-modal__fundo" onClick={onFechar} />

      <section className="lesson-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-modal-titulo">
        <header className="lesson-modal__topo">
          <div>
            <p className="lesson-modal__rotulo">{moduloTitulo}</p>
            <h2 className="lesson-modal__titulo" id="lesson-modal-titulo">{aula.title}</h2>
          </div>
          <button className="lesson-modal__fechar" type="button" onClick={onFechar} aria-label="Fechar aula">×</button>
        </header>

        <div
          className="lesson-modal__progresso"
          role="progressbar"
          aria-label="Progresso da aula"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progresso)}
        >
          <span style={{ width: `${progresso}%` }} />
        </div>

        <div className="lesson-modal__corpo">
          {fase === "carregando" && <p className="lesson-modal__aviso">Carregando aula...</p>}

          {fase === "intro" && (
            <>
              {jaConcluida && <p className="lesson-modal__selo">✓ Você já concluiu esta aula. Pode refazer para praticar.</p>}

              {aula.content
                ? <div className="lesson-modal__conteudo">{aula.content}</div>
                : <p className="lesson-modal__aviso">Esta aula não tem texto de apoio.</p>}

              {questoes.length > 0
                ? <p className="lesson-modal__resumo">{questoes.length} {questoes.length === 1 ? "questão" : "questões"} · até {xpTotal} XP</p>
                : <p className="lesson-modal__resumo">{!questoesCarregadas ? "Não foi possível carregar as atividades." : salaId ? "Esta aula não tem atividades. A conclusão sem questões está disponível no contexto de curso." : "Esta aula não tem atividades. Você pode marcá-la como concluída (sem XP)."}</p>}
            </>
          )}

          {fase === "questoes" && questao && entrada && (
            <>
              <div className="lesson-modal__cabecalho-questao">
                <span>Questão {indice + 1} de {questoes.length}</span>
                <span className="lesson-modal__tipo">{ROTULO_TIPO[questao.type]} · {questao.xp_value} XP</span>
              </div>
              <h3 className="lesson-modal__enunciado">{questao.prompt}</h3>
              <p className="lesson-modal__dica">{DICA_TIPO[questao.type]}</p>

              <CamposQuestao
                key={questao.id}
                questao={questao}
                entrada={entrada}
                bloqueado={verificada || ocupado}
                onChange={setEntrada}
                onEnviar={() => void verificar()}
              />

              {verificada && (
                <div
                  className={`lesson-modal__feedback${correcao ? (correcao.is_correct ? " lesson-modal__feedback--certo" : " lesson-modal__feedback--errado") : ""}`}
                  role="status"
                >
                  {correcao === null && <strong>Resposta salva.</strong>}
                  {correcao?.is_correct && <strong>Correto! +{correcao.xp} XP</strong>}
                  {correcao && !correcao.is_correct && (
                    <>
                      <strong>{correcao.xp > 0 ? `Quase! +${correcao.xp} XP` : "Não foi dessa vez."}</strong>
                      <span>Resposta esperada: {respostaEsperada(questao)}</span>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {fase === "resultado" && (resultado || concluidaSemQuestoes) && (
            <div className="lesson-modal__resultado">
              <div className="lesson-modal__selo-grande" aria-hidden="true">✓</div>
              <h3 className="lesson-modal__resultado-titulo">Aula concluída!</h3>
              {concluidaSemQuestoes ? <p className="lesson-modal__resumo">Esta aula não tinha atividades, então não vale XP.</p> : resultado && <div className="lesson-modal__numeros">
                <div><strong>{resultado.correct_count}/{resultado.total_count}</strong><span>acertos</span></div>
                <div><strong>{pac}%</strong><span>de aproveitamento</span></div>
                <div><strong>+{resultado.xp_earned}</strong><span>XP</span></div>
              </div>}
            </div>
          )}

          {erro && <p className="lesson-modal__erro" role="alert">{erro}</p>}
        </div>

        <footer className="lesson-modal__rodape">
          {fase === "intro" && (
            <>
              <button className="lesson-modal__botao-secundario" type="button" onClick={onFechar}>Fechar</button>
              <button
                className="lesson-modal__botao-primario"
                type="button"
                disabled={ocupado || !questoesCarregadas || (questoes.length === 0 && Boolean(salaId))}
                onClick={() => void (questoes.length === 0 ? concluirSemQuestoes() : comecar())}
              >
                {ocupado ? "Processando..." : questoes.length === 0 ? "Marcar como concluída" : jaConcluida ? "Refazer atividade" : "Começar atividade"}
              </button>
            </>
          )}

          {fase === "questoes" && (
            <>
              <button className="lesson-modal__botao-secundario" type="button" onClick={onFechar}>Sair</button>
              {!verificada ? (
                <button
                  className="lesson-modal__botao-primario"
                  type="button"
                  disabled={ocupado || !entrada || !questao || !entradaCompleta(questao, entrada)}
                  onClick={() => void verificar()}
                >
                  {ocupado ? "Salvando..." : "Verificar"}
                </button>
              ) : (
                <button className="lesson-modal__botao-primario" type="button" disabled={ocupado} onClick={() => void avancar()}>
                  {ocupado ? "Finalizando..." : ultimaQuestao ? "Finalizar aula" : "Próxima"}
                </button>
              )}
            </>
          )}

          {fase === "resultado" && (
            <button className="lesson-modal__botao-primario" type="button" onClick={onFechar}>Voltar à trilha</button>
          )}
        </footer>
      </section>
    </div>
  );
}
