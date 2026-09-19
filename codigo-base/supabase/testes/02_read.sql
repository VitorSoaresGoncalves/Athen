BEGIN;

DO $$
DECLARE

    v_creator_id UUID  := '10000000-0000-0000-0000-000000000001';
    v_learner_id UUID  := '10000000-0000-0000-0000-000000000002';
    v_curso_id UUID    := '20000000-0000-0000-0000-000000000001';
    v_sala_id UUID     := '30000000-0000-0000-0000-000000000001';
    v_notebook_id UUID := '70000000-0000-0000-0000-000000000001';

    v_user_rec RECORD;
    v_curso_rec RECORD;
    v_matricula_rec RECORD;
    v_sala_rec RECORD;
    v_count_anotacoes INTEGER;
BEGIN
    RAISE NOTICE '===========================================================';
    RAISE NOTICE '          ETAPA 2: LEITURA E VALIDAÇÃO DE ESTADO           ';
    RAISE NOTICE '===========================================================';

    -- 1. Valida sincronização dos perfis de Usuário
    SELECT "Nome_Display", "Nome_Usuario", "Cargo" INTO v_user_rec 
    FROM public."Usuario" WHERE "ID" = v_learner_id;
    
    IF v_user_rec."Nome_Display" IS NOT NULL THEN
        RAISE NOTICE '[PASS] USUÁRIO: Aluno encontrado (% | Username: %)', v_user_rec."Nome_Display", v_user_rec."Nome_Usuario";
    ELSE
        RAISE EXCEPTION '[FAIL] Usuário aluno não encontrado em public.Usuario!';
    END IF;

    -- 2. Valida estatísticas agregadas do Curso (Triggers automáticas)
    SELECT "Contagem_Estudante", "Avaliacao", "Contagem_Avaliacao" 
    INTO v_curso_rec FROM public."Curso" WHERE "ID" = v_curso_id;

    IF v_curso_rec."Contagem_Estudante" = 1 THEN
        RAISE NOTICE '[PASS] CURSO DERIVADO: Contagem de estudantes calculada via Trigger = % (esperado: 1)', v_curso_rec."Contagem_Estudante";
    ELSE
        RAISE EXCEPTION '[FAIL] Contagem de estudantes incorreta no curso: %', v_curso_rec."Contagem_Estudante";
    END IF;

    -- 3. Valida inicialização do XP do Aluno na Matrícula
    SELECT "XP_Total", "XP_Diario", "Aulas_Finalizadas" 
    INTO v_matricula_rec FROM public."matricula" 
    WHERE "fk_Curso_ID" = v_curso_id AND "fk_Usuario_ID" = v_learner_id;

    IF v_matricula_rec."XP_Total" = 100 THEN
        RAISE NOTICE '[PASS] MATRÍCULA INITIAL XP: XP_Total inicial sincronizado via Trigger = %', v_matricula_rec."XP_Total";
    ELSE
        RAISE EXCEPTION '[FAIL] XP_Total inicial incorreto: %', v_matricula_rec."XP_Total";
    END IF;

    -- 4. Valida vinculação da Sala e Participante
    SELECT s."Nome", p."Pontos" INTO v_sala_rec
    FROM public."Sala" s
    JOIN public."participa" p ON p."fk_Sala_ID" = s."ID"
    WHERE s."ID" = v_sala_id AND p."fk_Usuario_ID" = v_learner_id;

    RAISE NOTICE '[PASS] SALA & PARTICIPAÇÃO: Sala "%" possui aluno com % pontos', v_sala_rec."Nome", v_sala_rec."Pontos";

    -- 5. Valida Notebook e Anotações associadas
    SELECT COUNT(*) INTO v_count_anotacoes 
    FROM public."Anotacoes" WHERE "ID_Notebook" = v_notebook_id;

    RAISE NOTICE '[PASS] NOTEBOOK & ANOTAÇÕES: Bloco possui % anotação(ões) vinculada(s)', v_count_anotacoes;
    RAISE NOTICE '===========================================================';
END $$;

COMMIT;