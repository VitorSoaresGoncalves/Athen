import type { Database } from "../../types/database";
import {
  novoIdOpcao,
  somaEsperada,
  type ConfigAssociacao,
  type ConfigLacuna,
  type ConfigMultipla,
  type ConfigSomatorio,
  type TipoQuestao,
} from "./questionConfig";

type Json = Database["public"]["Tables"]["questions"]["Row"]["config"];

type Props = {
  tipo: TipoQuestao;
  config: Json;
  onChange: (config: Json) => void;
  desabilitado?: boolean;
};

/**
 * Editor da configuração específica de cada tipo de questão. Emite a config no
 * mesmo formato jsonb que o corretor do servidor lê (ver questionConfig.ts).
 */
export function EditorConfigQuestao({ tipo, config, onChange, desabilitado = false }: Props) {
  if (tipo === "match") {
    const c = config as unknown as ConfigAssociacao;
    const pares = c.pairs ?? [];
    return (
      <div className="criar-curso__config">
        <p className="criar-curso__config-dica">Associe cada item da esquerda ao da direita.</p>
        {pares.map((par, i) => (
          <div className="criar-curso__config-linha" key={i}>
            <input
              className="criar-curso__input"
              placeholder="Esquerda"
              value={par.left}
              disabled={desabilitado}
              onChange={(e) => onChange({ pairs: pares.map((p, j) => (j === i ? { ...p, left: e.target.value } : p)) } as unknown as Json)}
            />
            <span className="criar-curso__config-seta" aria-hidden="true">↔</span>
            <input
              className="criar-curso__input"
              placeholder="Direita"
              value={par.right}
              disabled={desabilitado}
              onChange={(e) => onChange({ pairs: pares.map((p, j) => (j === i ? { ...p, right: e.target.value } : p)) } as unknown as Json)}
            />
            <button
              type="button"
              className="criar-curso__remover-mini"
              aria-label="Remover par"
              disabled={desabilitado}
              onClick={() => onChange({ pairs: pares.filter((_, j) => j !== i) } as unknown as Json)}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="criar-curso__botao-leve"
          disabled={desabilitado}
          onClick={() => onChange({ pairs: [...pares, { left: "", right: "" }] } as unknown as Json)}
        >
          + Adicionar par
        </button>
      </div>
    );
  }

  if (tipo === "multiple_choice") {
    const c = config as unknown as ConfigMultipla;
    const opcoes = c.options ?? [];
    return (
      <div className="criar-curso__config">
        <p className="criar-curso__config-dica">Marque uma ou mais alternativas corretas. A correção exige o conjunto exato.</p>
        {opcoes.map((opcao, i) => (
          <div className="criar-curso__config-linha" key={opcao.id}>
            <input
              type="checkbox"
              className="criar-curso__checkbox"
              checked={opcao.correct}
              aria-label="Correta"
              disabled={desabilitado}
              onChange={(e) => onChange({ options: opcoes.map((o, j) => (j === i ? { ...o, correct: e.target.checked } : o)) } as unknown as Json)}
            />
            <input
              className="criar-curso__input criar-curso__input--flex"
              placeholder={`Alternativa ${i + 1}`}
              value={opcao.text}
              disabled={desabilitado}
              onChange={(e) => onChange({ options: opcoes.map((o, j) => (j === i ? { ...o, text: e.target.value } : o)) } as unknown as Json)}
            />
            <button
              type="button"
              className="criar-curso__remover-mini"
              aria-label="Remover alternativa"
              disabled={desabilitado}
              onClick={() => onChange({ options: opcoes.filter((_, j) => j !== i) } as unknown as Json)}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="criar-curso__botao-leve"
          disabled={desabilitado}
          onClick={() => onChange({ options: [...opcoes, { id: novoIdOpcao(), text: "", correct: false }] } as unknown as Json)}
        >
          + Adicionar alternativa
        </button>
      </div>
    );
  }

  if (tipo === "fill_blank") {
    const c = config as unknown as ConfigLacuna;
    const respostas = c.answers ?? [];
    return (
      <div className="criar-curso__config">
        <p className="criar-curso__config-dica">
          Use o enunciado para indicar a lacuna. Liste todas as respostas aceitas (a correção ignora acentos, maiúsculas e espaços extras).
        </p>
        {respostas.map((resposta, i) => (
          <div className="criar-curso__config-linha" key={i}>
            <input
              className="criar-curso__input criar-curso__input--flex"
              placeholder={`Resposta aceita ${i + 1}`}
              value={resposta}
              disabled={desabilitado}
              onChange={(e) => onChange({ answers: respostas.map((a, j) => (j === i ? e.target.value : a)) } as unknown as Json)}
            />
            <button
              type="button"
              className="criar-curso__remover-mini"
              aria-label="Remover resposta"
              disabled={desabilitado}
              onClick={() => onChange({ answers: respostas.filter((_, j) => j !== i) } as unknown as Json)}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="criar-curso__botao-leve"
          disabled={desabilitado}
          onClick={() => onChange({ answers: [...respostas, ""] } as unknown as Json)}
        >
          + Adicionar resposta aceita
        </button>
      </div>
    );
  }

  // sum_alternatives
  const c = config as unknown as ConfigSomatorio;
  const afirmativas = c.statements ?? [];
  const soma = somaEsperada(c);
  return (
    <div className="criar-curso__config">
      <p className="criar-curso__config-dica">
        Numere as afirmativas com valores (ex.: 1, 2, 4, 8...) e marque as corretas. A soma esperada é calculada automaticamente.
      </p>
      {afirmativas.map((afirmativa, i) => (
        <div className="criar-curso__config-linha" key={i}>
          <input
            type="checkbox"
            className="criar-curso__checkbox"
            checked={afirmativa.correct}
            aria-label="Correta"
            disabled={desabilitado}
            onChange={(e) => onChange({ statements: afirmativas.map((s, j) => (j === i ? { ...s, correct: e.target.checked } : s)) } as unknown as Json)}
          />
          <input
            type="number"
            className="criar-curso__input criar-curso__input--numero"
            value={afirmativa.value}
            aria-label={`Valor da afirmativa ${i + 1}`}
            disabled={desabilitado}
            onChange={(e) => onChange({ statements: afirmativas.map((s, j) => (j === i ? { ...s, value: Number(e.target.value) || 0 } : s)) } as unknown as Json)}
          />
          <button
            type="button"
            className="criar-curso__remover-mini"
            aria-label="Remover afirmativa"
            disabled={desabilitado}
            onClick={() => onChange({ statements: afirmativas.filter((_, j) => j !== i) } as unknown as Json)}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="criar-curso__config-rodape">
        <button
          type="button"
          className="criar-curso__botao-leve"
          disabled={desabilitado}
          onClick={() => onChange({ statements: [...afirmativas, { value: 1, correct: false }] } as unknown as Json)}
        >
          + Adicionar afirmativa
        </button>
        <span className="criar-curso__soma">Soma esperada: <strong>{soma}</strong></span>
      </div>
    </div>
  );
}

export default EditorConfigQuestao;