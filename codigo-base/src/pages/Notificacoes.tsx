import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "../components/layout/PageLayout";
import { DatabaseNotConnected } from "../components/layout/DatabaseNotConnected";
import { notificacaoRepository, revisaoRepository } from "../data/repositories";
import { NOTIFICATIONS_READ_EVENT } from "../components/sidebar/SidebarLeft";
import type { Database } from "../types/database";
import "./Notificacoes.css";

type Notificacao = Database["public"]["Tables"]["notifications"]["Row"];
type TipoNotificacao = Database["public"]["Enums"]["notification_type"];

// Caixa real: leitura, navegação e remoção dos avisos próprios, sob RLS.
const BANCO_CONECTADO = true;

// Ícone, rótulo e destino por tipo de notificação (enum do servidor).
const ICONE_TIPO: Record<TipoNotificacao, string> = {
  atualizacao_curso: "📘",
  pedido_amizade: "👋",
  convite_sala: "🚪",
  missao: "🎯",
  lembrete_estudo: "⏰",
  revisao_curso: "🔄",
};

const ROTULO_TIPO: Record<TipoNotificacao, string> = {
  atualizacao_curso: "Atualização de curso",
  pedido_amizade: "Pedido de amizade",
  convite_sala: "Convite de sala",
  missao: "Missão",
  lembrete_estudo: "Lembrete de estudo",
  revisao_curso: "Revisão de curso",
};

function iconeTipo(tipo: TipoNotificacao) {
  return ICONE_TIPO[tipo] ?? "🔔";
}

function rotuloTipo(tipo: TipoNotificacao) {
  return ROTULO_TIPO[tipo] ?? tipo;
}

// Destino no app conforme o tipo da notificação (null = sem link).
function linkNotificacao(notificacao: Pick<Notificacao, "type" | "reference_id">): string | null {
  switch (notificacao.type) {
    case "pedido_amizade":
    case "lembrete_estudo":
      return "/amigos";
    case "convite_sala":
    case "missao":
      return "/salas";
    case "atualizacao_curso":
      return "/catalogo";
    default:
      return null;
  }
}

