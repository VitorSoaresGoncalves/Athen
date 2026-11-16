# Issue 47 — revisão esporádica de curso

Origem: issue 47, contrato revisão 4. Data: 2026-11-16. **Estado: validada localmente**; pipeline, jornadas reais e revisão independente concluídos na revisão 9 do diff. Código analisado: alterações de trabalho da branch `issue/47-revisao-esporadica`, sobre a base `3d22c6a`, incluindo migrações 0042–0045. Este registro não representa aprovação humana, PR ou deploy.

## Problema e solução

Concluir aulas não oferecia uma revisão de curso que reunisse questões dos módulos e distinguisse estudo voluntário de uma oportunidade periódica de recompensa. Essa distinção é necessária: permitir praticar várias vezes não deve permitir ganhar XP repetidamente pela mesma oportunidade.

A implementação acrescenta revisão individual para cursos elegíveis, com todas as aulas oficialmente concluídas. Seleciona aleatoriamente 20% das questões de cada módulo, arredondando para cima; módulos sem questões não acrescentam itens. Um módulo com quatro questões fornece uma; outro com dez fornece duas. O modal existente passa a apresentar também essa execução, preservando os formatos de questão já usados na aplicação.

A revisão aparece em um [cartão próprio](../../../codigo-base/src/components/course-review/CourseReviewCard.tsx), no canto inferior direito do curso. Ele mostra o último resultado persistido, com acertos, nota, XP e data. Um único **Revisar curso** abre o modal e seleciona o bônus disponível automaticamente; o aviso fica separado do botão. Em salas, o cartão não aparece e a abertura é impedida. O servidor também exige conclusões no contexto individual: concluir o mesmo conteúdo em uma sala não habilita essa revisão.

## Quatro conceitos para entender a implementação

**Prática e bônus têm ciclos diferentes.** A prática normal pode ser iniciada sem uma ocorrência e concede zero XP. Uma ocorrência representa a oportunidade semanal de bônus de um usuário, com curso sorteado e prazo próprios. A agenda é global por usuário e nasce da primeira conclusão oficial observada; completar outro curso não reinicia o calendário. Dados anteriores à implantação recebem uma âncora operacional de rollout, sem inventar a data histórica da primeira conclusão.

O job `tick_course_reviews()` materializa somente a janela semanal corrente, sem acumular semanas perdidas. O curso escolhido fica persistido. Aprovando com pelo menos 70%, a primeira sessão premiada recebe +10 XP global; reprovação permite outra sessão na mesma ocorrência. Desativar avisos suprime a notificação, mas mantém a atividade disponível no dashboard. A entrega do aviso tem tratamento de falha separado da atribuição do curso.

**O servidor é a autoridade.** A tela solicita operações; as funções SQL verificam identidade, elegibilidade, prazo, respostas e concessão. Em [0043_course_reviews.sql](../../../codigo-base/supabase/migrations/0043_course_reviews.sql), `start_course_review`, `submit_course_review_answer` e `finalize_course_review` concentram essas regras. Políticas de acesso às linhas e permissões de execução restringem dados e funções. Esconder um botão ou enviar uma nota pelo navegador não substitui a correção oficial. A aprovação usa a proporção exata: dois acertos em três questões não atingem 70%.

**Persistência torna repetições e concorrência previsíveis.** Idempotência significa repetir uma operação sem repetir seu efeito. O UUID do pedido identifica a intenção de iniciar: repetir o mesmo pedido recupera a sessão; “Tentar novamente”, após reprovar, gera outro UUID. O snapshot é a cópia persistida das questões e configurações sorteadas, usada na correção mesmo se o conteúdo original mudar. A primeira resposta aceita fica fixada e o resultado final é imutável.

Bloqueios coordenam operações simultâneas. Duas sessões aprovadas podem terminar, mas somente uma consome o prêmio; a outra registra `already_awarded`, com zero. Resultado, evento de XP, saldo e consumo da ocorrência pertencem à mesma transação: falhar reverte o conjunto. [0044_course_review_lock_order.sql](../../../codigo-base/supabase/migrations/0044_course_review_lock_order.sql) antecipa o bloqueio nas conclusões oficiais para manter ordem compatível com revisão, missões e perfil, evitando ciclos de espera.

**Testes simulados e reais respondem perguntas distintas.** Fixtures HTTP, respostas controladas que substituem o backend, permitem testar erros, retomada, navegação e acessibilidade com previsibilidade. Não demonstram que o PostgreSQL impede dois prêmios. O [harness SQL](../../../codigo-base/supabase/testes-issue-47/harness.sql) verifica contratos; seu [runner](../../../codigo-base/supabase/testes-issue-47/run-harness.ts) acrescenta conexões independentes, corridas e rollback. A [jornada real](../../../codigo-base/tests/live/local-course-review.spec.ts) exercita navegador, Auth, PostgREST e banco locais sem interceptação HTTP.

## Correções observadas no teste manual

Uma simulação que antecipa a âncora pode deixar duas janelas com datas ainda válidas. A consulta do cartão esperava uma ocorrência e recebia duas, enquanto o aviso funcionava por buscar um ID específico. A [0045](../../../codigo-base/supabase/migrations/0045_current_course_review_period.sql) resolve isso usando o período calculado pela agenda, preservando os fatos antigos. É a diferença entre filtrar datas e identificar qual registro representa o estado corrente.

A exclusão de avisos já existia no repository e na política de acesso, mas não havia controle na página. Agora **Remover** e **Limpar lidas** a expõem sem alterar a revisão. A lista usa os IDs confirmados pelo servidor: um aviso pode parecer novo na tela, embora a abertura da caixa já o tenha marcado como lido no banco. Em falha, o aviso permanece e há uma mensagem para tentar novamente.

No layout, reservar 312 px abaixo do conteúdo para um cartão fixo mudou a altura flexível e empurrou trilha/carrossel para cima. O desktop agora mantém a geometria original e acomoda o cartão na lateral inferior, com largura responsiva. Os testes medem altura da página, posição e interseção dos controles visíveis, além das capturas; o espaço vazio de um container não equivale a um controle coberto.

## Caminho dos dados e verificação

[Dashboard](../../../codigo-base/src/pages/Dashboard.tsx) descobre a ocorrência mesmo sem aviso. [Notificacoes](../../../codigo-base/src/pages/Notificacoes.tsx) encaminha ao mesmo contexto. [LessonModal](../../../codigo-base/src/components/lesson/LessonModal.tsx) mantém pedido, sessão e resultado; o `revisaoRepository` em [repositories.ts](../../../codigo-base/src/data/repositories.ts) traduz e valida os contratos das RPCs antes de entregá-los à interface.

Na consolidação final passaram lint, tipos, build, 32 testes Vitest, 94 E2E simulados, os harnesses SQL das issues 42/47 e quatro jornadas reais. Foram exercitados opt-out, notificação entregue/lida, reprovação, nova intenção, replay e recusa de acesso por outra conta. Os dois revisores independentes encerraram sem achados pendentes. As [evidências de verificação](../../testes-issue-47.md) registram comandos, resultados e limites. Validação local não comprova CI de PR, aplicação das migrações no destino ou funcionamento do executor periódico em produção; veja [Testes e validações](../../testes.md).

## Exploração

Localize no modal a geração de `crypto.randomUUID()` e compare-a com a busca por `request_id` no SQL. Descreva o resultado esperado ao reenviar um pedido após falha de rede e ao escolher “Tentar novamente” após reprovar. Depois, identifique a condição que impede a segunda sessão aprovada de conceder mais +10 XP.
