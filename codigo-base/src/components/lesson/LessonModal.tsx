import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  dominioRepository,
  questaoRepository,
  respostaRepository,
  tentativaRepository,
  revisaoRepository,
  type DisponibilidadeRevisao,
  type OcorrenciaRevisao,
  type ResultadoRevisao,
  type SessaoRevisao,
  type RespostaRevisao,
} from "../../data/repositories";
import { PROFILE_UPDATED_EVENT } from "../sidebar/SidebarLeft";
import type { Database } from "../../types/database";
import "./LessonModal.css";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
type Aula = Database["public"]["Tables"]["lessons"]["Row"];
type Questao = Pick<Database["public"]["Tables"]["questions"]["Row"],
  "id" | "type" | "prompt" | "config"> & { xp_value?: number };
type ResultadoTentativa = Awaited<ReturnType<typeof tentativaRepository.finalizar>>;
type Correcao = { is_correct: boolean; xp: number };

type AulaModalProps = {
  modo?: "aula";
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

type RevisaoModalProps = {
  modo: "revisao";
  cursoId: string;
  ocorrenciaId?: string;
  pedidoId?: string;
  sessaoId?: string;
  cor: string;
  onFechar: () => void;
  onPedido: (requestId: string) => void;
  onSessao: (sessionId: string) => void;
  onFinalizada: () => void;
};
type LessonModalProps = AulaModalProps | RevisaoModalProps;

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

function entradaCompleta(questao: Questao, entrada: Entrada, permiteSomaZero = false): boolean {
  switch (entrada.tipo) {
    case "multiple_choice": return entrada.ids.length > 0;
    case "fill_blank": return entrada.texto.trim().length > 0;
    case "sum_alternatives": return entrada.marcados.length > 0 || permiteSomaZero;
    case "match": return lerPares(questao).every((par) => Boolean(entrada.ligacoes[par.esquerda]));
  }
}

// Monta o `submitted` no formato que o grade_answer do banco espera.
function montarResposta(questao: Questao, entrada: Entrada): RespostaRevisao {
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
        aria-label="Sua resposta"
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

export function LessonModal(props: LessonModalProps) {
  const { cursoId, cor, onFechar } = props;
  const revisao = props.modo === "revisao" ? props : null;
  const aula = props.modo !== "revisao" ? props.aula : null;
  const salaId = props.modo !== "revisao" ? props.salaId : undefined;
  const moduloTitulo = props.modo !== "revisao" ? props.moduloTitulo : "Revisão de curso";
  const jaConcluida = props.modo !== "revisao" && props.jaConcluida;
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
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeRevisao | null>(null);
  const [ocorrencia, setOcorrencia] = useState<OcorrenciaRevisao | null>(null);
  const [sessao, setSessao] = useState<SessaoRevisao | null>(null);
  const [resultadoRevisao, setResultadoRevisao] = useState<ResultadoRevisao | null>(null);
  const [recarga, setRecarga] = useState(0);
  const sessaoRef = useRef<SessaoRevisao | null>(null);
  const acoesRef = useRef(props);
  const dialogRef = useRef<HTMLElement>(null);
  const vivoRef = useRef(false);
  const mutacaoRef = useRef(false);
  const versaoRef = useRef(0);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (props.modo !== "revisao") return;
    const timer = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [props.modo]);
  useEffect(() => { acoesRef.current = props; });
  useEffect(() => {
    vivoRef.current = true;
    return () => { vivoRef.current = false; };
  }, []);

  // Mantém o handler mais recente sem religar os listeners do teclado.
  const fecharRef = useRef(onFechar);
  useEffect(() => {
    fecharRef.current = onFechar;
  });

  // Fecha com Esc e trava a rolagem da página enquanto o pop-up está aberto.
  useEffect(() => {
    const gatilho = document.activeElement;
    const dialog = dialogRef.current;
    const focaveis = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
    ) ?? []);
    focaveis()[0]?.focus();
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        fecharRef.current();
      }
      if (evento.key === "Tab") {
        const lista = focaveis();
        const primeiro = lista[0];
        const ultimo = lista[lista.length - 1];
        if (!primeiro) { evento.preventDefault(); dialog?.focus(); return; }
        if (evento.shiftKey && (document.activeElement === primeiro || !dialog?.contains(document.activeElement))) {
          evento.preventDefault(); ultimo?.focus();
        } else if (!evento.shiftKey && (document.activeElement === ultimo || !dialog?.contains(document.activeElement))) {
          evento.preventDefault(); primeiro.focus();
        }
      }
    }

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", aoTeclar);
      if (gatilho instanceof HTMLElement && gatilho.isConnected) gatilho.focus();
    };
  }, []);

  // Carrega as questões da aula.
  useEffect(() => {
    if (!aula) return;
    const aulaId = aula.id;
    let cancelado = false;

    async function carregar() {
      try {
        const lista = await questaoRepository.listarPorAula(aulaId);
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
  }, [aula]);

  const ocorrenciaId = revisao?.ocorrenciaId;
  const pedidoId = revisao?.pedidoId;
  const sessaoId = revisao?.sessaoId;
  const modoRevisao = props.modo === "revisao";
  useEffect(() => {
    if (!modoRevisao) return;
    versaoRef.current += 1;
    let cancelado = false;
    async function carregarRevisao() {
      setOcupado(true);
      setErro("");
      try {
        // Every entry resolves its own official occurrence, independent of delivery.
        const convite = ocorrenciaId ? await revisaoRepository.obterOcorrencia(ocorrenciaId) : null;
        if (convite && convite.course_id !== cursoId) throw new Error("O curso não corresponde à revisão solicitada.");
        if (cancelado) return;
        setOcorrencia(convite);
        let estado: SessaoRevisao | null = null;
        if (sessaoId) {
          estado = sessaoRef.current?.session_id === sessaoId && recarga === 0
            ? sessaoRef.current : await revisaoRepository.obter(sessaoId);
        } else if (pedidoId) {
          estado = await revisaoRepository.iniciar({ cursoId, ocorrenciaId, requestId: pedidoId });
        } else {
          const retomar = convite?.resume_session_id ?? convite?.last_finished_session_id;
          if (retomar) estado = await revisaoRepository.obter(retomar);
        }
        if (cancelado) return;
        if (estado) {
          if (estado.course_id !== cursoId || estado.mode !== (ocorrenciaId ? "bonus" : "normal")
            || estado.occurrence_id !== (ocorrenciaId ?? null)) {
            throw new Error("A sessão não corresponde ao curso e ao modo de revisão solicitados.");
          }
          const mesmaSessao = sessaoRef.current?.session_id === estado.session_id;
          const resultadoNovo = estado.result !== null
            && sessaoRef.current?.result?.session_id !== estado.session_id;
          sessaoRef.current = estado;
          setSessao(estado);
          setResultadoRevisao(estado.result);
          if (!mesmaSessao || recarga > 0) {
            const lista = estado.items.map(item => ({
              id: item.question_id, type: item.type, prompt: item.prompt, config: item.config,
            }));
            const pendente = estado.items.findIndex(item => item.submitted === null);
            const posicao = pendente < 0 ? lista.length - 1 : pendente;
            const atual = estado.items[posicao];
            setQuestoes(lista);
            setIndice(posicao);
            setEntrada(entradaVazia(lista[posicao]));
            setVerificada(atual.submitted !== null);
            setCorrecao(atual.is_correct === null ? null : { is_correct: atual.is_correct, xp: 0 });
          }
          setFase(estado.result ? "resultado" : "questoes");
          const acoes = acoesRef.current;
          if (acoes.modo === "revisao" && sessaoId !== estado.session_id) acoes.onSessao(estado.session_id);
          if (resultadoNovo) {
            if (estado.result && estado.result.bonus_earned > 0) window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
            if (acoes.modo === "revisao") acoes.onFinalizada();
          }
        } else {
          const status = await revisaoRepository.obterDisponibilidade(cursoId);
          if (cancelado) return;
          setDisponibilidade(status);
          setFase("intro");
        }
      } catch (error) {
        if (!cancelado) {
          setErro(mensagemDoErro(error));
          setOcorrencia(null);
          // A failed new intention must not erase the previous frozen result.
          if (!sessaoRef.current) setFase("intro");
        }
      } finally {
        if (!cancelado) setOcupado(false);
      }
    }
    void carregarRevisao();
    return () => { cancelado = true; };
  }, [modoRevisao, cursoId, ocorrenciaId, pedidoId, sessaoId, recarga]);

  const questao = questoes[indice];
  const xpTotal = questoes.reduce((soma, item) => soma + (item.xp_value ?? 0), 0);

  function irParaQuestao(posicao: number) {
    setIndice(posicao);
    setEntrada(questoes[posicao] ? entradaVazia(questoes[posicao]) : null);
    const item = sessaoRef.current?.items[posicao];
    setVerificada(modoRevisao && item?.submitted != null);
    setCorrecao(modoRevisao && item?.is_correct != null ? { is_correct: item.is_correct, xp: 0 } : null);
  }

  function comecarRevisao() {
    if (!revisao || ocupado) return;
    // An outstanding receipt is retried, never replaced on a network failure.
    if (pedidoId && !sessaoId) { setRecarga(value => value + 1); return; }
    revisao.onPedido(crypto.randomUUID());
  }

  // A tentativa só é criada quando o aluno decide começar a atividade.
  async function comecar() {
    if (!aula || props.modo === "revisao" || ocupado || questoes.length === 0) return;
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
    if (!aula || props.modo === "revisao" || ocupado || !questoesCarregadas || questoes.length > 0 || salaId) return;
    setOcupado(true);
    setErro("");
    try {
      await dominioRepository.concluirAulaSemQuestoes(aula.id);
      setConcluidaSemQuestoes(true);
      setFase("resultado");
      props.onConcluida(aula.id);
    } catch (error) {
      setErro(mensagemDoErro(error));
    } finally {
      setOcupado(false);
    }
  }

  // Revisão persiste correção oficial por snapshot; aula mantém seu feedback atual.
  async function verificar() {
    if (ocupado || mutacaoRef.current || verificada || !questao || !entrada
      || (!modoRevisao && !tentativaId) || !entradaCompleta(questao, entrada, modoRevisao)) return;
    if (modoRevisao && !sessao) return;
    mutacaoRef.current = true;
    const versao = versaoRef.current;
    setOcupado(true);
    setErro("");

    const resposta = montarResposta(questao, entrada);

    try {
      if (modoRevisao && sessao) {
        const feedback = await revisaoRepository.salvarResposta(sessao.session_id, questao.id, resposta);
        if (!vivoRef.current || versao !== versaoRef.current) return;
        const atualizada = { ...sessao, items: sessao.items.map(item => item.question_id === questao.id
          ? { ...item, submitted: resposta, is_correct: feedback.is_correct } : item) };
        sessaoRef.current = atualizada;
        setSessao(atualizada);
        setCorrecao({ is_correct: feedback.is_correct, xp: 0 });
        setVerificada(true);
        return;
      }
      if (!tentativaId) return;
      await respostaRepository.salvar({ attempt_id: tentativaId, question_id: questao.id, submitted: resposta });

      try {
        const corrigida = await dominioRepository.corrigirResposta(questao.type, questao.config, resposta, questao.xp_value ?? 0);
        setCorrecao({ is_correct: corrigida.is_correct, xp: corrigida.xp });
      } catch {
        // O feedback imediato é só um bônus: a correção oficial acontece ao finalizar.
        setCorrecao(null);
      }

      setVerificada(true);
    } catch (error) {
      if (vivoRef.current && versao === versaoRef.current) setErro(mensagemDoErro(error));
    } finally {
      mutacaoRef.current = false;
      if (vivoRef.current && versao === versaoRef.current) setOcupado(false);
    }
  }

  async function avancar() {
    if (ocupado || mutacaoRef.current) return;
    if (indice < questoes.length - 1) {
      irParaQuestao(indice + 1);
      return;
    }

    if ((!modoRevisao && !tentativaId) || (modoRevisao && !sessao)) return;
    mutacaoRef.current = true;
    const versao = versaoRef.current;
    setOcupado(true);
    setErro("");

    try {
      if (modoRevisao && sessao) {
        const final = await revisaoRepository.finalizar(sessao.session_id);
        if (final.bonus_earned > 0) window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
        if (!vivoRef.current || versao !== versaoRef.current) return;
        const atualizada = { ...sessao, finished_at: final.finished_at, result: final };
        sessaoRef.current = atualizada;
        setSessao(atualizada);
        setResultadoRevisao(final);
        setFase("resultado");
        const acoes = acoesRef.current;
        if (acoes.modo === "revisao") acoes.onFinalizada();
        // Result stays visible even if refreshing current availability fails.
        try {
          if (ocorrenciaId) {
            const atual = await revisaoRepository.obterOcorrencia(ocorrenciaId);
            if (vivoRef.current && versao === versaoRef.current) setOcorrencia(atual);
          }
        } catch (error) {
          if (vivoRef.current && versao === versaoRef.current) { setOcorrencia(null); setErro(mensagemDoErro(error)); }
        }
        return;
      }
      if (!tentativaId || !aula || props.modo === "revisao") return;
      const final = await tentativaRepository.finalizar(tentativaId);
      setResultado(final);
      setFase("resultado");
      props.onConcluida(aula.id);
    } catch (error) {
      if (vivoRef.current && versao === versaoRef.current) setErro(mensagemDoErro(error));
    } finally {
      mutacaoRef.current = false;
      if (vivoRef.current && versao === versaoRef.current) setOcupado(false);
    }
  }

  const pac = resultado && resultado.total_count > 0
    ? Math.round((resultado.correct_count / resultado.total_count) * 100)
    : 0;
  const ultimaQuestao = indice === questoes.length - 1;
  const progresso = fase === "questoes" && questoes.length > 0
    ? ((indice + (verificada ? 1 : 0)) / questoes.length) * 100
    : fase === "resultado" ? 100 : 0;
  const titulo = modoRevisao ? sessao?.course_title ?? disponibilidade?.course_title ?? ocorrencia?.course_title ?? "Revisão de curso" : aula?.title;
  const bonusDisponivel = ocorrencia?.state === "available"
    && Date.parse(ocorrencia.expires_at) > agora;
  const podeIniciarRevisao = !ocupado && (Boolean(pedidoId && !sessaoId)
    || Boolean(disponibilidade?.can_review && (!ocorrenciaId || bonusDisponivel)));
  const itemRevisao = sessao?.items[indice];
  const notaRevisao = resultadoRevisao
    ? Math.floor(resultadoRevisao.correct_count * 10000 / resultadoRevisao.total_count) / 100 : 0;
  const respostaRegistrada = itemRevisao?.submitted;
  const textoRespostaRegistrada = respostaRegistrada
    ? "selected" in respostaRegistrada ? respostaRegistrada.selected.join(", ")
      : "text" in respostaRegistrada ? respostaRegistrada.text
        : "sum" in respostaRegistrada ? `Soma: ${respostaRegistrada.sum}`
          : respostaRegistrada.pairs.map(par => `${par.left} → ${par.right}`).join("; ")
    : "";

  return (
    <div className="lesson-modal__camada" role="presentation" style={{ "--lesson-accent": cor } as CSSProperties}>
      <div className="lesson-modal__fundo" onClick={onFechar} />

      <section ref={dialogRef} tabIndex={-1} className="lesson-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-modal-titulo" aria-busy={ocupado}>
        <header className="lesson-modal__topo">
          <div>
            <p className="lesson-modal__rotulo">{moduloTitulo}</p>
            <h2 className="lesson-modal__titulo" id="lesson-modal-titulo">{titulo}</h2>
          </div>
          <button className="lesson-modal__fechar" type="button" onClick={onFechar} aria-label={modoRevisao ? "Fechar revisão" : "Fechar aula"}>×</button>
        </header>

        <div
          className="lesson-modal__progresso"
          role="progressbar"
          aria-label={modoRevisao ? "Progresso da revisão" : "Progresso da aula"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progresso)}
        >
          <span style={{ width: `${progresso}%` }} />
        </div>

        <div className="lesson-modal__corpo">
          {fase === "carregando" && <p className="lesson-modal__aviso">{modoRevisao ? "Carregando revisão..." : "Carregando aula..."}</p>}

          {modoRevisao && (
            <p className="lesson-modal__politica">
              {ocorrenciaId
                ? `Revisão com bônus${sessao || ocorrencia ? ` · +${sessao?.bonus_xp ?? ocorrencia?.bonus_xp} XP` : ""} · Meta: 70%`
                : "Sem bônus de revisão"}
              {ocorrenciaId && (sessao?.expires_at ?? ocorrencia?.expires_at) && (
                <span>Prazo: {new Date(sessao?.expires_at ?? ocorrencia?.expires_at ?? "").toLocaleString("pt-BR")}</span>
              )}
            </p>
          )}
          {fase === "intro" && modoRevisao && (
            <>
              {disponibilidade && (
                <>
                  <p className="lesson-modal__resumo">{disponibilidade.sample_count} {disponibilidade.sample_count === 1 ? "questão" : "questões"} · 20% por módulo, arredondado para cima.</p>
                  <ul className="lesson-modal__modulos">
                    {disponibilidade.module_counts.map((modulo, index) => (
                      <li key={modulo.module_id}>Módulo {index + 1}: {modulo.sample_count} de {modulo.question_count} {modulo.question_count === 1 ? "questão" : "questões"}</li>
                    ))}
                  </ul>
                  {!disponibilidade.can_review && <p className="lesson-modal__aviso">
                    {disponibilidade.reason === "REVIEW_EMPTY" ? "Este curso não tem questões para revisão" : "Este curso não está disponível para revisão. Conclua todas as aulas atuais no contexto individual."}
                  </p>}
                </>
              )}
              {ocorrenciaId && ocorrencia && !bonusDisponivel && <p className="lesson-modal__aviso">Esta ocorrência não está disponível para uma nova revisão com bônus.</p>}
              <p className="lesson-modal__aviso">A amostra só será sorteada ao começar. Esta prática não altera conclusões de aulas, missões ou pontuação de temporada.</p>
            </>
          )}
          {fase === "intro" && aula && !modoRevisao && (
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
                <span className="lesson-modal__tipo">{ROTULO_TIPO[questao.type]}{!modoRevisao && ` · ${questao.xp_value} XP`}</span>
              </div>
              {modoRevisao && itemRevisao && <p className="lesson-modal__aviso">{itemRevisao.module_title} · Amostra persistida desta sessão</p>}
              <h3 className="lesson-modal__enunciado">{questao.prompt}</h3>
              <p className="lesson-modal__dica">{DICA_TIPO[questao.type]}</p>

              {modoRevisao && verificada
                ? <p className="lesson-modal__conteudo">Resposta registrada: {textoRespostaRegistrada}</p>
                : <CamposQuestao
                key={questao.id}
                questao={questao}
                entrada={entrada}
                bloqueado={verificada || ocupado}
                onChange={setEntrada}
                onEnviar={() => void verificar()}
                />}

              {verificada && (
                <div
                  className={`lesson-modal__feedback${correcao ? (correcao.is_correct ? " lesson-modal__feedback--certo" : " lesson-modal__feedback--errado") : ""}`}
                  role="status"
                >
                  {correcao === null && <strong>Resposta salva.</strong>}
                  {correcao?.is_correct && <strong>{modoRevisao ? "Correto!" : `Correto! +${correcao.xp} XP`}</strong>}
                  {correcao && !correcao.is_correct && (
                    <>
                      <strong>{!modoRevisao && correcao.xp > 0 ? `Quase! +${correcao.xp} XP` : "Não foi dessa vez."}</strong>
                      <span>Resposta esperada: {respostaEsperada(questao)}</span>
                    </>
                  )}
                  {modoRevisao && itemRevisao?.explanation && <span>{itemRevisao.explanation}</span>}
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
          {fase === "resultado" && modoRevisao && resultadoRevisao && (
            <div className="lesson-modal__resultado" role="status">
              <h3 className="lesson-modal__resultado-titulo">Revisão finalizada</h3>
              <div className="lesson-modal__numeros">
                <div><strong>{resultadoRevisao.correct_count}/{resultadoRevisao.total_count}</strong><span>acertos</span></div>
                <div><strong>{notaRevisao}%</strong><span>de aproveitamento · meta 70%</span></div>
                <div><strong>+{resultadoRevisao.bonus_earned}</strong><span>XP global concedido</span></div>
              </div>
              {resultadoRevisao.bonus_outcome === "already_awarded" && <p>Bônus deste período já recebido em outra execução</p>}
              {resultadoRevisao.bonus_outcome === "below_target" && <p>Meta não atingida. Antes do prazo, você pode tentar novamente com outra amostra.</p>}
              {resultadoRevisao.bonus_outcome === "awarded" && <p>Bônus de revisão recebido!</p>}
            </div>
          )}

          {erro && <p className="lesson-modal__erro" role="alert">{erro}</p>}
          {modoRevisao && erro && (
            <button className="lesson-modal__botao-secundario" type="button" disabled={ocupado} onClick={() => setRecarga(value => value + 1)}>Tentar carregar novamente</button>
          )}
        </div>

        <footer className="lesson-modal__rodape">
          {fase === "intro" && modoRevisao && (
            <>
              <button className="lesson-modal__botao-secundario" type="button" onClick={onFechar}>Fechar</button>
              <button className="lesson-modal__botao-primario" type="button" disabled={!podeIniciarRevisao} onClick={comecarRevisao}>
                {ocupado ? "Processando..." : pedidoId ? "Repetir pedido de início" : "Começar revisão"}
              </button>
            </>
          )}
          {fase === "intro" && !modoRevisao && (
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
                  disabled={ocupado || !entrada || !questao || !entradaCompleta(questao, entrada, modoRevisao)}
                  onClick={() => void verificar()}
                >
                  {ocupado ? "Salvando..." : "Verificar"}
                </button>
              ) : (
                <button className="lesson-modal__botao-primario" type="button" disabled={ocupado} onClick={() => void avancar()}>
                  {ocupado ? "Finalizando..." : ultimaQuestao ? modoRevisao ? "Finalizar revisão" : "Finalizar aula" : "Próxima"}
                </button>
              )}
            </>
          )}

          {fase === "resultado" && (
            <>
              {modoRevisao && resultadoRevisao?.bonus_outcome === "below_target" && bonusDisponivel && (
                <button className="lesson-modal__botao-primario" type="button" disabled={ocupado} onClick={comecarRevisao}>Tentar novamente</button>
              )}
              <button className="lesson-modal__botao-secundario" type="button" onClick={onFechar}>Voltar à trilha</button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
