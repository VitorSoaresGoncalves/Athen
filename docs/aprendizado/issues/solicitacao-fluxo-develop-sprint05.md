# Fluxo Git desde a sprint05

- **Origem:** solicitação direta, sem issue própria informada.
- **Data:** 2026-11-16.
- **Estado:** final para o escopo documental, validado localmente; publicação remota executada em 2026-11-16; revisão humana, PR e CI ainda pendentes.
- **Base/revisão:** `develop`, commit `3d22c6a8e3b647ec4dec791d394cd46a5f183fa0`; diff documental 1, conforme [contrato revisão 2](../../../.scratch/fluxo-develop-sprint05/spec.md) e evidências em [tarefas](../../../.scratch/fluxo-develop-sprint05/tasks.md).

## Problema e solução

As orientações de branches e PRs ainda refletiam decisões de sprints anteriores, o que poderia levar alguém a iniciar trabalho ou abrir PR contra a branch errada. A solicitação definiu o fluxo a partir da sprint05: branches de issue saem de `develop` atualizada; PRs têm `develop` como destino; ao fim da sprint, `develop` integra `main`, mantendo revisão humana e validação. As branches `sprint#` continuam registradas como históricas, não como base para novos trabalhos.

O diff final atualizou seis documentos normativos ou de apoio, sem alterar produto: [Convenções](../../convencoes.md), [Fluxo de trabalho com IA](../../fluxo-de-trabalho-ia.md), [tracker local](../../agents/issue-tracker.md), [protocolo do time](../../agents/time-opencode.md), [comando `/deliver`](../../../.opencode/commands/deliver.md) e [respostas do guia](../../respostas-guia-desenvolvimento-missoes-ligas-e-pac.md). No documento de respostas, o texto antigo foi preservado como histórico e marcado como superado para novos trabalhos. A issue 47 permaneceu pausada e não foi implementada.

## Conceitos necessários

- **Base da branch** é o ponto de partida do trabalho. Desde a sprint05, a instrução concreta em [Convenções](../../convencoes.md) atualiza `develop` antes de criar a branch de issue.
- **Destino do PR** é a branch que receberá a proposta após revisão. O fluxo pede PR para `develop`; a integração posterior de `develop` em `main` ocorre no encerramento da sprint.
- **YouTrack manual e independente** significa que a equipe mantém o board, mas acesso, atribuição ou estado nele não bloqueiam a execução por agentes. Registre somente a identificação e os dados fornecidos; não invente issue ou estado.

## Caminho das instruções e verificação

O contrato direcionou a atualização das referências. A pessoa que usa `/deliver` encontra o procedimento no comando, que aponta para o protocolo e para as convenções; o [fluxo de trabalho com IA](../../fluxo-de-trabalho-ia.md) também remete às Convenções. Assim, a orientação operacional e a regra geral convergem, enquanto a referência de respostas distingue decisão histórica de regra atual.

Na versão final, o reviewer independente não encontrou achados. O tester passou os critérios positivos e negativos do fluxo, a verificação de 50 referências locais/âncoras (sem falhas), `git diff --check` e a busca por regras normativas conflitantes. Os resultados estão registrados em [tarefas](../../../.scratch/fluxo-develop-sprint05/tasks.md); não há log de teste persistido. A verificação de aplicação foi **não aplicável**, pois a mudança é exclusivamente documental.

Essas verificações estáticas não demonstram o comportamento de agentes em execuções reais. Também não substituem revisão humana, CI ou PR. O commit e o push solicitados foram executados em 2026-11-16, publicando `develop` no remoto; revisão humana, CI e PR permanecem pendentes. As alterações preexistentes no perfil do developer e em `docs/pendencias-ligas-missoes-sprint04.md` foram mantidas separadas desta entrega.

**Para explorar:** compare a regra em [Convenções](../../convencoes.md#branches-e-revisão) com a nota histórica em [Respostas](../../respostas-guia-desenvolvimento-missoes-ligas-e-pac.md). Identifique qual orienta o próximo trabalho e qual preserva o contexto passado.
