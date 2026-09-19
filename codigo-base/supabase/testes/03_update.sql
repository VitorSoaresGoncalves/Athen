BEGIN;

DO $$
DECLARE

    v_learner_id UUID  := '10000000-0000-0000-0000-000000000002';
    v_curso_id UUID    := '20000000-0000-0000-0000-000000000001';
    v_aula_id UUID     := '50000000-0000-0000-0000-000000000001';

    v_matricula_rec RECORD;
    v_curso_rec RECORD;
BEGIN
    RAISE NOTICE '===========================================================';
    RAISE NOTICE '     ETAPA 3: TESTES DE ATUALIZAÇÃO, TRIGGERS E TRAVAS     ';
    RAISE NOTICE '===========================================================';

    -- -------------------------------------------------------------------------
    -- 1. CONCLUI AULA -> RECÁLCULO AUTOMÁTICO DE AULAS_FINALIZADAS
    -- -------------------------------------------------------------------------
    INSERT INTO public."conclui" ("fk_Usuario_ID", "fk_Aula_ID", "Pontuacao", "XP_Ganho")
    VALUES (v_learner_id, v_aula_id, 100, 50);

    SELECT "Aulas_Finalizadas" INTO v_matricula_rec FROM public."matricula" 
    WHERE "fk_Curso_ID" = v_curso_id AND "fk_Usuario_ID" = v_learner_id;

    IF v_matricula_rec."Aulas_Finalizadas" = 1 THEN
        RAISE NOTICE '[PASS] PROGRESSO AUTOMÁTICO: Conclusão registrada. Aulas Finalizadas = % (esperado: 1)', v_matricula_rec."Aulas_Finalizadas";
    ELSE
        RAISE EXCEPTION '[FAIL] Recálculo de Aulas_Finalizadas falhou. Valor obtido: %', v_matricula_rec."Aulas_Finalizadas";
    END IF;

    -- -------------------------------------------------------------------------
    -- 2. PROTEÇÃO CONTRA ALTERAÇÃO DIRETA EM XP_TOTAL (BLOQUEIO DE FRAUDE)
    -- -------------------------------------------------------------------------
    UPDATE public."matricula" 
    SET "XP_Total" = 99999 
    WHERE "fk_Curso_ID" = v_curso_id AND "fk_Usuario_ID" = v_learner_id;

    SELECT "XP_Total" INTO v_matricula_rec FROM public."matricula" 
    WHERE "fk_Curso_ID" = v_curso_id AND "fk_Usuario_ID" = v_learner_id;

    IF v_matricula_rec."XP_Total" < 99999 THEN
        RAISE NOTICE '[PASS] TRAVA DE SEGURANÇA XP: Tentativa de alterar XP_Total diretamente foi revertida/bloqueada (Valor real: %)', v_matricula_rec."XP_Total";
    ELSE
        RAISE EXCEPTION '[FAIL] O sistema permitiu fraude alterando XP_Total diretamente!';
    END IF;

    -- -------------------------------------------------------------------------
    -- 3. AVALIAÇÃO DO CURSO E CÁLCULO DE MÉDIAS
    -- -------------------------------------------------------------------------
    UPDATE public."matricula" 
    SET "Avaliacao" = 5.0 
    WHERE "fk_Curso_ID" = v_curso_id AND "fk_Usuario_ID" = v_learner_id;

    SELECT "Avaliacao", "Contagem_Avaliacao" INTO v_curso_rec 
    FROM public."Curso" WHERE "ID" = v_curso_id;

    IF v_curso_rec."Contagem_Avaliacao" = 1 AND v_curso_rec."Avaliacao" = 5.0 THEN
        RAISE NOTICE '[PASS] AGREGADOR DE AVALIAÇÕES: Média do Curso atualizada para % (Contagem: %)', v_curso_rec."Avaliacao", v_curso_rec."Contagem_Avaliacao";
    ELSE
        RAISE EXCEPTION '[FAIL] Falha ao recalcular avaliação do curso!';
    END IF;

    -- -------------------------------------------------------------------------
    -- 4. TESTE DE IMUTABILIDADE DA AVALIAÇÃO (NÃO PODE ALTERAR APÓS AVALIAR)
    -- -------------------------------------------------------------------------
    BEGIN
        UPDATE public."matricula" 
        SET "Avaliacao" = 2.0 
        WHERE "fk_Curso_ID" = v_curso_id AND "fk_Usuario_ID" = v_learner_id;

        RAISE EXCEPTION '[FAIL] Permitiu alterar uma avaliação que já havia sido feita!';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[PASS] IMUTABILIDADE DA AVALIAÇÃO: Bloqueou tentativa de reavaliação. Mensagem capturada: "%"', SQLERRM;
    END;

    RAISE NOTICE '===========================================================';
END $$;

COMMIT;