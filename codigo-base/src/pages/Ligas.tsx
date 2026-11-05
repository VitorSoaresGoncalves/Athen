import { useEffect, useState } from "react";
import { PageLayout } from "../components/layout/PageLayout";
import { RankBadge, RankingPodium, type PodiumHeight, type PodiumPlayer, type Tier } from "../components/ranking/RankingPodium";
import { temporadaRepository } from "../data/repositories";
import "./Ligas.css";

type Temporada = NonNullable<Awaited<ReturnType<typeof temporadaRepository.atual>>>;
type Resumo = Awaited<ReturnType<typeof temporadaRepository.meuResumo>>;
type Classificacao = Awaited<ReturnType<typeof temporadaRepository.minhaClassificacao>>;
type Participante = Classificacao[number];
type Estado = { temporada: Temporada | null; resumo: Resumo; grupo: Classificacao };

const categorias: { tier: Tier; nome: string }[] = [
  { tier: "bronze", nome: "Bronze" }, { tier: "silver", nome: "Prata" },
  { tier: "gold", nome: "Ouro" }, { tier: "platinum", nome: "Platina" },
  { tier: "diamond", nome: "Diamante" }, { tier: "master", nome: "Mestre" },
];
const nomeCategoria = (categoria: string) => categorias.find((item) => item.tier === categoria)?.nome ?? "Mestre";
const tierCategoria = (categoria: string): Tier => categorias.find((item) => item.tier === categoria)?.tier ?? "master";
const textoXp = (pontos: number) => `${pontos.toLocaleString("pt-BR")} XP`;
const nomeExibido = (pessoa: Participante) => pessoa.hidden || !pessoa.display_name ? "Participante oculto" : pessoa.display_name;
const formatarData = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit",
});

