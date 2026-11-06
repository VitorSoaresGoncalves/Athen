BEGIN;

DO $$
DECLARE
    -- UUIDs Fixos para garantirem consistência entre os scripts

    v_creator_id UUID  := '10000000-0000-0000-0000-000000000001';
    v_learner_id UUID  := '10000000-0000-0000-0000-000000000002';
    v_curso_id UUID    := '20000000-0000-0000-0000-000000000001';
    v_sala_id UUID     := '30000000-0000-0000-0000-000000000001';
    v_modulo_id UUID   := '40000000-0000-0000-0000-000000000001';
    v_aula_id UUID     := '50000000-0000-0000-0000-000000000001';
    v_questao_id UUID  := '60000000-0000-0000-0000-000000000001';
    v_notebook_id UUID := '70000000-0000-0000-0000-000000000001';
    v_anotacao_id UUID := '80000000-0000-0000-0000-000000000001';

    v_user_rec RECORD;
    v_curso_rec RECORD;
BEGIN
    RAISE NOTICE '===========================================================';
    RAISE NOTICE '          ETAPA 1: CRIAÇÃO E INSERÇÃO DE ENTIDADES         ';
    RAISE NOTICE '===========================================================';

    -- 0. Limpeza prévia (caso algum teste anterior tenha falhado no meio)
    DELETE FROM auth.users WHERE id IN (v_creator_id, v_learner_id);

    -- 1. Criação dos Usuários em auth.users (Trigger lidar_novo_user deve popular public.Usuario)
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES 
        (v_creator_id, 'criador.test@athen.com', '{"name": "Prof Criador Teste", "username": "proftest"}'),
        (v_learner_id, 'aluno.test@athen.com', '{"name": "Aluno Teste", "username": "alunotest"}');

    -- Ajusta cargo do criador
    UPDATE public."Usuario" SET "Cargo" = 'creator' WHERE "ID" = v_creator_id;

    SELECT "ID", "Nome_Display", "Cargo" INTO v_user_rec FROM public."Usuario" WHERE "ID" = v_creator_id;
    IF v_user_rec."ID" IS NOT NULL THEN
        RAISE NOTICE '[PASS] TRIGGER AUTH: Criador inserido e sincronizado em public.Usuario (% | %)', v_user_rec."Nome_Display", v_user_rec."Cargo";
    ELSE
        RAISE EXCEPTION '[FAIL] Falha na sincronização do Criador em public.Usuario';
    END IF;

    -- 2. Criação do Curso
    INSERT INTO public."Curso" (
        "ID", "Titulo", "Slug", "ID_Criador", "Status", "Categoria", "Dificuldade"
    ) VALUES (
        v_curso_id, 'Engenharia de Software de Teste', 'eng-sw-test-suite', v_creator_id, 'published', 'Tecnologia', 'Beginner'
    );

    -- 3. Criação da Sala vinculada ao Curso
    INSERT INTO public."Sala" ("ID", "Nome", "Codigo", "ID_Criador", "fk_Curso_ID")
    VALUES (v_sala_id, 'Turma Alfa - 2026', 'ALFA2026', v_creator_id, v_curso_id);

    -- 4. Criacao do Módulo
    INSERT INTO public."Modulo" ("ID", "ID_Curso", "Titulo", "Posicao")
    VALUES (v_modulo_id, v_curso_id, 'Módulo 1: Fundamentos de Arquitetura', 1);

    -- 5. Criacao da Aula
    INSERT INTO public."Aula" ("ID", "ID_Modulo", "Titulo", "Posicao", "Publicado")
    VALUES (v_aula_id, v_modulo_id, 'Aula 1: Modelagem Relacional & Triggers', 1, true);

    -- 6. Criacao da Questão (JSONB)
    INSERT INTO public."Questao" ("ID", "ID_Aula", "Posicao", "Tipo", "Enunciado")
    VALUES (v_questao_id, v_aula_id, 1, 'multiple_choice', '{"pergunta": "O que e RLS?", "opcoes": ["Filtro de linha", "Índice"]}'::jsonb);

    RAISE NOTICE '[PASS] HIERARQUIA DE CONTEÚDO: Curso, Sala, Módulo, Aula e Questão criados com sucesso.';

    -- 7. Matrícula do Aluno no Curso (Trigger trg_atualizar_xp_matricula e trg_contagem_estudantes)
    INSERT INTO public."matricula" ("fk_Curso_ID", "fk_Usuario_ID", "XP_Diario")
    VALUES (v_curso_id, v_learner_id, 100);

    -- 8. Entrada na Sala
    INSERT INTO public."participa" ("fk_Usuario_ID", "fk_Sala_ID", "Pontos")
    VALUES (v_learner_id, v_sala_id, 50);

    -- 9. Bloco de Notas (Notebook) & Anotação
    INSERT INTO public."Notebook" ("ID", "ID_Usuario", "ID_Curso", "Nome")
    VALUES (v_notebook_id, v_learner_id, v_curso_id, 'Anotações de Software Test');

    INSERT INTO public."Anotacoes" ("ID", "ID_Notebook", "Titulo", "Conteudo")
    VALUES (v_anotacao_id, v_notebook_id, 'Resumo do Módulo 1', '{"texto": "Triggers mantêm a integridade agregada."}'::jsonb);

    RAISE NOTICE '[PASS] MATRÍCULA E INTERAÇÕES: Matrícula, Participação na Sala, Notebook e Anotações inseridos.';
    RAISE NOTICE '===========================================================';
END $$;

COMMIT;