// Tempo relativo em pt-BR (agora, X min, X h, X d, ou data).
function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const quando = new Date(iso).getTime();
  if (Number.isNaN(quando)) return "";
  const seg = Math.max(0, Math.floor((agora.getTime() - quando) / 1000));
  if (seg < 60) return "agora";
  const min = Math.floor(seg / 60);
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h`;
  const dia = Math.floor(hr / 24);
  if (dia < 7) return `${dia} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function Notificacoes() {
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(BANCO_CONECTADO);
  const [erro, setErro] = useState("");
  const [erroAbertura, setErroAbertura] = useState("");
  const [abrindoId, setAbrindoId] = useState<string | null>(null);
  const [acao, setAcao] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState("");
  const [mensagem, setMensagem] = useState("");
  const ocupado = abrindoId !== null || acao !== null;

  useEffect(() => {
    if (!BANCO_CONECTADO) return;

    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro("");
      try {
        const lista = await notificacaoRepository.listar();
        if (!cancelado) setNotificacoes(lista);

        // Acessar a caixa conta como "ver" as notificações: marca as não lidas como
        // lidas no servidor e avisa a sidebar para zerar a bolha de não lidas. A
        // lista local mantém o estado recém-carregado, então o destaque de "nova"
        // continua visível nesta visita.
        if (lista.some((item) => !item.is_read)) {
          await notificacaoRepository.marcarTodasComoLidas();
          window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
        }
      } catch (error) {
        if (!cancelado) setErro(error instanceof Error ? error.message : "Não foi possível carregar as notificações.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();
    return () => { cancelado = true; };
  }, []);

  const naoLidas = useMemo(() => notificacoes.reduce((total, item) => (item.is_read ? total : total + 1), 0), [notificacoes]);

  async function abrirNotificacao(notificacao: Notificacao) {
    if (ocupado || carregando) return;
    setAbrindoId(notificacao.id);
    setErroAbertura("");
    try {
      let destino: string | null | { pathname: string; search?: string; state?: { courseId?: string; revisao?: string } } = linkNotificacao(notificacao);
      if (notificacao.type === "revisao_curso") {
        if (!notificacao.reference_id) throw new Error("Esta notificação não identifica uma revisão de curso.");
        const ocorrencia = await revisaoRepository.obterOcorrencia(notificacao.reference_id);
        if (!ocorrencia.course_id) throw new Error("Esta revisão não tem um curso atribuído.");
        // Mantém a seleção do curso em state para não expor o id na URL.
        destino = {
          pathname: "/dashboard",
          search: new URLSearchParams({ revisao: ocorrencia.occurrence_id }).toString(),
          state: { courseId: ocorrencia.course_id },
        };
      }
      if (!notificacao.is_read) {
        try {
          await notificacaoRepository.marcarComoLida(notificacao.id);
          setNotificacoes((atuais) => atuais.map((item) => (item.id === notificacao.id ? { ...item, is_read: true } : item)));
          window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
        } catch (error) {
          setErroAbertura(error instanceof Error ? error.message : "Não foi possível marcar a notificação como lida.");
        }
      }
      if (destino) {
        if (typeof destino === "string") navigate(destino);
        else navigate({ pathname: destino.pathname, search: destino.search }, { state: destino.state });
      }
    } catch (error) {
      setErroAbertura(error instanceof Error ? error.message : "Não foi possível abrir a revisão. Tente novamente.");
    } finally {
      setAbrindoId(null);
    }
  }

  async function marcarTodas() {
    if (ocupado || carregando) return;
    setAcao("marcar");
    setErroAcao("");
    setMensagem("");
    try {
      await notificacaoRepository.marcarTodasComoLidas();
      setNotificacoes((atuais) => atuais.map((item) => ({ ...item, is_read: true })));
      window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível marcar as notificações como lidas.");
    } finally {
      setAcao(null);
    }
  }

  async function remover(id?: string) {
    if (ocupado || carregando) return;
    setAcao(id ?? "limpar");
    setErroAcao("");
    setErroAbertura("");
    setMensagem("");
    try {
      let removidas: string[];
      if (id) {
        await notificacaoRepository.deletar(id);
        removidas = [id];
      } else {
        removidas = await notificacaoRepository.deletarLidas();
      }
      // Usa os IDs efetivamente removidos: o destaque local pode conservar o
      // estado anterior à marcação automática, e novos avisos podem ter chegado.
      setNotificacoes((atuais) => atuais.filter((item) => !removidas.includes(item.id)));
      setMensagem(id ? "Notificação removida." : removidas.length
        ? "Notificações lidas removidas." : "Nenhuma notificação lida para remover.");
      window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível remover as notificações.");
    } finally {
      setAcao(null);
    }
  }

  return (
    <PageLayout variant="bare">
      <div className="notificacoes">
        <div className="notificacoes__main">
          <div className="notificacoes__brilho" />

          <header className="notificacoes__cabecalho">
            <div>
              <p className="notificacoes__caminho">PLATAFORMA / <span>NOTIFICAÇÕES</span></p>
              <h1 className="notificacoes__titulo">Notificações</h1>
              <p className="notificacoes__subtitulo">
                {BANCO_CONECTADO
                  ? (naoLidas > 0 ? `${naoLidas} não lida(s).` : "Tudo em dia.")
                  : "Acompanhe avisos de cursos, amizades, salas e missões."}
              </p>
            </div>
            {BANCO_CONECTADO && !carregando && !erro && notificacoes.length > 0 && (
              <div className="notificacoes__acoes">
                {naoLidas > 0 && (
                  <button className="notificacoes__botao-secundario" type="button" disabled={ocupado} onClick={() => void marcarTodas()}>
                    Marcar todas como lidas
                  </button>
                )}
                <button className="notificacoes__botao-secundario" type="button" disabled={ocupado} aria-busy={acao === "limpar"} onClick={() => void remover()}>
                  Limpar lidas
                </button>
              </div>
            )}
          </header>

          {erroAcao && <p className="notificacoes__estado notificacoes__estado--erro" role="alert">{erroAcao}</p>}
          {mensagem && <p className="notificacoes__feedback" role="status">{mensagem}</p>}
          {erroAbertura && (
            <p className="notificacoes__estado notificacoes__estado--erro" role="alert">{erroAbertura}</p>
          )}
          {!BANCO_CONECTADO ? (
            <DatabaseNotConnected recurso="suas notificações" className="mt-[24px]" />
          ) : carregando ? (
            <p className="notificacoes__estado">Carregando notificações...</p>
          ) : erro ? (
            <p className="notificacoes__estado notificacoes__estado--erro" role="alert">{erro}</p>
          ) : notificacoes.length === 0 ? (
            <p className="notificacoes__estado">Você ainda não tem notificações.</p>
          ) : (
            <ul className="notificacoes__lista">
              {notificacoes.map((notificacao) => (
                <li key={notificacao.id}>
                  <button
                    type="button"
                    onClick={() => void abrirNotificacao(notificacao)}
                    disabled={ocupado}
                    aria-label={`Abrir notificação: ${notificacao.title}`}
                    aria-busy={abrindoId === notificacao.id}
                    className={`notificacoes__item${notificacao.is_read ? "" : " notificacoes__item--nova"}`}
                  >
                    <span className="notificacoes__icone" aria-hidden="true">{iconeTipo(notificacao.type)}</span>
                    <div className="notificacoes__conteudo">
                      <div className="notificacoes__linha-topo">
                        <strong className="notificacoes__item-titulo">{notificacao.title}</strong>
                        <span className="notificacoes__quando">{tempoRelativo(notificacao.created_at)}</span>
                      </div>
                      {notificacao.message && <p className="notificacoes__mensagem">{notificacao.message}</p>}
                      <span className="notificacoes__tipo">{rotuloTipo(notificacao.type)}</span>
                    </div>
                    {!notificacao.is_read && <span className="notificacoes__ponto" aria-label="não lida" />}
                  </button>
                  <button type="button" className="notificacoes__remover"
                    aria-label={`Remover notificação: ${notificacao.title}`}
                    disabled={ocupado} aria-busy={acao === notificacao.id}
                    onClick={() => void remover(notificacao.id)}>
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
