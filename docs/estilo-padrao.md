# Guia de estilos e identidade visual

Diretriz para manter a identidade visual do Athen e referência das variantes já implementadas. Conferido em 2026-10-23 por leitura do TSX e CSS das rotas de [Hub.tsx](../codigo-base/src/Hub.tsx). Esta conferência não é uma homologação visual em navegador nem uma auditoria de contraste de todas as combinações.

## Onde começar uma mudança visual

1. Localize a família da página na tabela abaixo e confira sua implementação.
2. Reaproveite os tokens de [src/index.css](../codigo-base/src/index.css) e a estrutura de [PageLayout.tsx](../codigo-base/src/components/layout/PageLayout.tsx), quando a página a utilizar.
3. Preserve as variantes de conteúdo, como o papel dos cadernos e a cor do módulo na trilha. Uma mudança de tela não implica uniformizar todas as páginas.

| Família | Padrão observado | Fontes |
| --- | --- | --- |
| Página inicial | Fundo escuro violeta, títulos de destaque, brilhos e ações arredondadas; sem sidebar | [HomePage](../codigo-base/src/pages/home-page/HomePage.tsx), [HeroSection](../codigo-base/src/pages/home-page/components/HeroSection.tsx), [Header](../codigo-base/src/pages/home-page/components/Header.tsx) |
| Login e cadastro | Formulário centralizado em cartão escuro, bordas violetas e ação principal dourada; cores locais próximas da base | [LoginPage](../codigo-base/src/pages/LoginPage.tsx), [RegisterPage](../codigo-base/src/pages/RegisterPage.tsx) |
| Catálogo, Salas, Amigos, Ranking, Notificações e Configurações | Sidebar, fundo `canvas`, superfícies escuras, cabeçalho comum e destaques dourados | [Catalogo.css](../codigo-base/src/pages/Catalogo.css), [Salas.css](../codigo-base/src/pages/Salas.css), [Amigos.css](../codigo-base/src/pages/Amigos.css), [Ranking.css](../codigo-base/src/pages/Ranking.css), [Notificacoes.css](../codigo-base/src/pages/Notificacoes.css), [ConfigPage.css](../codigo-base/src/pages/ConfigPage.css) |
| Perfil | Base escura compartilhada, banner, avatar, cartões e botões frequentemente em cápsula | [Profile.tsx](../codigo-base/src/pages/profile/Profile.tsx) |
| Trilha e aula | Fundo e acentos derivados do módulo, nós e carrossel; aula em modal escuro com `--lesson-accent` | [Dashboard.tsx](../codigo-base/src/pages/Dashboard.tsx), [Dashboard.css](../codigo-base/src/pages/Dashboard.css), [LessonModal.css](../codigo-base/src/components/lesson/LessonModal.css) |
| Cadernos | Estante sobre base escura; cartões e editor com aparência de papel, tons creme/ocre e texto marrom | [Notebook.tsx](../codigo-base/src/pages/Notebook.tsx), [CursoNotebook.tsx](../codigo-base/src/components/notebook/CursoNotebook.tsx) |
| Console CRUD | Estilo existente separado, com cinzas, verde e fonte de sistema; divergência em relação à identidade principal | [CrudConsole.css](../codigo-base/src/pages/CrudConsole.css) |

Para uma página interna nova de listagem ou formulário, use a família de Catálogo/Salas/Configurações como referência. O console CRUD é uma implementação distinta, não o modelo visual para expandir o produto.

## Paleta e contraste

A fonte dos valores é `@theme` em [index.css](../codigo-base/src/index.css). Use os tokens em classes Tailwind ou como variáveis CSS, por exemplo `bg-surface` ou `var(--color-surface)`.

| Família | Tokens | Uso na identidade compartilhada |
| --- | --- | --- |
| Amarelo | `gold`, `gold-light`, `gold-pale` | Ações principais, destaques e superfícies de apoio |
| Violeta | `violet`, `violet-mid`, `violet-pale` | Identidade, acentos, texto sobre amarelo e apoio visual |
| Base escura | `canvas`, `surface` | Fundo da página e superfícies elevadas |
| Texto e divisórias | `ink`, `muted`, `line` | Texto principal, texto de apoio e bordas discretas |

Na paleta principal, use texto `violet` sobre os amarelos da identidade, e `ink`/`muted` sobre superfícies escuras conforme a função. Os cremes dos cadernos são superfícies de papel com texto marrom, uma variante distinta dos botões `gold`.

A trilha e o modal de aula têm acentos próprios definidos pelo módulo; os cartões do catálogo também usam variações decorativas locais. Preserve sua função de identificar conteúdo e confira o contraste da combinação, sem convertê-los em novas cores globais por repetição.

Erros e ações destrutivas usam tons de vermelho; acertos na aula usam verde. Esses estados possuem cores locais nas telas, sem uma família semântica global completa em `@theme`. Combine a cor com texto, ícone ou estado acessível.

## Tipografia e herança

