import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageLayout } from "../components/layout/PageLayout";
import { missaoGlobalRepository } from "../data/repositories";
import type { Database } from "../types/database";
import { ROTULO_OBJETIVO, prazoAbsoluto, rotuloContexto } from "./missoes-labels";
import "./Missoes.css";

// ---------------------------------------------------------------------------
// Detalhe da missão (/missoes/:id)
//
// Mostra criterio/objetivo, meta, contexto, progresso, prazo com fuso e
// recompensa, com acao para abrir o conteudo correto (Q073). Indisponibilidade
// (ocorrencia inexistente/fora do periodo) explica o motivo.
// ---------------------------------------------------------------------------

type Missao = Database["public"]["Functions"]["my_mission_detail"]["Returns"][number];

const errMsg = (error: unknown, fallback = "Erro desconhecido.") =>
  error instanceof Error ? error.message : fallback;

// Destino do conteudo elegivel (Q073). Diaria de curso abre o curso; globais
// abrem o catalogo, de onde o usuario escolhe o que estudar.
function destinoConteudo(missao: Missao): { to: string; rotulo: string } {
  if (missao.scope === "course_daily" && missao.course_id) {
    return { to: "/catalogo", rotulo: "Abrir o curso" };
  }
  return { to: "/catalogo", rotulo: "Escolher conteúdo para estudar" };
}

export default function MissaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [missao, setMissao] = useState<Missao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro("");
      setMissao(null);
      if (!id) {
        setErro("Missão não informada.");
        setCarregando(false);
        return;
      }
      try {
        const detalhe = await missaoGlobalRepository.detalhe(id);
        if (!cancelado) setMissao(detalhe);
      } catch (error) {
        if (!cancelado) setErro(errMsg(error, "Não foi possível carregar a missão."));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, [id]);

  const objetivo = missao ? ROTULO_OBJETIVO[missao.objective] ?? missao.objective : "";
  const contexto = missao ? rotuloContexto(missao.scope, missao.course_title) : "";
  const progresso = missao ? Math.min(100, Number(missao.progress) || 0) : 0;
  const destino = missao ? destinoConteudo(missao) : null;

  return (
    <PageLayout variant="bare">
      <div className="missoes">
        <main className="missoes__main">
          <div className="missoes__brilho" />

          <header className="missoes__cabecalho">
            <div>
              <p className="missoes__caminho">
                PLATAFORMA / <Link to="/missoes" className="missoes__voltar">MISSÕES</Link> / <span>DETALHE</span>
              </p>
              <h1 className="missoes__titulo">{missao?.title ?? "Missão"}</h1>
              {missao && <p className="missoes__subtitulo">{contexto}</p>}
            </div>
          </header>

          {carregando ? (
            <p className="missoes__estado">Carregando missão...</p>
          ) : erro ? (
            <p className="missoes__estado missoes__estado--erro">{erro}</p>
          ) : !missao ? (
            <p className="missoes__estado">
              Esta missão não está disponível. Pode ter encerrado ou não pertencer ao período atual.
            </p>
          ) : (
            <section className="missoes__detalhe">
              {missao.description && <p className="missoes__detalhe-descricao">{missao.description}</p>}

              <dl className="missoes__detalhe-grade">
                <div>
                  <dt>Critério</dt>
                  <dd>{objetivo}</dd>
                </div>
                <div>
                  <dt>Meta</dt>
                  <dd>{missao.current_count}/{missao.target}</dd>
                </div>
                <div>
                  <dt>Recompensa</dt>
                  <dd>+{missao.reward_xp} XP</dd>
                </div>
                <div>
                  <dt>Prazo</dt>
                  <dd>{prazoAbsoluto(missao.period_end)}</dd>
                </div>
                {missao.scope === "course_daily" && missao.course_title && (
                  <div>
                    <dt>Curso</dt>
                    <dd>{missao.course_title}</dd>
                  </div>
                )}
                <div>
                  <dt>Situação</dt>
                  <dd>{missao.completed ? "Concluída" : `${progresso}% concluído`}</dd>
                </div>
              </dl>

              <div className="missoes__barra missoes__barra--detalhe" role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${progresso}%` }} />
              </div>

              {destino && !missao.completed && (
                <Link to={destino.to} className="missoes__acao">
                  {destino.rotulo}
                </Link>
              )}
            </section>
          )}
        </main>
      </div>
    </PageLayout>
  );
}
