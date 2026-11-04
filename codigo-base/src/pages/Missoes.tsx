import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageLayout } from "../components/layout/PageLayout";
import { missaoGlobalRepository } from "../data/repositories";
import type { Database } from "../types/database";
import { ROTULO_OBJETIVO, prazoRelativo, rotuloContexto } from "./missoes-labels";
import "./Missoes.css";

// ---------------------------------------------------------------------------
// Missões (/missoes)
//
// Lista as missões do período corrente do usuário (globais diárias/semanais e
// diárias de curso), lidas de my_missions (migração 0031). Mostra resumo com
// pendentes e concluídas; cada cartão tem rótulo de contexto, meta, progresso,
// prazo e bônus (Q071/Q072/Q073) e leva ao detalhe (/missoes/:id). As missões de
// SALA ficam na página da sala.
// ---------------------------------------------------------------------------

type Missao = Database["public"]["Functions"]["my_missions"]["Returns"][number];

const errMsg = (error: unknown, fallback = "Erro desconhecido.") =>
  error instanceof Error ? error.message : fallback;

export default function Missoes() {
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro("");
      try {
        const lista = await missaoGlobalRepository.minhas();
        if (!cancelado) setMissoes(lista);
      } catch (error) {
        if (!cancelado) setErro(errMsg(error, "Não foi possível carregar as missões."));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  const pendentes = useMemo(() => missoes.filter((m) => !m.completed), [missoes]);
  const concluidas = useMemo(() => missoes.filter((m) => m.completed), [missoes]);

  return (
    <PageLayout variant="bare">
      <div className="missoes">
        <main className="missoes__main">
          <div className="missoes__brilho" />

          <header className="missoes__cabecalho">
            <div>
              <p className="missoes__caminho">PLATAFORMA / <span>MISSÕES</span></p>
              <h1 className="missoes__titulo">Missões</h1>
              <p className="missoes__subtitulo">
                Objetivos diários e semanais. Cumpra para ganhar XP de bônus.
              </p>
            </div>
          </header>

          {carregando ? (
            <p className="missoes__estado">Carregando missões...</p>
          ) : erro ? (
            <p className="missoes__estado missoes__estado--erro">{erro}</p>
          ) : missoes.length === 0 ? (
            <p className="missoes__estado">Nenhuma missão disponível no momento.</p>
          ) : (
            <>
              <section className="missoes__secao">
                <div className="missoes__secao-cabecalho">
                  <h2 className="missoes__secao-titulo">Pendentes</h2>
                  <span className="missoes__secao-resumo">{pendentes.length}</span>
                </div>
                {pendentes.length === 0 ? (
                  <p className="missoes__estado">Tudo em dia. Volte amanhã para novas missões.</p>
                ) : (
                  <ul className="missoes__lista">
                    {pendentes.map((missao) => (
                      <MissaoCartao key={missao.occurrence_id} missao={missao} />
                    ))}
                  </ul>
                )}
              </section>

              {concluidas.length > 0 && (
                <section className="missoes__secao">
                  <div className="missoes__secao-cabecalho">
                    <h2 className="missoes__secao-titulo">Concluídas</h2>
                    <span className="missoes__secao-resumo">{concluidas.length}</span>
                  </div>
                  <ul className="missoes__lista">
                    {concluidas.map((missao) => (
                      <MissaoCartao key={missao.occurrence_id} missao={missao} concluida />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </PageLayout>
  );
}

function MissaoCartao({ missao, concluida = false }: { missao: Missao; concluida?: boolean }) {
  const objetivo = ROTULO_OBJETIVO[missao.objective] ?? missao.objective;
  const progresso = Math.min(100, Number(missao.progress) || 0);
  const contexto = rotuloContexto(missao.scope, missao.course_title);

  return (
    <li>
      <Link
        to={`/missoes/${missao.occurrence_id}`}
        className={`missoes__item${concluida ? " missoes__item--concluida" : ""}`}
        aria-label={`Abrir detalhe da missão ${missao.title}`}
      >
        <div className="missoes__item-topo">
          <span className="missoes__contexto">{contexto}</span>
          <span className="missoes__prazo">{concluida ? "concluída" : prazoRelativo(missao.period_end)}</span>
        </div>

        <strong className="missoes__item-titulo">{missao.title}</strong>
        {missao.description && <p className="missoes__item-descricao">{missao.description}</p>}

        <div className="missoes__item-meta">
          <span className="missoes__objetivo">{objetivo}</span>
          <span className="missoes__contagem">
            {missao.current_count}/{missao.target}
          </span>
          <span className="missoes__bonus" aria-label={`Recompensa de ${missao.reward_xp} XP`}>
            +{missao.reward_xp} XP
          </span>
        </div>

        <div className="missoes__barra" role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progresso}%` }} />
        </div>
      </Link>
    </li>
  );
}
