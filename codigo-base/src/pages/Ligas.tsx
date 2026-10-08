import { useMemo, useState, type ReactNode } from "react";
import { SidebarLeft } from "../components/sidebar/SidebarLeft";
import {
  RankBadge,
  RankingPodium,
  type PodiumHeight,
  type PodiumPlayer,
  type Tier,
} from "../components/ranking/RankingPodium";
import "./Ligas.css";

// ---------------------------------------------------------------------------
// Ícones (só os que esta página usa)
// ---------------------------------------------------------------------------
type NomeIcone = "subir" | "descer";

const caminhos: Record<NomeIcone, ReactNode> = {
  subir: <path d="M12 19V5M6 11l6-6 6 6" />,
  descer: <path d="M12 5v14M6 13l6 6 6-6" />,
};

function Icone({ nome, tamanho = 18 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {caminhos[nome]}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Dados de exemplo — trocar pelas consultas ao Supabase depois
// ---------------------------------------------------------------------------
type Jogador = { nome: string; pontos: number; voce: boolean };
type Zona = "promocao" | "rebaixamento" | null;

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

const LIGA_ATUAL: Tier = "platinum";
const VOCE = "Marina Alves";
const QTD_ZONA = 3; // quantos ficam na zona de promoção e na de rebaixamento

const NOMES = ["Helena", "Beatriz", "Ravi", "Caio", "Lia", "Mateus", "Sofia", VOCE, "Davi", "Aurora", "Pedro", "Bruno"];

// Monta uma classificação de exemplo para cada liga.
function criarLiga(tier: Tier): Jogador[] {
  const indice = ligas.findIndex((liga) => liga.tier === tier);
  const ehMinhaLiga = tier === LIGA_ATUAL;

  // Nas outras ligas a lista gira para a classificação mudar e o usuário não aparece.
  const base = ehMinhaLiga ? NOMES : NOMES.filter((nome) => nome !== VOCE);
  const giro = ehMinhaLiga ? 0 : (indice * 3) % base.length;
  const nomes = [...base.slice(giro), ...base.slice(0, giro)];

  const topo = 900 + indice * 420;
  return nomes.map((nome, posicao) => ({
    nome,
    pontos: Math.round(topo * (1 - posicao * 0.052)),
    voce: ehMinhaLiga && nome === VOCE,
  }));
}

const classificacoes = Object.fromEntries(ligas.map((liga) => [liga.tier, criarLiga(liga.tier)])) as Record<
  Tier,
  Jogador[]
>;

function zonaDe(posicao: number, total: number, tier: Tier): Zona {
  if (tier !== "legendary" && posicao <= QTD_ZONA) return "promocao";
  if (tier !== "bronze" && posicao > total - QTD_ZONA) return "rebaixamento";
  return null;
}

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
  const [ligaSelecionada, setLigaSelecionada] = useState<Tier>(LIGA_ATUAL);

  const jogadores = classificacoes[ligaSelecionada];
  const podio = useMemo(() => montarPodio(jogadores, ligaSelecionada), [jogadores, ligaSelecionada]);

  // Resumo do usuário (sempre da liga dele, não da liga que está sendo exibida).
  const minhaClassificacao = classificacoes[LIGA_ATUAL];
  const meuIndice = minhaClassificacao.findIndex((jogador) => jogador.voce);
  const minhaPosicao = meuIndice + 1;
  const meusPontos = minhaClassificacao[meuIndice]?.pontos ?? 0;
  const pontosDeCorte = minhaClassificacao[QTD_ZONA - 1]?.pontos ?? 0;
  const faltam = Math.max(0, pontosDeCorte - meusPontos + 1);
  const naZonaDePromocao = minhaPosicao > 0 && minhaPosicao <= QTD_ZONA;
  const progresso = naZonaDePromocao ? 100 : Math.min(100, Math.round((meusPontos / pontosDeCorte) * 100));
  const indiceLigaAtual = ligas.findIndex((liga) => liga.tier === LIGA_ATUAL);
  const proximaLiga = ligas[indiceLigaAtual + 1]?.nome;

  return (
    <div className="ligas">
      <SidebarLeft />

      <main className="ligas__main">
        <div className="ligas__brilho" />

        <header className="ligas__cabecalho">
          <div>
            <p className="ligas__caminho">PLATAFORMA / <span>LIGAS</span></p>
            <h1 className="ligas__titulo">Ligas</h1>
            <p className="ligas__subtitulo">Conquiste pontos e suba de liga.</p>
          </div>
        </header>

        {/* Seletor de ligas */}
        <section className="ligas__seletor" aria-label="Escolher liga">
          {ligas.map((liga) => {
            const ativa = liga.tier === ligaSelecionada;
            return (
              <button
                key={liga.tier}
                type="button"
                className={`ligas__liga${ativa ? " ligas__liga--ativa" : ""}`}
                aria-pressed={ativa}
                onClick={() => setLigaSelecionada(liga.tier)}
              >
                {liga.tier === LIGA_ATUAL && <span className="ligas__liga-tag">SUA LIGA</span>}
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
                <p className="ligas__rotulo">LIGA {nomeDaLiga[ligaSelecionada].toUpperCase()}</p>
                <h2 className="ligas__painel-titulo">Top 5 da liga</h2>
              </div>
              <span className="ligas__painel-resumo">{jogadores.length} participantes</span>
            </div>
            <RankingPodium players={podio} ariaLabel={`Top 5 da liga ${nomeDaLiga[ligaSelecionada]}`} />
          </section>

          {/* Resumo do usuário */}
          <aside className="ligas__painel ligas__resumo">
            <p className="ligas__rotulo">SUA JORNADA</p>
            <div className="ligas__resumo-liga">
              <RankBadge tier={LIGA_ATUAL} size={44} />
              <div>
                <h2 className="ligas__painel-titulo">Liga {nomeDaLiga[LIGA_ATUAL]}</h2>
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
              <span>Rumo à zona de promoção</span>
              <strong>{progresso}%</strong>
            </div>
            <div className="ligas__barra"><span style={{ width: `${progresso}%` }} /></div>
            <p className="ligas__progresso-texto">
              {naZonaDePromocao
                ? "Você está na zona de promoção. Continue assim para subir de liga."
                : `Faltam ${faltam.toLocaleString("pt-BR")} XP para entrar no top ${QTD_ZONA}.`}
            </p>
          </aside>
        </div>

        {/* Classificação completa */}
        <section className="ligas__painel ligas__tabela">
          <div className="ligas__painel-cabecalho">
            <div>
              <p className="ligas__rotulo">CLASSIFICAÇÃO COMPLETA</p>
              <h2 className="ligas__painel-titulo">Liga {nomeDaLiga[ligaSelecionada]}</h2>
            </div>
            <div className="ligas__legenda">
              {ligaSelecionada !== "legendary" && (
                <span className="ligas__legenda-item ligas__legenda-item--promocao">
                  <Icone nome="subir" tamanho={14} />Promoção
                </span>
              )}
              {ligaSelecionada !== "bronze" && (
                <span className="ligas__legenda-item ligas__legenda-item--rebaixamento">
                  <Icone nome="descer" tamanho={14} />Rebaixamento
                </span>
              )}
            </div>
          </div>

          <ol className="ligas__lista">
            {jogadores.map((jogador, indice) => {
              const posicao = indice + 1;
              const zona = zonaDe(posicao, jogadores.length, ligaSelecionada);

              return (
                <li
                  key={jogador.nome}
                  className={[
                    "ligas__linha",
                    zona ? `ligas__linha--${zona}` : "",
                    jogador.voce ? "ligas__linha--voce" : "",
                  ].join(" ").trim()}
                >
                  <span className="ligas__linha-posicao">{posicao}º</span>
                  <span className="ligas__linha-avatar" aria-hidden="true">{jogador.nome.charAt(0)}</span>
                  <span className="ligas__linha-nome">
                    {jogador.nome}
                    {jogador.voce && <span className="ligas__linha-voce">VOCÊ</span>}
                  </span>
                  <span className="ligas__linha-zona">
                    {zona === "promocao" && <Icone nome="subir" tamanho={16} />}
                    {zona === "rebaixamento" && <Icone nome="descer" tamanho={16} />}
                  </span>
                  <span className="ligas__linha-pontos">{formatarXp(jogador.pontos)}</span>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </div>
  );
}