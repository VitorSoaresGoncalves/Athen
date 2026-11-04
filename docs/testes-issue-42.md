# Suíte de testes — Issue 42 (missões, ligas/temporadas e PAC)

Plano de testes do que foi entregue na issue 42 (migrações `0023`–`0037` e a UI de ligas/missões). Complementa o [guia geral de testes](testes.md): aqui o foco é o comportamento novo de servidor (XP, missões, temporadas, alerta) e as telas que o consomem.

> **Natureza das verificações.** A maior parte das regras vive no SQL (server-authoritative). Portanto, a validação primária é por **ensaio em Postgres real** (local via Docker ou o projeto de ensaio `Athen-Teste`), não por cliques na UI. O pipeline de frontend cobre compilação/tipos; não valida RLS, XP nem a aplicação das migrações.

## 1. Ambiente e pré-condições

| Item | Como |
| --- | --- |
| Banco com todas as migrações | `supabase db reset` (local) aplica `0001`–`0037` + `seed.sql`. No ensaio remoto, as migrações já estão aplicadas via `db push`. |
| Extensões de operação | `pg_cron` e `pg_net` habilitados (Dashboard → Database → Extensions). Local já vem com ambas; no remoto foram habilitadas manualmente. |
| Secret do webhook | `season_alert_webhook` no Supabase Vault (só para o teste de entrega do alerta — seção 6). |
| Seed base | `supabase/seed.sql` (contas, cursos, salas). Senha das contas: `test123!`. |
| Seed do cenário | `supabase/testes-issue-42/seed_teste.sql` (ver seção 3). |

Contas usadas (do seed base): `...0002` Ana e `...0003` Bruno (educadores), `...0004` Carla, `...0005` Diego, `...0006` Elisa, `...0007` Felipe (estudantes); `...0001` AdminDev (admin).

## 2. O que a issue 42 entregou (mapa de cobertura)

| Área | Migração(ões) | Regras-chave |
| --- | --- | --- |
| Ledger de XP | 0023 | `xp_events` por evento; `finalize_attempt` grava sem alterar saldos; `user_xp_in_window` (Q102) |
| XP proporcional ao acerto | 0035 | 1º acerto = `round(base/N)`; acerto após 1º = 0 (anti-regrind) (Q112/Q093) |
| Catálogo de missões | 0024 | definições/ocorrências/atribuições globais e de curso (Q136) |
| Avanço + bônus de missão | 0025 | progresso recalculado; bônus uma vez; não pontua temporada (Q019/Q092/Q102) |
| Leitura de missões | 0031 | `my_missions`/`my_mission_detail`; materialização do período (Q020/Q072/Q073) |
| Unicidade de ocorrência global | 0032 | índice com `coalesce(course_id, nil)` (correção) |
| Temporadas (estrutura) | 0026 | `seasons`/`season_groups`/`season_entries`; categorias; congelamento (Q101/Q104) |
| Formação de grupos | 0027 | afinidade social por BFS (Q123/Q124) |
| Abertura/fechamento | 0028 | elegibilidade 7 dias, cortes 20%, queda de zeros/piso Bronze (Q138/Q143) |
| Leitura de temporada + cobertura PAC | 0029 | `current_season`/`my_season_*`; `course_coverage`/`friends_course_pac_v2` (Q066/Q069/Q111) |
| Conta × temporada | 0030 | desativação oculta identidade, preserva linha (Q070) |
| Agendador | 0033 | `tick_seasons` via `pg_cron` a cada 5 min (Q109/Q134) |
| Observabilidade | 0034 | `season_ops_log`; `seasons_needing_attention` (Q087/Q134) |
| Alerta de atraso | 0036/0037 | registra `alert` e entrega ao webhook via `pg_net`+Vault (Q134/Q078) |
| UI | — | `/ligas` por temporada; `/missoes` lista/detalhe; TopDown; navegação |

## 3. Seed do cenário de teste

`supabase/testes-issue-42/seed_teste.sql` é determinístico e idempotente. Ele:

- Executa `finalize_attempt` de verdade para gerar **XP proporcional** (Carla erra a101 e acerta depois → 2 XP; Diego acerta a201 de primeira → 6 XP) e os `xp_events` correspondentes.
- Cria três temporadas:
  - **2a — corrente aberta**: grupo de Prata com XP variado (inclui um zero) para as leituras da UI.
  - **2b — vencida com XP real na janela**: pronta para `close_season` consolidar e aplicar cortes (grupo pequeno: positivo conserva Prata; zero cai para Bronze).
  - **2c — vencida há 45 min, não fechada**: condição de alerta de atraso.
