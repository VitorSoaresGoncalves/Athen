---
description: Entrega uma tarefa com implementação, testes, revisão independente e registro didático, sem push.
agent: orchestrator
subagent: false
---

Execute a entrega da tarefa:

$ARGUMENTS

1. Leia `AGENTS.md` e `docs/agents/time-opencode.md`. Localize a issue/spec indicada e o diretório `.scratch/<feature-slug>/`; consulte `spec.md`, `tasks.md` e `handoff.md` existentes. Se faltarem, inicialize somente os necessários pelos templates do protocolo, preservando o conteúdo anterior. Com objetivo claro, escolha um slug e prossiga mesmo sem número de issue. Pergunte somente se faltar uma definição indispensável do resultado esperado.
2. Confira o estado local, a base Git, os critérios de aceitação e as dependências. Siga o fluxo de branches e revisão de `docs/convencoes.md`, salvo exceção explícita do usuário nesta tarefa. Registre as informações da issue quando fornecidas; o YouTrack é manual e independente, sem exigir acesso, atribuição ou estado para executar a solicitação. Registre alterações preexistentes e separe-as da entrega.
3. Defina o contrato proporcional ao risco. Acione o architect para mudanças de comportamento, interfaces compartilhadas ou SQL; para mudanças simples, registre o contrato mínimo e a razão de dispensar essa etapa. Resolva escolhas técnicas reversíveis autonomamente. Atribua arquivos e dependências inicialmente e permita ampliá-los dentro do mesmo objetivo, coordenando um único escritor por arquivo.
4. Prepare o ambiente necessário conforme o protocolo: confira ferramentas e serviços, instale dependências declaradas e inicie Docker Desktop/Supabase local, preview ou navegador de teste quando os critérios exigirem. Confirme a prontidão antes de testar. Delegue a implementação ao developer e faça diretamente ajustes pequenos/de infraestrutura quando isso evitar transferências desnecessárias. Solicite ao tester cenários positivos e negativos pertinentes e verificações focadas; após estabilizar o diff, execute a validação de entrega exigida por `docs/testes.md`. Serialize builds e ensaios que compartilham artefatos ou banco.
5. Solicite ao reviewer uma revisão independente em sessão nova, com requisito original, contrato, base e diff completo, incluindo arquivos novos. Registre achados por impacto e evidência.
6. Encaminhe bloqueadores ao responsável, confirme as correções com o tester e solicite revisão das partes alteradas. Atualize o contrato antes de aceitar uma mudança de escopo. Investigue e tente resolver falhas recuperáveis de ambiente antes de pedir intervenção humana; registre impedimentos persistentes e requisitos ausentes como pendências concretas, sem convertê-los em aprovação.
7. Solicite ao educator o registro didático do resultado final em `docs/aprendizado/issues/`. Atualize `tasks.md` e `handoff.md` da feature com estado real, comandos/resultados, revisão e próximo passo. Se houver impedimento, deixe o registro didático parcial claramente identificado.
8. Apresente arquivos e comportamento alterados, critérios atendidos, evidências, limites e pendências. Use os critérios de conclusão do protocolo para distinguir entrega validada, parcial e bloqueada. Informe separadamente que revisão humana e entrega remota ainda dependem do fluxo do projeto.

Não realize `git push`, publicação ou deploy. Este comando não autoriza commit, merge nem abertura de PR; execute essas ações apenas se o usuário as solicitar explicitamente. Não declare sucesso sem as validações aplicáveis concluídas e sem bloqueadores resolvidos.
