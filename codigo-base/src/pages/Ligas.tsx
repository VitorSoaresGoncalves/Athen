import { useEffect, useState } from "react";
import { PageLayout } from "../components/layout/PageLayout";
import {
  RankBadge,
  RankingPodium,
  type PodiumHeight,
  type PodiumPlayer,
  type Tier,
} from "../components/ranking/RankingPodium";
import {
  ligaRepository,
  type CategoriaLiga,
  type MovimentoLiga,
  type ParticipanteLiga,
  type ResumoLiga,
  type TemporadaFechada,
} from "../data/Ligarepository";
import "./Ligas.css";

// ---------------------------------------------------------------------------
// Ligas semanais
//
// Cada temporada vai de segunda 00:00 até a segunda seguinte 00:00 (America/Sao_Paulo). O usuário
// disputa, dentro de uma categoria (Bronze...Lendário), com um grupo de até 30 pessoas, só pelo XP de
// aprendizado ganho na semana. No fechamento, os do topo sobem, os do fim descem e os demais ficam.
// Toda a regra mora no banco (migração 0023_leagues.sql); esta página só exibe o que as funções devolvem.
// ---------------------------------------------------------------------------

const ligas: { tier: Tier; nome: string }[] = [
  { tier: "bronze", nome: "Bronze" },
  { tier: "silver", nome: "Prata" },
  { tier: "gold", nome: "Ouro" },
  { tier: "platinum", nome: "Platina" },
  { tier: "diamond", nome: "Diamante" },
  { tier: "master", nome: "Mestre" },
  { tier: "legendary", nome: "Lendário" },
];

const tierDaCategoria = (categoria: CategoriaLiga): Tier => ligas[categoria - 1].tier;
const nomeDaCategoria = (categoria: CategoriaLiga) => ligas[categoria - 1].nome;

const INTERVALO_ATUALIZACAO_MS = 60_000;

const errMsg = (error: unknown, fallback = "Erro desconhecido.") => (error instanceof Error ? error.message : fallback);

const formatarXp = (pontos: number) => `${pontos.toLocaleString("pt-BR")} XP`;

const formatarData = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

