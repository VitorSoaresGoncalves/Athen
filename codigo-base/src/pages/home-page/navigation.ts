import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "./data";
import { getSession } from "./services";

// Navegação para áreas que exigem conta (cursos, explorar, ranking, criar curso...).
// Consulta a sessão do Supabase NO MOMENTO DO CLIQUE (não depende de estado que pode estar desatualizado):
//  - logado  -> vai para o destino
//  - visitante -> vai para o cadastro, levando o destino em `state.redirectTo` para voltar depois
// Telas públicas (entrar / cadastrar) continuam usando `useNavigate` direto.
export function useGuardedNavigate() {
  const navigate = useNavigate();

  return useCallback(
    async (path: string) => {
      try {
        const { data } = await getSession();
        if (data.session) {
          navigate(path);
          return;
        }
      } catch {
        // se não deu para ler a sessão, trata como visitante
      }
      navigate(ROUTES.register, { state: { redirectTo: path } });
    },
    [navigate],
  );
}
