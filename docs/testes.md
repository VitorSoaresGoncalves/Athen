# Testes e validações

## Correções visuais de responsividade — 24/11/2026

**Gate de publicação do PR:** após os commits de código `ca3c5b0`, `50a1551` e `cdb113a`, passaram novamente lint, typecheck, 52 Vitest, test:check, build e os 160 E2E Chromium (zero falhas, skips ou retries). Essa rodada inclui o alinhamento desktop final de 40px. Evidências visuais versionadas: [Dashboard mobile 390×844](evidencias-responsividade/dashboard-mobile-390.png), [Dashboard desktop 1440×900](evidencias-responsividade/dashboard-desktop-1440.png) e [revisão em paisagem 568×320](evidencias-responsividade/revisao-paisagem-568.png). São capturas de Chromium com dados HTTP simulados, não de dispositivos físicos ou de banco real.

**Alinhamento desktop posterior:** seletor e notebook passam a compartilhar recuo esquerdo de 40px após a sidebar, ponto médio dos 16px e 64px anteriores. Posições verticais e mobile preservados. Build com tipos, test:check e os 19 E2E de `dashboard.spec.ts`/`visual-corrections.spec.ts` passaram. Esta rodada focal é posterior à suíte completa de 160 casos abaixo; o JSON do runner guarda a execução mais recente.

**Ajuste desktop posterior:** sidebar/reserva ampliadas para 260px, com links/perfil acompanhando a largura e notificação mantendo o recuo direito; notebook de 84px restaurado ao canto inferior esquerdo acima de 760px (64px após a sidebar e 1,5rem da base). Até 760px permanece abaixo do seletor. Build com tipos, lint, 52 Vitest, test:check e os 160 E2E Chromium passaram novamente, sem falhas ou retries. Os testes conferem o espaço entre marca/notificação e a borda direita em 768/1023/1024/1025/1440px, além da posição do notebook nas fronteiras 760/761px e em 1024/1440px. Captura de 1440px inspecionada; alterações ainda locais nessa rodada.

Avatar mobile da sidebar: passaram Vitest (52) e E2E Chromium (160). Os testes de `SidebarLeft.test.tsx`, `responsive-shell.spec.ts`, `dashboard.spec.ts` e `visual-corrections.spec.ts` acompanham o avatar visível com a navegação recolhida e a nova ordem de Tab. A suíte não cobre Firefox, WebKit nem aparelhos reais.

Na branch `issue/53-responsividade`, passaram lint, typecheck, **52 testes Vitest**, test:check, build e **160 E2E Chromium** na execução final. O build conserva o aviso de bundle acima de 500 kB. A suíte usa HTTP simulado; SQL/live, dispositivos físicos, teclado virtual e outros navegadores não foram executados nesta alteração.

O preview foi iniciado separadamente em `127.0.0.1:4173`, com build apontando para o endpoint fictício das fixtures. O runner usou a configuração local `.scratch/issue-53/visual-playwright.config.ts`, derivada da configuração versionada, mantendo os testes/projeto Chromium e retirando apenas a inicialização automática do servidor. Isso contornou o encerramento do webServer que ficou pendente no Windows nas primeiras execuções. Resultado final: `.scratch/issue-53/visual-results.json`, **160 aprovados, zero falhas**, exit 0. O servidor temporário foi encerrado após os ensaios.

`visual-corrections.spec.ts` verifica ausência de scroll vertical, notebook abaixo do seletor no mobile e alinhado a 40px após a sidebar no desktop, TopDown à direita sem interceptação de cliques, cards iguais, notificações junto ao toggle e categorias de Ligas sem feedback de interação. Também verifica que matrícula com progresso 100% não substitui conclusões próprias para mostrar Revisar; após a conclusão, o botão abre o cartão e indica bônus ativo, sem iniciar sessão por simples abertura. As suítes de revisão preservam casos de erro, histórico, troca de curso, expiração, foco, recibos e ausência de revisão em salas.

Foram inspecionadas capturas do Dashboard em 320/390/1440px e paisagem 568×320, além do cartão em 390×844 e 568×320. `dashboard-review-layout.spec.ts` exige a ação inteira dentro do diálogo, corpo rolável em altura curta, retorno de foco e geometria da trilha/carrossel preservada ao abrir/fechar. As capturas finais ficam em `codigo-base/test-results/`. Evidências anteriores neste documento pertencem aos respectivos snapshots.

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

