# Banco de dados atual

Referência do modelo usado pelo cliente, conferida com a sequência SQL numerada `0001–0045` da branch `issue/47-revisao-esporadica` em 2026-11-16. A revisão de curso acrescenta `0042–0045`. Esta conferência documental não executou migrações nem consultou o banco remoto; os tipos gerados e os registros históricos abaixo não comprovam o esquema aplicado em outro ambiente.

### Histórico de aplicação no remoto

Verificação posterior no remoto vinculado `testeAthen`: migrações `0001–0040` aplicadas. A `0040` foi ensaiada com `ROLLBACK` sobre os dados remotos antes do `db push`; a reconciliação preservou as duas inscrições novas existentes e incorporou os outros cinco participantes legados. A conferência final confirmou ausência de migrações pendentes e `EXECUTE` negado para `anon` e `authenticated` em `record_xp_event`.

Em 2026-11-04, a migração aditiva `0041` também foi aplicada ao remoto `testeAthen`. Os tipos de `codigo-base/src/types/database.ts` foram regenerados diretamente desse schema com `npx supabase gen types typescript --linked --schema public`, usando Supabase CLI `2.121.0`. A conferência anterior das 29 RPCs foi complementada pela nova `my_season_standings`; os contratos de parâmetros e retornos são validados pela compilação com o arquivo gerado. Os testes de audiência, identidade oculta e permissões da nova leitura são executados no banco local descartável, conforme o [plano da issue 42](../testes-issue-42.md).

A consulta final daquele catálogo remoto confirmou `0041` como última migração e `EXECUTE` de `my_season_standings(uuid)` permitido para `authenticated` e negado para `anon`.

### Tipos locais da revisão de curso

**Conferência remota em 2026-11-18:** o histórico de `testeAthen` já continha `0042–0046`. Os corpos das funções de `0045/0046` conferiram com as migrations versionadas. A `0047` foi ensaiada localmente, executada no remoto em transação com rollback e depois aplicada por `db push --linked --skip-vault`, sem seeds ou roles extras. O dry-run posterior não encontrou pendências. As nove funções auditadas de `0045–0047` conferem com as fontes; índice e ACLs da RPC do catálogo foram verificados. Os harnesses com fixtures e jornadas reais foram executados somente no banco local descartável.

Nesta feature, `src/types/database.ts` foi regenerado do esquema **local `0001–0045`**, com Supabase CLI `2.121.0`, por `supabase gen types typescript --local --schema public`. A saída foi gravada em UTF-8 sem BOM, separada de stderr; uma limpeza automática removeu espaços finais sem alterar os tokens TypeScript. Não houve reconstrução manual das definições.

Os tipos anteriores eram UTF-16LE e provinham do remoto vinculado. A geração local não contém os seguintes objetos daquele retrato:

- Tabelas: `league_entries`, `league_groups`, `league_seasons`, `xp_credits`.
- RPCs opcionais da home: `home_categories`, `home_course_students`, `home_featured_courses`, `home_featured_reviews`, `home_stats`, `home_top_learners`.
- Funções legadas de ligas: `league_affinity`, `league_close_season`, `league_compute`, `league_form_groups`, `league_late_enroll`, `league_my_group`, `league_my_history`, `league_open_season`, `league_overview`, `league_register_activity`, `league_sync`, `league_tick`, `league_week_end`, `league_week_start`.
- Funções legadas de aprendizagem/XP: `learning_attempt_breakdown`, `learning_first_correct_ordinal`, `learning_xp_preview`, `xp_credit_for`.

Isso é divergência prévia entre o retrato remoto e a sequência numerada local, não exclusão desses objetos remotos pela feature. As seis funções `home_*` têm um [script opcional fora das migrações](../../codigo-base/supabase/home_public_data.sql) e [consumidores com fallback](../../codigo-base/src/pages/home-page/services.ts). A inspeção de `src` não encontrou consumidores das demais definições removidas dos tipos. Não restaure objetos à mão no arquivo gerado nem aplique scripts opcionais silenciosamente para igualar os dois ambientes.

## Catálogo em carrosséis (0047)

`catalog_course_feed()` retorna somente cursos publicados e públicos, com médias/contagens de avaliações publicadas, matrículas acumuladas e dos últimos sete dias, pontuação bayesiana (`m=5`) e afinidade por categoria/tags do estudante autenticado. Avaliações são consideradas sem recorte de data; a janela de sete dias pertence às matrículas, não às notas. Matrículas do próprio criador não contam na popularidade. Cursos próprios ou já matriculados recebem recomendação nula. As matrículas são contadas pelo histórico existente, inclusive estados posteriores da matrícula.

