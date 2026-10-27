import { useEffect, useState } from "react";
import { missaoRepository, progressoMissaoRepository, rankingRepository } from "../../data/repositories";
import { supabase } from "../../lib/supabase";
import type { Database } from "../../types/database";

export type AmigoRank = Database["public"]["Functions"]["friends_course_pac"]["Returns"][number];

type Missao = Database["public"]["Tables"]["missions"]["Row"];

export type MissaoAtiva = Missao & { progresso: number; concluida: boolean };

function mensagemDeErro(motivo: unknown, padrao: string) {
    return motivo instanceof Error ? motivo.message : padrao;
}

export function useTopDownDados(cursoId?: string) {
    const [ranking, setRanking] = useState<AmigoRank[]>([]);
    const [missoes, setMissoes] = useState<MissaoAtiva[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erroRanking, setErroRanking] = useState("");
    const [erroMissoes, setErroMissoes] = useState("");

    useEffect(() => {
        if (!cursoId) return;

        const idCurso = cursoId;
        let cancelado = false;

        async function carregar() {
            setCarregando(true);
            setErroRanking("");
            setErroMissoes("");

            const { data } = await supabase.auth.getUser();

            if (!data.user) {
                if (cancelado) return;
                setRanking([]);
                setMissoes([]);
                setErroRanking("Entre na sua conta para ver o rank.");
                setErroMissoes("Entre na sua conta para ver as missões.");
                setCarregando(false);
                return;
            }

            const [amigos, ativas, progressos] = await Promise.allSettled([
                rankingRepository.listarAmigosPorCurso(idCurso),
                missaoRepository.listarAtivas(),
                progressoMissaoRepository.listarPorUsuario(data.user.id),
            ]);

            if (cancelado) return;

            if (amigos.status === "fulfilled") {
                setRanking(amigos.value);
            } else {
                setRanking([]);
                setErroRanking(mensagemDeErro(amigos.reason, "Não foi possível carregar o rank."));
            }

            if (ativas.status === "fulfilled") {
                const lista = progressos.status === "fulfilled" ? progressos.value : [];
                const porMissao = new Map(lista.map((item) => [item.mission_id, item]));

                setMissoes(ativas.value.map((missao) => ({
                    ...missao,
                    progresso: Number(porMissao.get(missao.id)?.progress ?? 0),
                    concluida: porMissao.get(missao.id)?.completed ?? false,
                })));
            } else {
                setMissoes([]);
                setErroMissoes(mensagemDeErro(ativas.reason, "Não foi possível carregar as missões."));
            }

            setCarregando(false);
        }

        void carregar();
        return () => { cancelado = true; };
    }, [cursoId]);

    return { ranking, missoes, carregando, erroRanking, erroMissoes };
}
