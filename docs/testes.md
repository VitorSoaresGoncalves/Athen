# Testes e validações

Referência dos comandos versionados neste checkout. Execute-os em `codigo-base/`. O [mapa detalhado dos testes](mapa-dos-testes.md) explica as suítes anteriores, sua utilidade, páginas cobertas, diagramas e limites. As fontes executáveis são [package.json](../codigo-base/package.json) e [ci.yml](../.github/workflows/ci.yml); a revisão de curso tem os critérios adicionais abaixo.

## Preparação

Instale as dependências e o navegador usado pelo runner:

```bash
npm ci
npx playwright install chromium
```

O MCP Playwright é uma ferramenta de exploração para o agente. Não é necessário instalá-lo para executar as suítes versionadas pelo terminal ou pelo GitHub Actions.

## Pipeline local para mudanças de código

```bash
npm run lint
npm run typecheck
npm run test:run
npm run test:check
npm run build
npm run test:e2e
```

| Verificação | Alcance |
| --- | --- |
| `lint` | Regras configuradas no ESLint; não comprova aderência completa aos guias |
| `typecheck` | Tipos dos projetos da aplicação e Vite |
| `test:run` | Suítes Vitest de configuração de questões, prazos/contextos de missões e componentes; contagem depende dos arquivos presentes |
| `test:check` | Tipos de `src`, `tests`, Vitest e configurações Playwright |
| `build` | TypeScript e assets de produção Vite |
| `test:e2e` | Cenários Chromium com HTTP simulado; não comprovam regras SQL |

Os exemplos de soma e contador foram removidos por não cobrirem comportamento do produto. As regressões de dashboard/ligas foram mantidas e os testes de missões passaram a comparar valores e navegação real. O [catálogo](mapa-dos-testes.md) relaciona os casos por página e arquivo.

O [Husky](../codigo-base/.husky/pre-commit) executa somente lint-staged/ESLint nos arquivos staged compatíveis. Não substitui o pipeline. Use `npm test` para acompanhar Vitest durante desenvolvimento e `npm run test:run -- tests/components/Modal.test.tsx` para focar um arquivo.

## Interface determinística

A [configuração principal](../codigo-base/playwright.config.ts) inicia seu próprio build/preview em `127.0.0.1:4173`, com URL/chave Supabase fictícias. Não reutiliza servidor existente: libere a porta antes de executar. Usa dois workers, Chromium, pt-BR e fuso de Brasília.

As novas suítes usam [fixtures HTTP](../codigo-base/tests/e2e/support/platform.ts) independentes por teste, sem reproduzir algoritmos SQL. Dashboard e ligas mantêm seus cenários controlados específicos. O fluxo padrão simulado está em [study-journey.spec.ts](../codigo-base/tests/e2e/study-journey.spec.ts).

```bash
npm run test:e2e -- tests/e2e/platform-pages.spec.ts
npm run test:e2e -- --list
```

Falhas guardam screenshot/trace em `test-results/`; o relatório padrão fica em `playwright-report/`. Capturas de sucesso dos testes antigos não são comparação automática com baseline visual. `--list` apenas descobre casos, sem executar asserções.

## Banco de dados atual e jornada real

Use **banco local descartável de ensaio**, com migrações numeradas e `supabase/seed.sql`. Não use produção. Com Docker iniciado:

```bash
npx supabase start -x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit
```

Forneça `SUPABASE_DB_URL` no ambiente do processo. Para a configuração local versionada, em PowerShell:

```powershell
$env:SUPABASE_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'
npm run test:db
npm run test:e2e:live
```

`test:db` executa **`test:issue42 && test:issue47`**, em série e interrompendo em falha. O [runner da issue 42](../codigo-base/supabase/testes-issue-42/run-harness.ts) executa `harness.sql`, `live-standings.sql`, `missions.sql` e `review-fixes.sql`. Habilita asserções PL/pgSQL, limita conexão/query e reverte os ensaios. O quarto script recebe a transação pelo runner. Há limpeza temporária de tabelas em alguns ensaios: rollback não elimina bloqueios/interferência durante a execução; mantenha o alvo isolado.

A [jornada real](../codigo-base/tests/live/local-study.spec.ts) usa [configuração própria](../codigo-base/playwright.live.config.ts), preview em 4175 e URL/chave da pilha **local**, obtidas sem imprimir segredos por `supabase status -o json`. Recusa API não loopback. Cadastra uma conta aleatória, faz login, matricula-se no curso do seed, responde uma aula, verifica XP/progresso após reload, lê missões e sai. Não usa interceptação HTTP ou sessão fictícia. Não gera traces de credenciais; mantém screenshots de falha. Sem backend local, falha explicitamente na preparação.