A [0047](../../codigo-base/supabase/migrations/0047_catalog_course_feed.sql) acrescenta uma função e um índice; não reescreve dados de estudo ou XP. A função usa `SECURITY DEFINER` para agregações, com `EXECUTE` somente para `authenticated`; não retorna matrículas de outros usuários. O harness [de leituras](../../codigo-base/supabase/testes-leituras/catalogo.sql) verifica visibilidade, ACL, afinidade, janela de matrículas e avaliações antigas/publicadas no banco local com rollback.

Na integração dos PRs 65–67, os tipos foram regenerados do banco local `0001–0047`, em UTF-8, preservando os contratos de revisão e estatísticas de sala. Objetos remotos opcionais ausentes da sequência local continuam sujeitos aos limites descritos em “Tipos locais da revisão de curso”.

## Fontes e ordem de leitura

1. [Migrações numeradas](../../codigo-base/supabase/migrations/), de `0001` a `0047` neste checkout: modelo, políticas, funções e suas alterações sucessivas. Leia a redefinição mais recente da função ou política que estiver alterando; a tabela abaixo aponta também para migrações anteriores quando elas continuam definindo parte da regra.
2. [Tipos gerados](../../codigo-base/src/types/database.ts): estrutura tipada consumida pelo frontend. São uma fotografia de geração, não prova de que o SQL foi aplicado no ambiente de destino.
3. [Consultas do cliente](../../codigo-base/src/data/repositories.ts): tabelas, views e RPCs efetivamente utilizadas.
4. [Estatísticas de sala — issue 56](estatisticas-sala.md): contratos e correções da migration `0046_room_stats.sql`, preparada para coexistir com `0042–0045` da issue 47.

Os arquivos `v1_schema.sql` e `v2_schema.sql`, embora estejam na pasta de migrações, representam esquemas antigos com nomes como `Usuario` e `Curso`. As [notas legadas](../historico/banco-de-dados-legado.md), os scripts de CRUD em `supabase/testes/` e os artefatos de modelagem antigos também usam esse modelo. Não os combine com o SQL numerado como se fossem uma única sequência de instalação.

## Mapa entre produto e persistência

As definições de produto estão no [glossário](../../GLOSSARY.md). Esta tabela indica onde procurar sua implementação.

| Conceito | Tabelas ou views |
| --- | --- |
| Perfil | `profiles` (identidade de acesso em `auth.users`) |
| Curso, módulo, aula e questão | `courses`, `modules`, `lessons`, `questions` |
| Matrícula | `enrollments` |
| Tentativa, resposta e conclusão | `attempts`, `answers`, `completions` |
| Revisão de curso | `course_review_schedules`, `course_review_occurrences`, `course_review_sessions`, `course_review_items` |
| Sala e participação | `rooms`, `room_members` |
| Avisos, missões e progresso | `announcements`, `missions`, `mission_progress` |
| Missões globais e diárias de curso | `mission_definitions` (catálogo), `mission_occurrences` (período), `mission_assignments` (progresso do usuário) |
| Amizade e notificação | `friendships`, `notifications` |
| Créditos de XP por evento | `xp_events` (livro append-only; fundação das temporadas) |
| Medalhas | `medals`, `user_medals` |
| Avaliações e comentários | `reviews`, `comments` |
| Caderno e anotações | `notebooks`, `notebook_pages` |
| Ranking global | view `global_ranking` |
| Temporadas competitivas | `seasons` (janela semanal), `season_groups` (grupos por categoria) e `season_entries` (inscrição, categoria/grupo congelados, XP de temporada) |
| Observabilidade do agendador | `season_ops_log` (trilha append-only, admin-only) |

## Regras que precisam permanecer no servidor

