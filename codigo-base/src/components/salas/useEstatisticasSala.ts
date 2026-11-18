import { useEffect, useState } from "react";
import { salaRepository } from "../../data/repositories";
import { traduzirErro } from "./tipos";
  
// Os tipos das RPCs não são exportados em repositories.ts, então são derivados aqui.
type Geral = NonNullable<Awaited<ReturnType<typeof salaRepository.estatisticasGerais>>>;
type Aluno = Awaited<ReturnType<typeof salaRepository.estatisticasAlunos>>[number];
type Modulo = Awaited<ReturnType<typeof salaRepository.estatisticasModulos>>[number];
type Questao = Awaited<ReturnType<typeof salaRepository.questoesMaisErradas>>[number];
  
export function useEstatisticasSala(salaId: string) {
    const [geral, setGeral] = useState<Geral | null>(null);
    const [alunos, setAlunos] = useState<Aluno[] | null>(null); // null = carregando
    const [modulos, setModulos] = useState<Modulo[] | null>(null);    
    const [questoes, setQuestoes] = useState<Questao[] | null>(null);  
    const [erroEstatisticas, setErroEstatisticas] = useState("");
  
    useEffect(() => {
        let cancelado = false;
  
        async function carregar() {
            try {
                const [g, a, m, q] = await Promise.all([
                    salaRepository.estatisticasGerais(salaId),
                    salaRepository.estatisticasAlunos(salaId),
                    salaRepository.estatisticasModulos(salaId),
                    salaRepository.questoesMaisErradas(salaId)
                ]);

                if (cancelado)
                    return;

                setGeral(g);
                setAlunos(a);
                setModulos(m);
                setQuestoes(q);

            } catch (error) {
                if (cancelado) 
                    return;

                setErroEstatisticas(traduzirErro(error));
                setAlunos([]);
                setModulos([]);
                setQuestoes([]);
            }
        }
  
        void carregar();
        return () => { cancelado = true; };
    }, [salaId]);
  
    return { geral, alunos, modulos, questoes, erroEstatisticas };
}