- Marca conclusões na janela de elegibilidade para a **abertura automática** inscrever três alunos.

Aplicar (local):
```bash
docker exec -i supabase_db_<proj> psql -U postgres -d postgres -f codigo-base/supabase/testes-issue-42/seed_teste.sql
```
Aplicar (ensaio remoto): cole o conteúdo no SQL Editor do projeto, ou use o runner/CLI com a connection string de ensaio. **Não rodar em produção.**

> **Codificação (UTF-8).** Os seeds contêm acentos e emojis (ícones de módulo). Ao aplicar por pipe no PowerShell, force UTF-8 antes (`chcp 65001`; `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`; `Get-Content ... -Encoding UTF8`), senão os caracteres multibyte são gravados como `?` no banco. O SQL Editor do Supabase e `psql -f` preservam UTF-8 naturalmente. O `seed.sql` já define `search_path = public, extensions` para achar `gen_salt`/`crypt` do pgcrypto no ambiente hospedado.

## 4. Casos de teste de servidor (SQL)

Cada caso traz a verificação e o resultado esperado. Rodar após o seed do cenário. As consultas abaixo assumem o papel `postgres`/admin; onde a regra depende de `auth.uid()`, use um bloco de transação com `set local request.jwt.claims = '{"sub":"<uuid>"}'`.

### T1 — XP proporcional ao número da tentativa (0035 / Q112/Q093)
- **T1.1** Erro na 1ª execução e acerto na 2ª → crédito `round(base/2)`.
  ```sql
  select xp_earned, correct_count from public.attempts
   where user_id='...0004' and lesson_id='...a101' order by started_at;
  -- esperado: linha 1 xp=0 correct=0; linha 2 xp=2 correct=1
  ```
- **T1.2** Acerto de primeira → XP cheio (Diego em a201, base 6 → 6).
- **T1.3** Novo acerto após o 1º acerto → 0 XP (anti-regrind). Rode outra tentativa correta da mesma questão e confira `xp_earned=0`.

### T2 — Ledger de XP (0023 / Q102)
- **T2.1** `finalize_attempt` gravou um `xp_events` por tentação finalizada, com `origin='learning_base'`.
  ```sql
  select origin, context, count(*) from public.xp_events group by 1,2;
  ```
- **T2.2** `user_xp_in_window(início, fim)` soma só `learning_base/course` na janela (não inclui bônus/sala). Verifique para a Carla na semana corrente.
- **T2.3** Reexecutar `finalize_attempt` do mesmo attempt **não** duplica evento nem XP (idempotência por `idempotency_key`).

### T3 — Missões globais e de curso (0024/0025/0031/0032)
- **T3.1** `my_missions()` (como um usuário) lista exatamente as missões globais do período + diárias de curso materializadas; sem duplicatas.
  ```sql
  begin; set local request.jwt.claims='{"sub":"...0004"}';
  select scope, code, target, reward_xp from public.my_missions(); commit;
  -- esperado: 3 global_daily + 2 global_weekly (+ course_daily se houver atividade individual)
  ```
- **T3.2** Concluir a meta de uma missão concede o bônus **uma vez**: após `finalize_attempt` que cumpre a meta, `mission_assignments.granted=true` e há um `xp_events origin='mission_bonus'`; repetir não concede de novo.
- **T3.3** O bônus de missão **não** entra em `user_xp_in_window` (não pontua a temporada — Q102).
- **T3.4** `my_mission_detail(occurrence)` retorna os campos do detalhe (critério, meta, prazo, recompensa).
- **T3.5** Unicidade global (0032): materializar a mesma global duas vezes não cria ocorrência duplicada.

### T4 — Temporadas: abertura e formação (0026/0027/0028)
- **T4.1** `open_season(now())` inscreve apenas contas ativas com conclusão na janela `[início da semana anterior, virada)` (Q138); categoria inicial Bronze na 1ª participação (Q139).
- **T4.2** A formação distribui por afinidade social (amigos no mesmo grupo); alvo 20/teto 30 (Q123/Q124). Com poucos elegíveis, um grupo só.
- **T4.3** Reexecutar `open_season` **não** reinscreve nem move quem já tem grupo (congelamento — Q104).

