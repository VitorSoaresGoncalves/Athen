# Tecnologias utilizadas

Referência de orientação, conferida com o código em 2026-10-23. Para versões declaradas, consulte [package.json](../codigo-base/package.json); para as resoluções reproduzíveis, consulte [package-lock.json](../codigo-base/package-lock.json). A versão do ambiente Node usada na CI está no [workflow](../.github/workflows/ci.yml).

| Área | Tecnologia | Onde conferir |
| --- | --- | --- |
| Cliente web | React, React DOM e TypeScript | [Entrada](../codigo-base/src/Main.tsx) e configurações `tsconfig.*` da aplicação |
| Navegação | React Router | [Rotas](../codigo-base/src/Hub.tsx) |
| Desenvolvimento e build | Vite | [Configuração](../codigo-base/vite.config.ts) |
| Estilização | Tailwind CSS, CSS por tela e fontes | [Tokens e importações](../codigo-base/src/index.css), [guia visual](estilo-padrao.md) |
| Dados e sessão | Supabase JS; Supabase Auth e PostgreSQL | [Cliente](../codigo-base/src/lib/supabase.ts), [consultas](../codigo-base/src/data/repositories.ts), [SQL](../codigo-base/supabase/migrations/) |
| Qualidade | ESLint, TypeScript ESLint e regras React | [ESLint](../codigo-base/eslint.config.js) |
| Testes de frontend | Vitest, Testing Library e jsdom | [Vitest](../codigo-base/vitest.config.ts) |
| E2E | Playwright com Chromium | [Playwright](../codigo-base/playwright.config.ts) |
| Hooks | Husky e lint-staged | [Manifesto](../codigo-base/package.json) e [hooks](../codigo-base/.husky/) |
| Scripts SQL de teste | tsx e pg | [Runner interativo legado](../codigo-base/supabase/testes/run-testes.ts); limitações em [Testes](testes.md) |

O código atual faz consultas pelo SDK e mantém estado nas telas; há cache próprio de perfil na sidebar. TanStack Query não consta do manifesto nem da implementação atual consultada. Veja a [arquitetura](arquitetura.md).

Vercel aparece nas referências históricas como destino de hospedagem. A configuração efetiva de hospedagem, variáveis e fallback de rotas precisa ser conferida no ambiente; não há `vercel.json` versionado neste checkout.
