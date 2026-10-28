import { useEffect, useMemo, useState } from "react";
import { PageLayout } from "../components/layout/PageLayout";
import {
  RankBadge,
  RankingPodium,
  type PodiumHeight,
  type PodiumPlayer,
  type Tier,
} from "../components/ranking/RankingPodium";
import { rankingRepository } from "../data/repositories";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";
import "./Ligas.css";

type RankingGlobal = Database["public"]["Views"]["global_ranking"]["Row"];

// ---------------------------------------------------------------------------
// Ligas
//
// O banco não tem uma tabela de ligas. Aqui cada liga corresponde a um NÍVEL do jogador
// (profiles.level, calculado no servidor a partir do XP):
//   nível 1 = Bronze, 2 = Prata, 3 = Ouro, 4 = Platina, 5 = Diamante, 6 = Mestre, 7 ou mais = Lendário.
// A classificação de cada liga é o ranking global (XP acumulado) só dos jogadores daquele nível.
// Não há ranking semanal, promoção nem rebaixamento: o nível sobe sozinho ao atingir o XP necessário.
// ---------------------------------------------------------------------------
type Jogador = { id: string; nome: string; pontos: number; voce: boolean };

const ligas: { tier: Tier; nome: string }[] = [
  { tier: "bronze", nome: "Bronze" },
  { tier: "silver", nome: "Prata" },
  { tier: "gold", nome: "Ouro" },
  { tier: "platinum", nome: "Platina" },
  { tier: "diamond", nome: "Diamante" },
  { tier: "master", nome: "Mestre" },
  { tier: "legendary", nome: "Lendário" },
];

const nomeDaLiga = Object.fromEntries(ligas.map((liga) => [liga.tier, liga.nome])) as Record<Tier, string>;

const nivelParaLiga = (nivel: number): Tier =>
  ligas[Math.min(Math.max(nivel, 1), ligas.length) - 1].tier;

// XP em que cada nível começa. Espelha level_for_xp() do banco (0010_domain_functions.sql):
// L1 0, L2 100, L3 250, L4 500, L5 1000, L6 2000 e, daí em diante, +2000 por nível.
const XP_INICIO_NIVEL = [0, 0, 100, 250, 500, 1000, 2000]; // o índice é o nível
const xpInicioDoNivel = (nivel: number) =>
  nivel <= 1 ? 0 : nivel <= 6 ? XP_INICIO_NIVEL[nivel] : 2000 + (nivel - 6) * 2000;

const errMsg = (error: unknown, fallback = "Erro desconhecido.") => (error instanceof Error ? error.message : fallback);

const formatarXp = (pontos: number) => `${pontos.toLocaleString("pt-BR")} XP`;

// O pódio é exibido na ordem visual: 4º, 2º, 1º, 3º, 5º.
const ORDEM_DO_PODIO: { indice: number; altura: PodiumHeight }[] = [
  { indice: 3, altura: "fourth" },
  { indice: 1, altura: "second" },
  { indice: 0, altura: "first" },
  { indice: 2, altura: "third" },
  { indice: 4, altura: "fifth" },
];

