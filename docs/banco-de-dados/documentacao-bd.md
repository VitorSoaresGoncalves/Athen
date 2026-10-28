# Banco de dados atual

Referência do modelo usado pelo cliente, conferida em 2026-10-23 contra o SQL versionado e os tipos gerados. A configuração e o histórico de aplicação de um banco remoto não foram inspecionados.

## Fontes e ordem de leitura

1. [Migrações numeradas](../../codigo-base/supabase/migrations/), de `0001` a `0022` neste checkout: modelo, políticas, funções e suas alterações sucessivas. Leia a redefinição mais recente da função ou política que estiver alterando.
2. [Tipos gerados](../../codigo-base/src/types/database.ts): estrutura tipada consumida pelo frontend. São uma fotografia de geração, não prova de que o SQL foi aplicado no ambiente de destino.
3. [Consultas do cliente](../../codigo-base/src/data/repositories.ts): tabelas, views e RPCs efetivamente utilizadas.

Os arquivos `v1_schema.sql` e `v2_schema.sql`, embora estejam na pasta de migrações, representam esquemas antigos com nomes como `Usuario` e `Curso`. As [notas legadas](../historico/banco-de-dados-legado.md), os scripts de CRUD em `supabase/testes/` e os artefatos de modelagem antigos também usam esse modelo. Não os combine com o SQL numerado como se fossem uma única sequência de instalação.

## Mapa entre produto e persistência

As definições de produto estão no [glossário](../../GLOSSARY.md). Esta tabela indica onde procurar sua implementação.

| Conceito | Tabelas ou views |
| --- | --- |
| Perfil | `profiles` (identidade de acesso em `auth.users`) |
| Curso, módulo, aula e questão | `courses`, `modules`, `lessons`, `questions` |
| Matrícula | `enrollments` |
| Tentativa, resposta e conclusão | `attempts`, `answers`, `completions` |
| Sala e participação | `rooms`, `room_members` |
| Avisos, missões e progresso | `announcements`, `missions`, `mission_progress` |
| Amizade e notificação | `friendships`, `notifications` |
| Medalhas | `medals`, `user_medals` |
| Avaliações e comentários | `reviews`, `comments` |
| Caderno e anotações | `notebooks`, `notebook_pages` |
| Ranking global | view `global_ranking` |

## Regras que precisam permanecer no servidor

| Assunto | Comportamento no SQL | Fonte |
| --- | --- | --- |
| Questões | Tipos `match`, `multiple_choice`, `fill_blank` e `sum_alternatives` | [0001](../../codigo-base/supabase/migrations/0001_extensions_and_enums.sql) e [0010](../../codigo-base/supabase/migrations/0010_domain_functions.sql) |
| Finalização de tentativa | Corrige respostas e aplica efeitos de conclusão no servidor; repetição da finalização não reaplica os efeitos | [0018](../../codigo-base/supabase/migrations/0018_no_xp_for_already_correct.sql) redefine `finalize_attempt` |
| XP | Curso credita XP global; sala usa métricas internas. Questão já acertada em tentativa anterior finalizada não rende novo XP | [0018](../../codigo-base/supabase/migrations/0018_no_xp_for_already_correct.sql) |
| Aula sem questões | `complete_empty_lesson` conclui no contexto de curso com zero XP e recalcula progresso | [0022](../../codigo-base/supabase/migrations/0022_complete_empty_lesson.sql) |
| Ranking | Global por XP acumulado; amigos por PAC no curso; pontuação de sala separada. Sem reset semanal | [0015](../../codigo-base/supabase/migrations/0015_rankings.sql) |
| Edição de curso | Rascunho editável pelo criador; conteúdo anterior à publicação protegido, com regras para acréscimos posteriores e exceção de admin | [0019](../../codigo-base/supabase/migrations/0019_course_edit_gating.sql) |
| Permissões | RLS e funções verificam identidade e acesso; revisar também as alterações posteriores das políticas | [0011](../../codigo-base/supabase/migrations/0011_rls_policies.sql), [0015](../../codigo-base/supabase/migrations/0015_rankings.sql), [0019](../../codigo-base/supabase/migrations/0019_course_edit_gating.sql), [0020](../../codigo-base/supabase/migrations/0020_fix_room_members_rls_recursion.sql) |
| Metadados de conteúdo | Ícone de módulo, explicação de questão e duração calculada do curso | [0021](../../codigo-base/supabase/migrations/0021_module_icon_question_explanation_course_duration.sql) |

`grade_answer` fornece feedback sem persistir os efeitos oficiais da tentativa. O cliente não deve substituir a finalização do servidor por cálculos de XP na tela.

No modal, aulas de curso sem questões oferecem **Marcar como concluída**, que chama `complete_empty_lesson` por `dominioRepository.concluirAulaSemQuestoes`. A ação só é habilitada depois de carregar as questões com sucesso; falha de consulta não é interpretada como aula vazia. A conclusão só aparece após sucesso da RPC, sem tentativa ou XP fictícios. Esse fluxo exige a migração `0022` aplicada e não conclui aulas no contexto de sala, que a RPC atual não atende.

O TopDown usa `friends_course_pac` com o curso ativo, `missions` publicadas e sem prazo vencido (até três, ordenadas pelo prazo), e `mission_progress` filtrado pelo usuário autenticado. As missões abrangem as salas permitidas pelas políticas RLS, independentemente do curso ativo. Falhas de autenticação ou de progresso são apresentadas como erro; não se tornam progresso zero. Sem curso, o painel encerra o carregamento sem consultar esses dados.

## Antes de alterar ou preparar um banco

- Identifique o ambiente e o esquema já aplicado, incluindo as migrações posteriores que redefinem funções e políticas.
- Confira se a mudança exige migração incremental e atualização das chamadas e dos tipos gerados.
- O checkout não fornece `supabase/config.toml` nem um procedimento validado de bootstrap completo. A presença do pacote CLI não garante que `supabase start` ou um reset seja um setup pronto deste projeto.
- Os seeds em [0013](../../codigo-base/supabase/migrations/0013_seed.sql) e [seed.sql](../../codigo-base/supabase/seed.sql) precisam ser lidos no contexto do ambiente de teste antes da execução; esta referência não instrui a aplicá-los sobre dados existentes.
- Regenere `src/types/database.ts` a partir do esquema-alvo correspondente após a mudança. Não edite o arquivo à mão. O alvo e o comando de geração devem acompanhar a entrega; não há script de geração em `package.json` atualmente.
- Confira no ambiente os recursos de Storage usados pelo [perfil](../../codigo-base/src/pages/profile/Profile.tsx); tabelas e RPCs não descrevem por si só as políticas do bucket.

## Verificação

Consulte [Testes](../testes.md) para o alcance das verificações e as limitações do runner SQL legado. Uma passagem no typecheck ou nos exemplos de frontend não valida RLS, XP ou aplicação das migrações.