| Assunto | Comportamento no SQL | Fonte |
| --- | --- | --- |
| Questões | Tipos `match`, `multiple_choice`, `fill_blank` e `sum_alternatives` | [0001](../../codigo-base/supabase/migrations/0001_extensions_and_enums.sql) e [0010](../../codigo-base/supabase/migrations/0010_domain_functions.sql) |
| Finalização de tentativa | `finalize_attempt` corrige respostas e aplica efeitos de conclusão no servidor; repetição da finalização não reaplica os efeitos. A definição vigente é a de `0035`; os triggers de conclusão acrescentados depois também participam da transação | [0035](../../codigo-base/supabase/migrations/0035_xp_proportional_attempt.sql), [0040](../../codigo-base/supabase/migrations/0040_season_mission_review_fixes.sql), [0043](../../codigo-base/supabase/migrations/0043_course_reviews.sql) e [0044](../../codigo-base/supabase/migrations/0044_course_review_lock_order.sql) |
| XP de aprendizagem | Curso credita XP global; sala usa métricas internas. Questão já acertada em tentativa anterior finalizada não rende novo XP. O primeiro acerto após erros rende `round(base / N)`, contando respostas à mesma questão em tentativas finalizadas anteriores do usuário, inclusive entre contextos de curso e sala | [0035](../../codigo-base/supabase/migrations/0035_xp_proportional_attempt.sql) |
| Aula sem questões | `complete_empty_lesson` conclui no contexto de curso sem tentativa ou XP base, garante matrícula, recalcula progresso e toca streak/medalhas. A primeira conclusão avança missões de aulas/dias pelos triggers, podendo conceder bônus de missão | [0022](../../codigo-base/supabase/migrations/0022_complete_empty_lesson.sql) e definição vigente em [0040](../../codigo-base/supabase/migrations/0040_season_mission_review_fixes.sql) |
| Ranking | Global por XP acumulado; amigos por PAC no curso; pontuação de sala separada. Sem reset semanal | [0015](../../codigo-base/supabase/migrations/0015_rankings.sql) |
| Créditos de XP por evento | O ledger `xp_events` registra créditos idempotentes por `idempotency_key`. `record_xp_event` apenas registra o fato; a função chamadora atualiza o saldo global ou interno quando devido. `user_xp_in_window` soma somente `learning_base/course` por janela `[início, fim)`; bônus de missão e `review_bonus` não pontuam temporada | [0023](../../codigo-base/supabase/migrations/0023_xp_events_ledger.sql), [0035](../../codigo-base/supabase/migrations/0035_xp_proportional_attempt.sql), [0042](../../codigo-base/supabase/migrations/0042_course_review_enums.sql) e [0043](../../codigo-base/supabase/migrations/0043_course_reviews.sql) |
| Catálogo de missões globais/curso | Catálogo determinístico compartilhado (`mission_definitions`), ocorrências por período com meta/bônus congelados (`mission_occurrences`) e atribuição com progresso por usuário (`mission_assignments`). O avanço e a concessão de bônus são implementados em `0025`, com correções posteriores em `0040` | [0024](../../codigo-base/supabase/migrations/0024_global_course_missions.sql), [0025](../../codigo-base/supabase/migrations/0025_mission_advance_grant.sql) e [0040](../../codigo-base/supabase/migrations/0040_season_mission_review_fixes.sql) |
| Avanço e bônus das missões globais/curso | `finalize_attempt` chama `advance_missions_for_attempt`, que materializa a ocorrência do período (`ensure_occurrence`, calendário America/Sao_Paulo) e avança cada missão compatível (globais por curso/sala; diária de curso só individual — Q017/Q125). Progresso recalculado das fontes (`count_mission_progress`); bônus concedido uma única vez (`upsert_mission_assignment`): `xp_events` origem `mission_bonus` + `xp_global`, sem pontuar a temporada (Q092/Q102) | [0025](../../codigo-base/supabase/migrations/0025_mission_advance_grant.sql) |
| Leitura de missões para a UI | `my_missions()` lista as missões do período corrente do usuário (globais + diárias de curso já materializadas) com progresso, materializando as globais do período antes de ler (`ensure_current_global_occurrences` — Q020/Q072); `my_mission_detail(occurrence)` dá o detalhe (Q073) | [0031](../../codigo-base/supabase/migrations/0031_mission_read.sql) |
| Unicidade das ocorrências globais | Correção: a unicidade de `mission_occurrences` não barrava duplicatas quando `course_id` é NULL (globais). Substituída por índice único com `coalesce(course_id, uuid-sentinela)`; duplicatas removidas e `ensure_occurrence` ajustada para o `on conflict` correspondente | [0032](../../codigo-base/supabase/migrations/0032_fix_global_occurrence_uniqueness.sql) |
| Agendador de temporadas | `tick_seasons()` fecha as temporadas vencidas antes de abrir a semana corrente; se algum fechamento falhar, adia a abertura. A agenda `pg_cron` de cinco minutos é criada em `0033`; sem a extensão, exige chamada privilegiada manual ou agendador externo. A implementação vigente do tick é `0040`. As agendas de temporadas e revisão de curso substituem a nota histórica "no cron" de `0001` | [0033](../../codigo-base/supabase/migrations/0033_season_scheduler.sql), [0040](../../codigo-base/supabase/migrations/0040_season_mission_review_fixes.sql) e [0043](../../codigo-base/supabase/migrations/0043_course_reviews.sql) |
| Observabilidade do fechamento | Trilha operacional `season_ops_log` (append-only, sem PII — Q087); o tick vigente registra `tick_start`/`close_ok`/`close_error`/`open_error`/`tick_done` e isola erros por temporada. `seasons_needing_attention(grace)` lista as temporadas vencidas há mais de N min ainda não fechadas, restrita a admin | [0034](../../codigo-base/supabase/migrations/0034_season_closing_observability.sql) e [0040](../../codigo-base/supabase/migrations/0040_season_mission_review_fixes.sql) |
| Alerta de atraso (Camada 1) | `check_season_alerts(grace)` registra um evento `alert` em `season_ops_log` para cada temporada vencida além da carência de 30 min e não fechada, deduplicado por episódio (âncora `ends_at`); chamado por `tick_seasons` após os fechamentos. `season_alerts(limit)` lê os alertas (admin) | [0036](../../codigo-base/supabase/migrations/0036_season_alert.sql) |
| Entrega do alerta (Camada 2) | `deliver_season_alert(season, detail)` envia o alerta ao webhook (Discord) via `pg_net`, lendo a URL do Supabase Vault (`season_alert_webhook`); chamado por `check_season_alerts` ao registrar um alerta novo. Robusto (Q078): sem `pg_net`/secret ou com falha de POST, registra `alert_delivery_error` e não propaga erro (agendador/aprendizagem nunca falham pela notificação). Requer `pg_net` habilitado e o secret no Vault | [0037](../../codigo-base/supabase/migrations/0037_season_alert_delivery.sql) |
| XP proporcional ao acerto | `finalize_attempt` credita o PRIMEIRO acerto de uma questão como `round(base / N)`, N = ordinal da execução finalizada do primeiro acerto (Q112/Q093/Q126: base 4 na 2ª execução → 2 XP). Acerto de primeira = XP cheio; acerto após um primeiro acerto = 0 (anti-regrind preservado). XP permanece inteiro (opção B; fidelidade de 4 casas exigiria XP numérico) | [0035](../../codigo-base/supabase/migrations/0035_xp_proportional_attempt.sql) |
| Correção: trigger em room_members | Remove o `set_updated_at` de `room_members` (bug pré-existente de 0012: o trigger genérico foi anexado a uma tabela sem a coluna `updated_at`). Finalizar tentativa em contexto de sala atualiza `room_members` e disparava `record "new" has no field "updated_at"`; sem o trigger, a conclusão em sala funciona | [0038](../../codigo-base/supabase/migrations/0038_fix_room_members_updated_at_trigger.sql) |
| Normalização dos patamares | Vocabulário único de 6 patamares (`bronze`/`silver`/`gold`/`platinum`/`diamond`/`master`) para ligas e PAC de sala; Lendário removido (teto = Mestre). `division_for_pac` passa a retornar a chave de tier em inglês com 6 faixas (<50/50-64/65-74/75-84/85-94/95-100); `season_category_from_rank` com teto Mestre (clamp 1..6). `legendary` permanece no enum por segurança, mas não é usado | [0039](../../codigo-base/supabase/migrations/0039_normalize_ranks.sql) |
| Correções da virada e missões | `tick_seasons` fecha temporadas vencidas antes de abrir a corrente; `open_season` aguarda apuração e inscreve também pela primeira conclusão da semana, reutilizando vagas dos grupos existentes. A primeira conclusão de aula sem questões avança as missões de aula/dias, sem XP base. Funções internas perdem `EXECUTE` de `PUBLIC`, `anon` e `authenticated` | [0040](../../codigo-base/supabase/migrations/0040_season_mission_review_fixes.sql) |
| Classificação corrente e projeções | `my_season_standings` lê o XP competitivo diretamente do ledger para temporadas não fechadas e calcula posição e categoria projetada com as regras de `close_season`: mínimo de dez positivos, cortes de 20%, empates juntos, piso Bronze e teto Mestre. Para temporadas fechadas, preserva os valores consolidados. As assinaturas de `my_season_group` e `my_season_summary` são mantidas, usando a mesma fonte corrente | [0041](../../codigo-base/supabase/migrations/0041_season_live_standings.sql) |
| Temporadas (estrutura) | `seasons`/`season_groups`/`season_entries`, janela semanal e categoria/grupo congelados. Audiência limitada ao próprio grupo via `is_in_season_group`. As categorias usadas são Bronze–Mestre; `legendary` permanece somente no enum legado. A formação, abertura e fechamento são implementados em `0027–0028`, com abertura corrigida em `0040` | [0026](../../codigo-base/supabase/migrations/0026_seasons_structure.sql), [0039](../../codigo-base/supabase/migrations/0039_normalize_ranks.sql) e [0040](../../codigo-base/supabase/migrations/0040_season_mission_review_fixes.sql) |
| Formação de grupos por afinidade social | `form_season_groups(season, target, min, cap)` distribui os inscritos sem grupo de cada categoria em grupos por proximidade social (`social_distance_order`, BFS por amizades aceitas — Q123), alvo 20/teto 30 (Q104/Q124). Idempotente: só atua sobre `group_id is null`, nunca move quem já tem grupo (congelamento). Operação de autoridade (revogada de `authenticated`) | [0027](../../codigo-base/supabase/migrations/0027_season_group_formation.sql) |
| Abertura/fechamento de temporada | Funções idempotentes de autoridade: `open_season(starts_at)` aguarda a apuração anterior, inscreve contas ativas por atividade na semana anterior ou conclusões na corrente e reutiliza vagas antes de formar novos grupos. `close_season(season_id, min)` consolida XP, rebaixa zeros com piso Bronze e aplica cortes de 20% aos positivos quando atingem o mínimo (padrão dez); empates ficam juntos, promoção tem precedência e positivos em grupo pequeno mantêm categoria | [0028](../../codigo-base/supabase/migrations/0028_season_open_close.sql), [0039](../../codigo-base/supabase/migrations/0039_normalize_ranks.sql) e [0040](../../codigo-base/supabase/migrations/0040_season_mission_review_fixes.sql) |
| Leitura de temporada e cobertura do PAC | `current_season` e `my_season_history` vêm de `0029`; `my_season_summary` e `my_season_group` usam a leitura corrente de `0041`, restrita ao próprio grupo e com identidade oculta preservada. `course_coverage` e `friends_course_pac_v2` acrescentam cobertura sem alterar a `pac()` binária. O XP proporcional de `0035` não muda essa fórmula de PAC | [0029](../../codigo-base/supabase/migrations/0029_season_read_pac_coverage.sql), [0035](../../codigo-base/supabase/migrations/0035_xp_proportional_attempt.sql) e [0041](../../codigo-base/supabase/migrations/0041_season_live_standings.sql) |
| Desativação de conta e temporada | `deactivate_account` (soft-delete de PII, amizades e salas) agora também marca `identity_hidden` nas entradas de temporadas abertas/em apuração: identidade oculta nas projeções, participação/XP/cortes preservados (Q070). Conta desativada não é inscrita na abertura (`open_season` filtra `account_status='active'`). Exclusão definitiva de Auth/Storage (Q085) é operação privilegiada fora da migração SQL | [0030](../../codigo-base/supabase/migrations/0030_account_season_retention.sql) |
| Edição de curso | Rascunho editável pelo criador; conteúdo anterior à publicação protegido, com regras para acréscimos posteriores e exceção de admin | [0019](../../codigo-base/supabase/migrations/0019_course_edit_gating.sql) |
| Permissões | RLS e funções verificam identidade e acesso; confira também ACLs de tabela/coluna e EXECUTE. `0040` restringe helpers de autoridade; `0043` restringe UPDATE de perfil/notificações e define acesso próprio de leitura às estruturas de revisão | [0011](../../codigo-base/supabase/migrations/0011_rls_policies.sql), [0019](../../codigo-base/supabase/migrations/0019_course_edit_gating.sql), [0020](../../codigo-base/supabase/migrations/0020_fix_room_members_rls_recursion.sql), [0040](../../codigo-base/supabase/migrations/0040_season_mission_review_fixes.sql) e [0043](../../codigo-base/supabase/migrations/0043_course_reviews.sql) |
| Metadados de conteúdo | Ícone de módulo, explicação de questão e duração calculada do curso | [0021](../../codigo-base/supabase/migrations/0021_module_icon_question_explanation_course_duration.sql) |
| Revisão amostral e bônus global | Agenda global, ocorrência semanal, amostras/resultados persistidos, prêmio único e entrega independente | [0042](../../codigo-base/supabase/migrations/0042_course_review_enums.sql), [0043](../../codigo-base/supabase/migrations/0043_course_reviews.sql) |
| Ordem de locks da conclusão e revisão | Lock do usuário antes dos efeitos de missões/perfil disparados por conclusão individual | [0044](../../codigo-base/supabase/migrations/0044_course_review_lock_order.sql) |
| Ocorrência corrente de revisão | `my_current_course_review` cruza agenda e ocorrência pelo período derivado da âncora e filtra a janela `[due_at, expires_at)`, retornando no máximo uma ocorrência própria sem criar registros ou apagar histórico | [0045](../../codigo-base/supabase/migrations/0045_current_course_review_period.sql) |

