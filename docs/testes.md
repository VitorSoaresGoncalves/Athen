# Testes e validações

Execute os comandos a partir de `codigo-base/`, após o [setup local](../codigo-base/README.md). O catálogo executável está em [package.json](../codigo-base/package.json); a automação de CI está no [workflow](../.github/workflows/ci.yml).

## Pipeline para mudanças de código

```bash
npm run lint
npm run typecheck
npm run test:run
npm run test:check
npm run build
```

| Verificação | O que cobre |
| --- | --- |
| `lint` | Regras configuradas no ESLint; não comprova aderência completa aos guias de estilo ou produto |
| `typecheck` | Compilação dos projetos TypeScript configurados |
| `test:run` | Testes `*.test.ts` e `*.test.tsx` sob `tests/`, com Vitest/jsdom |
| `test:check` | Tipagem do projeto de testes |
| `build` | Compilação TypeScript e assets de produção do Vite |

O pre-commit em [Husky](../codigo-base/.husky/pre-commit) usa lint-staged e faz verificações locais; confira o arquivo ao investigar falhas. Ele não substitui a execução completa acima.

## Interface e E2E

Para mudanças visuais ou de navegação, execute também:

```bash
npm run test:e2e
```

A [configuração Playwright](../codigo-base/playwright.config.ts) usa Chromium e prepara um build/preview em `127.0.0.1:4173`, com variáveis Supabase fictícias. Ela pode reutilizar um servidor existente fora da CI: confira o processo ao interpretar os resultados. Se faltar o navegador, instale-o com `npx playwright install chromium`.

O teste existente verifica título e cabeçalho da página inicial. Não testa login real nem os fluxos autenticados de curso, aula, sala ou perfil. Os valores fictícios usados pelo E2E não servem para acesso funcional ao banco.

## Cobertura existente

Conferência em 2026-10-23: os testes Vitest existentes são exemplos de [soma](../codigo-base/tests/unit/sum.test.ts) e [contador](../codigo-base/tests/components/ExampleCounter.test.tsx). O [E2E](../codigo-base/tests/e2e/home-page.spec.ts) cobre a página inicial. Aprovação dessas verificações não comprova correção dos fluxos de domínio ou permissões do banco.

Ao acrescentar testes, exercite comportamento observável pelo ponto de entrada usado pelo chamador; evite depender da organização interna da implementação.

## Runner SQL legado

`npm run test:db` aponta para [run-testes.ts](../codigo-base/supabase/testes/run-testes.ts). É um menu interativo que usa `SUPABASE_DB_URL` do ambiente do processo e executa SQL de criação, atualização e exclusão.

Limitações encontradas na leitura:

- Os scripts SQL usam tabelas antigas, como `public."Usuario"`, diferentes do [modelo atual](banco-de-dados/documentacao-bd.md).
- O runner resolve arquivos como `./01_create.sql` pelo diretório de execução; o comando do manifesto parte de `codigo-base/`, não de `supabase/testes/`.
- Falhas dos scripts são reportadas, mas o retorno booleano não vira uma falha global do processo em cada opção do menu.
- O runner não configura um banco isolado nem faz parte da CI atual.

Portanto, esse comando não é uma validação automatizada confiável do esquema atual. Para alterar SQL, declare o ambiente de teste e verifique as regras afetadas, incluindo permissões e efeitos persistidos. A correção do runner e a criação dessa cobertura são trabalho de código separado desta documentação.

## Mudanças exclusivamente documentais

Confira caminhos e links locais, exemplos de comandos contra o manifesto e afirmações técnicas contra as fontes referenciadas. Relate separadamente verificações executadas e inspeções por leitura; reserve o pipeline da aplicação para mudanças de código ou configuração executável.