O pipeline SQL `test:db` também encerra com `npm run test:read-models`: o runner em [testes-leituras](../codigo-base/supabase/testes-leituras/run-harness.ts) executa o harness da issue 56 e o catálogo da 0047, em série e com rollback. Recusa alvo diferente de `127.0.0.1:55322/postgres`; exige o banco local descartável com `0001–0047`. Não imprime credenciais. Esse gate também participa do job de integração que já chama `test:db`.

As fixtures HTTP incluem `catalog_course_feed` com DTOs controlados, sem recalcular o algoritmo SQL. O E2E do catálogo usa o painel de filtros atual e confere retorno de foco por Escape; o da landing verifica “Ver todos” até `/catalogo` autenticado. A nova descrição do ranking distingue notas publicadas sem corte temporal e matrículas dos últimos sete dias.

A [configuração principal](../codigo-base/playwright.config.ts) inicia seu próprio build/preview em `127.0.0.1:4173`, com URL/chave Supabase fictícias. Não reutiliza servidor existente: libere a porta antes de executar. Usa dois workers, Chromium, pt-BR e fuso de Brasília.

As novas suítes usam [fixtures HTTP](../codigo-base/tests/e2e/support/platform.ts) independentes por teste, sem reproduzir algoritmos SQL. Dashboard e ligas mantêm seus cenários controlados específicos. O fluxo padrão simulado está em [study-journey.spec.ts](../codigo-base/tests/e2e/study-journey.spec.ts).

Para a casca responsiva e o recorte da página Salas da issue 53 r2, `responsive-shell.spec.ts` verifica disclosure/foco nas 12 rotas em 320/360/390px, ativação dos destinos e histórico back/forward, Shift+Tab, falhas/perfil lento, breakpoint e reserva entre 759/760/761/1023/1024/1025px nos consumidores Dashboard/Catálogo/Salas/Ligas; compara requisições mutadoras ao abrir/recolher navegação/conta. `salas-responsive.spec.ts` verifica vazio/carregando/erro/busca, matriz vazia/adicionar, conteúdo de 80 caracteres sem espaços, entrada válida/inválida, criação positiva com curso/PAC e detalhe educador com respostas fixas das RPCs 0046; respostas HTTP simuladas não comprovam SQL/RLS. `dashboard.spec.ts` mantém a regressão S1 em altura curta desktop e navegação em 568×320, e verifica overlays SidebarRight/notebook abertos no desktop sem deslocar âncoras ou casca. Esses cenários cobrem o contrato cliente deste recorte; não homologam os miolos explicitamente fora do escopo nem os defeitos móveis conhecidos de notebook/SidebarRight.

**Validação local issue 53 r2 em 2026-11-23:** branch `issue/53-responsividade`, contrato r2, implementação r2-dev2 mais diff de tester (hash reproduzível e manifesto em `.scratch/issue-53/fingerprint-r2.json`). Lint, typecheck, 41 testes Vitest, tipos dos testes, build e 125 E2E Chromium passaram; três suítes afetadas passaram focalmente (39 casos: 12 responsividade da casca, 11 Salas, 16 Dashboard). A inspeção com zoom nativo confirmou orientação 844×390 e 100/200/400%, com viewport efetiva de 640/320 CSS px; a 200%, viewport 760,5px comprovada com as media queries fracionárias e breakpoint do produto desktop. **Correção da evidência visual:** os `salas-zoom-*.png` antigos usam raster de tamanho CSS (por exemplo, 320×201 em 400%) e permanecem preservados, mas não são screenshots físicos da viewport. Os novos `salas-zoom-*-physical-viewport.png` usam CDP `Page.captureScreenshot` com superfície, capturam o viewport físico completo (1280×804; 1521×804 na largura 760,5 CSS px) e os JSON pareados confirmam a relação pixels CSS×DPR. Complemento T1: a zoom nativo real de 200/400%, Tab alcançou Ver perfil/Configuração/Sair com rolagem, Escape devolveu foco conta→navegação; em Salas, formulário e seleções sobreviveram ao erro de código, e entrada/criação foram operadas por click real sem `force`, com sucesso HTTP simulado e payload registrado. Em 400% a viewport é 320×201 CSS px; os CTAs foram alcançados por rolagem vertical normal, sem exigir que estivessem na primeira dobra. Capturas físicas e JSON de ações estão em `.scratch/issue-53/evidence-zoom-actions/`; fixtures HTTP não provam SQL/RLS. Os cliques coordenados anteriores no toggle/logo/notificações também estão medidos em `evidence-zoom-capture-investigation/diagnostic.json`. Logs, capturas e limites, inclusive `test:db` já executado no banco local descartável e sem acesso remoto, estão no registro `.scratch/issue-53/testes-r2.md`. A revisão independente encerrou S1/T2/T3 e fingerprint; a nova evidência T1 ainda não recebeu revisão própria. Não se afirma homologação dos miolos explicitamente fora do escopo, notebook/SidebarRight móvel ou produto integral.