`grade_answer` fornece feedback sem persistir os efeitos oficiais da tentativa. O cliente não deve substituir a finalização do servidor por cálculos de XP na tela.

No modal, aulas de curso sem questões oferecem **Marcar como concluída**, que chama `complete_empty_lesson` por `dominioRepository.concluirAulaSemQuestoes`. A ação só é habilitada depois de carregar as questões com sucesso; falha de consulta não é interpretada como aula vazia. A conclusão só aparece após sucesso da RPC, sem tentativa ou XP fictícios. Esse fluxo exige a migração `0022` aplicada e não conclui aulas no contexto de sala, que a RPC atual não atende.

O TopDown usa `friends_course_pac` com o curso ativo, `missions` publicadas e sem prazo vencido (até três, ordenadas pelo prazo), e `mission_progress` filtrado pelo usuário autenticado. As missões abrangem as salas permitidas pelas políticas RLS, independentemente do curso ativo. Falhas de autenticação ou de progresso são apresentadas como erro; não se tornam progresso zero. Sem curso, o painel encerra o carregamento sem consultar esses dados.

## Revisão de curso

### Elegibilidade, amostra e efeitos

As regras estão em [0043](../../codigo-base/supabase/migrations/0043_course_reviews.sql), com os enums `notification_type.revisao_curso` e `xp_event_origin.review_bonus` adicionados separadamente em [0042](../../codigo-base/supabase/migrations/0042_course_review_enums.sql). Conta ativa, matrícula não `dropped`, curso publicado legível e ao menos uma aula são exigidos. **Todas as aulas atuais** devem ter conclusão própria em `context='course'`; status/progresso da matrícula e conclusões de sala não substituem esses fatos. Início, resposta e primeira finalização revalidam elegibilidade; conteúdo novo sem conclusão bloqueia a execução aberta sem apagar seu histórico.