function tempoRestante(fim: string, agora: number): string {
  const minutos = Math.floor((new Date(fim).getTime() - agora) / 60_000);
  if (minutos <= 0) return "encerrando";
  const dias = Math.floor(minutos / 1440);
  const horas = Math.floor((minutos % 1440) / 60);
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${minutos % 60}min`;
  return `${minutos}min`;
}

const ordemPodio: { indice: number; altura: PodiumHeight }[] = [
  { indice: 3, altura: "fourth" }, { indice: 1, altura: "second" },
  { indice: 0, altura: "first" }, { indice: 2, altura: "third" }, { indice: 4, altura: "fifth" },
];

function montarPodio(grupo: Classificacao, tier: Tier): PodiumPlayer[] {
  return ordemPodio.filter(({ indice }) => grupo[indice]).map(({ indice, altura }) => ({
    position: `${grupo[indice].rank_position}º`, name: nomeExibido(grupo[indice]),
    detail: textoXp(grupo[indice].season_xp), tier, height: altura, isYou: grupo[indice].is_self,
  }));
}

function Seta({ sobe }: { sobe: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={sobe ? "M12 19V6M6 11l6-6 6 6" : "M12 5v13M6 13l6 6 6-6"} /></svg>;
}

function descreverProjecao(pessoa: Participante, categoria: string) {
  const destino = nomeCategoria(pessoa.projected_category);
  if (pessoa.movement === "promoted") return `Se a semana fechasse agora, você subiria para ${destino}.`;
  if (pessoa.movement === "demoted") return `Se a semana fechasse agora, você desceria para ${destino}.`;
  return `Se a semana fechasse agora, você continuaria em ${nomeCategoria(categoria)}.`;
}

export default function Ligas() {
  const [estado, setEstado] = useState<Estado>({ temporada: null, resumo: null, grupo: [] });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    let cancelado = false;
    let emCurso = false;
    async function carregar() {
      if (emCurso) return;
      emCurso = true;
      try {
        const temporada = await temporadaRepository.atual();
        const [resumo, grupo] = temporada ? await Promise.all([
          temporadaRepository.meuResumo(temporada.id),
          temporadaRepository.minhaClassificacao(temporada.id),
        ]) : [null, []];
        if (!cancelado) {
          setEstado({ temporada, resumo, grupo });
          setErro("");
        }
      } catch (error) {
        if (!cancelado) setErro(error instanceof Error ? error.message : "Erro ao carregar as ligas.");
      } finally {
        emCurso = false;
        if (!cancelado) setCarregando(false);
      }
    }
    const atualizar = () => {
      if (document.visibilityState !== "visible") return;
      setAgora(Date.now());
      void carregar();
    };
    void carregar();
    const timer = window.setInterval(atualizar, 60_000);
    document.addEventListener("visibilitychange", atualizar);
    window.addEventListener("focus", atualizar);
    return () => {
      cancelado = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", atualizar);
      window.removeEventListener("focus", atualizar);
    };
  }, []);

  const { temporada, resumo, grupo } = estado;
  const tier = tierCategoria(resumo?.category ?? "bronze");
  const eu = grupo.find((pessoa) => pessoa.is_self);
  const temGrupo = Boolean(resumo?.group_id);
  const participantes = temGrupo ? grupo : [];
  const tamanhoGrupo = temGrupo ? participantes.length : resumo?.group_size ?? 0;
  const minhaPosicao = eu?.rank_position ?? resumo?.final_rank;
  const meuXp = eu?.season_xp ?? resumo?.season_xp ?? 0;
  const podio = montarPodio(participantes, tier);
  const janelaFinal = temporada ? new Date(temporada.ends_at).getTime() - agora <= 24 * 60 * 60 * 1000 : false;
  const inscricao = eu?.entry_kind === "snapshot" ? "Inscrito no início da semana"
    : eu?.entry_kind === "late" ? "Entrada durante a semana" : "Inscrição registrada nesta temporada";

  return <PageLayout variant="bare" className="ligas-layout">
    <div className="ligas"><main className="ligas__main">
      <div className="ligas__brilho" />
      <header className="ligas__cabecalho"><div>
        <p className="ligas__caminho">PLATAFORMA / <span>LIGAS</span></p>
        <h1 className="ligas__titulo">Ligas</h1>
        <p className="ligas__subtitulo">{temporada
          ? `Temporada de ${formatarData(temporada.starts_at)} a ${formatarData(temporada.ends_at)} · termina em ${tempoRestante(temporada.ends_at, agora)}`
          : "Temporada semanal de XP. Compita no seu grupo e suba de categoria."}</p>
      </div></header>

      {carregando ? <p className="ligas__subtitulo" role="status">Carregando ligas...</p>
        : erro && !temporada ? <p className="ligas__subtitulo" role="alert">{erro}</p>
        : <>
          {erro && <p className="ligas__aviso" role="alert">Não foi possível atualizar agora ({erro}). Exibindo os últimos dados carregados.</p>}
          <section className="ligas__seletor" aria-label="Categorias da liga">
            {categorias.map((categoria) => {
              const ativa = Boolean(resumo && categoria.tier === tier);
              return <div key={categoria.tier} className={`ligas__liga${ativa ? " ligas__liga--ativa" : ""}`} aria-current={ativa ? "true" : undefined}>
                {ativa && <span className="ligas__liga-tag">SUA LIGA</span>}
                <RankBadge tier={categoria.tier} size={44} />
                <span className="ligas__liga-nome">{categoria.nome}</span>
              </div>;
            })}
          </section>

          {!temporada ? <section className="ligas__painel">
            <p className="ligas__rotulo">SEM TEMPORADA ATIVA</p>
            <h2 className="ligas__painel-titulo">Aguardando a próxima temporada</h2>
            <p className="ligas__progresso-texto">A temporada desta semana ainda não foi aberta. Aguarde a atualização automática.</p>
          </section> : !resumo ? <section className="ligas__painel">
            <p className="ligas__rotulo">VOCÊ AINDA NÃO ESTÁ NA LIGA</p>
            <h2 className="ligas__painel-titulo">Conclua uma aula para entrar</h2>
            <p className="ligas__progresso-texto">Ao concluir uma aula nesta semana você entra na temporada. Sua categoria anterior é preservada; a primeira participação começa em Bronze.</p>
          </section> : <>
            <div className="ligas__colunas">
              <section className="ligas__painel ligas__podio">
                <div className="ligas__painel-cabecalho"><div>
                  <p className="ligas__rotulo">LIGA {nomeCategoria(tier).toUpperCase()}</p>
                  <h2 className="ligas__painel-titulo">Top 5 do seu grupo</h2>
                </div><span className="ligas__painel-resumo">{tamanhoGrupo} {tamanhoGrupo === 1 ? "participante" : "participantes"}</span></div>
                {!temGrupo ? <p className="ligas__subtitulo">Seu grupo ainda está em formação. Volte em instantes.</p>
                  : podio.length > 0 ? <RankingPodium players={podio} hideTier ariaLabel={`Top 5 do seu grupo na liga ${nomeCategoria(tier)}`} />
                  : <p className="ligas__subtitulo">Ninguém pontuou no seu grupo ainda.</p>}
              </section>
              <aside className="ligas__painel ligas__resumo">
                <p className="ligas__rotulo">SUA SEMANA</p>
                <div className="ligas__resumo-liga"><RankBadge tier={tier} size={44} /><div>
                  <h2 className="ligas__painel-titulo">Liga {nomeCategoria(tier)}</h2>
                  <p className="ligas__resumo-proxima">{inscricao}</p>
                  {temporada.status === "closing" && <p className="ligas__resumo-proxima">Apuração em andamento</p>}
                </div></div>
                <div className="ligas__numeros">
                  <div><span className="ligas__numero-rotulo">POSIÇÃO</span><strong className="ligas__numero-valor">{minhaPosicao ? `${minhaPosicao}º` : "—"}</strong><span className="ligas__numero-detalhe">de {tamanhoGrupo}</span></div>
                  <div><span className="ligas__numero-rotulo">XP DA SEMANA</span><strong className="ligas__numero-valor">{meuXp.toLocaleString("pt-BR")}</strong><span className="ligas__numero-detalhe">só aprendizagem elegível</span></div>
                </div>
                {eu && temGrupo && <p className="ligas__progresso-texto">{descreverProjecao(eu, tier)}</p>}
                {eu?.season_xp === 0 && tier !== "bronze" && <p className="ligas__progresso-texto">Você ainda não fez XP nesta semana. Quem fecha a semana com 0 XP desce uma categoria; a marca de rebaixamento aparece nas últimas 24 horas.</p>}
                <p className="ligas__progresso-texto">A projeção muda conforme os outros pontuam; só vale no fechamento da semana.</p>
              </aside>
            </div>
            {temGrupo && <section className="ligas__painel ligas__tabela">
              <div className="ligas__painel-cabecalho"><div>
                <p className="ligas__rotulo">CLASSIFICAÇÃO DO SEU GRUPO</p><h2 className="ligas__painel-titulo">Liga {nomeCategoria(tier)}</h2>
              </div><div className="ligas__legenda">
                <span className="ligas__legenda-item ligas__legenda-item--promocao"><Seta sobe />Zona de promoção</span>
                <span className="ligas__legenda-item ligas__legenda-item--rebaixamento"><Seta sobe={false} />Zona de rebaixamento</span>
              </div></div>
              {participantes.length === 0 ? <p className="ligas__subtitulo">Nenhum participante pontuou no seu grupo ainda.</p> : <ol className="ligas__lista">
                {participantes.map((pessoa) => {
                  const movimento = pessoa.season_xp === 0 && !janelaFinal ? "stayed" : pessoa.movement;
                  const zona = movimento === "promoted" ? " ligas__linha--promocao" : movimento === "demoted" ? " ligas__linha--rebaixamento" : "";
                  const nome = nomeExibido(pessoa);
                  return <li key={pessoa.user_id} className={`ligas__linha${zona}${pessoa.is_self ? " ligas__linha--voce" : ""}`}>
                    <span className="ligas__linha-posicao">{pessoa.rank_position}º</span>
                    <span className="ligas__linha-avatar" aria-hidden="true">{!pessoa.hidden && pessoa.avatar_url
                      ? <img src={pessoa.avatar_url} alt="" className="ligas__linha-foto" /> : nome.charAt(0).toUpperCase()}</span>
                    <span className="ligas__linha-nome">{nome}{pessoa.is_self && <span className="ligas__linha-voce">VOCÊ</span>}</span>
                    <span className="ligas__linha-zona">{movimento !== "stayed" && <span className={`ligas__zona ligas__zona--${movimento === "promoted" ? "sobe" : "desce"}`}><Seta sobe={movimento === "promoted"} />{movimento === "promoted" ? "Sobe" : "Desce"}</span>}</span>
                    <span className="ligas__linha-pontos">{textoXp(pessoa.season_xp)}</span>
                  </li>;
                })}
              </ol>}
            </section>}
          </>}
        </>}
    </main></div>
  </PageLayout>;
}