```bash
npm run test:e2e -- tests/e2e/platform-pages.spec.ts
npm run test:e2e -- --list
```

Falhas guardam screenshot/trace em `test-results/`; o relatório padrão fica em `playwright-report/`. Capturas de sucesso dos testes antigos não são comparação automática com baseline visual. `--list` apenas descobre casos, sem executar asserções.

## Issue 53 r3 — execução local e limites

Em 2026-11-23, contrato r3, implementação `r3-dev1`, branch `issue/53-responsividade`, base `1b371689ba81b20fc9c4aa34b808fa5dbb3ab976`: o pipeline final passou em lint, typecheck, **52 Vitest**, test:check, build e **146 E2E Chromium**. Os três casos novos do seletor passaram focalmente, e o arquivo `dashboard-responsive.spec.ts` completo passou 10/10 após sua última edição. O gate anterior de 143 casos e os 24 focais eram de outro snapshot e não foram usados para validar os três novos casos. A fixture do primeiro curso longo foi corrigida com módulo/aula próprios; o cenário 503 aguarda as retentativas sem retirar a verificação de erro. Produto e evidências T1/T2 não mudaram. Comandos, bytes do teste e logs finais: `.scratch/issue-53/gate-r3-final.md`; rastreabilidade geral: `testes-r3.md`. O manifesto `fingerprint-r3-final.json` identifica separadamente 16 arquivos executáveis, cinco documentos técnicos e o conjunto dos 21 caminhos atribuídos ao incremento; exclui alterações preexistentes exclusivas de r2, cache da CLI e artefatos locais. Identificar bytes não substitui comprovar sua execução. O manifesto do tester é separado e não representa o produto inteiro.

**Zoom nativo (T1): PASSOU** a 200% e 400%, com extensão MV3/`chrome.tabs.setZoom`, viewport efetiva 640×402/DPR2 e 320×201/DPR4. Foram operados notebook aberto/editado antes do zoom, ajustes geométricos, salvar, primeira/última página, erro de gravação com rascunho preservado e cancelamento; seletor vazio/erro/lista longa, curso/sala, SidebarRight, trilha, carrossel e CTA/intro individual sem iniciar revisão. Os 32 pares PNG/JSON finais usam captura física CDP 1280×804, não raster CSS recortado, em `.scratch/issue-53/evidence-zoom-actions-r3/`; nota `zoom-r3-final.md`. O pré-voo antigo tinha uma colisão de IDs na fixture: o curso alternativo duplicava o ID do inicial em 200%. A unicidade foi corrigida e verificada no roteiro; não foi demonstrado defeito de `src` por aquele pré-voo. Tentativas incompletas ficam preservadas como diagnóstico, não aprovação.

**Matriz/gestos (T2): PASSOU** em 11 cenários, com 24 pares PNG/JSON: Dashboard 320/768 nos contextos individual/sala/sem curso; SidebarRight longo com último conteúdo alcançável, Tab livre/Escape; arraste/resize reais, cancelamento confiável e resize da viewport interrompendo o gesto sem perder rascunho; roda compacta, Ctrl+wheel e extremos desktop liberados. Nota `t2-r3-final.md`, artefatos em `.scratch/issue-53/evidence-t2-r3/`. O reviewer encerrou T1/T2/T3/T4/T5 e a sugestão N1: recorte técnico aprovado localmente, sem bloqueadores abertos em Spec ou Normas.

Esses ensaios validam o cliente no recorte notebook/Dashboard, não a issue inteira. Fixtures HTTP não comprovam SQL/RLS/XP; SQL/live não são gates deste incremento sem alteração de persistência/autorização. Firefox/WebKit, dispositivos físicos e teclado virtual, CI, deploy e revisão humana/PR não foram executados. Os registros `.scratch/` são locais e não acompanham clones.

## Issue 53 r4 — Criar Curso

Em 2026-11-23, a implementação r4-dev1 passou no gate local da revisão 4. Os quatro casos novos verificam os editores em 320/390/768/1440px, resize/paisagem/sidebar sem escrita, operações de adicionar/remover, validação e falha HTTP preservando dados, e submissão dos quatro formatos com payload. O caso existente de criação como rascunho e o redirecionamento de visitante em `/criar-curso` também passaram sem alteração. O foco foi esta rota; não implica homologação de outras páginas, SQL/RLS, Firefox/WebKit ou dispositivos físicos.

