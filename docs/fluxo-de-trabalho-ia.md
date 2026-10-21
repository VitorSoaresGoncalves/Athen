# Fluxo de Trabalho com Agentes de IA

Este documento define o **padrão oficial de uso de agentes de IA** no projeto Athen. O objetivo é organizar o trabalho de seis pessoas que usam ferramentas de IA diferentes (principalmente **Manus**, **Kiro** e **Claude**), eliminando os problemas que surgem quando cada pessoa usa IA de um jeito próprio: estilos de código divergentes, commits fora do padrão, PRs gigantes e difíceis de revisar, retrabalho e conflitos de merge.

> Este documento complementa — e nunca substitui — o [Guia de Convenções](./convencoes.md), o [Guia de Estilos](./estilo-padrao.md) e a [documentação de Testes](./testes.md). Em caso de dúvida, essas convenções têm prioridade sobre qualquer sugestão de uma IA.

---

## 1. Princípios Gerais (valem para qualquer IA)

1. **A IA assiste, a pessoa decide.** Todo código gerado por IA é de responsabilidade de quem abriu o commit/PR. Você deve entender e conseguir explicar cada linha enviada.
2. **A IA segue as convenções do projeto, não o contrário.** Antes de pedir código, garanta que o agente conheça as regras do projeto (veja a seção 3 — Contexto Obrigatório).
3. **Nada entra sem validação local.** Nenhum código gerado por IA vai para um PR sem passar pelo pipeline local (`lint`, `typecheck`, `test:run`, `test:check`, `build`). O CI vai barrar, então valide antes.
4. **Mudanças pequenas e revisáveis.** Uma branch `issue/*` = um escopo. Não deixe a IA "resolver tudo de uma vez" em um PR de 40 arquivos.
5. **Sem segredos no prompt.** Nunca cole conteúdo de `.env`, chaves do Supabase, tokens ou credenciais em nenhum agente de IA.
6. **Transparência.** Se um trecho relevante foi gerado majoritariamente por IA, sinalize na descrição do PR (veja a seção 6).

---

## 2. Qual IA usar para quê

As três ferramentas têm forças diferentes. Use a certa para cada etapa para reduzir atrito e retrabalho.

| Ferramenta | Melhor uso no Athen | Evite usar para |
| --- | --- | --- |
| **Kiro** (dentro do editor, com acesso ao repositório) | Implementação de features dentro da base de código, edição multi-arquivo, refatorações, rodar lint/testes/build, seguir as convenções do repo, criar Specs (requisitos → design → tarefas) para features maiores. | Discussões longas e abertas sem relação com o código. |
| **Claude** (chat) | Raciocínio sobre arquitetura, revisão de trechos de código, explicação de erros, redação/revisão de documentação, gerar casos de teste, discutir trade-offs antes de implementar. | Aplicar mudanças direto no repositório (ele não tem acesso ao seu workspace — você copia e cola). |
| **Manus** (agente autônomo) | Tarefas exploratórias e de pesquisa, protótipos isolados, rascunhos iniciais de um componente ou página que depois são integrados manualmente. | Mexer direto na `sprint#` ou gerar PRs sem revisão humana rigorosa; integração final na base. |

**Regra prática:** o que **toca a base de código versionada** deve, de preferência, passar pelo **Kiro** (que aplica as convenções do repo e roda as validações). **Claude** entra no raciocínio e revisão. **Manus** entra na exploração e rascunhos, com integração sempre revisada por uma pessoa.

---

## 3. Contexto Obrigatório para a IA

Antes de pedir qualquer geração de código, o agente precisa conhecer o projeto. **Sempre forneça (ou garanta que o agente tenha acesso a):**

- **Stack:** React 19 + TypeScript 6 + Vite 8, Supabase/PostgreSQL, ESLint + TypeScript ESLint, Tailwind CSS 4, testes com Vitest + Testing Library e E2E com Playwright. (Ver [tecnologias-utilizadas.md](./tecnologias-utilizadas.md).)
- **Convenções de Git e nomenclatura:** [convencoes.md](./convencoes.md).
- **Identidade visual e UI:** [estilo-padrao.md](./estilo-padrao.md) — paleta, tipografia (Gabriela, Roboto, Google Sans), regras de contraste e acessibilidade.
- **A Issue/história de usuário** que está sendo trabalhada (número e descrição do YouTrack).

### 3.1 Kiro — use Steering
No Kiro, o contexto do projeto já é carregado automaticamente via **steering** (`.kiro/steering/*.md`). Mantenha esses arquivos atualizados para que o agente aplique as convenções sem você repetir em todo prompt. Para features maiores, prefira abrir uma **Spec** e revisar requisitos e design antes de gerar código.

### 3.2 Claude e Manus — use um prompt-base
Como essas ferramentas não têm acesso direto ao repositório, cole no início da conversa um **prompt-base padronizado**:

```text
Você está ajudando no projeto Athen (plataforma de estudo gamificada).
Stack: React 19 + TypeScript 6 + Vite 8, Supabase/PostgreSQL, Tailwind CSS 4.
Siga ESTAS regras obrigatoriamente:
- Componentes React em arquivos .tsx com nome em PascalCase.
- Demais arquivos e pastas em kebab-case, sem acentos/cedilha/espaços.
- Arquivo CSS segue o nome do .tsx que o referencia (HomePage.tsx -> HomePage.css).
- Sem console.log (apenas warn/error); variáveis não usadas devem começar com "_".
- Commits no padrão Conventional Commits, em português: "<tipo>: <descricao>".
- Paleta e tipografia conforme o guia de estilos (amarelo #FFCC00/#FFDE5C/#FFEB99,
  violeta #54318C/#A486D5; texto sobre fundo amarelo sempre em #54318C).
- Não invente dependências novas sem necessidade; use as já presentes.
Entregue código que passe em: npm run lint, typecheck, test:run, test:check e build.
```

