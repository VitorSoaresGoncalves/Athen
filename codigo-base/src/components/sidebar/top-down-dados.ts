import { useEffect, useState } from "react";
import {
    missaoGlobalRepository,
    missaoRepository,
    progressoMissaoRepository,
    rankingRepository,
} from "../../data/repositories";
import { supabase } from "../../lib/supabase";
import type { Database } from "../../types/database";

export type AmigoRank = Database["public"]["Functions"]["friends_course_pac"]["Returns"][number];

type MissaoSala = Database["public"]["Tables"]["missions"]["Row"];
type MissaoGlobal = Database["public"]["Functions"]["my_missions"]["Returns"][number];
type EscopoMissao = Database["public"]["Enums"]["mission_scope"];

// Resumo unificado de missão para o TopDown (Q072): mistura globais, de curso e
// de sala num mesmo cartão, com rótulo de contexto. prazo é o instante de fim
// (null = sem prazo), usado para ordenar pelo mais próximo.
export type MissaoResumo = {
    id: string;
    title: string;
    reward_xp: number;
    progresso: number;
    concluida: boolean;
    prazo: string | null;
    contexto: string;
};

const ROTULO_ESCOPO_GLOBAL: Record<EscopoMissao, string> = {
    global_daily: "Diária global",
    global_weekly: "Semanal global",
    course_daily: "Diária de curso",
};

// Limite de cartões no resumo (Q072: até três pendentes, as mais urgentes).
const LIMITE_RESUMO = 3;

function mensagemDeErro(motivo: unknown, padrao: string) {
    return motivo instanceof Error ? motivo.message : padrao;
}

// Ordena por prazo mais próximo (sem prazo vai por último) e desempata por id
// estável, mantendo apresentação determinística (Q072).
function ordenarPorPrazo(a: MissaoResumo, b: MissaoResumo) {
    const pa = a.prazo ? new Date(a.prazo).getTime() : Number.POSITIVE_INFINITY;
    const pb = b.prazo ? new Date(b.prazo).getTime() : Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return a.id.localeCompare(b.id);
}

export function useTopDownDados(cursoId?: string) {
    const [ranking, setRanking] = useState<AmigoRank[]>([]);
    const [missoes, setMissoes] = useState<MissaoResumo[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erroRanking, setErroRanking] = useState("");
    const [erroMissoes, setErroMissoes] = useState("");

    useEffect(() => {
        const idCurso = cursoId;
        let cancelado = false;

        async function carregar() {
            setCarregando(true);
            setErroRanking("");
            setErroMissoes("");
            setRanking([]);
            setMissoes([]);

            let usuario;
            try {
                const { data, error } = await supabase.auth.getUser();
                if (error) throw error;
                usuario = data.user;
            } catch (error) {
                if (cancelado) return;
                const mensagem = mensagemDeErro(error, "Não foi possível verificar sua sessão.");
                setErroRanking(mensagem);
                setErroMissoes(mensagem);
                setCarregando(false);
                return;
            }

            if (!usuario) {
                if (cancelado) return;
                setErroRanking("Entre na sua conta para ver o rank.");
                setErroMissoes("Entre na sua conta para ver as missões.");
                setCarregando(false);
                return;
            }

            // O rank de amigos depende do curso ativo; as missões (globais) não.
            const tarefas = [
                idCurso ? rankingRepository.listarAmigosPorCurso(idCurso) : Promise.resolve([] as AmigoRank[]),
                missaoGlobalRepository.minhas(),
                missaoRepository.listarAtivas(),
                progressoMissaoRepository.listarPorUsuario(usuario.id),
            ] as const;

            const [amigos, globais, ativasSala, progressos] = await Promise.allSettled(tarefas);

            if (cancelado) return;

            if (idCurso && amigos.status === "fulfilled") {
                setRanking(amigos.value as AmigoRank[]);
            } else if (idCurso && amigos.status === "rejected") {
                setRanking([]);
                setErroRanking(mensagemDeErro(amigos.reason, "Não foi possível carregar o rank."));
            } else {
                setRanking([]);
            }

            // Missões: combina globais/curso (my_missions) com as de sala, mantém só
            // as pendentes, ordena pelo prazo mais próximo e limita a três (Q072).
            const resumo: MissaoResumo[] = [];
            let houveErroMissoes = false;

            if (globais.status === "fulfilled") {
                for (const m of globais.value as MissaoGlobal[]) {
                    if (m.completed) continue;
                    const contexto = m.scope === "course_daily" && m.course_title
                        ? `${ROTULO_ESCOPO_GLOBAL[m.scope]} · ${m.course_title}`
                        : ROTULO_ESCOPO_GLOBAL[m.scope] ?? "Missão";
                    resumo.push({
                        id: m.occurrence_id,
                        title: m.title,
                        reward_xp: m.reward_xp,
                        progresso: Math.round(Number(m.progress) || 0),
                        concluida: false,
                        prazo: m.period_end,
                        contexto,
                    });
                }
            } else {
                houveErroMissoes = true;
            }

            if (ativasSala.status === "fulfilled" && progressos.status === "fulfilled") {
                const porMissao = new Map(progressos.value.map((item) => [item.mission_id, item]));
                for (const missao of ativasSala.value as MissaoSala[]) {
                    const p = porMissao.get(missao.id);
                    if (p?.completed) continue;
                    resumo.push({
                        id: missao.id,
                        title: missao.title,
                        reward_xp: missao.reward_xp,
                        progresso: Math.round(Number(p?.progress ?? 0)),
                        concluida: false,
                        prazo: missao.deadline,
                        contexto: "Sala",
                    });
                }
            } else {
                houveErroMissoes = true;
            }

            resumo.sort(ordenarPorPrazo);
            setMissoes(resumo.slice(0, LIMITE_RESUMO));

            if (houveErroMissoes && resumo.length === 0) {
                const motivo = globais.status === "rejected" ? globais.reason
                    : ativasSala.status === "rejected" ? ativasSala.reason
                    : progressos.status === "rejected" ? progressos.reason
                    : undefined;
                setErroMissoes(mensagemDeErro(motivo, "Não foi possível carregar as missões."));
            }

            setCarregando(false);
        }

        void carregar();
        return () => { cancelado = true; };
    }, [cursoId]);

    return { ranking, missoes, carregando, erroRanking, erroMissoes };
}
