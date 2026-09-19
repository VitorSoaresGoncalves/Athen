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
*   `feat: adiciona nova fase`
*   `fix: preserva sala na reconexão`
*   `test: cobre respawn autoritativo`
*   `docs: simplifica instalação local`
*   `chore: atualiza dependências do package.json`

## 3. Estratégia de Branches (Fluxo de Trabalho)

Nosso fluxo de trabalho será estruturado da seguinte forma para garantir que o código principal esteja sempre protegido e funcional:

### Branch `main` (Principal)
*   É a branch oficial do projeto em produção.
*   **Regra de Ouro:** A branch `develop` **só será mergeada na `main` após validação no Preview e entrega final**.
*   Nenhum desenvolvedor deve commitar diretamente nesta branch.

### Branch `develop` (Desenvolvimento)
*   É o ponto de conexão das sprints, criada a partir da `main`.
*   Consolida o código gerado ao longo do desenvolvimento a uma distância segura da versão em deploy (`main`).
*   Cada nova `sprint#` deve ser criada a partir dessa branch.

### Branch `sprint#` (Bi-semanal)
*   É a branch base do nosso dia a dia, criada a partir da `develop`.
*   Ela contém o código mais recente com todas as novas funcionalidades integradas pela equipe durante a sprint "#" (01, 02, etc).
*   As novas features devem ser criadas a partir desta branch.

### Branches de Trabalho e Prefixos Oficiais
Antes de alterar qualquer código, escolha ou abra uma Issue no Board, atribua a você e mova o card para **Em andamento**. Toda branch de trabalho nasce da `sprint#` atualizada.

Estrutura padrão de uma branch nova:

*   **`issue/*`**: Funcionalidades (ex: `issue/123-nova-feature`)

onde o número `123` representa o número da issue no YouTrack.

### Processo de Pull Request
1. **Validação Local Pré-Envio:** Antes de enviar o código, execute na pasta do projeto as verificações locais para garantir a integridade (`lint`, checagem de tipos, testes unitários e build). Para mudanças visuais ou de gameplay, registre uma imagem ou vídeo.
2. **Abertura do PR:** Faça o *push* da sua branch e abra um **Pull Request (PR)** apontando para a `sprint#`.
4. **Regras de Revisão:** 
   * Mudanças comuns exigem pelo menos **uma aprovação**.
   * O autor **não** pode aprovar o próprio PR.

### Resumo do Fluxo Passo a Passo:
1. `git switch develop` e `git pull --ff-only origin develop` (garante que está na base correta)
2. `git switch -c issue/123-descricao-curta` (cria sua branch de trabalho)
3. Desenvolve a tarefa, valida localmente e faz commits pequenos e descritivos
4. `git push -u origin issue/123-descricao-curta`
5. Abre o Pull Request no GitHub para revisão da equipe e execução dos testes de CI/CD
6. Após aprovação e validação no Preview, o merge é realizado e a branch local/remota concluída é removida.

## 4. Nomenclatura de Arquivos e Pastas

Para mantermos a padronização e evitarmos problemas de compatibilidade entre diferentes sistemas operacionais e ferramentas, adotaremos as seguintes regras rigorosas para nomear arquivos e diretórios no projeto:

*   **Exceção para Componentes React (`.tsx` e `jsx`):** Arquivos dos tipos `.tsx` e `.jsx` devem obrigatoriamente utilizar o padrão **PascalCase** em seus nomes (ex: `MenuPrincipal.tsx`, `CardDeProduto.jsx`).
*   **Demais Arquivos e Pastas (Tudo em minúsculo):** Letras maiúsculas não devem ser utilizadas nos demais tipos de arquivo.
*   **Hífen (`-`) como separador:** Para arquivos gerais (como `.ts`, `.py`, assets, etc.) e pastas, nunca utilize espaços em branco, *underscores* (`_`) ou *camelCase*. Use sempre o hífen para separar palavras (*kebab-case*).
*   **Arquivos CSS:** Para arquivos css, mantenha o padrão usado no arquivo que o referencia.
    *   `HomePage.tsx` referencia `HomePage.css`

*   **Sem caracteres especiais ou acentuação:** Não utilize til, cedilha ou acentos (á, é, ã, ç, etc.) em nomes de arquivos ou pastas gerais.
    *   *Certo:* `relatorio-mensal.html`, `funcoes-calculo.py`
    *   *Errado:* `relatório-mensal.html`, `funções-cálculo.py`
*   **Seja descritivo e conciso:** Dê nomes que deixem claro o que o arquivo ou pasta contém, mas evite nomes longos demais.