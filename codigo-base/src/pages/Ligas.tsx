import { useEffect, useMemo, useState } from "react";
import { PageLayout } from "../components/layout/PageLayout";
import {
  RankBadge,
  RankingPodium,
  type PodiumHeight,
  type PodiumPlayer,
  type Tier,
} from "../components/ranking/RankingPodium";
import { temporadaRepository } from "../data/repositories";
import type { Database } from "../types/database";
import "./Ligas.css";

// ---------------------------------------------------------------------------
// Ligas — temporadas competitivas (ligas globais por XP).
//
// A página consome a temporada corrente do banco (migrações 0026–0029):
//   - current_season  -> a janela semanal aberta/em apuração;
//   - my_season_summary -> categoria, grupo, XP de temporada e posição do usuário;
//   - my_season_group   -> a classificação do PRÓPRIO grupo (Q066: só o seu grupo);
//   - my_season_history -> histórico das temporadas do usuário.
//
// As categorias (Bronze→Mestre) são as faixas competitivas; a identidade exibida
// é só a padrão (display name/avatar/banner — Q069), e linhas ocultas (conta
// desativada — Q070) aparecem sem nome/avatar mas com posição/XP.
// ---------------------------------------------------------------------------

type SeasonCategory = Database["public"]["Enums"]["season_category"];

// Jogador do grupo, já normalizado para o pódio/lista.
type Jogador = { id: string; nome: string; pontos: number; posicao: number; voce: boolean; oculto: boolean };

// A categoria do banco (season_category) é exatamente o Tier visual do cliente.
const categorias: { tier: Tier; nome: string }[] = [
  { tier: "bronze", nome: "Bronze" },
  { tier: "silver", nome: "Prata" },
  { tier: "gold", nome: "Ouro" },
  { tier: "platinum", nome: "Platina" },
  { tier: "diamond", nome: "Diamante" },
  { tier: "master", nome: "Mestre" },
];

const nomeDaCategoria = Object.fromEntries(categorias.map((c) => [c.tier, c.nome])) as Record<Tier, string>;

// season_category e Tier compartilham as mesmas chaves; mapeamento direto.
const categoriaParaTier = (categoria: SeasonCategory): Tier => categoria as Tier;

const errMsg = (error: unknown, fallback = "Erro desconhecido.") => (error instanceof Error ? error.message : fallback);

const formatarXp = (pontos: number) => `${pontos.toLocaleString("pt-BR")} XP`;

