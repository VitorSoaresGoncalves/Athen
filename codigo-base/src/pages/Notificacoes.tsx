import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "../components/layout/PageLayout";
import { DatabaseNotConnected } from "../components/layout/DatabaseNotConnected";
import { notificacaoRepository } from "../data/repositories";
import type { Database } from "../types/database";
import "./Notificacoes.css";

type Notificacao = Database["public"]["Tables"]["notifications"]["Row"];
type TipoNotificacao = Database["public"]["Enums"]["notification_type"];

// Integração ativa: caixa de entrada real (listar, marcar como lida, marcar todas).
const BANCO_CONECTADO = true;

// Ícone, rótulo e destino por tipo de notificação (enum do servidor).
const ICONE_TIPO: Record<TipoNotificacao, string> = {
  atualizacao_curso: "📘",
  pedido_amizade: "👋",
  convite_sala: "🚪",
  missao: "🎯",
  lembrete_estudo: "⏰",
};

const ROTULO_TIPO: Record<TipoNotificacao, string> = {
  atualizacao_curso: "Atualização de curso",
  pedido_amizade: "Pedido de amizade",
  convite_sala: "Convite de sala",
  missao: "Missão",
  lembrete_estudo: "Lembrete de estudo",
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

  useEffect(() => {
    if (!BANCO_CONECTADO) return;

    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro("");
      try {
        const lista = await notificacaoRepository.listar();
        if (!cancelado) setNotificacoes(lista);
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
    if (!notificacao.is_read) {
      try {
        await notificacaoRepository.marcarComoLida(notificacao.id);
        setNotificacoes((atuais) => atuais.map((item) => (item.id === notificacao.id ? { ...item, is_read: true } : item)));
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Não foi possível marcar a notificação como lida.");
      }
    }
    const destino = linkNotificacao(notificacao);
    if (destino) navigate(destino);
  }

  async function marcarTodas() {
    try {
      await notificacaoRepository.marcarTodasComoLidas();
      setNotificacoes((atuais) => atuais.map((item) => ({ ...item, is_read: true })));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível marcar as notificações como lidas.");
    }
  }

  return (
    <PageLayout variant="bare">
      <div className="notificacoes">
        <main className="notificacoes__main">
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
            {BANCO_CONECTADO && naoLidas > 0 && (
              <button className="notificacoes__botao-secundario" type="button" onClick={() => void marcarTodas()}>
                Marcar todas como lidas
              </button>
            )}
          </header>

          {!BANCO_CONECTADO ? (
            <DatabaseNotConnected recurso="suas notificações" className="mt-[24px]" />
          ) : carregando ? (
            <p className="notificacoes__estado">Carregando notificações...</p>
          ) : erro ? (
            <p className="notificacoes__estado notificacoes__estado--erro">{erro}</p>
          ) : notificacoes.length === 0 ? (
            <p className="notificacoes__estado">Você ainda não tem notificações.</p>
          ) : (
            <ul className="notificacoes__lista">
              {notificacoes.map((notificacao) => (
                <li key={notificacao.id}>
                  <button
                    type="button"
                    onClick={() => void abrirNotificacao(notificacao)}
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
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </PageLayout>
  );
}
