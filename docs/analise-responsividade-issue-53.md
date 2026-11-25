# Análise de responsividade — issue 53

Data: 23/11/2026. Base: `develop`, commit `1b37168`; branch `issue/53-responsividade`.

Status: diagnóstico do código, da documentação e do comportamento em Chromium local, com dados HTTP simulados. As propostas abaixo não alteram as regras do produto nem representam correções implementadas.

## Resultado principal

A plataforma tem adaptações responsivas locais, mas não possui um contrato global de layout móvel aplicado a todas as páginas. A maior diferença está na navegação: Dashboard, Catálogo e Ligas transformam a sidebar em barra superior até 760px; várias outras páginas preservam a sidebar fixa e o deslocamento de 230px, embora reduzam alguns espaços internos. Assim, adaptar cartões ou campos não resolve o espaço útil da página inteira. Fontes: [PageLayout](../codigo-base/src/components/layout/PageLayout.tsx), [SidebarLeft](../codigo-base/src/components/sidebar/SidebarLeft.tsx), [Dashboard.css](../codigo-base/src/pages/Dashboard.css), [Catalogo.css](../codigo-base/src/pages/Catalogo.css), [Ligas.css](../codigo-base/src/pages/Ligas.css).

Há orientações existentes de tamanho e verificação, principalmente no [guia de estilos](estilo-padrao.md#layout-e-composição) e em [Testes](testes.md#revisão-de-curso-issue-47). Elas são referências por família e por funcionalidade, não uma especificação universal de todos os breakpoints, dispositivos ou tamanhos mínimos suportados.

## Escopo e método

- Inventário de todas as rotas ativas de [Hub.tsx](../codigo-base/src/Hub.tsx), incluindo páginas públicas, internas, detalhe de missão, erros e manutenção.
- Leitura de TSX, CSS, estilos inline, layout compartilhado e componentes de interação. A análise considera desktop e mobile, além dos intervalos de transição.
- Comparação com regras documentadas e cobertura existente de testes. Código com media query é evidência de intenção implementada; não prova utilização satisfatória por si só.
- Nesta etapa não há alteração da aplicação, persistência ou permissões. Estados dependentes de dados e interações precisam de evidência dinâmica específica.

## Padrões e orientações que já existem

| Assunto | Referência existente | Alcance e limite |
| --- | --- | --- |
| Cabeçalhos de listagem/formulário | [Estilo, Layout e composição](estilo-padrao.md#layout-e-composição): títulos de 46px, recuos horizontais/verticais de 56px/42px; perto de 760px, títulos de 36px e recuos de 20px/28px | Referência da família Catálogo/Salas/Notificações/Configurações; não obrigação para landing, perfil e trilha. Salas diverge do texto atual, conforme achado R3. |
| Casca interna | [PageLayout.tsx](../codigo-base/src/components/layout/PageLayout.tsx), linhas 10 e 85–96: offset de 230px; variante `contained` com máximo de 1320px, `px-6`, e `px-10` a partir de 1440px | `offset={false}` apenas transfere a responsabilidade à página. A casca não fornece navegação móvel global. |
| Navegação móvel já adotada | [Estilo](estilo-padrao.md#revisão-no-dashboard-e-no-modal), [Arquitetura](arquitetura.md#hospedagem-e-integrações), CSS de Dashboard/Catálogo/Ligas | Barra superior no fluxo, links em linha com rolagem horizontal até 760px. É um padrão reaproveitável já implementado em três rotas. |
| Tipografia global | [index.css](../codigo-base/src/index.css), linhas 53–64 | Raiz de 18px, reduzida a 16px até 1024px. Utilitários em `rem` mudam de tamanho junto; valores explícitos em `px` não. |
| Modal de aula/revisão | [Estilo](estilo-padrao.md#revisão-no-dashboard-e-no-modal) e [LessonModal.css](../codigo-base/src/components/lesson/LessonModal.css) | Até 560px: margens de 12px, limite por `100dvh`, pares em coluna, ações com quebra. Corpo rolável preservando cabeçalho e rodapé. |
| Homologação visual | [Estilo, critérios de conclusão](estilo-padrao.md#acessibilidade-e-critérios-de-conclusão) | Conferir sobreposição, rolagem, legibilidade, estados, teclado/foco, contraste e movimento reduzido; registrar larguras e evidências. |
| Tamanhos da issue 47 | [Testes](testes.md#revisão-de-curso-issue-47) e [registro da issue 47](testes-issue-47.md) | Capturas de 390×844 e 1440×900 para Dashboard/modal. Evidência anterior, não certificação de todas as páginas nesta branch. |
| Tamanhos de Ligas/missões/PAC | [Respostas do guia](respostas-guia-desenvolvimento-missoes-ligas-e-pac.md), Q079–Q080 e M01; [testes da issue 42](testes-issue-42.md) | 360/768/1440px; desktop Chrome/Edge/Firefox, móvel Chrome Android/Safari iOS. Escopo daquela definição; não homologação atual de toda a plataforma. |
| Viewport do HTML | [index.html](../codigo-base/index.html), linha 6 | `width=device-width, initial-scale=1.0` está presente. |

Não foi encontrada uma largura mínima global declarada, uma matriz obrigatória para todas as rotas ou tokens próprios `--breakpoint-*` em `src`. Há mistura de media queries em px com variantes Tailwind (`sm`, `md`, `lg` e larguras arbitrárias). A ausência desses tokens não significa ausência de breakpoints: o projeto importa Tailwind em [index.css](../codigo-base/src/index.css).

## Inventário comparativo de páginas

As conclusões desta tabela são de leitura estática. “Adaptação local” significa que o conteúdo muda, mas o layout compartilhado ainda pode limitar sua utilização.

| Rota | Computador: composição implementada | Mobile: adaptação implementada / ponto de atenção | Fontes |
| --- | --- | --- | --- |
| `/` | Cabeçalho com links/conta, seções de várias colunas, categorias em oito colunas no `md`, cursos em quatro no `lg` | Menu por botão no lugar da navegação; hero/ações e seções empilham. Categorias ainda têm quatro colunas; cartão de nível usa `w-72` fixo. Inspecionar labels longos e telas estreitas, pois o root oculta overflow horizontal. | [HomePage](../codigo-base/src/pages/home-page/HomePage.tsx), [Header](../codigo-base/src/pages/home-page/components/Header.tsx), [CategoriesSection](../codigo-base/src/pages/home-page/components/CategoriesSection.tsx), [LevelCard](../codigo-base/src/pages/home-page/components/LevelCard.tsx) |
| `/login-page` | Cartão central, máximo de 400px | `w-full` com espaço externo, sem sidebar. Campo de senha usa `min-w-0`; conferir teclado virtual e altura curta. | [LoginPage](../codigo-base/src/pages/LoginPage.tsx) |
| `/register-page` | Cartão central, máximo de 400px | Mesma estratégia fluida do login; formulário mais alto exige rolagem vertical. | [RegisterPage](../codigo-base/src/pages/RegisterPage.tsx) |
| `/sobre` | Seções com título/texto lado a lado no `md` | Seções em coluna, padding menor e menu móvel compartilhado. | [SobrePage](../codigo-base/src/pages/home-page/SobrePage.tsx), [InfoPageLayout](../codigo-base/src/pages/home-page/InfoPageLayout.tsx) |
| `/ajuda` | Busca e blocos de ajuda em contêiner limitado | Busca `w-full max-w-md`, margens menores; mesmo cabeçalho móvel. Conferir expansão de respostas e CTA de contato. | [AjudaPage](../codigo-base/src/pages/home-page/AjudaPage.tsx), [InfoPageLayout](../codigo-base/src/pages/home-page/InfoPageLayout.tsx) |
| `/privacidade` | Documento e índice lateral sticky no `lg` | Índice passa para cima, texto em coluna; linhas de leitura limitadas por `ch`. | [PrivacidadePage](../codigo-base/src/pages/home-page/PrivacidadePage.tsx), [LegalDocument](../codigo-base/src/pages/home-page/InfoPageLayout.tsx) |
| `/termos` | Mesma estrutura legal de privacidade | Mesma adaptação do índice e conteúdo. | [TermosPage](../codigo-base/src/pages/home-page/TermosPage.tsx), [LegalDocument](../codigo-base/src/pages/home-page/InfoPageLayout.tsx) |
| `/dashboard` | Trilha horizontal, seletor fixo, carrossel, notebook e TopDown; ajustes em 1280/1440/1920px | Até 760px, sidebar superior e offset removido. Com cartão de revisão, root de `100dvh`, reserva inferior de 312px e main rolável; ajustes adicionais do notebook e carrossel dependem dessa presença. O contexto sala/sem cartão exige conferência separada. | [Dashboard.tsx](../codigo-base/src/pages/Dashboard.tsx), [Dashboard.css](../codigo-base/src/pages/Dashboard.css), [CourseReviewCard.css](../codigo-base/src/components/course-review/CourseReviewCard.css) |
| `/catalogo` | Cabeçalho, busca/filtros e carrosséis/grade | Até 760px: sidebar superior, offset zero, recuos menores, cabeçalho em coluna e cartões com base `min(78vw,280px)`. Carrossel deve rolar internamente; filtro usa largura limitada pela viewport. | [Catalogo.tsx](../codigo-base/src/pages/Catalogo.tsx), [Catalogo.css](../codigo-base/src/pages/Catalogo.css) |
| `/salas` | Sidebar fixa, grade, busca/filtros, pop-ups de sala/aluno/educador | Grade cai para duas colunas até 1100px, mas não há regra móvel da sidebar, recuos ou cabeçalho. Até 760px só abas/cartões do detalhe mudam. Alto risco de conteúdo comprimido/cortado. | [Salas.tsx](../codigo-base/src/pages/Salas.tsx), [Salas.css](../codigo-base/src/pages/Salas.css) |
| `/profile` | Banner/avatar, cartões estatísticos de até quatro colunas, medalhas e cursos | Conteúdo empilha e reduz avatar/banner/paddings; mantém sidebar fixa do `PageLayout` na rota própria. Perfil embutido, sem sidebar, é outro contexto e não comprova adaptação da rota. | [Profile.tsx](../codigo-base/src/pages/profile/Profile.tsx), [Profile.css](../codigo-base/src/pages/profile/Profile.css) |
| `/configuracoes` | Duas colunas de campos, cartões e zona de atenção | Até 760px: campos em coluna, título/recuos menores, zona de atenção em coluna. Sidebar e offset continuam fixos; confirmação de exclusão ainda usa linha com ações lado a lado. | [ConfigPage.tsx](../codigo-base/src/pages/ConfigPage.tsx), [ConfigPage.css](../codigo-base/src/pages/ConfigPage.css) |
| `/amigos` | Listas com duas colunas a partir de 900px e três a partir de 1280px | Lista cai para uma coluna, mas sidebar fixa e padding horizontal de 56px permanecem. Modal de perfil tem máximo de 500px e margens, sem limite vertical explícito. | [Amigos.tsx](../codigo-base/src/pages/Amigos.tsx), linhas 397–402 e 575–599 |
| `/caderno` | Estante com duas colunas a partir de 900px; editor com painel lateral de 320px a partir de 1000px | Estante em uma coluna e editor empilhado, recuos de 20px até 760px. Sidebar da plataforma permanece fixa; cabeçalho do editor mantém botões/ícone na mesma linha. | [Notebook.tsx](../codigo-base/src/pages/Notebook.tsx), linhas 469–509 |
| `/notificacoes` | Lista, filtros e ações de limpeza | Até 760px reduz título/recuos e empilha cabeçalho; sidebar/offset permanecem fixos. Horário com `whitespace-nowrap` e remover absoluto pedem conferência com mensagens longas. | [Notificacoes.tsx](../codigo-base/src/pages/Notificacoes.tsx), [Notificacoes.css](../codigo-base/src/pages/Notificacoes.css) |
| `/criar-curso` | Formulário limitado a 920px com módulos, aulas e editores de questão aninhados | Até 760px reduz recuos/título e empilha ações finais, mas mantém sidebar. Linhas internas de configuração ficam em `flex` sem quebra, e campos numéricos têm 88px; profundidade de paddings reduz ainda mais espaço útil. | [CriarCurso.tsx](../codigo-base/src/pages/criar-curso/CriarCurso.tsx), [CriarCurso.css](../codigo-base/src/pages/criar-curso/CriarCurso.css), [EditarConfigQuestao](../codigo-base/src/pages/criar-curso/EditarConfigQuestao.tsx) |
| `/ligas` | Seis categorias, resumo e classificação em colunas | Até 1100px compacta linhas e empilha painéis; até 760px sidebar superior, offset zero, recuos menores e categorias em três colunas. Nomes podem quebrar linha. | [Ligas.tsx](../codigo-base/src/pages/Ligas.tsx), [Ligas.css](../codigo-base/src/pages/Ligas.css) |
| `/missoes` | Lista de cartões com prazo, progresso e XP | Até 760px reduz título/recuos e empilha cabeçalho; sidebar/offset continuam. Prazo não quebra, metadados permanecem em linha. | [Missoes.tsx](../codigo-base/src/pages/Missoes.tsx), [Missoes.css](../codigo-base/src/pages/Missoes.css) |
| `/missoes/:id` | Detalhe limitado a 640px, dados em duas colunas | Dados passam a uma coluna até 760px; repete problema da sidebar e offset. Validar missão existente e estado de ausência. | [MissaoDetalhe.tsx](../codigo-base/src/pages/MissaoDetalhe.tsx), [Missoes.css](../codigo-base/src/pages/Missoes.css) |
| `/crud` | Console próprio sem PageLayout, máximo de 960px e tabela | Até 600px empilha toolbar/ações e permite rolagem de abas; tabela tem wrapper com `overflow-x:auto`. Estilo separado é exceção documentada, não modelo das demais páginas. | [CrudConsole.tsx](../codigo-base/src/pages/CrudConsole.tsx), [CrudConsole.css](../codigo-base/src/pages/CrudConsole.css) |
| `/acesso-negado` | Página de status centralizada, conteúdo até 640px | Código/título fluidos por `clamp`; até 480px ações em coluna/largura total e diagnóstico em uma coluna. Sem sidebar. | [AcessDeny](../codigo-base/src/error-pages/AcessDeny.tsx), [ErrorLayout.css](../codigo-base/src/error-pages/ErrorLayout.css) |
| `/erro` | Mesma casca de status | Mesma adaptação; conferir mensagem/rota longa no diagnóstico. | [InternError](../codigo-base/src/error-pages/InternError.tsx), [ErrorLayout.css](../codigo-base/src/error-pages/ErrorLayout.css) |
| `/manutencao` | Mesma casca, com indicador de manutenção | Mesma adaptação. Também substitui toda a aplicação quando o modo de manutenção de build está ativo. | [Maintenance](../codigo-base/src/error-pages/Maintenance.tsx), [Hub.tsx](../codigo-base/src/Hub.tsx) |
| `*` (404) | Mesma casca de status | Mesma adaptação; testar caminho inexistente longo. | [NotFound](../codigo-base/src/error-pages/NotFound.tsx), [ErrorLayout.css](../codigo-base/src/error-pages/ErrorLayout.css) |

## Breakpoints efetivos encontrados

| Largura/condição | Uso implementado |
| --- | --- |
| Até 480px | Ações/diagnóstico das páginas de erro. |
| Até 560px | Modal de aula/revisão: pares, recuos e altura dinâmica. |
| Até 600px | Console CRUD: toolbar, botões e abas. |
| Até 760px | Adaptações recorrentes das páginas internas; transformação da navegação somente em Dashboard/Catálogo/Ligas; casca de modal; cartão de revisão. |
| 761–1199px | Cartão de revisão com largura de 170px. |
| A partir de 700/900/1000/1100/1280px | Variantes arbitrárias em Notebook/Amigos; layout do editor, grids e busca. Consultar os TSX correspondentes. |
| Até 900px | Partes do detalhe de Salas. |
| Até 1024px | Raiz tipográfica de 16px; acima disso, 18px. |
| Até 1100px | Grades e classificação de Salas/Ligas. |
| 1280–1439 / 1440–1919 / 1920+ | Geometria e controles do Dashboard. |
| Altura até 800px | Compactação de Salas, detalhe do Catálogo e Modal compartilhado. |
| `sm` / `md` / `lg` e outros utilitários Tailwind | Landing, páginas informativas e Perfil. O código importa os defaults do Tailwind; não centraliza seus valores junto das media queries em px. |

Fontes: [CSS de páginas](../codigo-base/src/pages), [LessonModal.css](../codigo-base/src/components/lesson/LessonModal.css), [Modal.css](../codigo-base/src/components/modal/Modal.css), [CourseReviewCard.css](../codigo-base/src/components/course-review/CourseReviewCard.css), [index.css](../codigo-base/src/index.css).

## Achados e prioridades propostas

### R1 — prioridade alta: navegação móvel varia por página

O [PageLayout](../codigo-base/src/components/layout/PageLayout.tsx), linhas 85–96, renderiza sidebar fixa e offset inline de 230px sem breakpoint próprio. Na largura de 390px, sobram nominalmente 160px antes dos paddings da página. Amigos ainda desconta 112px de padding horizontal; Notificações/Missões/Configurações/Notebook/CriarCurso descontam 40px no mobile. Isso explica por que ajustes locais de grid não bastam. Fontes por rota estão na matriz.

**Proposta:** levar o comportamento móvel já usado em Catálogo/Ligas ao layout compartilhado, preservando o contrato especial de Dashboard. Definir a navegação uma vez e verificar todas as rotas consumidoras. A correção precisa considerar altura real do bloco de perfil da sidebar, foco e rolagem dos links; transformar posição sem esses cuidados não encerra a tarefa.

### R2 — prioridade alta: largura da sidebar em rem diverge do offset em px

[SidebarLeft.tsx](../codigo-base/src/components/sidebar/SidebarLeft.tsx), linhas 263–269, usa `w-57.5`; [PageLayout](../codigo-base/src/components/layout/PageLayout.tsx), linha 10, usa constante de 230px. A escala Tailwind corresponde a `14.375rem`: em raiz de 16px, equivale a 230px; em raiz de 18px, equivale a 258,75px. A [mudança global de fonte](../codigo-base/src/index.css), linhas 53–64, faz essa diferença aparecer acima de 1024px. Portanto, há divergência entre o comentário de largura fixa e a expressão usada pelo componente. A medição computada do navegador deve confirmar o efeito no build atual.

**Proposta:** fazer sidebar e offset consumirem a mesma medida efetiva, com unidade intencional; verificar telas acima e abaixo de 1024px. Padding interno de algumas páginas pode mascarar a diferença visual sem eliminá-la.

### R3 — prioridade média: documentação descreve ajustes ausentes em Salas/Configurações

O [guia de estilos](estilo-padrao.md#layout-e-composição) inclui Salas entre páginas que reduzem título/recuos perto de 760px. [Salas.css](../codigo-base/src/pages/Salas.css), linhas 36–55, mantém recuos 56px/42px e título 46px; as regras responsivas nas linhas 453 e 722 não os substituem. O comentário de `offset` em [PageLayout.tsx](../codigo-base/src/components/layout/PageLayout.tsx), linhas 32–39, cita ConfigPage como exemplo de transformação da sidebar, mas [ConfigPage.css](../codigo-base/src/pages/ConfigPage.css), linhas 274–280, só altera conteúdo.

**Proposta:** na implementação da issue, preservar a intenção documentada de liberar largura e atualizar os comentários/guias para o comportamento final conferido. Este relatório registra a divergência sem transformar o código atual em nova regra.

### R4 — prioridade alta: notebook flutuante não limita dimensão à viewport

[CursoNotebook.tsx](../codigo-base/src/components/notebook/CursoNotebook.tsx), linhas 50–51, inicia em 440×420px. Ao abrir (linhas 192–197), limita `x` a pelo menos 16px, mas não reduz a largura: em viewport de 390px, a borda direita calculada fica em 456px. O painel recebe essas dimensões inline (linhas 518–519). Arrastar/redimensionar impõe mínimos, sem máximo da viewport. O ajuste móvel do botão no Dashboard com revisão não adapta o painel aberto.

**Proposta:** limitar dimensão e posição pela viewport dinâmica, responder à mudança de orientação e oferecer modo móvel que preserve editor/ações sem depender de redimensionamento manual.

### R5 — prioridade média: adaptações do Dashboard dependem do cartão de revisão

[Dashboard.css](../codigo-base/src/pages/Dashboard.css), linhas 133–147, aplica altura/rolagem/reserva inferior e reposicionamento do notebook sob `:has(.course-review-card)`/`dashboard-main--review-card`. Em salas, o cartão não existe por regra de produto. Assim, a evidência do curso individual não cobre a composição de sala. O botão de notebook mantém posição fixa calculada com sidebar+64px fora desse seletor; [CursoNotebook](../codigo-base/src/components/notebook/CursoNotebook.tsx), linha 503. O [SidebarRight](../codigo-base/src/components/sidebar/SidebarRight.tsx), linhas 85–91, usa 300px fixos e `right-[24px]`, sem variante estreita.

**Proposta:** verificar separadamente curso individual, sala e estado sem curso em 360/390px e em paisagem; adaptar controles pelo espaço disponível, independentemente da elegibilidade de revisão.

### R6 — prioridade média: conteúdo estreito e diálogos secundários precisam de critérios próprios

As linhas internas de [CriarCurso.css](../codigo-base/src/pages/criar-curso/CriarCurso.css), linhas 84 e 116, combinam campos de 88px e `flex` sem quebra em níveis aninhados. [Amigos.tsx](../codigo-base/src/pages/Amigos.tsx), linha 579, e [ConfirmDialog.tsx](../codigo-base/src/components/dialogbox/ConfirmDialog.tsx), linhas 101 e 112, têm largura fluida, mas não limite vertical/rolagem explícitos; ConfirmDialog mantém até três ações em uma linha. [Modal.css](../codigo-base/src/components/modal/Modal.css), linhas 51–57 e 159–168, ainda usa `100vh`, enquanto o modal de aula já trata `100dvh` no mobile. São riscos concretos de composição a verificar com texto longo, teclado virtual e baixa altura; não uma afirmação de falha em todos os estados.

**Proposta:** conferir os quatro tipos de editor de questão, diálogos com três ações, pop-ups de sala/curso e perfil de amigo em largura/altura reduzidas; permitir quebra e rolagem interna quando necessário.

### R7 — prioridade média: ausência de overflow global não prova que todo conteúdo cabe

[HomePage.tsx](../codigo-base/src/pages/home-page/HomePage.tsx) e [InfoPageLayout](../codigo-base/src/pages/home-page/InfoPageLayout.tsx) ocultam overflow horizontal. Categorias usam quatro colunas mesmo no mobile; [CategoriesSection](../codigo-base/src/pages/home-page/components/CategoriesSection.tsx), linhas 22 e 36. O cartão de nível usa largura `w-72`; [LevelCard](../codigo-base/src/pages/home-page/components/LevelCard.tsx), linhas 14, 19 e 35. Em várias páginas internas, a raiz também usa `overflow-hidden`. É preciso verificar clipping, dimensões dos descendentes e controles alcançáveis, além do `scrollWidth` da página.

**Proposta:** combinar capturas, medição dos elementos e exercício das ações; considerar nomes reais longos nas categorias, cursos, perfis e missões.

### R8 — prioridade média: console CRUD transborda a página inteira

Embora [CrudConsole.css](../codigo-base/src/pages/CrudConsole.css) adapte toolbar/abas e forneça `.table-wrap` com rolagem, o documento mediu 879px em viewports de 320/390px e 891px em 768px. A captura evidencia que o formulário e a tabela não se restringem à largura do dispositivo. É uma falha observada, além do risco estático descrito na matriz.

**Proposta:** conter a largura do shell e dos itens flex/grid para que apenas tabelas/abas rolem horizontalmente; verificar cada entidade do console, cujas colunas e formulários variam. Não tratar rolagem global como equivalente à rolagem interna de tabela.

## Cobertura de testes existente e lacunas

- [platform-pages.spec.ts](../codigo-base/tests/e2e/platform-pages.spec.ts), linhas 30–66: Catálogo em 390/1440px, filtro/foco/movimento reduzido, largura global e início do conteúdo móvel em `x=0`.
- [ligas.spec.ts](../codigo-base/tests/e2e/ligas.spec.ts), a partir da linha 206: 360/768/1440px. O [mapa dos testes](mapa-dos-testes.md) já distingue overflow de verificação completa de sobreposição.
- [dashboard.spec.ts](../codigo-base/tests/e2e/dashboard.spec.ts), a partir da linha 130: geometria em 1280/1440/1920px.
- [dashboard-review-layout.spec.ts](../codigo-base/tests/e2e/dashboard-review-layout.spec.ts): 1024×768, 1280×900, 1440×900 e 1440×768; histórico longo em 390×844/1440×900.
- [course-review.spec.ts](../codigo-base/tests/e2e/course-review.spec.ts), a partir da linha 287: foco, fechamento, modal e cartão em 390px; outras capturas em 390/1440.
- A configuração [Playwright](../codigo-base/playwright.config.ts) define somente o projeto Chromium Desktop Chrome. Redimensionar viewport nesses testes não equivale a ensaio em Safari iOS/Chrome Android com toque, teclado virtual e barras dinâmicas.

Os testes existentes concentram asserções geométricas em Catálogo, Ligas e Dashboard/revisão. Não há uma matriz equivalente que afirme adaptação móvel de todas as outras rotas. A descoberta destes testes é análise da cobertura, não registro de sua execução nesta tarefa.

## Evidências dinâmicas desta análise

### Ambiente e alcance

Aplicação Vite local, sem modificar fontes, usando `https://example.supabase.co` e a fronteira HTTP de [installPlatform](../codigo-base/tests/e2e/support/platform.ts). Nenhuma operação foi enviada ao banco real. Foram visitadas as **24 entradas de rota** da matriz em **390×844, 1440×900, 320×844 e 768×900**: 96 visitas medidas, além das interações complementares. O fallback foi exercitado por `/nao-existe`; o detalhe de missão usou uma ocorrência simulada existente.

As capturas de 390/1440px foram comparadas visualmente, inclusive por folhas de contato. As medidas de 320/768px ampliam a análise geométrica; não equivalem à mesma inspeção visual de todas as páginas nesses tamanhos. A navegação pública foi exercitada autenticada e, na landing, também como visitante, com menu, formulário e categorias preenchidas.

Os dados iniciais contêm um curso, módulo e aula; Dashboard com matrícula individual, perfil preenchido, uma missão existente e listas vazias para Salas, Amigos, Caderno e Notificações. Ligas inicialmente exibe espera por temporada. Portanto, a comparação inicial cobre a estrutura dessas páginas, sem pressupor que listas vazias comprovam todos os seus estados.

### Comparação medida por rota

`scrollWidth` é a largura do documento em pixels CSS. Em 1440px, todas as rotas iniciais tiveram `scrollWidth=1440`. Isso não elimina a divergência de largura da sidebar nem substitui inspeção de conteúdo. A coluna móvel combina geometria e captura, porque conteúdo oculto pode não aumentar `scrollWidth`.

| Rota / família | Desktop 1440×900 | Mobile 390×844 |
| --- | --- | --- |
| `/` | Seções largas e navegação completa; rolagem interna da landing | Menu móvel funciona; formulário e categorias alcançados por rolagem. Em 320px, formulário quase ocupa toda a largura e o rótulo “Criar conta” quebra em duas linhas. |
| `/login-page`, `/register-page` | Cartões centralizados | Campos e ações cabem; sem overflow horizontal medido. Teclado virtual não ensaiado. |
| `/sobre`, `/ajuda`, `/termos`, `/privacidade` | Conteúdo amplo e composição de desktop | Textos/índice empilhados; sem controles fora da largura na amostra inicial. Expansão de todas as respostas não ensaiada. |
| `/acesso-negado`, `/erro`, `/manutencao`, fallback 404 | Status centralizado | Títulos e ações empilhados cabem; sem overflow horizontal medido. |
| `/catalogo` | Sidebar e carrossel | Sidebar superior; título em `x=20`; documento de 390px. Detalhe aberto com painel de 370px, em `x=10`, e corpo rolável. |
| `/dashboard` | Trilha, carrossel e revisão distribuídos na tela | Sidebar superior de 291px de altura; cartão inferior e main com rolagem própria. Carrossel foi alcançado por rolagem, sem sobreposição com cartão na amostra. Notebook aberto falha, conforme abaixo. |
| `/salas` | Cabeçalho, busca e ações distribuídos | Sidebar fixa de 230px; título começa em `x=286` e chega a `x=400`. Ações/busca excedem a área útil. Abrir “Adicionar sala” expõe formulários extremamente estreitos; um deles mediu apenas 48px. |
| `/profile` | Banner, estatísticas e cartões distribuídos | Documento com **561px** de largura; conteúdo empilhado numa área de 160px. Edição também permanece nessa faixa, sem resolver o problema. |
| `/configuracoes` | Campos em duas colunas | Documento continua com 390px, mas título e campos ficam cortados. Título/área útil começam em `x=250`, após sidebar e padding; captura comprova perda de conteúdo. |
| `/amigos` | Abas, busca e lista ampla | Documento com **412px**; conteúdo entre sidebar e paddings fica comprimido; abas e controles ultrapassam a tela. |
| `/caderno` | Cabeçalho e estante ampla | Documento com **580px**; “Criar notebook” excede a borda direita mesmo no estado vazio. |
| `/notificacoes` | Cabeçalho/lista ampla | Título em `x=250`, com 202px de largura: termina em `x=452`, embora documento meça 390px. Estado vazio comprimido. |
| `/criar-curso` | Formulário central e módulos aninhados | Sidebar preservada; faixa nominal do título de 120px; formulário muito estreito e título em duas linhas. Em 320px, diversos campos/botões ultrapassam a viewport. |
| `/ligas` | Categorias em seis colunas e estado de temporada | Sidebar superior, categorias em três colunas e documento de 390px; estrutura de espera cabe. |
| `/missoes` | Cartão com metadados em linha | Sidebar fixa; largura do documento de 390px mascara cartão comprimido, quebra excessiva de texto e pouco espaço para XP/prazo. |
| `/missoes/:id` | Detalhe em duas colunas | Dados em coluna, porém faixa útil estreita: título de exemplo em três linhas; datas e ação final quebram excessivamente. |
| `/crud` | Formulário e tabela cabem em 1440px | Documento com **879px** de largura. A presença de `overflow-x:auto` na tabela/abas não conteve o transbordamento global. |

Em 320px, Perfil/Amigos/Caderno/CRUD mantiveram respectivamente 561/412/580/879px de largura de documento. Em 768px, CRUD ainda mediu **891px**; as demais páginas iniciais não excederam a largura do documento, o que não homologa seus detalhes ou estados preenchidos.

### Interações e falhas confirmadas

- **Notebook flutuante:** em 390px abre em `x=16`, `y=212`, com **440×420px**; borda direita em **456px**, 66px além da viewport. O documento continua medindo 390px. A captura mostra a lateral direita cortada, incluindo ações do cabeçalho. Em desktop, o mesmo painel cabe, em `x=500`, `y=240`. Confirma R4.
- **Sidebar:** em desktop de 1440px, a largura efetiva é **258,75px**, enquanto o conteúdo reserva **230px**. Em mobile, as páginas sem conversão preservam 230px. Confirma a diferença de unidades de R2; o padding de algumas páginas evita sobreposição aparente do texto, mas não corrige o contrato de layout.
- **Dashboard individual:** main inicialmente abaixo da navegação, com rolagem vertical própria. Ao rolar até o carrossel, setas e módulo atual ficam acima do cartão de revisão. O recorte inicial da página não deve ser interpretado como ausência da trilha/carrossel. A pequena alça ciano no topo pertence ao `SidebarRight`, não a um nó da trilha.
- **Catálogo:** detalhe do curso foi aberto em 390/1440px; o painel móvel permanece dentro dos limites medidos. Isso não comprova contraste de todo o conteúdo: títulos violetas sobre o fundo escuro merecem uma auditoria específica de contraste.
- **Perfil:** ação de edição abre formulário, mas mantém a limitação da sidebar no mobile. Em Salas, o botão do cabeçalho foi acionado de forma forçada pelo Playwright para observar o painel apesar da posição comprometida; isso não comprova que a ação seja utilizável por toque.
- **Landing visitante:** menu abre; formulário e quatro categorias preenchidas foram alcançados em 320/390px. Não houve overflow global nessas amostras, mas o espaçamento do formulário em 320px é menor que o recuo de 24px do restante da seção.

### Contextos e fronteiras complementares

O script `complemento.mts` visitou Dashboard sem curso e em sala, abriu a introdução de aula e apresentou Salas, Ligas e Notificações preenchidas, em 390/1440px. Dados/resultados estão em `complemento.json`; chamadas sem fixture permaneceram vazias nas duas larguras.

- **Sala no Dashboard:** sem cartão de revisão, o botão do notebook mantém 84×84px em `x=294`, `y=736` no mobile, enquanto no curso individual era 52×52px no fluxo do cabeçalho. Na tela de 390px ainda cabe, com apenas 12px de folga à direita; em 320px, essa posição fixa terminaria em 378px. A largura de 320px nesse contexto de sala foi inferida do posicionamento, não ensaiada. Confirma a necessidade de separar os contextos em R5.
- **Introdução de aula:** modal de 366×342px, em `x=12`, `y=251` no mobile; em desktop, 680×342px, em `x=380`, `y=279`. Cabeçalho, fechar e começar ficaram visíveis. Não foi iniciada/finalizada a tentativa nesta verificação.
- **Salas preenchida:** o cartão da turma torna-se uma faixa muito estreita; o título está no DOM, mas o Playwright não o considera visível. O problema também ocorre com dados, além do estado vazio.
- **Notificações preenchida:** cabeçalho/ações cortados, aviso comprimido e metadados disputando largura; não é um problema exclusivo da caixa vazia.
- **Ligas preenchida:** categorias e início do pódio adaptam-se à largura de 390px; o restante usa rolagem vertical. A captura dessa amostra não é homologação de todos os tamanhos de grupo, nomes ou zonas.
- **Fronteira do Catálogo:** em 759/760px, sidebar no fluxo com largura total e altura de 291px; em 761px volta a ser fixa, de 230px. Em 1024px mede 230px; em 1025px mede 258,75px. Nenhuma dessas cinco visitas produziu overflow global, mas confirma a mudança abrupta de unidade/dimensão descrita em R2.

### Artefatos e reprodução

Os artefatos ficam em [`.scratch/issue-53/`](../.scratch/issue-53), diretório local ignorado pelo Git: `audit.mts` gera a matriz inicial; `interacoes.mts` exercita os painéis; `complemento.mts` cobre os estados e fronteiras adicionais; os três JSONs preservam as coordenadas; `capturas/` contém os pares de imagens. As folhas `contato-mobile.jpg` e `contato-desktop.jpg` ajudam a comparar as páginas. O relatório versionável preserva os resultados mesmo sem esses arquivos locais.

Os scripts usam o Chromium instalado para o Playwright, o carregador TSX já declarado e Vite em `127.0.0.1:5173`, configurado exclusivamente com o endpoint fictício da fixture. A matriz inicial e as interações concluídas não registraram endpoints HTTP sem fixture. Não foram executados lint/build/suíte completa: esta entrega altera somente documentação; a auditoria usa a aplicação em desenvolvimento.

### Limites da conclusão

Esta é uma análise de todas as rotas e de interações selecionadas, não uma homologação de todas as combinações de dados e estados. Não foram validados dispositivos físicos, Safari/Firefox, toque real, zoom de 200%, teclado virtual, paisagem, todas as variantes de questão, todos os estados de erro/carregamento, uploads ou exclusões. Não houve auditoria completa de contraste/foco. Esses pontos devem integrar a implementação e sua validação, conforme as referências existentes.

Verificação documental: caminhos citados neste relatório conferidos no checkout; `git diff --check` sem erros nas mudanças rastreadas e relatório novo conferido quanto a espaços finais. A varredura do índice também encontrou duas referências preexistentes a `relatorio-trabalho-local.md`, ausente neste checkout; foram preservadas por estarem fora do escopo. O arquivo local preexistente `pendencias-ligas-missoes-sprint04.md` não foi alterado.

## Sequência recomendada para a implementação

1. Corrigir o contrato de largura/navegação no layout compartilhado e conferir todas as páginas internas em 360×800, 390×844, 768×1024 e 1440×900. Esses tamanhos combinam referências já presentes; sua adoção como matriz global é uma proposta.
2. Corrigir notebook flutuante e os contextos do Dashboard sem cartão. Conferir alturas curtas e paisagem, incluindo barra dinâmica/teclado em dispositivo móvel real.
3. Tratar formulários aninhados, cabeçalhos, listas, diálogos e detalhes com conteúdo longo, sem confundir rolagem interna de trilha/carrossel/tabela com overflow da página inteira.
4. Registrar evidência por família/estado e acrescentar regressões geométricas relevantes. Verificar 759/760/761px e 1024/1025px para detectar diferenças nas fronteiras, além das larguras de referência.
5. Atualizar [Estilo](estilo-padrao.md), [Arquitetura](arquitetura.md) e [Testes](testes.md) somente conforme o comportamento implementado e validado.
