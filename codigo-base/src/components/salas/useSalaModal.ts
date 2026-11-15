import { useCallback, useEffect, useMemo, useState } from "react";
import { avisoRepository, usuarioRepository } from "../../data/repositories";
import type { PodiumPlayer } from "../ranking/RankingPodium";
import { ALTURAS, type AvisoLinha, type Sala, tierPorPac } from "./tipos";

// ---------------------------------------------------------------------------
// Lógica compartilhada entre SalaModalAluno e SalaModalEducador.
//
// Reúne o que os dois pop-ups fazem igual: carregar o mural, resolver os nomes
// de quem aparece no ranking e montar a lista do pódio. Fica num hook para que
// uma mudança de comportamento valha para aluno e educador ao mesmo tempo, sem
// risco de divergência entre dois componentes. O que é específico de cada papel
// (código de acesso e form de aviso do educador; trilha e "Seu desempenho" do
// aluno) mora no próprio componente.
// ---------------------------------------------------------------------------

export function useSalaModal(sala: Sala, usuarioId: string) {
  const [avisos, setAvisos] = useState<AvisoLinha[] | null>(null);
  const [versaoAvisos, setVersaoAvisos] = useState(0);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());

  const top5 = useMemo(() => sala.ranking.slice(0, 5), [sala.ranking]);
  const idsDoRanking = top5.map((membro) => membro.user_id).join(",");

  // Carrega o mural; publicar um aviso novo só incrementa o contador para recarregar.
  useEffect(() => {
    let cancelado = false;

    async function carregarAvisos() {
      try {
        const lista = await avisoRepository.listarPorSala(sala.id);
        if (!cancelado) setAvisos(lista.filter((aviso) => aviso.status === "published"));
      } catch {
        if (!cancelado) setAvisos([]);
      }
    }

    void carregarAvisos();
    return () => { cancelado = true; };
  }, [sala.id, versaoAvisos]);

  // Nomes de quem aparece no ranking.
  useEffect(() => {
    let cancelado = false;
    const ids = idsDoRanking ? idsDoRanking.split(",") : [];

    async function carregarNomes() {
      const perfis = await Promise.all(ids.map((id) => usuarioRepository.obterPorId(id)));
      if (cancelado) return;
      const mapa = new Map<string, string>();
      for (const perfil of perfis) {
        if (perfil) mapa.set(perfil.id, perfil.display_name);
      }
      setNomes(mapa);
    }

    void carregarNomes();
    return () => { cancelado = true; };
  }, [idsDoRanking]);

  // O PAC dos colegas só aparece se a sala permitir (ou se você for o educador).
  const mostrarPac = sala.souEducador || sala.pacVisibilidade !== "educator_only";

  const jogadores = useMemo(() => {
    const lista: PodiumPlayer[] = top5.map((membro, indice) => {
      const pac = Math.round(Number(membro.pac_internal));
      const ehVoce = membro.user_id === usuarioId;
      const detalhe = mostrarPac || ehVoce ? `${pac}% · ${membro.xp_internal} XP` : `${membro.xp_internal} XP`;
      return {
        position: `${indice + 1}º`,
        name: ehVoce ? "Você" : nomes.get(membro.user_id) ?? "Aluno",
        detail: detalhe,
        tier: tierPorPac(pac),
        height: ALTURAS[indice],
        isYou: ehVoce,
      };
    });
    // Ordem visual do pódio (esquerda → direita): 4º, 2º, 1º, 3º, 5º.
    return [3, 1, 0, 2, 4].filter((posicao) => lista[posicao]).map((posicao) => lista[posicao]);
  }, [top5, nomes, usuarioId, mostrarPac]);

  const recarregarAvisos = useCallback(() => setVersaoAvisos((versao) => versao + 1), []);

  return { avisos, jogadores, recarregarAvisos };
}