### T5 — Temporadas: fechamento, cortes e zeros (0028 / Q105/Q143)
- **T5.1** (cenário 2b) `close_season` consolida `season_xp` da fonte (`user_xp_in_window`), ignorando valores plantados. Positivo em grupo pequeno conserva a categoria; zero cai uma faixa com piso Bronze.
  ```sql
  -- após close_season da temporada 2b:
  -- Ana (120 XP) -> result_category 'silver'; Bruno (0) -> 'bronze'
  ```
- **T5.2** Grupo grande (≥10 positivos): os 20% do topo promovem, os 20% do fundo rebaixam, empates na fronteira tratados juntos; promoção tem precedência sobre rebaixamento. (Exige um grupo maior — montar fixture dedicada se quiser cobrir nominalmente.)
- **T5.3** `close_season` é idempotente: rodar de novo não refaz movimentos (retorna cedo se `closed`).

### T6 — Leitura de temporada e PAC (0029 / Q066/Q069/Q111)
- **T6.1** `my_season_group(season)` (como membro) retorna **só o próprio grupo**, ordenado por XP; `is_self` correto.
- **T6.2** Identidade: linha com `identity_hidden=true` vem com nome/avatar/banner nulos, mas mantém posição/XP (Q069/Q070). Para testar, rode `deactivate_account()` como um membro e releia.
- **T6.3** `course_coverage(user, course)` retorna cobertura separada do PAC; `friends_course_pac_v2(course)` traz `pac` e `coverage` lado a lado (Q111).
- **T6.4** Audiência (RLS): um usuário **não** consegue ler `season_entries` de um grupo que não é o dele.

### T7 — Conta × temporada (0030 / Q070)
- **T7.1** `deactivate_account()` marca `identity_hidden=true` nas entradas de temporadas abertas/em apuração, preservando `season_xp`/posição.
- **T7.2** Conta já desativada **não** é inscrita por `open_season` (filtro `account_status='active'`).

### T8 — Agendador e observabilidade (0033/0034)
- **T8.1** `tick_seasons()` abre a corrente, fecha as vencidas e registra a trilha (`tick_start`/`close_ok`/`tick_done`). Isola erro por temporada (uma falha não aborta a varredura).
- **T8.2** `pg_cron`: `select jobname, schedule, active from cron.job;` → `tick_seasons_every_5m`, `*/5 * * * *`, ativo.
- **T8.3** `seasons_needing_attention(30)` (como admin) lista as vencidas há mais de 30 min não fechadas; vazio para não-admin.

### T9 — Alerta de atraso (0036/0037 / Q134/Q078)
- **T9.1** (cenário 2c) `check_season_alerts(30)` registra um evento `alert` para a vencida; **deduplicado** (2ª chamada não repete).
- **T9.2** Entrega: com `pg_net` + secret, o POST ao webhook gera `alert_delivered`; sem `pg_net`/secret, gera `alert_delivery_error` **sem quebrar** o agendador (Q078). Ver seção 6.
- **T9.3** Temporada que fecha normalmente **não** gera alerta (`tick_done` com `alerts:0`).

## 5. Testes de interface (UI)

Executar com o app apontando para um banco com o seed do cenário. Validar em desktop e nas larguras 360/768/1440 (Q079), teclado e leitor de tela.

| ID | Tela | Verificação |
| --- | --- | --- |
| U1 | `/ligas` | Mostra a temporada corrente, a categoria do usuário, a classificação do **próprio grupo** e o XP da temporada. Estado "sem temporada ativa" quando não há corrente. |
| U2 | `/ligas` | Identidade oculta aparece como "Participante oculto" (sem avatar/nome), mas com posição/XP. |
| U3 | `/missoes` | Lista pendentes e concluídas, com rótulo de contexto (global diária/semanal, curso), meta, progresso, prazo e bônus. |
| U4 | `/missoes/:id` | Detalhe com critério, meta, prazo **com fuso** (BRT), recompensa e ação de abrir conteúdo; mensagem clara quando indisponível. |
| U5 | Navegação | "Missões" ao lado de "Ligas" na sidebar; rota funciona. |
| U6 | TopDown | Resumo com até 3 missões pendentes misturando globais/curso/sala, com rótulo de contexto, ordenadas por prazo. |

## 6. Teste de entrega do alerta (ponta a ponta, ambiente de ensaio)