| Fonte/token | Diretriz | Implementação observada |
| --- | --- | --- |
| Gabriela / `font-display` | Títulos e destaques; leitura longa em fonte de corpo | Títulos de páginas e blocos; o seletor global aplica a fonte a `h1`, `h2` e `h3` |
| Roboto / `font-body` | Textos, descrições e leitura geral | Base das páginas; controles também podem herdá-la |
| Google Sans / `font-ui` | Controles, metadados e campos novos de interface, com os fallbacks do CSS | Uso explícito na página inicial, em áreas do perfil e nos campos de Configurações; aplicação não uniforme no restante do produto |

Buscas do Catálogo e de Salas e campos de autenticação ainda herdam a fonte do contexto. Portanto, não assuma que todo campo existente já usa Google Sans. Ao ajustar tipografia, confira a cascata, incluindo `font: inherit`, antes de acrescentar outra regra.

`index.css` mantém aliases em `:root`, como `--sans`, `--heading` e `--input-font`, além dos tokens de `@theme`. Preserve os usos existentes ao mudar a definição de uma fonte. A presença de uma importação de fonte no CSS não comprova que ela carregou no navegador.

## Layout e composição

`PageLayout` é a estrutura comum das páginas internas que o utilizam. Ele inclui a sidebar e reserva seu deslocamento por padrão. Confira a constante `SIDEBAR_LEFT_WIDTH` e as props no arquivo em vez de duplicar essa medida.

- `contained` fornece o contêiner padrão e a base visual de corpo; `bare` deixa o conteúdo e o estilo principal com a página.
- `offset={false}` transfere à página a responsabilidade pelo deslocamento. Essa opção não implementa por si só uma sidebar responsiva.
- `overlay` acomoda conteúdo fora do fluxo principal. Confira também posição e empilhamento dos overlays na tela.

Nas seis páginas da família Catálogo/Salas/Amigos/Ranking/Notificações/Configurações, o padrão recorrente é cabeçalho com caminho pequeno em caixa alta, título Gabriela de 46px, subtítulo discreto e área principal com recuos de 56px na horizontal e 42px no topo. Perto de 760px de largura, o CSS reduz o título a 36px e os recuos a 20px/28px. São referências dessa família, não medidas obrigatórias para a página inicial, o perfil ou a trilha.

A trilha tem geometria, rolagem horizontal e ajustes voltados a desktop. As regras de viewport das listagens não comprovam adaptação móvel da trilha nem da sidebar fixa.

## Superfícies, ações e campos

- **Cartões e listas:** a base recorrente é `surface`, borda `line` e cantos arredondados. Os cartões comuns usam raios próximos de 12–16px; perfil e página inicial também usam raios maiores e cápsulas. Cadernos mantêm seus cantos e sombras de papel.
- **Ação principal da identidade:** fundo `gold`, texto `violet`, hover `gold-light` e estado desabilitado distinguível. Nos modais de aula, a ação principal usa a cor do módulo; login/cadastro têm texto escuro local sobre dourado.
- **Ação secundária:** nas listagens, predomina `surface` ou fundo transparente, borda `line`, texto `violet-pale` e hover mais claro. A combinação violeta/amarelo também aparece em destaques do perfil, sem definir a aparência de toda ação secundária.
- **Campos:** superfícies escuras ou transparentes dentro de uma busca, texto claro e borda/foco distinguíveis. A identidade usa dourado no foco; campos da aula e do caderno têm foco derivado de sua variante.
- **Modais:** fundo escurecido, painel legível com cantos arredondados, espaço para rolagem e ação de fechar. Reaproveite o padrão da família afetada, conferindo o modal no contexto de abertura.

A composição atual mistura utilitários Tailwind, CSS específico e estilos inline. Em arquivos CSS com `@apply`, siga o uso de `@reference` para `index.css` das páginas equivalentes. Nos brilhos e sombras, prefira derivar as cores dos tokens ou do acento de conteúdo já existente.

## Acessibilidade e critérios de conclusão

Para considerar uma mudança visual concluída:

1. Confira carregamento, erro, vazio, seleção e desabilitação nos controles afetados. Registre quais estados foram exercitados.
2. Verifique rótulos, navegação por teclado e foco visível. Em modais, confira entrada/retorno de foco e fechamento; a existência de `role="dialog"` sozinha não comprova esse comportamento.
3. Confira contraste, sobreposição, rolagem e legibilidade nas larguras afetadas. Registre as larguras verificadas; aparência de desktop não comprova adaptação móvel.
4. Confira animações relevantes e a necessidade de reduzir movimento. O Catálogo já tem uma regra local para `prefers-reduced-motion`; ela não equivale a um tratamento global da aplicação.
5. Execute as verificações aplicáveis de [Testes](testes.md) e registre evidência visual da mudança conforme [Convenções](convencoes.md). O E2E atual cobre apenas a página inicial.

Esses critérios orientam alterações; não significam que todas as telas existentes já foram auditadas ou atendem a todos eles. As fontes acima documentam o padrão atual e suas diferenças de implementação.

## Esboços e imagens

Capturas, sketches e vídeos listados no [índice de documentação](README.md) são referências históricas. Confira o código e o comportamento da tela para reproduzir seu estado atual. Mudanças na identidade compartilhada devem manter este guia e os tokens coerentes.