Em cada módulo, SQL sorteia `ceil(0,20 * quantidade_de_questões)`, sem reposição e sem teto global; módulo vazio contribui zero. Contagem, seleção e snapshots compartilham uma instrução transacional. IDs, ordem, conteúdo e configuração ficam persistidos por sessão, sem FK que os apague ao excluir a questão original. Curso sem questões não gera sessão nem entra no sorteio de curso.

A revisão não escreve em tentativas/conclusões de aula. Prática normal tem zero XP; a bonificada exige a amostra inteira e a comparação exata `correct_count * 100 >= total_count * 70`. Reprovar congela resultado com zero prêmio e admite quantas novas sessões forem necessárias dentro da janela, cada qual com nova intenção/amostra. Retry HTTP ou retomada não são nova execução.

O primeiro aprovado recebe **10 XP globais inteiros**, com nível recalculado, chave `xp:course-review:<occurrence_id>` e um evento `review_bonus/course`. Outra sessão aprovada já aberta recebe `already_awarded`, zero XP e nenhum evento próprio. Não há XP base, de sala ou de temporada, nem alteração de PAC/cobertura, aulas/matrícula, missões, streak, medalhas, atividade recente ou inscrição em temporada. A única mudança de gamificação é o bônus/nível global quando devido.

O resumo da última revisão usa leitura das sessões finalizadas do próprio usuário e curso, ordenadas por `finished_at`/ID descendentes, com limite um. O repository valida o resultado antes de exibi-lo; RLS e filtros explícitos preservam isolamento. Essa leitura não altera progresso ou XP. Progresso e conclusões apenas de sala não autorizam revisão normal ou bonificada, mesmo com matrícula marcada como completa.

