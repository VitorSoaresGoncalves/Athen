import { useEffect, useState } from "react";
import { salaRepository } from "../../data/repositories";
import { traduzirErro } from "./tipos";
  
// Os tipos das RPCs não são exportados em repositories.ts, então são derivados aqui.
type Geral = NonNullable<Awaited<ReturnType<typeof salaRepository.estatisticasGerais>>>;
type Aluno = Awaited<ReturnType<typeof salaRepository.estatisticasAlunos>>[number];
  
export function useEstatisticasSala(salaId: string) {
    const [geral, setGeral] = useState<Geral | null>(null);
    const [alunos, setAlunos] = useState<Aluno[] | null>(null); // null = carregando
    const [erroEstatisticas, setErroEstatisticas] = useState("");
  
    useEffect(() => {
        let cancelado = false;
  
        async function carregar() {
            try {
                const [g, a] = await Promise.all([
                salaRepository.estatisticasGerais(salaId),
                salaRepository.estatisticasAlunos(salaId),
                ]);

                if (cancelado)
                    return;

                setGeral(g);
                setAlunos(a);

            } catch (error) {
                if (cancelado) 
                    return;

                setErroEstatisticas(traduzirErro(error));
                setAlunos([]);
            }
        }
  
        void carregar();
        return () => { cancelado = true; };
    }, [salaId]);
  
    return { geral, alunos, erroEstatisticas };
}