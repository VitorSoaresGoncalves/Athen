BEGIN;

DO $$
DECLARE
    v_creator_id UUID  := '10000000-0000-0000-0000-000000000001';
    v_learner_id UUID  := '10000000-0000-0000-0000-000000000002';
    v_curso_id UUID    := '20000000-0000-0000-0000-000000000001';
    v_sala_id UUID     := '30000000-0000-0000-0000-000000000001';
    v_notebook_id UUID := '70000000-0000-0000-0000-000000000001';

    v_count_modulos INTEGER;
    v_count_aulas INTEGER;
    v_count_questoes INTEGER;
    v_count_salas INTEGER;
    v_count_matriculas INTEGER;
    v_count_anotacoes INTEGER;
    v_count_usuarios INTEGER;
BEGIN
    RAISE NOTICE '===========================================================';
    RAISE NOTICE '    ETAPA 4: EXCLUSÃO DE DADOS E TESTES DE CASCADE (DELETE) ';
    RAISE NOTICE '===========================================================';

    DELETE FROM public."Curso" WHERE "ID" = v_curso_id;

    SELECT COUNT(*) INTO v_count_modulos FROM public."Modulo" WHERE "ID_Curso" = v_curso_id;
    SELECT COUNT(*) INTO v_count_aulas FROM public."Aula" WHERE "ID_Modulo" = '40000000-0000-0000-0000-000000000001';
    SELECT COUNT(*) INTO v_count_questoes FROM public."Questao" WHERE "ID_Aula" = '50000000-0000-0000-0000-000000000001';
    SELECT COUNT(*) INTO v_count_salas FROM public."Sala" WHERE "ID" = v_sala_id;
    SELECT COUNT(*) INTO v_count_matriculas FROM public."matricula" WHERE "fk_Curso_ID" = v_curso_id;

    IF (v_count_modulos + v_count_aulas + v_count_questoes + v_count_salas + v_count_matriculas) = 0 THEN
        RAISE NOTICE '[PASS] CASCADE CURSO: Módulos, Aulas, Questões, Salas e Matrículas vinculados foram removidos.';
    ELSE
        RAISE EXCEPTION '[FAIL] Falha ao deletar dependências em cascata do Curso!';
    END IF;

    DELETE FROM auth.users WHERE id IN (v_creator_id, v_learner_id);

    SELECT COUNT(*) INTO v_count_usuarios FROM public."Usuario" WHERE "ID" IN (v_creator_id, v_learner_id);
    SELECT COUNT(*) INTO v_count_anotacoes FROM public."Anotacoes" WHERE "ID_Notebook" = v_notebook_id;

    IF v_count_usuarios = 0 AND v_count_anotacoes = 0 THEN
        RAISE NOTICE '[PASS] CASCADE USUÁRIO: Perfil público e Notebooks/Anotações removidos ao deletar de auth.users.';
    ELSE
        RAISE EXCEPTION '[FAIL] Falha no CASCADE de exclusão de Usuário!';
    END IF;

    RAISE NOTICE '===========================================================';
    RAISE NOTICE '   BANCO TOTALMENTE LIMPO E SUÍTE DE TESTES FINALIZADA!    ';
    RAISE NOTICE '===========================================================';
END $$;

COMMIT;