# Time de agentes no OpenCode

Protocolo operacional para o time configurado em [opencode.json](../../opencode.json) e [.opencode/agents/](../../.opencode/agents/). Complementa o [fluxo de trabalho com IA](../fluxo-de-trabalho-ia.md); as referências de Git, testes, domínio e estilo continuam responsáveis por suas regras.

## Preparação e uso

Configuração escrita para OpenCode **2.3.0 / V2**. V1 usa outros campos de configuração e permissões; não copie os perfis para V1 sem adaptação e validação.

1. Inicie `opencode` na raiz do repositório. Em `/connect`, escolha OpenAI e o login ChatGPT para usar a franquia do plano; uma API key usa a cobrança do provedor. Confira os modelos disponíveis em `/models`.
2. Confira o carregamento com `opencode debug agents --standalone` e as fontes com `opencode debug config --standalone`. Esses diagnósticos não executam uma tarefa de IA.
3. Use `/deliver <issue ou caminho da spec> [objetivo/restrições]`. Exemplo: `/deliver .scratch/catalogo/issues/01-filtro.md implementar os critérios da spec`. O exemplo pressupõe que esses arquivos existem; use os caminhos reais.
4. Para retomar, informe a mesma feature e consulte seu `handoff.md`. Em uma sessão já aberta, confirme o modelo selecionado: selecionar o agente primário não necessariamente troca o modelo guardado na sessão.

Os modelos configurados são a fonte de verdade nos frontmatters dos perfis. Sol atende coordenação, contratos, implementação e revisão; Luna atende testes focados e explicação. Para SQL, concorrência ou diagnóstico difícil, o orchestrator pode pedir uma nova sessão do tester com Sol, se o cliente permitir o override. Se não permitir, ajuste o modelo do perfil antes de retomar. Escalone para Astra somente quando a dificuldade justificar o consumo e o catálogo conectado oferecer o modelo.

O login ChatGPT consome a franquia compartilhada do plano. A disponibilidade do catálogo não comprova saldo ou acesso a uma execução. Alternativas públicas gratuitas são opcionais: confira `/models` e a política de dados do provedor antes de mudar o `model` do tester ou educator. Faça a troca explicitamente; não use fallback automático para um provedor pago. Credenciais ficam fora do repositório. Não é necessário instalar modelos locais, plugins ou um pacote npm neste projeto para descobrir estes perfis.

Para experimentar os gratuitos discutidos, os IDs encontrados no catálogo local durante a preparação foram `opencode/glm-5.3-flash-free` (tester em tarefas simples) e `opencode/deepseek-v4.1-flash-free` (educator). São candidatos para avaliação, não uma garantia permanente de acesso ou qualidade. Mantenha Sol nas verificações complexas e compare retrabalho e aderência ao contrato antes de adotar uma troca.

## Papéis e acionamento

| Perfil | Entrega | Quando acionar |
| --- | --- | --- |
| [orchestrator](../../.opencode/agents/orchestrator.md) | Escopo, atribuições, registros e evidências consolidadas | Toda entrega do time |
| [architect](../../.opencode/agents/architect.md) | Contrato verificável em `spec.md` | Comportamento novo, interfaces compartilhadas, banco ou ambiguidade técnica |
| [developer](../../.opencode/agents/developer.md) | Implementação e referência técnica atualizada | Alterações de produto/documentação atribuídas |
| [tester](../../.opencode/agents/tester.md) | Testes pertinentes e resultados reproduzíveis | Verificação da entrega, proporcional ao escopo |
| [reviewer](../../.opencode/agents/reviewer.md) | Achados independentes por impacto | Após estabilizar a implementação e antes de declarar entrega validada |
| [educator](../../.opencode/agents/educator.md) | Registro didático da alteração final | Ao consolidar a entrega de uma issue ou solicitação |

O reviewer é um sexto perfil pequeno para viabilizar a revisão independente do `/deliver`. Ele trabalha em sessão nova, sem editar. Uma alteração localizada de texto pode dispensar architect e testes novos; continua exigindo conferência, revisão e registro didático breve. Mudanças em permissões, XP, RPCs ou migrações exigem análise do SQL e verificação em banco local descartável.

