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
| [orchestrator](../../.opencode/agents/orchestrator.md) | Escopo, atribuições, ambiente local, registros e evidências consolidadas | Toda entrega do time |
| [architect](../../.opencode/agents/architect.md) | Contrato verificável em `spec.md` | Comportamento novo, interfaces compartilhadas, banco ou ambiguidade técnica |
| [developer](../../.opencode/agents/developer.md) | Implementação e referência técnica atualizada | Alterações de produto/documentação atribuídas |
| [tester](../../.opencode/agents/tester.md) | Testes pertinentes e resultados reproduzíveis | Verificação da entrega, proporcional ao escopo |
| [reviewer](../../.opencode/agents/reviewer.md) | Achados independentes por impacto | Após estabilizar a implementação e antes de declarar entrega validada |
| [educator](../../.opencode/agents/educator.md) | Registro didático da alteração final | Ao consolidar a entrega de uma issue ou solicitação |

O reviewer é um sexto perfil pequeno para viabilizar a revisão independente do `/deliver`. Ele trabalha em sessão nova e preserva os arquivos revisados; pode registrar achados e reproduções isoladas em `.scratch/` e executar validações. Uma alteração localizada de texto pode dispensar architect e testes novos; continua exigindo conferência, revisão e registro didático breve. Mudanças em permissões, XP, RPCs ou migrações exigem análise do SQL e verificação em banco local descartável.

## Worktree principal e operações Git

Todos os agentes trabalham no checkout principal do repositório, na mesma branch da tarefa. Confirme o caminho com `git rev-parse --show-toplevel`. A worktree contém os arquivos do projeto; `.git/` contém metadados administrados pelos comandos Git e permanece protegido contra edição direta.