Pré: `pg_net` habilitado e `season_alert_webhook` no Vault com a URL **limpa** (sem `< >`).

1. Garantir uma temporada vencida há >30 min não fechada (o cenário 2c já cria uma).
2. `select public.check_season_alerts(30);`
3. Aguardar alguns segundos (o `pg_net` é assíncrono) e conferir a trilha:
   ```sql
   select event from public.season_ops_log where event like 'alert%' order by created_at;
   -- esperado: 'alert' e 'alert_delivered'
   ```
4. Conferir visualmente que a mensagem chegou no canal do Discord.
5. Limpar o episódio de teste (remover os eventos `alert*` e a temporada de teste) para não bloquear o dedup.

> **Segurança:** nunca selecionar/ecoar o valor da URL do webhook; uma mensagem de erro do `pg_net` pode conter a URL. Se vazar, regenerar o webhook e atualizar o secret.

## 7. Automação

### Harness SQL automático (T1–T9)

Os casos de servidor estão automatizados em `codigo-base/supabase/testes-issue-42/harness.sql`, executado pelo runner `run-harness.ts` (ou pelo script npm). O harness:
- É **auto-verificável**: cada caso usa `assert`; a falha de qualquer asserção aborta com erro (o runner sai com código ≠ 0).
- É **isolado**: roda numa transação e dá `ROLLBACK` ao final — não persiste nenhum dado (tentativas, temporadas, eventos).
- É **independente do estado**: no início da transação zera as tabelas de temporada/missão/evento e as tentativas das contas de teste (tudo revertido no rollback), então pode ser reexecutado sem colidir com resíduos.

Rodar contra um banco de **ensaio** (nunca produção):
```bash
# a connection string aponta para o banco de ensaio (local ou Athen-Teste)
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres npm run test:issue42
```
Pré-requisitos no alvo: migrações `0001`–`0037` aplicadas e `supabase/seed.sql` carregado (fornece as contas/cursos). O runner recusa rodar contra a connection string do projeto de produção.

Saída de sucesso: `HARNESS ISSUE 42: OK`. Qualquer falha imprime a mensagem da asserção (ex.: `T5.1b: zero deveria cair para bronze...`) e sai com erro.

### E2E das telas (U1–U5)

Automatizados em `tests/e2e/ligas.spec.ts` e `tests/e2e/missoes.spec.ts`, no padrão do `dashboard.spec.ts`: build de produção com Supabase fake, auth via `localStorage` e as RPCs de temporada/missão (`current_season`, `my_season_summary`, `my_season_group`, `my_missions`, `my_mission_detail`) mockadas por `page.route`. Cobrem:
- **U1** temporada corrente, categoria e classificação do próprio grupo;
- **U2** identidade oculta (nome nulo, XP/posição preservados);
- **U3** lista de missões com contexto, meta, progresso e bônus;
- **U4** detalhe com critério, meta, prazo com fuso e recompensa; e estado indisponível;
- **U5** navegação com "Missões" ao lado de "Ligas".

Rodar: `npm run test:e2e` (toda a suíte) — requer Chromium (`npx playwright install chromium`).

### Pendente / complementar
- **U6 (TopDown)** com missões globais/curso: o resumo depende de curso ativo no dashboard; coberto parcialmente pelo `dashboard.spec.ts`. Um caso dedicado pode ser acrescentado.
- O harness cobre os casos determinísticos de servidor; os cenários nominais de corte em grupo grande (T5.2) e a entrega real do alerta ao webhook (seção 6, exige `pg_net`) continuam como verificação manual/ensaio.
- **Pipeline do projeto** (`lint`/`typecheck`/`test:run`/`test:check`/`build`): cobre compilação/tipos, complementa o harness e os E2E.

## 8. Critérios de aceite (resumo)

A issue 42 está validada quando, em ambiente de ensaio com o seed aplicado:
1. T1–T3 confirmam XP proporcional, ledger idempotente e missões (avanço/bônus único, sem pontuar temporada).
2. T4–T5 confirmam abertura por elegibilidade, formação por afinidade, e fechamento com cortes/queda de zeros e piso Bronze.
3. T6–T7 confirmam leitura por grupo, PAC com cobertura, ocultação de identidade e o ciclo de conta.
4. T8–T9 confirmam o agendador rodando, a observabilidade e o alerta (registro + entrega).
5. U1–U6 confirmam as telas contra o resultado do servidor.
