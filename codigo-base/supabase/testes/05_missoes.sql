BEGIN;

DO $$
DECLARE
    -- UUIDs fixos, no mesmo padrão dos scripts 01 a 04.
    v_user_id UUID    := '10000000-0000-0000-0000-000000000011';
    v_curso_id UUID   := '20000000-0000-0000-0000-000000000011';
    v_modulo_id UUID  := '40000000-0000-0000-0000-000000000011';
    v_aula_id UUID    := '50000000-0000-0000-0000-000000000011';
    v_questao_id UUID := '60000000-0000-0000-0000-000000000011';
    v_attempt_id UUID := '90000000-0000-0000-0000-000000000011';
    v_answer_id UUID  := 'a0000000-0000-0000-0000-000000000011';

    v_def_id UUID;
    v_occ_id UUID;

    v_assignment_rec RECORD;
    v_xp_bonus INTEGER;
    v_xp_competitivo INTEGER;
    v_xp_global_antes INTEGER;
    v_xp_global_depois INTEGER;
    v_reward INTEGER;
    v_pol_count INTEGER;
    v_rls_defs BOOLEAN;
    v_rls_occ BOOLEAN;
    v_rls_assign BOOLEAN;
BEGIN
    RAISE NOTICE '===========================================================';
    RAISE NOTICE '    ETAPA 5: TESTES DE MISSOES E ISOLAMENTO DAS LIGAS      ';
    RAISE NOTICE '===========================================================';

    -- 0. Limpeza prévia (caso uma execução anterior tenha falhado no meio)
    DELETE FROM auth.users WHERE id = v_user_id;
    DELETE FROM public.courses WHERE id = v_curso_id;

    -- 1. Usuário (trigger handle_new_user popula public.profiles) e conteúdo mínimo:
    --    curso publicado e público (para o finalize creditar XP de curso), módulo,
    --    aula e uma questão de múltipla escolha com meta de XP.
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (v_user_id, 'missao.test@athen.com',
            '{"username": "missaotest", "display_name": "Aluno Missao"}');

    INSERT INTO public.courses (id, creator_id, title, slug, status, visibility)
    VALUES (v_curso_id, v_user_id, 'Curso de Missoes', 'curso-de-missoes-test', 'published', 'public');

    INSERT INTO public.modules (id, course_id, title, position)
    VALUES (v_modulo_id, v_curso_id, 'Modulo 1', 0);

    INSERT INTO public.lessons (id, module_id, title, position, status)
    VALUES (v_aula_id, v_modulo_id, 'Aula 1', 0, 'published');

    INSERT INTO public.questions (id, lesson_id, type, prompt, position, config, xp_value)
    VALUES (v_questao_id, v_aula_id, 'multiple_choice', 'Marque a correta.', 0,
            '{"options":[{"id":"a","text":"Certa","correct":true},{"id":"b","text":"Errada","correct":false}]}'::jsonb,
            10);

    RAISE NOTICE '[PASS] SETUP: usuario, curso publicado, modulo, aula e questao criados.';

    -- A diária global de aula concluída é o molde que queremos exercitar.
    SELECT id, reward_xp INTO v_def_id, v_reward
    FROM public.mission_definitions WHERE code = 'global_daily_complete_lesson';

    IF v_def_id IS NULL THEN
        RAISE EXCEPTION '[FAIL] Semente do catalogo de missoes ausente (global_daily_complete_lesson).';
    END IF;

    -- -------------------------------------------------------------------------
    -- 2. MATERIALIZAÇÃO DA OCORRÊNCIA (ensure_occurrence idempotente)
    -- -------------------------------------------------------------------------
    v_occ_id := public.ensure_occurrence(v_def_id, NULL, now());
    IF v_occ_id IS NULL THEN
        RAISE EXCEPTION '[FAIL] ensure_occurrence nao materializou a ocorrencia global.';
    END IF;

    -- Reexecutar no mesmo período devolve a MESMA ocorrência (não duplica).
    IF public.ensure_occurrence(v_def_id, NULL, now()) <> v_occ_id THEN
        RAISE EXCEPTION '[FAIL] ensure_occurrence duplicou a ocorrencia do periodo.';
    END IF;
    RAISE NOTICE '[PASS] OCORRENCIA: materializada e idempotente no periodo corrente.';

    -- -------------------------------------------------------------------------
    -- 3. ATIVIDADE REAL: tentativa finalizada que conclui a aula
    -- -------------------------------------------------------------------------
    INSERT INTO public.attempts (id, user_id, lesson_id, course_id, finished_at)
    VALUES (v_attempt_id, v_user_id, v_aula_id, v_curso_id, now());

    INSERT INTO public.answers (id, attempt_id, question_id, submitted, is_correct)
    VALUES (v_answer_id, v_attempt_id, v_questao_id, '{"selected":["a"]}'::jsonb, true);

    SELECT xp_global INTO v_xp_global_antes FROM public.profiles WHERE id = v_user_id;

    -- Avanço das missões a partir do attempt (gancho usado pelo finalize_attempt).
    PERFORM public.advance_missions_for_attempt(v_attempt_id);

    SELECT * INTO v_assignment_rec FROM public.mission_assignments
     WHERE occurrence_id = v_occ_id AND user_id = v_user_id;

    IF v_assignment_rec.completed AND v_assignment_rec.current_count >= 1 THEN
        RAISE NOTICE '[PASS] PROGRESSO: aula concluida avancou a missao (count=%, concluida).', v_assignment_rec.current_count;
    ELSE
        RAISE EXCEPTION '[FAIL] A missao nao avancou apos concluir a aula (count=%, completed=%).',
            v_assignment_rec.current_count, v_assignment_rec.completed;
    END IF;

    -- -------------------------------------------------------------------------
    -- 4. BÔNUS CONCEDIDO UMA ÚNICA VEZ (granted + idempotency_key)
    -- -------------------------------------------------------------------------
    IF NOT v_assignment_rec.granted THEN
        RAISE EXCEPTION '[FAIL] Bonus da missao nao foi marcado como concedido.';
    END IF;

    SELECT count(*) INTO v_xp_bonus FROM public.xp_credits
     WHERE user_id = v_user_id AND source = 'mission_bonus';

    IF v_xp_bonus <> 1 THEN
        RAISE EXCEPTION '[FAIL] Esperado um unico lancamento de bonus, encontrado %.', v_xp_bonus;
    END IF;

    -- Reexecutar o avanço não pode conceder o bônus de novo (granted + chave única).
    PERFORM public.advance_missions_for_attempt(v_attempt_id);
    SELECT count(*) INTO v_xp_bonus FROM public.xp_credits
     WHERE user_id = v_user_id AND source = 'mission_bonus';

    IF v_xp_bonus = 1 THEN
        RAISE NOTICE '[PASS] CONCESSAO UNICA: reexecutar o avanco nao duplicou o bonus.';
    ELSE
        RAISE EXCEPTION '[FAIL] Bonus concedido mais de uma vez (lancamentos=%).', v_xp_bonus;
    END IF;

    -- -------------------------------------------------------------------------
    -- 5. BÔNUS EM xp_credits NÃO COMPETITIVO (não altera a liga)
    -- -------------------------------------------------------------------------
    SELECT count(*) INTO v_xp_competitivo FROM public.xp_credits
     WHERE user_id = v_user_id AND source = 'mission_bonus' AND competitive = true;

    IF v_xp_competitivo = 0 THEN
        RAISE NOTICE '[PASS] ISOLAMENTO DA LIGA: bonus de missao gravado com competitive=false.';
    ELSE
        RAISE EXCEPTION '[FAIL] Bonus de missao marcado como competitivo (pontuaria a liga): %.', v_xp_competitivo;
    END IF;

    -- O bônus soma no XP global vitalício, como o resto do projeto.
    SELECT xp_global INTO v_xp_global_depois FROM public.profiles WHERE id = v_user_id;
    IF v_xp_global_depois >= v_xp_global_antes + v_reward THEN
        RAISE NOTICE '[PASS] XP GLOBAL: bonus somado ao saldo vitalicio (ganho minimo de % XP).', v_reward;
    ELSE
        RAISE EXCEPTION '[FAIL] XP global nao refletiu o bonus (antes=%, depois=%, bonus=%).',
            v_xp_global_antes, v_xp_global_depois, v_reward;
    END IF;

    -- -------------------------------------------------------------------------
    -- 6. RLS: catálogo legível, atribuições restritas ao dono
    -- -------------------------------------------------------------------------
    SELECT relrowsecurity INTO v_rls_defs FROM pg_class WHERE oid = 'public.mission_definitions'::regclass;
    SELECT relrowsecurity INTO v_rls_occ FROM pg_class WHERE oid = 'public.mission_occurrences'::regclass;
    SELECT relrowsecurity INTO v_rls_assign FROM pg_class WHERE oid = 'public.mission_assignments'::regclass;

    IF NOT (v_rls_defs AND v_rls_occ AND v_rls_assign) THEN
        RAISE EXCEPTION '[FAIL] RLS desabilitada em alguma tabela de missoes (defs=%, occ=%, assign=%).',
            v_rls_defs, v_rls_occ, v_rls_assign;
    END IF;

    -- A atribuição deve ter política de leitura do próprio usuário.
    SELECT count(*) INTO v_pol_count FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'mission_assignments'
       AND policyname = 'mission_assignments_select_own';

    IF v_pol_count = 1 THEN
        RAISE NOTICE '[PASS] RLS: tabelas protegidas e leitura das atribuicoes restrita ao dono.';
    ELSE
        RAISE EXCEPTION '[FAIL] Politica de leitura propria das atribuicoes ausente.';
    END IF;

    -- -------------------------------------------------------------------------
    -- 7. Limpeza: remove o que este script criou (cascade de auth.users e curso).
    -- -------------------------------------------------------------------------
    DELETE FROM auth.users WHERE id = v_user_id;
    DELETE FROM public.courses WHERE id = v_curso_id;

    RAISE NOTICE '===========================================================';
    RAISE NOTICE '      SUITE DE MISSOES FINALIZADA E DADOS DE TESTE LIMPOS  ';
    RAISE NOTICE '===========================================================';
END $$;

COMMIT;