A jornada `local-study` deixa sua conta e atividade no banco descartável para diagnóstico. As jornadas de revisão usam fixtures próprias e as removem ao concluir, preservando dados preexistentes. Os testes SQL e as jornadas reais devem rodar sequencialmente. As suítes real e simulada também devem rodar sequencialmente, pois ambas escrevem `dist/`. `local-study` não exige `SUPABASE_DB_URL`; as jornadas de revisão exigem essa variável para preparar e conferir fixtures por conexão PostgreSQL local, além de usar Auth/PostgREST reais no navegador.

O [plano da issue 42](testes-issue-42.md) traz ensaios adicionais. Fixtures/checagens de upgrade ainda exigem migração entre etapas, na mesma transação revertida. Entrega real do alerta e operação do cron não são comprovadas pelos testes de interface.

## Revisão de curso (issue 47)

O [runner da issue 47](../codigo-base/supabase/testes-issue-47/run-harness.ts), chamado por `npm run test:issue47`, executa o [harness SQL](../codigo-base/supabase/testes-issue-47/harness.sql) com rollback e regressões de concorrência em conexões independentes. Recusa alvo fora de `127.0.0.1:55322/postgres`, usa timeouts e saída não zero em falha, sem imprimir a URL/credenciais. Fixtures de concorrência precisam ser visíveis entre conexões: são exclusivas da execução, persistidas para o ensaio e limpas em `finally`. Isso não autoriza executar o gate sobre um banco pessoal só porque usa a mesma porta.