### Agenda, janela e entrega

Existe uma agenda **por usuário**, não por curso. Com âncora `a`, o período `k >= 1` começa em `a + k * 168 horas` e termina exclusivamente em `a + (k+1) * 168 horas`, intervalos exatos de sete dias em UTC. Só a janela corrente é materializada; não há atrasados, acumulação ou transporte de bônus. Outros cursos concluídos, rematrícula, repetição ou prêmio não deslocam a âncora.

Em cada ocorrência, SQL escolhe uniformemente um dos cursos distintos elegíveis com questões e persiste a escolha uma única vez. `no_candidates` pode ser reavaliado dentro da mesma janela, sem estender prazo. Após atribuir, perda de acesso/conclusão torna o curso indisponível; não sorteia substituto. Início anterior não reserva prêmio: no prazo de expiração ou depois não se cria uma sessão bonificada, aceita resposta ou finaliza pela primeira vez. Leituras históricas, repetição de um request de início já atendido e resultado já finalizado permanecem reproduzíveis; isso não reabre a sessão para mutações.

O observador de conclusões oficiais confirma o primeiro marco novo, inclusive aula sem questões, sem depender da atualização prévia da matrícula. Na implantação, cursos já completos comprováveis recebem âncora operacional única de rollout, **sem afirmar data histórica de primeira conclusão**. Reconciliação posterior sem marco confiável usa `legacy_observed`, também com data real nula. Não se infere a primeira conclusão de `enrollments.updated_at` ou de min/max de `completions.completed_at`, sobrescrito ao refazer aula.

Entrega é independente da autorização: `profiles.notification_preferences` usa a chave `revisao_curso`; preferência ausente/true permite aviso, false marca `suppressed` e não bloqueia atividade/prêmio. O helper `create_notification`, definido em [0016](../../codigo-base/supabase/migrations/0016_notifications_social_account.sql), retorna NULL no opt-out. Ligar novamente não reenvia ocorrência suprimida. Ler/apagar o aviso não consome/reabre a ocorrência. Falha técnica de notificação é isolada em subtransação, preserva curso/ocorrência, registra `failed` com o SQLSTATE em `last_delivery_error` e permite retry de entrega na janela.

`tick_course_reviews()` retorna contagens `{occurrences_created, courses_assigned, notifications_created}` e não concede XP. O job próprio `tick_course_reviews_every_5m` usa `*/5 * * * *`, sem alterar `tick_seasons`. Sem `pg_cron`, a migração avisa e mantém a função privilegiada; periodicidade exige executor alternativo comprovado. Visitar a página não substitui o agendador.