## Contexto por feature

O [tracker local](issue-tracker.md) define o diretório e a spec. O time acrescenta dois registros à mesma feature, sem criar um backlog global concorrente com o YouTrack:

| Arquivo | Responsável | Conteúdo |
| --- | --- | --- |
| `.scratch/<feature-slug>/spec.md` | Architect; orchestrator em tarefa simples | Objetivo, critérios, revisão do contrato, interfaces, invariantes e arquivos previstos |
| `.scratch/<feature-slug>/issues/<NN>-<slug>.md` | Fluxo de tickets já existente | Ticket individual, dependências e estado, quando houver decomposição |
| `.scratch/<feature-slug>/tasks.md` | Orchestrator | Etapas, responsáveis, arquivos atribuídos, pendências, achados e evidências |
| `.scratch/<feature-slug>/handoff.md` | Orchestrator | Ponto de retomada, base Git, versão do trabalho, decisões e próximo passo |

Inicialize os registros pelos templates de [spec](templates/spec.md), [tasks](templates/tasks.md) e [handoff](templates/handoff.md), substituindo os campos de exemplo. Reaproveite uma spec existente; acrescente apenas informações ausentes. Esses templates são referência e não instruções carregadas em toda sessão. Os nomes minúsculos adaptam `TASKS.md` e `HANDOFF.md` do comando original à convenção do projeto e isolam as features.

Registre a issue real quando informada. Para solicitação direta sem número, use um slug descritivo e marque “solicitação direta, sem issue informada”; isso não satisfaz por si só os requisitos do board para alterar código. Peça somente o identificador ou acesso indispensável ao fluxo, sem inventar números, atribuições ou estados no YouTrack.

Mantenha decisões atuais no contrato e evidências em `tasks.md`; o handoff aponta para elas. Resumos didáticos são históricos e não substituem esses registros nem as referências técnicas atuais. Preserve o conteúdo de outras tarefas ao retomar uma feature compartilhada.

## Delegação e consumo de contexto

Cada delegação inclui: objetivo, referência da issue/spec e sua revisão, base/estado Git, arquivos permitidos, critérios atribuídos, dependências, verificações esperadas e local das evidências. Prefira caminhos e trechos selecionados a transcrições completas. Um resumo inicial de 200–400 palavras costuma bastar; a precisão do contrato tem prioridade sobre esse alvo.

Cada especialista lê `AGENTS.md`, o contrato e as referências pertinentes ao assunto. Descubra skills por descrição e carregue apenas as aplicáveis. Se uma skill exigir delegação além da permissão do perfil, devolva a necessidade ao orchestrator; ele coordena as sessões necessárias ou registra a limitação, sem apresentar a execução parcial como cumprimento integral da skill.

O retorno tem: resultado, caminhos alterados/consultados, decisões, verificações com resultado, pendências e próximo passo. Logs extensos ficam em artefatos locais sem segredos; o retorno contém o trecho que explica a falha. Se a saída de uma ferramenta for truncada, leia o artefato relevante antes de concluir.

Use no máximo dois especialistas simultaneamente e um único escritor por arquivo. A lista atribuída à etapa é menor ou igual à permissão estática do perfil. Após mudar a revisão do contrato, avise os consumidores afetados antes de continuar. Preserve a sessão do developer nos ciclos de correção; use sessão nova para revisão independente. Não delegue recursivamente a partir dos especialistas.

No Athen, `repositories.ts`, `Hub.tsx` e as migrações são pontos compartilhados: atribua um dono antes de editar. Serialize `build`, E2E simulado e jornada real, pois escrevem em `dist/`; serialize também ensaios sobre o mesmo banco. Testes focados durante a implementação não substituem o pipeline final exigido por [Testes](../testes.md).

A compactação automática mantém a sessão utilizável, mas pode perder detalhes. Antes de encerrar uma etapa ou trocar de modelo, atualize o handoff com revisão, decisões e próximo passo. Meça consumo por issue concluída, retrabalho e bloqueadores; não use quantidade de agentes como indicador de produtividade.