Antes do gate, confirme posse/isolamento do projeto e volumes, aplicação de `0001–0045` e seed. Banco restaurado de backup não é evidência de instalação limpa. Ensaie também instalação limpa e upgrade `0041→0042→0043→0044→0045`, sem apagar um alvo preexistente para fazê-lo parecer novo. Os [tipos](banco-de-dados/documentacao-bd.md#tipos-locais-da-revisão-de-curso) devem corresponder ao esquema ensaiado, sem restaurar definições remotas legadas à mão.

A configuração versionada usa `project_id = "athen-issue47"` para a pilha local descartável. Essa identidade é intencional: preserva os volumes do projeto `codigo-base` usado anteriormente e evita direcionar a jornada real a esse banco preexistente. Confirme os containers `supabase_*_athen-issue47`, a API em `127.0.0.1:55321` e o PostgreSQL em `127.0.0.1:55322` antes de executar os ensaios. Nomes diferentes isolam volumes, mas não portas; os dois projetos não podem estar ativos simultaneamente nas mesmas `553xx`. Nunca use reset ou remoção de volumes para resolver essa disputa de portas. A alteração é local ao CLI, sem aplicar migrações em um projeto remoto vinculado.

Critérios a evidenciar na versão final:

- **SQL/ACL:** elegibilidade por conclusões próprias de todas as aulas atuais; quotas `ceil(20% por módulo)`, sem teto global e com módulo vazio contribuindo zero; snapshots e respostas fixas; início idempotente por UUID; dados/RPCs alheios negados como anon/A/B, sem testar só como owner; grants efetivos de perfil, notificações e helpers.
- **Calendário/entrega:** uma agenda global, primeiro vencimento em sete dias, apenas a janela corrente, um curso escolhido uma vez por ocorrência; ausência de candidatos e recuperação dentro do prazo; rollout com data histórica nula, marco novo sem renovação; opt-out e falha de entrega sem bloquear bônus, nem ressorteio/reenvio por leitura/exclusão.
- **Resultado/prêmio:** amostra inteira, comparação exata de 70%, reprovação congelada seguida de nova intenção, um evento/+10 global por ocorrência; aprovações concorrentes com `awarded` e `already_awarded`; replay após prazo; saldo aditivo, rollback integral e ausência dos efeitos de aula/missões/temporadas.
- **Corridas reais:** tick×tick, mesmo request×mesmo request, respostas distintas×fechamento, aprovações simultâneas, primeiras conclusões e outra fonte de XP. Incluir conclusão de aula vazia com missão premiada × revisão bonificada para demonstrar a ordem corrigida em `0044`, além de aula com questões/upsert.
- **Componente/E2E simulado:** quatro tipos no mesmo `LessonModal`; intro não cria sessão; prática normal distinta do bônus; `pedido`/`sessao` na URL, reload/retry sem novo sorteio; reprovação→nova sessão→aprovação, resposta atrasada/troca de curso/sala, `already_awarded`, erro versus vazio e preservação de preferências. Cartão inferior direito com histórico isolado por usuário/curso, CTA único e bônus separado; ausência de cartão/abertura em salas. Fixtures HTTP não devem reproduzir o algoritmo SQL para “validá-lo”.
- **Jornada local real:** Auth/PostgREST/SQL, prática zero XP, aviso e bônus sem aviso no Dashboard, reprovação/retake/pagamento/reload e recusa de outra conta. Apenas a conexão privilegiada do ensaio ajusta a âncora de fixture; credencial de autoridade não vai ao navegador.
- **Acessibilidade/visual:** entrada/contenção/devolução de foco, Tab/Shift+Tab/Esc, clique interno/fundo, estados ocupados/erro/retry e capturas em **390×844 e 1440×900**, com rolagem, contraste e redução de movimento.

Regressões adicionais: [layout do cartão](../codigo-base/tests/e2e/dashboard-review-layout.spec.ts) compara a geometria da trilha/carrossel com e sem o modificador do cartão e verifica ausência de scroll desktop/sobreposição. [Limpeza de notificações](../codigo-base/tests/e2e/notifications-cleanup.spec.ts) cobre remoção individual/lidas, persistência, falha/retry e aviso novo preservado. O harness SQL verifica períodos sobrepostos e exclusão própria/alheia sem alterar prêmio ou reenviar; a jornada real de aviso reproduz duas simulações, remoção individual, limpeza em lote e histórico após excluir.

**Verificação local em 2026-11-16:** contrato revisão 4, diff 9 sobre `3d22c6a`, branch `issue/47-revisao-esporadica`. Lint, tipos, 32 testes Vitest, tipos dos testes, build, 94 E2E simulados, `test:db` (issues 42 e 47) e quatro jornadas reais passaram com exit 0. Os ensaios incluem corridas reais, bloco de rollout extraído da migração versionada, opt-out, falha de aviso, prêmio único, rollback e acesso por outra conta. A regressão autenticada comprova que conclusões exclusivamente de sala não autorizam revisão normal/bonificada. O cron local registrou 13 execuções `succeeded`; isso não comprova operação no destino remoto. A instalação limpa e a aplicação incremental até 0044 foram registradas na etapa anterior; nesta correção foi aplicada incrementalmente a 0045, sem reset. Evidências e revisões independentes estão no [registro de verificação](testes-issue-47.md). CI, Preview, migração remota, revisão humana e deploy não foram executados ou aprovados por esses resultados.

Execute pipeline, gate SQL e jornadas em série conforme a coordenação: `build`/E2E/live compartilham `dist/`; SQL/live compartilham o banco. Não rode dois ensaios concorrentes sobre o mesmo alvo. Ao acrescentar testes de revisão, confira as fixtures do Dashboard/Notificações/Configurações que agora recebem RPCs adicionais.

## Material SQL legado

`npm run test:db:legacy` preserva o menu antigo de `supabase/testes/` para consulta histórica. Ele usa tabelas antigas, resolve SQL pelo diretório atual, persiste mudanças e não propaga todas as falhas corretamente. **Não é gate do esquema atual nem integra a CI.** Seu detalhamento e limitações estão no [mapa](mapa-dos-testes.md).

## Automação

O GitHub Actions executa, em eventos elegíveis:

1. `quality`: lint, tipos, Vitest, tipos dos testes e build.
2. Após `quality`, `e2e`: os casos simulados descobertos pelo Playwright.
3. Também após `quality`, `integration`: Supabase descartável, harness SQL e jornada real; encerra a pilha mesmo em falha.

Os gatilhos e artefatos estão no [workflow](../.github/workflows/ci.yml). A integração de `test:issue47` em `test:db` não comprova sucesso do job; aprovação remota depende da execução do workflow.

A Vercel tem apenas [rewrite de rotas versionado](../codigo-base/vercel.json), sem comando de testes declarado. Configuração de Preview/build no painel não foi inspecionada. Um build de hospedagem não equivale à execução das suítes.

## Mudanças exclusivamente documentais

Confira links e caminhos locais, comandos contra o manifesto e afirmações contra as fontes. Relate separadamente leitura, descoberta de testes e execução das asserções. Não execute novamente todo o pipeline apenas para alterar texto sem efeito no código.