---

## 4. Regras de Código Geradas por IA

Estas regras são verificadas pelo ESLint e pelo CI. A IA **deve** respeitá-las:

- **Nomenclatura de arquivos:** `.tsx`/`.jsx` em **PascalCase**; demais arquivos e pastas em **kebab-case** (regra `check-file` no `eslint.config.js`).
- **Sem acentuação/caracteres especiais** em nomes de arquivos e pastas.
- **CSS espelha o componente:** `Dashboard.tsx` → `Dashboard.css`.
- **`console`:** apenas `console.warn` e `console.error` são permitidos.
- **Variáveis/args não usados:** prefixe com `_` para não quebrar o lint.
- **Tipagem:** nada de `any` desnecessário; o `typecheck` (`tsc -b`) precisa passar.
- **Não editar arquivos gerados:** `src/types/database.ts` é ignorado pelo lint e não deve ser alterado manualmente/por IA.
- **UI:** respeite a paleta, a tipografia e as regras de contraste/acessibilidade do [guia de estilos](./estilo-padrao.md).

---

## 5. Fluxo Passo a Passo (com IA integrada ao Git)

O fluxo de Git segue exatamente o [guia de convenções](./convencoes.md). A IA entra dentro desse fluxo, **nunca por fora**:

1. **Pegue a Issue.** Escolha/abra a Issue no board, atribua a você e mova para *Em andamento*.
2. **Atualize a base.**
   ```bash
   git switch sprint04        # a sprint# atual
   git pull --ff-only
   git switch -c issue/123-descricao-curta
   ```
3. **Alinhe o contexto com a IA.** Kiro: confirme o steering/abra uma Spec. Claude/Manus: cole o prompt-base (seção 3.2) + a descrição da Issue.
4. **Gere e integre em passos pequenos.** Peça incrementos pequenos e revise cada um. Não aceite blocos grandes que você não consegue explicar.
5. **Revise como se fosse código humano.** Procure por: dependências inventadas, lógica duplicada, segredos embutidos, strings de conexão, acessos ao Supabase sem tratamento de erro, e divergências de estilo/paleta.
6. **Valide localmente (obrigatório)** dentro de `codigo-base`:
   ```bash
   npm run lint
   npm run typecheck
   npm run test:run
   npm run test:check
   npm run build
   ```
   Para mudanças de UI, rode também o E2E quando fizer sentido: `npm run test:e2e`.
7. **Commits no padrão.** Conventional Commits em português, pequenos e descritivos:
   - `feat: adiciona filtro de trilhas na pagina de cursos`
   - `fix: corrige carregamento do dashboard`
   - `test: cobre criacao de sala`
8. **Abra o PR** apontando para a `sprint#`. Preencha a descrição com a seção 6.
9. **Revisão humana obrigatória.** Pelo menos **uma aprovação** de outra pessoa. O autor **não** aprova o próprio PR. Código gerado por IA não dispensa revisão — pelo contrário, reforça a necessidade.

---

## 6. Divergência na Descrição do PR

Para manter rastreabilidade e facilitar a revisão, inclua no PR uma linha indicando o uso de IA:

```markdown
### Uso de IA
- Ferramenta(s): Kiro / Claude / Manus
- Escopo gerado por IA: (ex.: estrutura inicial do componente X, testes do serviço Y)
- Revisado e validado localmente por: @seu-usuario
```

Isso não é burocracia: ajuda o revisor a saber onde olhar com mais atenção e evita que código não compreendido entre na base.

---

## 7. Checklist Rápido (antes de abrir o PR)

- [ ] Trabalhei em uma branch `issue/*` criada a partir da `sprint#` atualizada.
- [ ] A IA recebeu o contexto do projeto (steering/Spec no Kiro ou prompt-base no Claude/Manus).
- [ ] Entendo e consigo explicar todo o código gerado.
- [ ] Nomenclatura de arquivos/pastas segue o padrão (PascalCase para `.tsx`, kebab-case no resto).
- [ ] UI respeita paleta, tipografia e contraste do guia de estilos.
- [ ] Nenhum segredo (`.env`, chaves Supabase, tokens) foi exposto à IA nem commitado.
- [ ] `lint`, `typecheck`, `test:run`, `test:check` e `build` passaram localmente.
- [ ] Commits no padrão Conventional Commits em português.
- [ ] PR aponta para a `sprint#` e tem a seção "Uso de IA".
- [ ] Vou solicitar ao menos uma revisão de outra pessoa (não aprovo o próprio PR).

---

## 8. Anti-padrões (o que parar de fazer)

- ❌ Colar `.env`, chaves do Supabase ou tokens em qualquer chat de IA.
- ❌ Aceitar um PR gigante gerado "de uma vez" sem entender o conteúdo.
- ❌ Deixar a IA inventar dependências ou mudar a stack sem combinar com a equipe.
- ❌ Commitar direto na `main`, `develop` ou `sprint#`.
- ❌ Ignorar o lint/typecheck porque "a IA disse que está certo".
- ❌ Misturar vários escopos/Issues em uma mesma branch.
- ❌ Usar cada IA do seu jeito sem fornecer o contexto do projeto.