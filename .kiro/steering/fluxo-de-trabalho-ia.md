---
inclusion: always
---

# Fluxo de Trabalho com Agentes de IA — Athen

Regras obrigatorias ao gerar ou editar codigo no projeto Athen. Documento de
referencia completo: `docs/fluxo-de-trabalho-ia.md`. Estas regras complementam e
nunca substituem `docs/convencoes.md` e `docs/estilo-padrao.md`; em caso de
conflito, essas convencoes tem prioridade.

## Principios
- A IA assiste, a pessoa decide. Todo codigo gerado e responsabilidade de quem commita.
- A IA segue as convencoes do projeto, nunca o contrario.
- Nada vai para um PR sem passar no pipeline local: `lint`, `typecheck`, `test:run`, `test:check`, `build`.
- Mudancas pequenas e revisaveis: uma branch `issue/*` = um escopo.
- Nunca inclua segredos (`.env`, chaves Supabase, tokens) em prompts ou commits.

## Qual IA usar para que
- **Kiro**: implementacao na base de codigo, edicao multi-arquivo, refatoracao, rodar lint/testes/build, Specs.
- **Claude**: raciocinio de arquitetura, revisao de codigo, explicacao de erros, documentacao.
- **Manus**: exploracao, pesquisa e rascunhos isolados que depois sao integrados manualmente e revisados.
- O que toca a base versionada deve, de preferencia, passar pelo Kiro.

## Regras de codigo (verificadas por ESLint/CI)
- Arquivos `.tsx`/`.jsx`: nome em **PascalCase**.
- Demais arquivos e pastas: **kebab-case**, sem acentos, cedilha ou espacos.
- CSS espelha o componente: `Dashboard.tsx` -> `Dashboard.css`.
- `console`: apenas `console.warn` e `console.error`.
- Variaveis/args nao usados: prefixe com `_`.
- Tipagem: evite `any` desnecessario; `tsc -b` precisa passar.
- Nunca editar `src/types/database.ts` (arquivo gerado).
- Nao invente dependencias novas; use as que ja existem.
- UI: respeite paleta, tipografia e contraste do `docs/estilo-padrao.md`.

## Git e commits
- Branch de trabalho `issue/123-descricao-curta`, criada a partir da `sprint#` atualizada.
- Nunca commitar direto em `main`, `develop` ou `sprint#`.
- Commits em Conventional Commits, em portugues: `<tipo>: <descricao>`
  (tipos: feat, fix, docs, style, refactor, test, chore).
- PR aponta para a `sprint#` e precisa de ao menos uma aprovacao de outra pessoa (o autor nao aprova o proprio PR).
- Na descricao do PR, registre o uso de IA (ferramenta, escopo gerado, quem validou).

## Comandos de validacao (dentro de `codigo-base`)
```bash
npm run lint
npm run typecheck
npm run test:run
npm run test:check
npm run build
# UI, quando fizer sentido:
npm run test:e2e
```
