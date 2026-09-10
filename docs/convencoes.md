# Guia de Convenções: Git e Fluxo de Trabalho

Este documento estabelece o padrão de uso do Git ao longo do projeto, as convenções de commits, a estratégia de versionamento e as regras de nomenclatura para o nosso projeto de desenvolvimento de software.

## 1. Cheat Sheet (Comandos Mais Comuns)

Aqui estão os comandos mais utilizados no dia a dia e o que cada um faz:

*   **`git clone <url>`**: Clona (baixa) um repositório remoto para a sua máquina local.
*   **`git status`**: Mostra o estado atual do repositório, quais arquivos foram modificados e quais estão prontos para o commit.
*   **`git add <arquivo>`**: Adiciona um arquivo modificado (ou todos, usando `git add .`) à área de preparação (staging area), deixando-o pronto para o commit.
*   **`git commit -m "mensagem"`**: Salva as alterações que estão na área de preparação no histórico local, com uma mensagem descritiva.
*   **`git push`**: Envia os seus commits locais para o repositório remoto.
*   **`git pull`**: Busca e mescla as alterações mais recentes do repositório remoto para a sua branch local.
*   **`git branch`**: Lista todas as branches locais. Para criar uma nova, use `git branch <nome-da-branch>`.
*   **`git checkout <nome-da-branch>`** (ou **`git switch <nome-da-branch>`**): Alterna de uma branch para outra. Para criar e já mudar para a nova branch, use `git checkout -b <nome-da-branch>`.
*   **`git merge <nome-da-branch>`**: Mescla o histórico da branch especificada na branch em que você está atualmente.

## 2. Convenções de Commit

Para manter o histórico legível e organizado, utilizaremos o padrão **Conventional Commits**. Cada commit deve deixar claro qual foi a intenção da mudança.

**Estrutura do commit:**
`<tipo>: <descrição curta e em português>`

**Tipos permitidos:**
*   **`feat`**: Uma nova funcionalidade (feature).
*   **`fix`**: Correção de um bug/erro.
*   **`docs`**: Alterações apenas na documentação (ex: README).
*   **`style`**: Alterações de formatação que não afetam o significado do código (espaços, ponto e vírgula, etc).
*   **`refactor`**: Uma mudança de código que nem corrige um bug nem adiciona uma feature (ex: renomear variáveis, melhorar a lógica).
*   **`test`**: Adição ou correção de testes automatizados.
*   **`chore`**: Atualizações de tarefas de build, configuração de pacotes, etc.

**Exemplos de commits:**
*   `feat: adiciona tela de login para usuários`
*   `fix: corrige cálculo de desconto no carrinho de compras`
*   `docs: atualiza instruções de instalação no README`
*   `refactor: simplifica a função de validação de email`
*   `chore: atualiza dependências do package.json`

## 3. Estratégia de Branches (Fluxo de Trabalho)

Nosso fluxo de trabalho será estruturado da seguinte forma para garantir que o código principal esteja sempre protegido e funcional:

### Branch `main` (Principal)
*   É a branch oficial do projeto.
*   **Regra de Ouro:** A branch `sprint#` **só será mergeada na `main` no final do projeto** (entrega final).
*   Nenhum desenvolvedor deve commitar diretamente nesta branch.

### Branch `sprint#` (Desenvolvimento)
*   É a branch base do nosso dia a dia, criada a partir da `main`.
*   Ela contém o código mais recente com todas as novas funcionalidades integradas pela equipe durante a sprint "#" (01, 02, etc).
*   As novas features devem ser criadas a partir desta branch.

### Branches de Funcionalidade (`feature/*` ou `fix/*`)
*   Sempre que você for trabalhar em uma nova tarefa, funcionalidade ou correção, você deve criar uma nova branch **a partir da `sprint#`**.
    *   *Exemplo:* `git checkout -b feature/tela-de-login` ou `git checkout -b fix/erro-carrinho`.
*   **Processo de Merge (Pull Request):** 
    1. Você desenvolve a tarefa na sua branch de funcionalidade.
    2. Após terminar, você faz o *push* da sua branch e abre um **Pull Request (PR)**.
    3. A branch de funcionalidade **só será mesclada após os outros membros da equipe revisarem o PR e confirmarem que tudo está funcionando corretamente**.
    4. Uma vez aprovada, a branch de funcionalidade é mesclada de volta na `sprint#` (para garantir que a `main` continue intacta até o final do projeto, conforme as regras estabelecidas).

### Resumo do Fluxo Passo a Passo:
1. `git checkout sprint#` (garante que está na base correta)
2. `git pull` (atualiza com o que a equipe já fez)
3. `git checkout -b feature/minha-tarefa` (cria sua branch)
4. Trabalha no código... `git add .` e `git commit -m "feat: descrição"`
5. `git push origin feature/minha-tarefa`
6. Abre o Pull Request para revisão da equipe.
7. Após aprovado, o merge é feito e o ciclo recomeça.

## 4. Nomenclatura de Arquivos e Pastas

Para mantermos a padronização e evitarmos problemas de compatibilidade entre diferentes sistemas operacionais e ferramentas, adotaremos as seguintes regras rigorosas para nomear qualquer arquivo ou diretório no projeto:

*   **Tudo em minúsculo:** Letras maiúsculas não devem ser utilizadas.
*   **Hífen (`-`) como separador:** Nunca utilize espaços em branco, *underscores* (`_`) ou *camelCase* para nomes de arquivos e pastas. Use sempre o hífen para separar palavras.
    *   *Certo:* `minha-nova-pasta`, `estilo-principal.css`, `script-de-validacao.js`
    *   *Errado:* `MinhaNovaPasta`, `estilo_principal.css`, `script de validacao.js`
*   **Sem caracteres especiais ou acentuação:** Não utilize til, cedilha ou acentos (á, é, ã, ç, etc.).
    *   *Certo:* `relatorio-mensal.html`, `funcoes-calculo.py`
    *   *Errado:* `relatório-mensal.html`, `funções-cálculo.py`
*   **Seja descritivo e conciso:** Dê nomes que deixem claro o que o arquivo ou pasta contém, mas evite nomes longos demais.