const formatarHora = (data: Date) =>
  data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function tempoRestante(fimIso: string, agora: number): string {
  const ms = new Date(fimIso).getTime() - agora;
  if (ms <= 0) return "encerrando";
  const minutos = Math.floor(ms / 60_000);
  const dias = Math.floor(minutos / 1440);
  const horas = Math.floor((minutos % 1440) / 60);
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${minutos % 60}min`;
  return `${minutos}min`;
}

// O pódio é exibido na ordem visual: 4º, 2º, 1º, 3º, 5º.
const ORDEM_DO_PODIO: { indice: number; altura: PodiumHeight }[] = [
  { indice: 3, altura: "fourth" },
  { indice: 1, altura: "second" },
  { indice: 0, altura: "first" },
  { indice: 2, altura: "third" },
  { indice: 4, altura: "fifth" },
];

function montarPodio(grupo: ParticipanteLiga[], tier: Tier): PodiumPlayer[] {
  return ORDEM_DO_PODIO.filter(({ indice }) => grupo[indice]).map(({ indice, altura }) => ({
    position: `${grupo[indice].posicao}º`,
    name: grupo[indice].nome ?? "Participante",
    detail: formatarXp(grupo[indice].pontos),
    tier,
    height: altura,
    isYou: grupo[indice].voce,
  }));
}

const textoMovimento: Record<MovimentoLiga, string> = {
  promoted: "Sobe",
  demoted: "Desce",
  stayed: "Mantém",
};

function descreverProjecao(resumo: ResumoLiga): string {
  if (!resumo.categoria) return "";
  if (resumo.projecao === "promoted" && resumo.categoriaProjetada) {
    return `Se a semana fechasse agora, você subiria para ${nomeDaCategoria(resumo.categoriaProjetada)}.`;
  }
  if (resumo.projecao === "demoted" && resumo.categoriaProjetada) {
    return `Se a semana fechasse agora, você desceria para ${nomeDaCategoria(resumo.categoriaProjetada)}.`;
  }
  return `Se a semana fechasse agora, você continuaria em ${nomeDaCategoria(resumo.categoria)}.`;
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default function Ligas() {
  const [resumo, setResumo] = useState<ResumoLiga | null>(null);
  const [grupo, setGrupo] = useState<ParticipanteLiga[]>([]);
  const [historico, setHistorico] = useState<TemporadaFechada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  // Cada incremento dispara uma nova leitura (botão "Atualizar" e atualização automática).
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        await ligaRepository.sincronizar();
        const [resumoAtual, grupoAtual, historicoAtual] = await Promise.all([
          ligaRepository.obterResumo(),
          ligaRepository.listarMeuGrupo(),
          ligaRepository.listarHistorico(),
        ]);
        if (cancelado) return;
        setResumo(resumoAtual);
        setGrupo(grupoAtual);
        setHistorico(historicoAtual);
        setAtualizadoEm(new Date());
        setErro("");
      } catch (error) {
        // Mantém o que já estava na tela: falha de rede não vira "0 XP".
        if (!cancelado) setErro(errMsg(error, "Erro ao carregar as ligas."));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, [versao]);

  // Atualiza a cada 60 s enquanto a aba estiver visível, e relê ao voltar para ela.
  useEffect(() => {
    const atualizar = () => {
      if (document.visibilityState !== "visible") return;
      setAgora(Date.now());
      setVersao((v) => v + 1);
    };
    const timer = window.setInterval(atualizar, INTERVALO_ATUALIZACAO_MS);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, []);

  const categoria = resumo?.categoria ?? null;
  const tier = categoria ? tierDaCategoria(categoria) : null;
  const podio = tier ? montarPodio(grupo, tier) : [];
  const inscrito = Boolean(resumo?.inscrito && categoria);

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
              {resumo
                ? `Temporada de ${formatarData(resumo.inicio)} a ${formatarData(resumo.fim)} · termina em ${tempoRestante(resumo.fim, agora)}`
                : "Dispute a semana com seu grupo e suba de liga."}
            </p>
          </div>
          <div className="ligas__atualizar">
            {atualizadoEm && <span className="ligas__atualizado">Atualizado às {formatarHora(atualizadoEm)}</span>}
            <button type="button" className="ligas__botao" onClick={() => setVersao((v) => v + 1)}>
              Atualizar
            </button>
          </div>
        </header>

        {carregando ? (
          <p className="ligas__subtitulo">Carregando ligas...</p>
        ) : erro && !resumo ? (
          <p className="ligas__subtitulo" role="alert">{erro}</p>
        ) : (
          <>
            {erro && (
              <p className="ligas__aviso" role="alert">
                Não foi possível atualizar agora ({erro}). Exibindo os últimos dados carregados.
              </p>
            )}

            {/* Categorias */}
            <section className="ligas__seletor" aria-label="Categorias de liga">
              {ligas.map((liga, indice) => {
                const atual = categoria === indice + 1;
                return (
                  <div key={liga.tier} className={`ligas__liga${atual ? " ligas__liga--ativa" : ""}`}>
                    {atual && <span className="ligas__liga-tag">SUA LIGA</span>}
                    <RankBadge tier={liga.tier} size={44} />
                    <span className="ligas__liga-nome">{liga.nome}</span>
                  </div>
                );
              })}
            </section>

            {!resumo ? (
              <section className="ligas__painel">
                <p className="ligas__rotulo">SEM TEMPORADA</p>
                <p className="ligas__progresso-texto">A temporada desta semana ainda não foi aberta. Tente atualizar em instantes.</p>
              </section>
            ) : !inscrito || !categoria || !tier ? (
              <section className="ligas__painel">
                <p className="ligas__rotulo">VOCÊ AINDA NÃO ESTÁ NA LIGA</p>
                <h2 className="ligas__painel-titulo">Conclua uma aula para entrar</h2>
                <p className="ligas__progresso-texto">
                  Ao concluir uma aula nesta semana você entra na liga Bronze e já começa a somar XP com o seu grupo.
                </p>
              </section>
            ) : (
              <>
                <div className="ligas__colunas">
                  {/* Pódio do grupo */}
                  <section className="ligas__painel ligas__podio">
                    <div className="ligas__painel-cabecalho">
                      <div>
                        <p className="ligas__rotulo">LIGA {nomeDaCategoria(categoria).toUpperCase()} · GRUPO {resumo.numeroGrupo}</p>
                        <h2 className="ligas__painel-titulo">Top 5 do grupo</h2>
                      </div>
                      <span className="ligas__painel-resumo">{grupo.length} {grupo.length === 1 ? "participante" : "participantes"}</span>
                    </div>
                    {podio.length > 0 ? (
                      <RankingPodium players={podio} ariaLabel={`Top 5 do seu grupo na liga ${nomeDaCategoria(categoria)}`} />
                    ) : (
                      <p className="ligas__subtitulo">Ainda não há classificação neste grupo.</p>
                    )}
                  </section>

                  {/* Resumo do usuário */}
                  <aside className="ligas__painel ligas__resumo">
                    <p className="ligas__rotulo">SUA SEMANA</p>
                    <div className="ligas__resumo-liga">
                      <RankBadge tier={tier} size={44} />
                      <div>
                        <h2 className="ligas__painel-titulo">Liga {nomeDaCategoria(categoria)}</h2>
                        <p className="ligas__resumo-proxima">
                          {resumo.tipoEntrada === "late" ? "Entrada durante a semana" : "Inscrito no início da semana"}
                        </p>
                      </div>
                    </div>

                    <div className="ligas__numeros">
                      <div>
                        <span className="ligas__numero-rotulo">POSIÇÃO</span>
                        <strong className="ligas__numero-valor">{resumo.posicao ?? "–"}º</strong>
                        <span className="ligas__numero-detalhe">de {resumo.tamanhoGrupo ?? grupo.length}</span>
                      </div>
                      <div>
                        <span className="ligas__numero-rotulo">XP DA SEMANA</span>
                        <strong className="ligas__numero-valor">{resumo.pontos.toLocaleString("pt-BR")}</strong>
                        <span className="ligas__numero-detalhe">só aprendizado</span>
                      </div>
                    </div>

                    <p className="ligas__progresso-texto">{descreverProjecao(resumo)}</p>
                    <p className="ligas__progresso-texto">A projeção muda conforme os outros pontuam; só vale no fechamento da semana.</p>
                  </aside>
                </div>

                {/* Classificação do grupo */}
                <section className="ligas__painel ligas__tabela">
                  <div className="ligas__painel-cabecalho">
                    <div>
                      <p className="ligas__rotulo">CLASSIFICAÇÃO DO GRUPO</p>
                      <h2 className="ligas__painel-titulo">Liga {nomeDaCategoria(categoria)} · Grupo {resumo.numeroGrupo}</h2>
                    </div>
                    <div className="ligas__legenda">
                      <span className="ligas__legenda-item ligas__legenda-item--promocao">Zona de promoção</span>
                      <span className="ligas__legenda-item ligas__legenda-item--rebaixamento">Zona de rebaixamento</span>
                    </div>
                  </div>

                  <ol className="ligas__lista">
                    {grupo.map((jogador) => {
                      const nome = jogador.nome ?? "Participante";
                      const zona =
                        jogador.movimento === "promoted"
                          ? " ligas__linha--promocao"
                          : jogador.movimento === "demoted"
                            ? " ligas__linha--rebaixamento"
                            : "";
                      return (
                        <li key={jogador.idUsuario} className={`ligas__linha${zona}${jogador.voce ? " ligas__linha--voce" : ""}`}>
                          <span className="ligas__linha-posicao">{jogador.posicao}º</span>
                          <span className="ligas__linha-avatar" aria-hidden="true">
                            {jogador.avatarUrl ? (
                              <img src={jogador.avatarUrl} alt="" className="ligas__linha-foto" />
                            ) : (
                              nome.charAt(0).toUpperCase()
                            )}
                          </span>
                          <span className="ligas__linha-nome">
                            {nome}
                            {jogador.voce && <span className="ligas__linha-voce">VOCÊ</span>}
                          </span>
                          <span
                            className="ligas__linha-zona"
                            title={jogador.movimento ? textoMovimento[jogador.movimento] : undefined}
                            aria-label={jogador.movimento ? textoMovimento[jogador.movimento] : undefined}
                          >
                            {jogador.movimento === "promoted" ? "▲" : jogador.movimento === "demoted" ? "▼" : ""}
                          </span>
                          <span className="ligas__linha-pontos">{formatarXp(jogador.pontos)}</span>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              </>
            )}

            {/* Histórico */}
            {historico.length > 0 && (
              <section className="ligas__painel ligas__historico">
                <div className="ligas__painel-cabecalho">
                  <div>
                    <p className="ligas__rotulo">HISTÓRICO</p>
                    <h2 className="ligas__painel-titulo">Temporadas anteriores</h2>
                  </div>
                </div>
                <ol className="ligas__lista">
                  {historico.map((t) => (
                    <li key={t.idTemporada} className="ligas__linha ligas__linha--historico">
                      <span className="ligas__linha-posicao">{formatarData(t.inicio)}</span>
                      <RankBadge tier={tierDaCategoria(t.categoria)} size={34} />
                      <span className="ligas__linha-nome">
                        {nomeDaCategoria(t.categoria)} · {t.posicao}º de {t.tamanhoGrupo}
                      </span>
                      <span className={`ligas__resultado ligas__resultado--${t.movimento}`}>
                        {t.movimento === "promoted" && t.categoriaDepois
                          ? `Subiu para ${nomeDaCategoria(t.categoriaDepois)}`
                          : t.movimento === "demoted" && t.categoriaDepois
                            ? `Desceu para ${nomeDaCategoria(t.categoriaDepois)}`
                            : "Manteve"}
                      </span>
                      <span className="ligas__linha-pontos">{formatarXp(t.pontos)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
      </main>
    </div>
    </PageLayout>
  );
}