// Nome exibido de uma linha do grupo, respeitando a ocultação de identidade (Q070).
const nomeExibido = (nome: string | null, oculto: boolean) =>
  oculto || !nome ? "Participante oculto" : nome;

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
    position: `${jogadores[indice].posicao}º`,
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
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [temporadaId, setTemporadaId] = useState<string | null>(null);
  const [temporadaStatus, setTemporadaStatus] = useState<Database["public"]["Enums"]["season_status"] | null>(null);
  const [minhaCategoria, setMinhaCategoria] = useState<SeasonCategory | null>(null);
  const [minhaPosicao, setMinhaPosicao] = useState<number | null>(null);
  const [meuXp, setMeuXp] = useState(0);
  const [tamanhoGrupo, setTamanhoGrupo] = useState(0);
  const [temGrupo, setTemGrupo] = useState(false);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro("");
      try {
        const temporada = await temporadaRepository.atual();
        if (cancelado) return;

        if (!temporada) {
          // Nenhuma temporada ativa: estado de formação/espera (Q141).
          setTemporadaId(null);
          setTemporadaStatus(null);
          return;
        }

        setTemporadaId(temporada.id);
        setTemporadaStatus(temporada.status);

        const [resumo, grupo] = await Promise.all([
          temporadaRepository.meuResumo(temporada.id),
          temporadaRepository.meuGrupo(temporada.id),
        ]);
        if (cancelado) return;

        if (resumo) {
          setMinhaCategoria(resumo.category);
          setMinhaPosicao(resumo.final_rank);
          setMeuXp(resumo.season_xp);
          setTamanhoGrupo(resumo.group_size);
          setTemGrupo(Boolean(resumo.group_id));
        }

        setJogadores(
          grupo.map((linha) => ({
            id: linha.user_id,
            nome: nomeExibido(linha.display_name, linha.hidden),
            pontos: linha.season_xp,
            posicao: linha.rank_position,
            voce: linha.is_self,
            oculto: linha.hidden,
          }))
        );
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

  const tierAtual = useMemo<Tier>(
    () => (minhaCategoria ? categoriaParaTier(minhaCategoria) : "bronze"),
    [minhaCategoria]
  );

  // Posição do usuário no grupo (prioriza o resumo; cai para a linha do grupo).
  const posicaoNoGrupo = useMemo(() => {
    if (minhaPosicao) return minhaPosicao;
    const eu = jogadores.find((j) => j.voce);
    return eu?.posicao ?? null;
  }, [minhaPosicao, jogadores]);

  const podio = montarPodio(jogadores, tierAtual);

  const semTemporada = !carregando && !erro && temporadaId === null;
  const emFormacao = !carregando && !erro && temporadaId !== null && !temGrupo;

  return (
    <PageLayout variant="bare">
      <div className="ligas">
        <main className="ligas__main">
          <div className="ligas__brilho" />

          <header className="ligas__cabecalho">
            <div>
              <p className="ligas__caminho">PLATAFORMA / <span>LIGAS</span></p>
              <h1 className="ligas__titulo">Ligas</h1>
              <p className="ligas__subtitulo">
                Temporada semanal de XP. Compita no seu grupo e suba de categoria.
              </p>
            </div>
          </header>

          {carregando ? (
            <p className="ligas__subtitulo">Carregando ligas...</p>
          ) : erro ? (
            <p className="ligas__subtitulo">{erro}</p>
          ) : semTemporada ? (
            <section className="ligas__painel">
              <p className="ligas__rotulo">SEM TEMPORADA ATIVA</p>
              <h2 className="ligas__painel-titulo">Aguardando a próxima temporada</h2>
              <p className="ligas__progresso-texto">
                Nenhuma temporada está aberta agora. Estude para entrar automaticamente
                quando a próxima começar.
              </p>
            </section>
          ) : (
            <>
              {/* Faixas competitivas (Bronze→Mestre). Destaca a sua categoria. */}
              <section className="ligas__seletor" aria-label="Categorias da liga">
                {categorias.map((categoria) => {
                  const ativa = categoria.tier === tierAtual;
                  return (
                    <div
                      key={categoria.tier}
                      className={`ligas__liga${ativa ? " ligas__liga--ativa" : ""}`}
                      aria-current={ativa ? "true" : undefined}
                    >
                      {ativa && <span className="ligas__liga-tag">SUA LIGA</span>}
                      <RankBadge tier={categoria.tier} size={44} />
                      <span className="ligas__liga-nome">{categoria.nome}</span>
                    </div>
                  );
                })}
              </section>

              <div className="ligas__colunas">
                {/* Pódio do próprio grupo */}
                <section className="ligas__painel ligas__podio">
                  <div className="ligas__painel-cabecalho">
                    <div>
                      <p className="ligas__rotulo">LIGA {nomeDaCategoria[tierAtual].toUpperCase()}</p>
                      <h2 className="ligas__painel-titulo">Top 5 do seu grupo</h2>
                    </div>
                    <span className="ligas__painel-resumo">
                      {tamanhoGrupo} {tamanhoGrupo === 1 ? "participante" : "participantes"}
                    </span>
                  </div>
                  {emFormacao ? (
                    <p className="ligas__subtitulo">
                      Seu grupo ainda está em formação. Volte em instantes.
                    </p>
                  ) : podio.length > 0 ? (
                    <RankingPodium players={podio} hideTier ariaLabel={`Top 5 do seu grupo na liga ${nomeDaCategoria[tierAtual]}`} />
                  ) : (
                    <p className="ligas__subtitulo">Ninguém pontuou no seu grupo ainda.</p>
                  )}
                </section>

                {/* Resumo do usuário */}
                <aside className="ligas__painel ligas__resumo">
                  <p className="ligas__rotulo">SUA TEMPORADA</p>
                  {minhaCategoria ? (
                    <>
                      <div className="ligas__resumo-liga">
                        <RankBadge tier={tierAtual} size={44} />
                        <div>
                          <h2 className="ligas__painel-titulo">Liga {nomeDaCategoria[tierAtual]}</h2>
                          {temporadaStatus === "closing" && (
                            <p className="ligas__resumo-proxima">Apuração em andamento</p>
                          )}
                        </div>
                      </div>

                      <div className="ligas__numeros">
                        <div>
                          <span className="ligas__numero-rotulo">POSIÇÃO</span>
                          <strong className="ligas__numero-valor">
                            {posicaoNoGrupo ? `${posicaoNoGrupo}º` : "—"}
                          </strong>
                          <span className="ligas__numero-detalhe">de {tamanhoGrupo}</span>
                        </div>
                        <div>
                          <span className="ligas__numero-rotulo">XP DA TEMPORADA</span>
                          <strong className="ligas__numero-valor">{meuXp.toLocaleString("pt-BR")}</strong>
                          <span className="ligas__numero-detalhe">só aprendizagem elegível</span>
                        </div>
                      </div>

                      <p className="ligas__progresso-texto">
                        Sua categoria pode subir ou descer ao fim da temporada conforme sua
                        posição no grupo. O XP vitalício e o nível não zeram.
                      </p>
                    </>
                  ) : (
                    <p className="ligas__progresso-texto">
                      Você ainda não está inscrito nesta temporada. Conclua uma aula para entrar.
                    </p>
                  )}
                </aside>
              </div>

              {/* Classificação completa do próprio grupo */}
              <section className="ligas__painel ligas__tabela">
                <div className="ligas__painel-cabecalho">
                  <div>
                    <p className="ligas__rotulo">CLASSIFICAÇÃO DO SEU GRUPO</p>
                    <h2 className="ligas__painel-titulo">Liga {nomeDaCategoria[tierAtual]}</h2>
                  </div>
                  <span className="ligas__painel-resumo">Ordenado por XP da temporada</span>
                </div>

                {jogadores.length === 0 ? (
                  <p className="ligas__subtitulo">Nenhum participante pontuou no seu grupo ainda.</p>
                ) : (
                  <ol className="ligas__lista">
                    {jogadores.map((jogador) => (
                      <li
                        key={jogador.id}
                        className={["ligas__linha", jogador.voce ? "ligas__linha--voce" : ""].join(" ").trim()}
                      >
                        <span className="ligas__linha-posicao">{jogador.posicao}º</span>
                        <span className="ligas__linha-avatar" aria-hidden="true">{jogador.nome.charAt(0)}</span>
                        <span className="ligas__linha-nome">
                          {jogador.nome}
                          {jogador.voce && <span className="ligas__linha-voce">VOCÊ</span>}
                        </span>
                        {/* Coluna mantida vazia só para preservar a grade do CSS. */}
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
