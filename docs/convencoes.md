# Convenções de desenvolvimento

Regras de Git e nomenclatura do projeto. A validação técnica fica em [Testes](testes.md); o processo de colaboração com agentes fica em [Fluxo de trabalho com IA](fluxo-de-trabalho-ia.md).

## Commits

Use Conventional Commits com descrição curta em português:

```text
<tipo>: <descricao>
```

| Tipo | Uso |
| --- | --- |
| `feat` | Funcionalidade nova |
| `fix` | Correção de comportamento |
| `docs` | Documentação |
| `style` | Formatação sem mudança de comportamento |
| `refactor` | Reorganização sem funcionalidade nova ou correção |
| `test` | Testes |
| `chore` | Configuração, build e manutenção |

Exemplos: `feat: adiciona filtro de cursos`, `fix: corrige progresso da trilha`, `docs: atualiza arquitetura`.

## Branches e revisão

- `main`: entrega final/produção; recebe `develop` após validação no Preview e entrega final.
- `develop`: consolidação das sprints.
- `sprint#`: base do trabalho da sprint, criada a partir de `develop`.
- `issue/123-descricao-curta`: trabalho de um escopo; o número identifica a história no YouTrack.

Antes de alterar código, identifique a issue no board, sua atribuição e o estado Em andamento. Crie a branch de trabalho a partir da sprint atualizada. Confira qual é a sprint pertinente à tarefa; exemplos e relatórios de sprints passadas não a determinam.

Sequência para uma árvore de trabalho adequada à troca de branch, substituindo `sprintNN` e a issue pelos valores reais:

```bash
git switch sprintNN
git pull --ff-only
git switch -c issue/123-descricao-curta
```

Confirme o estado local antes dessa sequência e preserve o trabalho existente. A base de uma branch de issue é a sprint, não `develop`. Faça commits pequenos e mantenha um escopo por branch. Commits diretos em `main`, `develop` e `sprint#` ficam fora do fluxo de desenvolvimento.

Antes de enviar código, execute as [validações locais](testes.md). Para mudanças visuais, registre evidência da interface. Abra o PR contra a sprint correspondente; ele exige pelo menos uma aprovação de outra pessoa. O autor não aprova o próprio PR. Após revisão e validação, siga o processo de integração da equipe.

## Nomes e regras de código

| Arquivo ou diretório | Padrão |
| --- | --- |
| `.tsx` e `.jsx` | PascalCase, como `HomePage.tsx` |
| CSS associado a uma tela | Mesmo nome-base, como `HomePage.css` |
| Demais arquivos e pastas novos | kebab-case, sem espaços, acentos ou cedilha |
| Entradas convencionais de documentação e ferramentas | Preserve nomes esperados, como `README.md`, `AGENTS.md`, `CLAUDE.md`, `KIRO.md` e `GLOSSARY.md` |

Use nomes descritivos e concisos. Os caminhos antigos que não seguem o padrão devem ser tratados com atenção às referências; não renomeie arquivos apenas para padronizar em uma tarefa sem esse escopo.

Use `console.warn` e `console.error` para os registros permitidos. Argumentos não usados devem receber prefixo `_`; remova variáveis sem função. Mantenha a tipagem e evite `any` desnecessário.

A [configuração ESLint](../codigo-base/eslint.config.js) é a fonte do que está automatizado: ela verifica nomes de `.tsx`/`.jsx` e pastas sob `src`, e algumas regras são avisos. Nem todas as convenções deste guia são verificadas automaticamente. Tipos de banco são gerados, conforme a [referência de banco](banco-de-dados/documentacao-bd.md).

## Conflitos de merge

Identifique os arquivos com conflito pelo Git, leia as duas intenções e resolva o conteúdo preservando o comportamento esperado. Remova os marcadores de conflito e revise o diff antes de continuar a operação. Execute novamente as verificações afetadas pela resolução.