## Permissões e limites

[opencode.json](../../opencode.json) contém regras comuns; os frontmatters restringem escrita e delegação por perfil. O orchestrator escreve nos registros, o architect na spec, o developer no produto e documentação técnica, o tester nos testes e o educator no aprendizado. Reviewer não escreve. Alterações nas instruções do time ou em arquivos fora dessas áreas exigem atribuição explícita e ajuste pontual das permissões antes da delegação; restaure o limite após a tarefa.

Comandos Git de inspeção previstos são liberados. Outros comandos de shell e integrações pedem aprovação; os comandos de teste conhecidos são liberados nos perfis que os executam. Aprovar instalação, diagnóstico ou preparação do ambiente não amplia os arquivos atribuídos nem autoriza publicação. Se uma aprovação for necessária, apresente a ação concreta e sua razão.

As regras de shell e as policies bloqueiam as formas usuais de `git push`. `/deliver` proíbe push, deploy e publicação, e não autoriza commit, merge nem PR. Uma solicitação posterior explícita deve ser executada em fluxo próprio, com as permissões adequadas e as [convenções](../convencoes.md). A exceção de branch de uma tarefa não se estende às seguintes.

Esses perfis organizam o trabalho; não são um sandbox do sistema operacional. Comandos autorizados, scripts npm e integrações podem ter efeitos além das ferramentas de edição, e outros ajustes locais/globais podem alterar permissões. Confira comandos e scripts antes de aprová-los. A lista de arquivos do contrato é uma restrição operacional, não uma allowlist técnica gerada automaticamente por issue.

## Evidências e conclusão

Para cada critério, associe evidência à versão atual do trabalho: comando/diretório, código de saída, resultado, data e caminho do artefato quando existir. Para alterações ainda sem commit, use commit-base mais revisão do contrato e uma revisão do diff mantida em `tasks.md`; incremente-a a cada correção. Invalide evidências afetadas e repita as verificações necessárias quando o diff mudar. Identifique mudanças staged, unstaged e arquivos novos.

| Estado da entrega | Critério |
| --- | --- |
| Em andamento | Há trabalho executável ou verificações em curso |
| Parcial | Há resultado útil, mas falta critério, validação aplicável ou correção |
| Bloqueada | Falta requisito/acesso/dependência indispensável; registrar condição de retomada |
| Validada localmente | Critérios atendidos, validações aplicáveis concluídas, bloqueadores resolvidos, revisão independente da versão final e registros atualizados |

Registre verificações como PASSOU, FALHOU, NÃO EXECUTADO ou NÃO APLICÁVEL. Justifique as duas últimas; indisponibilidade de ambiente não transforma uma verificação aplicável em não aplicável. Revisão humana, PR, CI, Preview e deploy são estados separados: validação local não comprova entrega remota. Registre o uso de IA conforme o fluxo do projeto quando um PR for solicitado.

O educator segue o [guia de aprendizado](../aprendizado/issues/README.md). Se faltar validação, seu registro permanece identificado como parcial. Em documentação/configuração do time, valide caminhos, sintaxe, descoberta no OpenCode e coerência das permissões; isso não comprova comportamento de agentes em uma execução real com modelos.

## Referências externas

Sintaxe e funcionamento conferidos na documentação oficial em 2026-11-16 e no CLI local 2.3.0. Consulte as fontes ao atualizar o OpenCode:

- [Configuração](https://opencode.ai/docs/config/) e [agentes](https://opencode.ai/docs/agents/).
- [Comandos](https://opencode.ai/docs/commands/) e [permissões](https://opencode.ai/docs/permissions/).
- [Provedores](https://opencode.ai/docs/providers/), [skills](https://opencode.ai/docs/skills/) e [compactação](https://opencode.ai/docs/compaction/).
- [Catálogo público e opções gratuitas](https://opencode.ai/docs/console/models/) e [modelos OpenAI](https://learn.chatgpt.com/docs/models).