O orchestrator aplica as [convenções de branches](../convencoes.md#branches-e-revisão): parte de `develop` atualizada, cria ou retoma a branch de issue no checkout principal e prepara o PR contra `develop`. Exceções explícitas do usuário valem somente para a tarefa indicada. Antes de trocar de branch, integrar alterações ou preparar um commit, pause os escritores afetados, confira o estado Git e preserve o trabalho preexistente. Todos compartilham branch, índice e arquivos: mantenha um escritor por arquivo e selecione apenas os caminhos da entrega ao preparar o commit.

A criação de worktrees adicionais e branches por especialista fica fora deste fluxo. Ao aplicar skills, adapte etapas de worktrees paralelas e agentes de merge para unidades de trabalho na branch compartilhada, coordenadas pelo orchestrator. Preserve dependências entre tickets, testes e revisão independente. Uma sessão nova de revisão usa o mesmo checkout; registre a versão revisada e coordene qualquer escrita concorrente.

Especialistas podem inspecionar Git, mas requisitam ao orchestrator operações que alterem índice, branches, histórico ou remotos, incluindo staging, commits, push e integração. Também encaminham publicação e ações que excedam sua atribuição. Cada pedido informa objetivo, arquivos envolvidos, comando proposto e evidências disponíveis. O orchestrator verifica o escopo, executa com seus acessos e devolve resultado e nova referência Git; o especialista aguarda antes de usar esse resultado.

## Contexto por feature

O [tracker local](issue-tracker.md) define o diretório e a spec. O time acrescenta dois registros à mesma feature, sem criar um backlog global concorrente com o YouTrack:

| Arquivo | Responsável | Conteúdo |
| --- | --- | --- |
| `.scratch/<feature-slug>/spec.md` | Architect; orchestrator em tarefa simples | Objetivo, critérios, revisão do contrato, interfaces, invariantes e arquivos previstos |
| `.scratch/<feature-slug>/issues/<NN>-<slug>.md` | Fluxo de tickets já existente | Ticket individual, dependências e estado, quando houver decomposição |
| `.scratch/<feature-slug>/tasks.md` | Orchestrator | Etapas, responsáveis, arquivos atribuídos, pendências, achados e evidências |
| `.scratch/<feature-slug>/handoff.md` | Orchestrator | Ponto de retomada, base Git, versão do trabalho, decisões e próximo passo |

Inicialize os registros pelos templates de [spec](templates/spec.md), [tasks](templates/tasks.md) e [handoff](templates/handoff.md), substituindo os campos de exemplo. Reaproveite uma spec existente; acrescente apenas informações ausentes. Esses templates são referência e não instruções carregadas em toda sessão. Os nomes minúsculos adaptam `TASKS.md` e `HANDOFF.md` do comando original à convenção do projeto e isolam as features.

Registre a issue real e as informações fornecidas quando disponíveis. Para solicitação direta sem número, use um slug descritivo e marque “solicitação direta, sem issue informada”. O YouTrack é mantido manualmente pela equipe e independe da execução dos agentes: acesso, atribuição e estado no board não bloqueiam a solicitação. Siga as [convenções de branches e revisão](../convencoes.md#branches-e-revisão), sem inventar números, atribuições ou estados.

A pasta `.scratch/` é local e ignorada pelo Git: trocar de branch não troca esses registros, e clones novos não os recebem. Separe features por slug, confira base/branch e revisão ao retomar e registre o caminho do checkout principal. Mantenha decisões atuais no contrato e evidências em `tasks.md`; o handoff aponta para elas. Resumos didáticos são históricos e não substituem esses registros nem as referências técnicas atuais. Preserve o conteúdo de outras tarefas ao retomar uma feature compartilhada.

## Delegação e consumo de contexto

Cada delegação inclui: objetivo, referência da issue/spec e sua revisão, base/estado Git, arquivos permitidos, critérios atribuídos, dependências, verificações esperadas e local das evidências. Prefira caminhos e trechos selecionados a transcrições completas. Um resumo inicial de 200–400 palavras costuma bastar; a precisão do contrato tem prioridade sobre esse alvo.

Cada especialista lê `AGENTS.md`, o contrato e as referências pertinentes ao assunto. Descubra skills por descrição e carregue apenas as aplicáveis. Se uma skill exigir delegação além da permissão do perfil, devolva a necessidade ao orchestrator; ele coordena as sessões necessárias ou registra a limitação, sem apresentar a execução parcial como cumprimento integral da skill.

O retorno tem: resultado, caminhos alterados/consultados, decisões, verificações com resultado, pendências e próximo passo. Logs extensos ficam em artefatos locais sem segredos; o retorno contém o trecho que explica a falha. Se a saída de uma ferramenta for truncada, leia o artefato relevante antes de concluir.

Use no máximo dois especialistas simultaneamente e um único escritor por arquivo. A lista de arquivos é uma previsão inicial: cada responsável pode ampliá-la para concluir o mesmo objetivo, registrando a razão sem pedir autorização humana por caminho. Se outro agente já tiver a posse do arquivo, combine a transferência com o orchestrator antes de editar. Após mudar a revisão do contrato, avise os consumidores afetados antes de continuar. Preserve a sessão do developer nos ciclos de correção; use sessão nova para revisão independente. Não delegue recursivamente a partir dos especialistas.

No Athen, `repositories.ts`, `Hub.tsx` e as migrações são pontos compartilhados: atribua um dono antes de editar. Serialize `build`, E2E simulado e jornada real, pois escrevem em `dist/`; serialize também ensaios sobre o mesmo banco. Testes focados durante a implementação não substituem o pipeline final exigido por [Testes](../testes.md).

A compactação automática mantém a sessão utilizável, mas pode perder detalhes. Antes de encerrar uma etapa ou trocar de modelo, atualize o handoff com revisão, decisões e próximo passo. Meça consumo por issue concluída, retrabalho e bloqueadores; não use quantidade de agentes como indicador de produtividade.

## Autonomia e permissões

[opencode.json](../../opencode.json) libera leitura, edição, shell, pesquisa web e acesso a diretórios externos necessários à tarefa. Os perfis herdam essas permissões; o orchestrator também delega aos especialistas. O reviewer mantém a edição direta limitada a `.scratch/`, para preservar a independência da revisão, e pode executar diagnósticos e testes que não alterem os arquivos revisados. Ferramentas de integrações não identificadas pela configuração continuam sujeitas à permissão própria do cliente.

Os papéis definem responsabilidades, não barreiras fixas entre pastas. Architect pode investigar, prototipar e atualizar contratos/documentação; developer pode modificar qualquer arquivo necessário, incluindo testes, scripts, CI e configuração do time; tester pode preparar ferramentas e corrigir uma causa simples sem mudar o contrato, coordenando a posse do arquivo; educator pode manter guias, índices, READMEs e exemplos documentais relacionados. Orchestrator pode corrigir diretamente detalhes pequenos e preparar infraestrutura quando delegar apenas acrescentaria uma transferência. Toda alteração da entrega passa pelas verificações aplicáveis e revisão independente.

Resolva autonomamente escolhas técnicas reversíveis, localização de arquivos, slug, detalhes de implementação, preparação local e falhas recuperáveis. Registre premissas e decisões em vez de pedir confirmações repetidas. Consulte o usuário somente quando faltar uma decisão de produto relevante sem resposta nas fontes, uma credencial/login/interação humana indispensável, autorização para uma ação destrutiva não prevista ou uma ação externa fora do escopo. Um número de issue ausente não impede uma solicitação cujo objetivo já esteja claro.

O acesso por ferramenta a arquivos `.env` reais permanece protegido, e sua edição pede aprovação; `.env.example` pode ser mantido normalmente. Use a configuração existente no processo das ferramentas quando necessário, sem imprimir valores nem carregar segredos em prompts, logs ou evidências. Escrita direta em `.git/` permanece bloqueada: use os comandos Git adequados. Acesso amplo ao shell não autoriza descartar trabalho existente, remover volumes de outros projetos ou executar ensaios no banco remoto.

O orchestrator tem shell liberado pelo perfil, inclusive para commits, push e demais comandos disponíveis a um agente comum. As negativas globais das formas usuais de push permanecem para os especialistas; o perfil principal sobrescreve essas regras de shell. A centralização das demais operações Git é uma regra operacional dos perfis, não um bloqueio exaustivo do shell. Operações continuam sujeitas ao escopo da solicitação, às autenticações e às [convenções](../convencoes.md). Uma entrega solicitada permite ao orchestrator realizar os commits e o push da branch de trabalho necessários ao fluxo, sem exigir nova autorização por comando. Abertura de PR e integração seguem o fluxo do projeto, com aprovação humana antes do merge. Publicação e deploy exigem que façam parte do objetivo solicitado. Registre comandos, commits, branch/remoto e resultados em `tasks.md` e atualize `handoff.md`. A exceção de branch de uma tarefa não se estende às seguintes.

Esses perfis organizam o trabalho; não são um sandbox do sistema operacional. Comandos, scripts e integrações podem ter efeitos além das ferramentas de edição. As permissões do sistema, políticas gerenciadas e autenticações continuam valendo; a configuração não elimina UAC nem concede privilégios administrativos. Se houver um bloqueio técnico, tente primeiro uma alternativa dentro do escopo e só então peça a intervenção específica. Preserve políticas pessoais/globais e os limites do escopo ao resolver bloqueios.

## Preparação autônoma do ambiente

O orchestrator é responsável por disponibilizar ferramentas e serviços necessários aos critérios. Developer e tester podem preparar dependências da própria etapa; coordene operações compartilhadas pelo orchestrator para evitar inicializações concorrentes.

1. Inspecione o ambiente e os scripts existentes: executáveis, versões, dependências, portas e processos. Reutilize configuração e serviços saudáveis. Inicie somente o que os critérios exigirem; revisar documentação não exige abrir Docker Desktop.
2. Para testes com banco, confira se o contexto Docker aponta para a máquina local e use `docker info` para verificar o daemon. Se Docker Desktop estiver instalado e parado, execute `docker desktop start --timeout 60` quando o subcomando estiver disponível. No Windows, se precisar iniciar o aplicativo pelo executável, descubra o caminho instalado e use `Start-Process -FilePath <caminho-confirmado> -WindowStyle Hidden`. Não reinicie um daemon saudável.
3. Confirme a prontidão com `docker info` antes de iniciar o Supabase local conforme [Testes](../testes.md). Aguarde em intervalos curtos, com prazo e mensagens de progresso; se houver demora, examine status/logs sem segredos antes de tentar outra abordagem. Janela aberta ou processo iniciado não comprovam que o serviço está pronto.
4. Instale as dependências declaradas do projeto e o navegador de testes quando ausentes. Pode baixar imagens da pilha local e iniciar build, preview, servidor de desenvolvimento ou navegador de teste. Para conflito de porta, identifique o processo: encerre apenas processos criados pela tarefa ou serviços descartáveis cuja posse tenha sido confirmada. Evite encerrar aplicativos de outra atividade.
5. Registre serviços/processos iniciados e o alvo do banco em `tasks.md`/`handoff.md`. Ao concluir, encerre processos temporários da tarefa. Preserve serviços que já estavam ativos e dados/volumes preexistentes; deixe explícito o que permanece ativo para a próxima etapa.

Essas ações locais necessárias estão incluídas na execução da tarefa e não exigem aprovação humana a cada comando. Instalação de ferramentas de sistema com elevação, aceite de licença, login interativo ou alteração de configuração global pode exigir intervenção do usuário. Antes de pedir ajuda, confira as alternativas disponíveis; informe a ação concreta e o impedimento observado. Consulte a ajuda da versão instalada e a documentação oficial de [inicialização](https://docs.docker.com/reference/cli/docker/desktop/start/) e [status do Docker Desktop](https://docs.docker.com/reference/cli/docker/desktop/status/) ao preparar o ambiente.

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