Os quatro casos novos e a regressão existente passaram focalmente (5/5). Pipeline serial: lint, typecheck, **52 Vitest**, test:check, build e **150 E2E Chromium**, todos exit 0. Capturas de 320px, erro de dependência em 320px e 1440px foram inspecionadas. Comandos, hashes, logs e evidências locais: `.scratch/issue-53/testes-r4.md`.

## Issue 53 r5 — Caderno

Em 2026-11-24, na branch `issue/53-responsividade`, contrato r5 e implementação estável `r5-dev1`, foram acrescentados quatro cenários em `/caderno`: estante vazia/preenchida em 320/390/768/1440px e busca sem resultado; editor em resize/paisagem/sidebar sem escritas; busca/edição/salvamento com payload preservado, página final e “Nova página” operadas por teclado; proteção de rascunho e erro HTTP mantendo o conteúdo. A regressão existente de criação/salvamento/proteção também passou; total focal 5/5.

Pipeline serial executado em `codigo-base/`, todos exit 0: lint, typecheck, **52 Vitest**, test:check, build e **154 E2E Chromium** (16 arquivos). Capturas da estante e editor em 320/1440px, mais erro de salvamento em 320px, foram inspecionadas. Hash/bytes do novo teste, comandos, logs e PNGs estão em `.scratch/issue-53/testes-r5.md` e `.scratch/issue-53/evidence-r5/`. HTTP simulado não comprova SQL/RLS; não houve alteração de persistência/autorização, portanto testes de banco e jornada live não se aplicam. Firefox/WebKit, dispositivos físicos, CI, deploy e revisão humana/PR não foram executados.

## Issue 53 r6 — Perfil e demais páginas, sem CRUD

Em 2026-11-24, na mesma branch/base, o recorte agregado inclui Perfil, Amigos, Missões/detalhe, Notificações, Configurações, Catálogo, Ligas e detalhes aluno/educador de Salas. Três cenários compactos em `remaining-pages-responsive.spec.ts` cobrem as entradas em 320/1440px, painéis, resize de Mural/Configurações, erro de Perfil e cancelamento de exclusão, reaproveitando as regressões funcionais existentes.

Lint, typecheck, **52 Vitest**, test:check e build passaram; o E2E inicial encontrou setas móveis ocultas no Catálogo. Corrigido somente o CSS, foram repetidos build e E2E: **157/157 Chromium passaram**. Os demais gates permanecem válidos, sem repetição desnecessária. Capturas selecionadas foram inspecionadas, incluindo setas em 320/390px; detalhes, hashes finais, logs e falhas históricas estão em `.scratch/issue-53/testes-r6.md`. Comportamentos compartilhados de foco/Tab/Escape/fundo do Modal reutilizam a cobertura existente.

CRUD foi explicitamente excluído. Este é um gate local selecionado, não uma homologação integrada final: a conferência manual opcional do usuário não foi realizada. Sem nova campanha de zoom real/hardware/Firefox/WebKit, SQL/RLS/live, CI, deploy ou aprovação humana de PR. HTTP simulado não comprova autorização nem persistência real.

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

`test:db` executa **`test:issue42 && test:issue47 && test:read-models`**, em série e interrompendo em falha. O [runner da issue 42](../codigo-base/supabase/testes-issue-42/run-harness.ts) executa `harness.sql`, `live-standings.sql`, `missions.sql` e `review-fixes.sql`. Habilita asserções PL/pgSQL, limita conexão/query e reverte os ensaios. O quarto script recebe a transação pelo runner. Há limpeza temporária de tabelas em alguns ensaios: rollback não elimina bloqueios/interferência durante a execução; mantenha o alvo isolado.

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

O job `integration` fornece `SUPABASE_DB_URL` da pilha descartável local tanto ao harness SQL quanto às jornadas reais de revisão, que também precisam preparar e conferir fixtures PostgreSQL.

A Vercel tem apenas [rewrite de rotas versionado](../codigo-base/vercel.json), sem comando de testes declarado. Configuração de Preview/build no painel não foi inspecionada. Um build de hospedagem não equivale à execução das suítes.

## Mudanças exclusivamente documentais

Confira links e caminhos locais, comandos contra o manifesto e afirmações contra as fontes. Relate separadamente leitura, descoberta de testes e execução das asserções. Não execute novamente todo o pipeline apenas para alterar texto sem efeito no código.
