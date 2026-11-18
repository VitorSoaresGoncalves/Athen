# Verificação da issue 47 — revisão esporádica de curso

Registro de validação local em 2026-11-16, contrato revisão 4 e diff revisão 9 da branch `issue/47-revisao-esporadica`, sobre `3d22c6a`. Não representa aprovação humana ou entrega remota. As fontes executáveis são os [scripts](../codigo-base/package.json), os testes abaixo e as [migrações 0042–0045](../codigo-base/supabase/migrations/).

## Resultados

Comandos executados em `codigo-base/` da worktree, em série quando compartilham `dist/` ou banco:

| Verificação | Resultado |
| --- | --- |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm run test:run` | Exit 0; 32 testes |
| `npm run test:check` | Exit 0 |
| `npm run build` | Exit 0 |
| `npm run test:e2e -- --reporter=list` | Exit 0; 94 cenários |
| `npm run test:db` | Exit 0; regressão issue 42 e contratos/concorrência issue 47 |
| `npm run test:e2e:live` | Exit 0; quatro jornadas reais |

O harness da issue 42 preserva eventos `review_bonus` referenciados por ocorrências, permitindo repetir o gate sem apagar histórico local manual. A limpeza do ensaio permanece em transação revertida.

Os logs e capturas desta execução estão no diretório local `.scratch/issue-47-evidence/` da worktree; o checkpoint e a revisão independente estão em `.scratch/issue-47-revisao-esporadica/` do checkout original. Esses artefatos locais não são pré-requisito para executar as suítes em outro checkout.

## Evidências por critério

- **CA-01–05:** o [harness SQL](../codigo-base/supabase/testes-issue-47/harness.sql) e o [runner](../codigo-base/supabase/testes-issue-47/run-harness.ts) verificam elegibilidade, amostragem e snapshots; os [testes do modal](../codigo-base/tests/components/LessonModal.test.tsx) e [E2E da revisão](../codigo-base/tests/e2e/course-review.spec.ts) exercitam início, UUID/reload, vazio, erro e recuperação.
- **CA-06/13/17:** o runner exercita agenda/tick, primeiro marco, opt-out, expiração, reconciliação e o bloco real de rollout extraído da migração versionada. Confere data histórica nula, âncora estável na reexecução e ausência de atrasados. As verificações de backfill terminam em rollback.
- **CA-07/08/16:** a [jornada real de revisão](../codigo-base/tests/live/local-course-review.spec.ts) cobre prática normal, bônus sem aviso e notificação entregue/lida. Inclui Auth/PostgREST reais e conta B sem acesso aos fatos de A; o harness também verifica ACL e RPCs.
- **CA-09–12/14:** o runner usa conexões independentes para mesmo pedido, respostas concorrentes, resposta versus fechamento e duas aprovações da mesma ocorrência. Verifica 60%/70%, reprovação/nova intenção, prêmio único, resultados congelados, rollback contábil e preservação dos efeitos P07. As corridas da migração 0044 incluem conclusão com missão e outra fonte de XP.
- **CA-15:** E2E e capturas em 390×844/1440×900 verificam foco inicial/contido/devolvido, teclado, fechamento, recuperação, dimensões e movimento reduzido. As capturas foram inspecionadas sem sobreposição aparente; não houve auditoria automatizada abrangente de contraste.

- **CA-18/19/20:** os E2E verificam cartão inferior direito sem ação no cabeçalho, último resultado persistido, único CTA com seleção automática de bônus, aviso separado, troca de curso sem vazamento de resposta atrasada e ausência em sala compartilhada. A jornada real comprova histórico após reload. O harness autenticado recusa início normal/bonificado com conclusões apenas de sala, mesmo com matrícula artificialmente completa, e aceita após conclusões individuais.

- **CA-21–24:** a [0045](../codigo-base/supabase/migrations/0045_current_course_review_period.sql) foi ensaiada incrementalmente sem reset. Antes, a regressão autenticada retornava duas ocorrências; depois, retorna só o período da agenda. O harness comprova histórico, exclusão própria/alheia, prêmio preservado e ausência de reenvio. Os [testes de limpeza](../codigo-base/tests/e2e/notifications-cleanup.spec.ts) cobrem remoção individual/lidas, falha/retry e novos avisos preservados; os [testes de layout](../codigo-base/tests/e2e/dashboard-review-layout.spec.ts) verificam altura sem scroll, posição da trilha/carrossel e separação dos controles visíveis. Repro anterior: scrollHeight956 em viewport900 e carrossel255,8px acima da referência; correção preserva a geometria desktop.

A [jornada geral de estudo](../codigo-base/tests/live/local-study.spec.ts) também passou, preservando cadastro, matrícula, conclusão e progresso. As revisões independentes de padrões e spec encerraram sem achados pendentes após a conferência das correções.

## Ambiente e limites

Foi usada a pilha descartável `athen-issue47` nas portas 55321/55322. O cron local registrou 13 execuções `succeeded`. A limpeza confirmou zero contas/cursos das fixtures de revisão e zero helpers de falha; a jornada geral conserva sua conta de ensaio conforme o runner existente. O banco `codigo-base` preexistente e seus volumes foram preservados.

A instalação limpa `0001–0043` com seed e a aplicação incremental `0044` foram registradas na etapa anterior, sem repetição nesta retomada. A retomada anterior confirmou schema 0044 e ensaiou o backfill real com fixtures. Nesta correção, a 0045 foi aplicada incrementalmente e a geração local de tipos foi comparada com a fonte, sem diferenças de assinatura. Nenhum reset ou remoção de volumes foi realizado.

Não foram executados commit, merge, PR, push, migração remota ou deploy. Os resultados locais não comprovam CI, Preview, aprovação humana ou execução do cron em produção. Consulte [Testes](testes.md) para preparação e comandos, e o [registro didático](aprendizado/issues/issue-47-revisao-esporadica.md) para entender a implementação.