function montarPodio(jogadores: Jogador[], tier: Tier): PodiumPlayer[] {
  return ORDEM_DO_PODIO.filter(({ indice }) => jogadores[indice]).map(({ indice, altura }) => ({
    position: `${indice + 1}º`,
    name: jogadores[indice].nome,
    detail: formatarXp(jogadores[indice].pontos),
    tier,
    height: altura,
    isYou: jogadores[indice].voce,
  }));
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default function Ligas() {
  const [ranking, setRanking] = useState<RankingGlobal[]>([]);
  const [meuId, setMeuId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  // null = ainda não escolheu: mostra a liga do próprio usuário.
  const [ligaSelecionada, setLigaSelecionada] = useState<Tier | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        const { data } = await supabase.auth.getUser();
        const lista = await rankingRepository.listarGlobal(1000); // já vem ordenado por XP
        if (cancelado) return;
        setMeuId(data.user?.id ?? "");
        setRanking(lista);
      } catch (error) {
        if (!cancelado) setErro(errMsg(error, "Erro ao carregar as ligas."));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  // Separa o ranking global por liga, mantendo a ordem de XP dentro de cada uma.
  const classificacoes = useMemo(() => {
    const mapa = Object.fromEntries(ligas.map((liga) => [liga.tier, [] as Jogador[]])) as Record<Tier, Jogador[]>;
    for (const linha of ranking) {
      if (!linha.user_id) continue;
      mapa[nivelParaLiga(linha.level ?? 1)].push({
        id: linha.user_id,
        nome: linha.display_name || linha.username || "Usuário",
        pontos: linha.xp_global ?? 0,
        voce: linha.user_id === meuId,
      });
    }
    return mapa;
  }, [ranking, meuId]);

  // Dados do usuário logado (a liga dele, não a que está sendo exibida).
  const minhaLinha = ranking.find((linha) => linha.user_id === meuId);
  const meuNivel = minhaLinha?.level ?? 1;
  const meusPontos = minhaLinha?.xp_global ?? 0;
  const minhaLiga = nivelParaLiga(meuNivel);
  const indiceMinhaLiga = ligas.findIndex((liga) => liga.tier === minhaLiga);
  const proximaLiga = ligas[indiceMinhaLiga + 1]?.nome;

  const ligaExibida = ligaSelecionada ?? minhaLiga;
  const jogadores = classificacoes[ligaExibida];
  const podio = montarPodio(jogadores, ligaExibida);

  const minhaClassificacao = classificacoes[minhaLiga];
  const minhaPosicao = minhaClassificacao.findIndex((jogador) => jogador.voce) + 1;

  // Progresso até a próxima liga = progresso até o próximo nível.
  const ehUltimaLiga = !proximaLiga;
  const inicioNivel = xpInicioDoNivel(meuNivel);
  const fimNivel = xpInicioDoNivel(meuNivel + 1);
  const progresso = ehUltimaLiga ? 100 : Math.min(100, Math.max(0, Math.round(((meusPontos - inicioNivel) / (fimNivel - inicioNivel)) * 100)));
  const faltam = Math.max(0, fimNivel - meusPontos);

  return (
    <PageLayout variant="bare">
    <div className="ligas">
      <main className="ligas__main">
        <div className="ligas__brilho" />

        <header className="ligas__cabecalho">
          <div>
            <p className="ligas__caminho">PLATAFORMA / <span>LIGAS</span></p>
            <h1 className="ligas__titulo">Ligas</h1>
            <p className="ligas__subtitulo">Conquiste pontos e suba de liga.</p>
          </div>
        </header>

        {carregando ? (
          <p className="ligas__subtitulo">Carregando ligas...</p>
        ) : erro ? (
          <p className="ligas__subtitulo">{erro}</p>
        ) : (
          <>
            {/* Seletor de ligas */}
            <section className="ligas__seletor" aria-label="Escolher liga">
              {ligas.map((liga) => {
                const ativa = liga.tier === ligaExibida;
                return (
                  <button
                    key={liga.tier}
                    type="button"
                    className={`ligas__liga${ativa ? " ligas__liga--ativa" : ""}`}
                    aria-pressed={ativa}
                    onClick={() => setLigaSelecionada(liga.tier)}
                  >
                    {minhaLinha && liga.tier === minhaLiga && <span className="ligas__liga-tag">SUA LIGA</span>}
                    <RankBadge tier={liga.tier} size={44} />
                    <span className="ligas__liga-nome">{liga.nome}</span>
                  </button>
                );
              })}
            </section>

            <div className="ligas__colunas">
              {/* Pódio da liga */}
              <section className="ligas__painel ligas__podio">
                <div className="ligas__painel-cabecalho">
                  <div>
                    <p className="ligas__rotulo">LIGA {nomeDaLiga[ligaExibida].toUpperCase()}</p>
                    <h2 className="ligas__painel-titulo">Top 5 da liga</h2>
                  </div>
                  <span className="ligas__painel-resumo">
                    {jogadores.length} {jogadores.length === 1 ? "participante" : "participantes"}
                  </span>
                </div>
                {podio.length > 0 ? (
                  <RankingPodium players={podio} ariaLabel={`Top 5 da liga ${nomeDaLiga[ligaExibida]}`} />
                ) : (
                  <p className="ligas__subtitulo">Ninguém chegou a esta liga ainda.</p>
                )}
              </section>

              {/* Resumo do usuário */}
              <aside className="ligas__painel ligas__resumo">
                <p className="ligas__rotulo">SUA JORNADA</p>
                {minhaLinha ? (
                  <>
                    <div className="ligas__resumo-liga">
                      <RankBadge tier={minhaLiga} size={44} />
                      <div>
                        <h2 className="ligas__painel-titulo">Liga {nomeDaLiga[minhaLiga]}</h2>
                        {proximaLiga && <p className="ligas__resumo-proxima">Próxima liga: {proximaLiga}</p>}
                      </div>
                    </div>

                    <div className="ligas__numeros">
                      <div>
                        <span className="ligas__numero-rotulo">POSIÇÃO</span>
                        <strong className="ligas__numero-valor">{minhaPosicao}º</strong>
                        <span className="ligas__numero-detalhe">de {minhaClassificacao.length}</span>
                      </div>
                      <div>
                        <span className="ligas__numero-rotulo">PONTOS</span>
                        <strong className="ligas__numero-valor">{meusPontos.toLocaleString("pt-BR")}</strong>
                        <span className="ligas__numero-detalhe">XP acumulados</span>
                      </div>
                    </div>

                    <div className="ligas__progresso-topo">
                      <span>{ehUltimaLiga ? "Liga mais alta" : `Rumo à liga ${proximaLiga}`}</span>
                      <strong>{progresso}%</strong>
                    </div>
                    <div className="ligas__barra"><span style={{ width: `${progresso}%` }} /></div>
                    <p className="ligas__progresso-texto">
                      {ehUltimaLiga
                        ? "Você está na liga mais alta. Continue acumulando XP."
                        : `Faltam ${faltam.toLocaleString("pt-BR")} XP para chegar à liga ${proximaLiga}.`}
                    </p>
                  </>
                ) : (
                  <p className="ligas__progresso-texto">
                    Você ainda não aparece na classificação. Faça login e conclua uma aula para ganhar XP.
                  </p>
                )}
              </aside>
            </div>

            {/* Classificação completa */}
            <section className="ligas__painel ligas__tabela">
              <div className="ligas__painel-cabecalho">
                <div>
                  <p className="ligas__rotulo">CLASSIFICAÇÃO COMPLETA</p>
                  <h2 className="ligas__painel-titulo">Liga {nomeDaLiga[ligaExibida]}</h2>
                </div>
                <span className="ligas__painel-resumo">Ordenado por XP acumulado</span>
              </div>

              {jogadores.length === 0 ? (
                <p className="ligas__subtitulo">Nenhum participante nesta liga ainda.</p>
              ) : (
                <ol className="ligas__lista">
                  {jogadores.map((jogador, indice) => (
                    <li
                      key={jogador.id}
                      className={["ligas__linha", jogador.voce ? "ligas__linha--voce" : ""].join(" ").trim()}
                    >
                      <span className="ligas__linha-posicao">{indice + 1}º</span>
                      <span className="ligas__linha-avatar" aria-hidden="true">{jogador.nome.charAt(0)}</span>
                      <span className="ligas__linha-nome">
                        {jogador.nome}
                        {jogador.voce && <span className="ligas__linha-voce">VOCÊ</span>}
                      </span>
                      {/* Coluna mantida vazia só para preservar a grade do CSS (antes mostrava promoção/rebaixamento). */}
                      <span className="ligas__linha-zona" aria-hidden="true" />
                      <span className="ligas__linha-pontos">{formatarXp(jogador.pontos)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
    </div>
    </PageLayout>
  );
}