A leitura de ocorrência corrente usa o período derivado da âncora da agenda, além dos limites de vencimento/expiração ([0045](../../codigo-base/supabase/migrations/0045_current_course_review_period.sql)). A unicidade usuário/período garante no máximo uma linha, mesmo após simulações que deixem intervalos históricos sobrepostos. A correção preserva os registros e a consulta por ID.

Notificações de revisão seguem a política `notifications_delete` de destinatário. Apagar o aviso não apaga a ocorrência, sessão ou recibo de XP, nem muda `delivery_state` para reenviar. A interface expõe remoção individual e de lidas; o repository retorna os IDs realmente apagados para atualizar a lista sem confundir o destaque local de novas notificações com o estado já marcado no servidor.

### Estruturas e RPCs

| Estrutura | Identidade e fatos |
| --- | --- |
| `course_review_schedules` | PK `user_id`; âncora preservada e origem `first_completion`, `rollout` ou `legacy_observed`; `first_course_completed_at` só para marco confirmado |
| `course_review_occurrences` | UNIQUE `(user_id, period_index)`; curso/título, política e prazo fixados, entrega e prêmio separados; referências históricas não apagam o fato ao excluir conteúdo/aviso |
| `course_review_sessions` | UNIQUE `(user_id, request_id)`, **sem UNIQUE de ocorrência**; modo normal/bonus irrevogável, resultado congelado e evento somente na sessão premiada |
| `course_review_items` | PK `(session_id, question_id)` e ordinal único por sessão; snapshot, primeira resposta/correção e data |

RPCs de usuário derivam identidade de `auth.uid()`; nenhuma aceita usuário, IDs sorteados, nota, XP, política, âncora ou prazo do navegador:

| RPC | Parâmetros | Leitura/resultado |
| --- | --- | --- |
| `course_review_status` | `p_course_id` | Uma disponibilidade com quantidades totais e `module_counts`; curso ilegível dá erro, não metadados |
| `my_current_course_review` | nenhum | Zero ou uma ocorrência da janela materializada; não cria agenda/ocorrência |
| `my_course_review_occurrence` | `p_occurrence_id` | Uma ocorrência própria, inclusive histórica |
| `start_course_review` | `p_course_id`, `p_request_id`, `p_occurrence_id` opcional | Sessão/amostra; ocorrência omitida/NULL cria prática normal; mesmo request e argumentos reproduzem a sessão, argumentos diferentes conflitam |
| `my_course_review` | `p_session_id` | Sessão própria, itens/respostas e resultado histórico |
| `submit_course_review_answer` | `p_session_id`, `p_question_id`, `p_submitted` | Feedback/quantidades; valida quatro formatos, corrige por snapshot com XP zero; enquanto a sessão puder receber respostas, JSONB igual repete feedback e alteração conflita |
| `finalize_course_review` | `p_session_id` | Resultado congelado: acertos/total/aprovação, `bonus_earned`, `bonus_outcome`, evento e data |

Os itens completos e contagens por módulo usam JSONB para não truncar amostras pelo limite de linhas de REST. O [adapter](../../codigo-base/src/data/repositories.ts) valida DTOs; não transforma falha/ausência inesperada em vazio ou zero. Ocorrência expõe estado `available/no_candidates/unavailable/expired/claimed`, entrega separada e IDs para retomar/consultar resultado/prêmio. Finalização retorna `not_applicable/below_target/awarded/already_awarded`; repetir resultado não recalcula nem promove reprovação antiga a prêmio.

Os retries têm limites distintos: `start_course_review` devolve a sessão existente antes de revalidar elegibilidade/prazo; `finalize_course_review` devolve o resultado congelado da sessão já finalizada. `submit_course_review_answer` exige sessão ainda aberta e elegível, com janela vigente no modo bônus, mesmo para repetir uma resposta idêntica; sessão finalizada retorna `REVIEW_FINISHED`. IDs alheios retornam `REVIEW_FORBIDDEN` (`42501`), entrada inválida retorna `REVIEW_INVALID_INPUT` (`22023`) e amostra incompleta impede finalizar com `REVIEW_INCOMPLETE`.

### Autorização, concorrência e ordem de locks

As quatro tabelas têm RLS de leitura própria para `authenticated`, sem escrita direta, inclusive do dono; não há exceção de admin nas RPCs para agir por outro usuário. RPCs `SECURITY DEFINER` usam caminho fixo e nomes qualificados, revogam EXECUTE herdado de PUBLIC/anon e concedem explicitamente a authenticated. Helpers `course_review_*` internos (exceto a RPC pública de status), trigger helpers e tick não são executáveis por PUBLIC/anon/authenticated; o executor privilegiado tem concessão explícita.

