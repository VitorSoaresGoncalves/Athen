# Testes e validações

Referência atual da branch `test/updates`. Execute os comandos em `codigo-base/`. O [mapa detalhado dos testes](mapa-dos-testes.md) explica cada suíte, sua utilidade, as páginas cobertas, diagramas e limites. As fontes executáveis são [package.json](../codigo-base/package.json) e [ci.yml](../.github/workflows/ci.yml).

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
| `test:run` | 26 testes Vitest de configuração de questões, prazos/contextos de missões e Modal real |
| `test:check` | Tipos de `src`, `tests`, Vitest e configurações Playwright |
| `build` | TypeScript e assets de produção Vite |
| `test:e2e` | 70 cenários Chromium, com HTTP simulado e cobertura das 16 rotas ativas |

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

`test:db` agora chama `test:issue42`: [run-harness.ts](../codigo-base/supabase/testes-issue-42/run-harness.ts) executa `harness.sql`, `live-standings.sql`, `missions.sql` e `review-fixes.sql`. Habilita asserções PL/pgSQL, limita conexão/query, interrompe a sequência em falha e reverte os ensaios. O quarto script recebe a transação pelo runner. Há limpeza temporária de tabelas em alguns ensaios: rollback não elimina bloqueios/interferência durante a execução; mantenha o alvo isolado.

A [jornada real](../codigo-base/tests/live/local-study.spec.ts) usa [configuração própria](../codigo-base/playwright.live.config.ts), preview em 4175 e URL/chave da pilha **local**, obtidas sem imprimir segredos por `supabase status -o json`. Recusa API não loopback. Cadastra uma conta aleatória, faz login, matricula-se no curso do seed, responde uma aula, verifica XP/progresso após reload, lê missões e sai. Não usa interceptação HTTP ou sessão fictícia. Não gera traces de credenciais; mantém screenshots de falha. Sem backend local, falha explicitamente na preparação.

Cada execução real deixa sua conta e atividade no banco descartável para diagnóstico, preservando dados preexistentes. Os testes SQL e a jornada real devem rodar sequencialmente. As suítes real e simulada também devem rodar sequencialmente, pois ambas escrevem `dist/`. A jornada não exige `SUPABASE_DB_URL`; usa Auth/PostgREST reais.

O [plano da issue 42](testes-issue-42.md) traz ensaios adicionais. Fixtures/checagens de upgrade ainda exigem migração entre etapas, na mesma transação revertida. Entrega real do alerta e operação do cron não são comprovadas pelos testes de interface.

## Material SQL legado

`npm run test:db:legacy` preserva o menu antigo de `supabase/testes/` para consulta histórica. Ele usa tabelas antigas, resolve SQL pelo diretório atual, persiste mudanças e não propaga todas as falhas corretamente. **Não é gate do esquema atual nem integra a CI.** Seu detalhamento e limitações estão no [mapa](mapa-dos-testes.md).

## Automação

O GitHub Actions executa, em eventos elegíveis:

1. `quality`: lint, tipos, Vitest, tipos dos testes e build.
2. Após `quality`, `e2e`: os 70 casos simulados.
3. Também após `quality`, `integration`: Supabase descartável, harness SQL e jornada real; encerra a pilha mesmo em falha.

Os gatilhos e artefatos estão no [workflow](../.github/workflows/ci.yml). As novas etapas foram ensaiadas localmente; aprovação remota depende da execução do workflow.

A Vercel tem apenas [rewrite de rotas versionado](../codigo-base/vercel.json), sem comando de testes declarado. Configuração de Preview/build no painel não foi inspecionada. Um build de hospedagem não equivale à execução das suítes.

## Mudanças exclusivamente documentais

Confira links e caminhos locais, comandos contra o manifesto e afirmações contra as fontes. Relate separadamente leitura, descoberta de testes e execução das asserções. Não execute novamente todo o pipeline apenas para alterar texto sem efeito no código.