`0043` revoga UPDATE amplo e grants de colunas anteriores de perfil/notificações. O cliente só pode alterar `username`, `display_name`, `bio`, `avatar_url`, `banner_url`, `notification_preferences` do perfil e `is_read` da notificação, sob RLS existente. Saldo, nível, papel/status e demais atributos de gamificação/identidade da conta ficam fora da escrita direta. `create_notification` também perde EXECUTE de PUBLIC/anon/authenticated; aviso ou `reference_id` não autoriza prêmio. `record_xp_event` permanece helper interno.

Mutações de revisão seguem lock transacional global por usuário → agenda → ocorrência → sessão → perfil. Tick adquire usuários em ordem determinística de UUID; índices únicos sustentam deduplicação. O relógio é obtido após espera dos locks; espera por perfil de outra fonte de XP não estende prazo. Evento, atualização aditiva do saldo/nível, resultado e consumo do prêmio pertencem à mesma transação, com rollback integral em falha.

A correção incremental [0044](../../codigo-base/supabase/migrations/0044_course_review_lock_order.sql) adquire o advisory lock **BEFORE INSERT/UPDATE de conclusão individual**, antes dos efeitos de missão/perfil dos triggers AFTER. O observador da âncora continua AFTER para enxergar a conclusão. Isso elimina a inversão perfil → usuário da missão de aula vazia contra usuário → perfil da revisão, sem redefinir os efeitos de `finalize_attempt`/`complete_empty_lesson`. Ensaios de ACL efetiva, corrida e rollback continuam necessários; leitura dessas declarações não é prova de execução.

## Antes de alterar ou preparar um banco

A `0041` registra `season_entries.entry_kind`: `snapshot` para a coorte elegível inserida na transação de abertura e `late` para entradas posteriores ou por atividade corrente. O legado só é preenchido quando `league_entries` fornece o tipo original; entradas antigas sem informação confiável permanecem nulas. A nova RPC exige `authenticated`, limita a audiência ao próprio grupo/inscrição e preserva a ocultação de nome, foto e banner.

Na interface, a marca de queda para zero XP aparece nas últimas 24 horas. Esse prazo é apenas visual: a projeção do servidor continua aplicando a queda de zeros conforme a regra de fechamento, em qualquer instante da semana.

- Identifique o ambiente e o esquema já aplicado, incluindo as migrações posteriores que redefinem funções e políticas.
- Se o histórico remoto contém a antiga `0023_ligas.sql`, a migração `0024` cria os pré-requisitos do ledger omitidos pelo versionamento de `0023`. A `0040` copia créditos e temporadas legados sem substituir saldos correntes, e revoga o acesso à sincronização antiga. Confira contagens e categorias em um clone do banco antes de aplicar no destino; conflitos entre entradas antigas e novas interrompem a `0040` para reconciliação explícita.
- Confira se a mudança exige migração incremental e atualização das chamadas e dos tipos gerados.
- O projeto inclui `supabase/config.toml` com portas na faixa `553xx`. Uma instalação limpa aplica `0001–0045` e o `seed.sql`; uma pilha restaurada de backup pode conter outro esquema/dados. Confirme `project_id`, volumes, portas e histórico antes de aplicar migrações. `supabase db reset` apaga os dados do alvo: não o use para resolver divergência em banco/volume preexistente de outra atividade.
- Os seeds em [0013](../../codigo-base/supabase/migrations/0013_seed.sql) e [seed.sql](../../codigo-base/supabase/seed.sql) precisam ser lidos no contexto do ambiente de teste antes da execução; esta referência não instrui a aplicá-los sobre dados existentes.
- Regenere `src/types/database.ts` a partir do esquema-alvo correspondente após mudanças de esquema; não edite o arquivo à mão. Para esta feature, use `npx supabase gen types typescript --local --schema public` após `0001–0045`. A `0045` preserva a assinatura da RPC; a geração local foi comparada e corresponde aos tipos existentes. Capture stdout separado de stderr, confira o exit code e só então grave UTF-8; evite redirecionamento que introduza UTF-16 ou diagnósticos no código. Limpeza automática de espaços finais deve preservar a semântica, sem completar definições manualmente.
- Confira no ambiente os recursos de Storage usados pelo [perfil](../../codigo-base/src/pages/profile/Profile.tsx); tabelas e RPCs não descrevem por si só as políticas do bucket.

## Verificação

Para popular o ambiente de teste com grupos competitivos e missões, consulte os [dados de demonstração](../dados-demonstracao.md). O seed opcional cria somente contas identificadas como fictícias e grupos próprios, sem reatribuir inscrições existentes; não faz parte das migrações nem do seed base de reset.

Consulte [Testes](../testes.md) para o alcance das verificações e as limitações do runner SQL legado. Para revisão de curso, o [plano da issue 47](../testes-issue-47.md) aponta os ensaios de RLS/ACLs, idempotência, concorrência e integração. A conferência documental de 2026-11-16 verificou definições/redefinições SQL e links locais; não executou esses ensaios. Uma passagem no typecheck ou nos exemplos de frontend não valida RLS, XP ou aplicação das migrações.
