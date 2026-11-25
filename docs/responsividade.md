# Guia de responsividade

Referência de implementação e próximos incrementos, preparada em 23/11/2026 a partir da [análise da issue 53](analise-responsividade-issue-53.md) e de fontes primárias consultadas nessa data. Diagnóstico conferido na base `1b371689ba81b20fc9c4aa34b808fa5dbb3ab976`, branch `issue/53-responsividade`.

**Implementação não equivale a homologação.** A análise preserva os achados históricos R1–R8. O primeiro incremento abaixo altera a casca e a listagem/adição de Salas; o restante deste guia orienta os recortes ainda pendentes. Evidências executadas e limites ficam em [Testes](testes.md), sem declarar a issue inteira resolvida.

## Correções visuais posteriores — 24/11/2026

A composição atual substitui o fluxo vertical compacto do incremento 2: trilha e fundo ocupam a área disponível sem scroll vertical do documento; até 760px, seletor, botão Revisar (quando disponível) e notebook ficam empilhados nessa ordem à esquerda. Acima disso, seletor e Revisar ficam no alto à esquerda; notebook fica no canto inferior esquerdo, alinhado a 40px após a sidebar, ponto médio dos recuos anteriores de 16/64px. TopDown permanece no canto superior direito. No ajuste desktop posterior, a sidebar foi ampliada de 230px para 260px pelo token compartilhado, preservando o recuo direito da notificação e ampliando links/perfil. A altura da trilha acompanha a área real com ResizeObserver. O seletor usa cards iguais de 180px, sem escala, com textos limitados a duas linhas por campo. Revisar aparece somente após todas as aulas atuais estarem concluídas no contexto individual; abre o cartão em Modal e mostra ! acessível quando há bônus ativo. A autorização final permanece no servidor. Notificações e toggle ficam agrupados com 12px de espaço. Categorias de Ligas não têm feedback de hover/clique. As evidências anteriores abaixo pertencem aos respectivos snapshots; não validam automaticamente esta correção.

## Incremento 1 implementado — casca e Salas

- `index.css` define `--sidebar-left-width: 230px`, largura física desktop independente da fonte raiz. `PageLayout.css` define `--sidebar-left-offset`: a mesma largura no desktop e `0px` até **760px inclusive**. O main reserva esse offset uma vez; `offset={false}` transfere apenas a reserva ao chamador. `bare`, `contained`, estilos extras e overlays continuam suportados, sem criar containing block para os fixos.
- `SidebarLeft.css` mantém a lateral fixa no desktop: o invólucro externo não recorta a decoração do Dashboard; `.sidebarL__scroll` concentra a rolagem vertical de cabeçalho/links/perfil/conta em altura curta. No estreito ambos ficam no fluxo, sem scroller vertical próprio, com altura natural e logo/notificações/toggle sempre disponíveis. O disclosure começa recolhido, com botão **Abrir navegação**/**Recolher navegação**, `aria-expanded` e grupo controlado oculto com `hidden`. Links recolhidos saem da árvore acessível e de Tab; o avatar de conta continua visível e alcançável. O nav **Navegação principal** rola horizontalmente; perfil/conta ficam fora desse scroller.
- Navegação e conta usam controles nativos, não `menu/menuitem`. Escape na conta fecha só a conta e devolve foco ao avatar; outro Escape no aside recolhe a navegação e foca o toggle. Escape no main/diálogo não é globalmente capturado. Não há trap, backdrop, inércia ou lock de body da navegação. Clique fora fecha só conta, sem roubar foco.
- Até 760px, o perfil é um avatar de 40px no header, entre o botão de notificações e o ☰, sempre visível (mesmo com a navegação recolhida). Ele abre um menu com nome, @usuário, streak, **Ver perfil**, **Configuração** e **Sair da conta**. O menu é `position: fixed` logo abaixo do header (`top: 72px`), para não ser cortado pelo `overflow-y` da navegação expandida no Dashboard. Avatar e ☰ são independentes: abrir um não fecha o outro. O clique em ☰ também preserva a conta ao recolher a navegação; clicar fora da conta e desse controle fecha apenas a conta, sem tomar o foco do destino clicado. Em 360px ou menos o texto "athen" some para caber. Acima de 760px, o card de perfil continua no rodapé da sidebar.
- Destinos (inclusive rota já ativa), mudanças de localização e cruzamento do breakpoint limpam expansão. Ao passar para desktop, foco do toggle vai ao link ativo ou primeiro link; ao voltar ao estreito, foco num descendente ocultável vai ao toggle. Foco no main permanece. Não há persistência nem remontagem dos hooks de perfil por abrir/recolher.
- Dashboard, Catálogo e Ligas não implementam mais uma sidebar responsiva própria. Dashboard usa a reserva padrão; suas âncoras e a do `CursoNotebook` consomem o offset efetivo (+64px no desktop). A exceção temporária da r2 para expandir navegação móvel foi substituída pelo fluxo compacto do incremento 2 abaixo.
- Listagem de Salas: um único landmark main (o da casca), cabeçalho empilhado, recuos 20px/28px e título 36px até 760px; grade 1/2/3 colunas (até 760/1100/acima de 1100px). Busca/filtro empilham, textos longos quebram e formulários de adição conservam estado, regras e ações dentro da largura útil.

**Alcance:** o incremento 1 foi validado separadamente; seus resultados não homologam mudanças posteriores. Detalhes/estatísticas de Salas e demais miolos R3/R6–R8 permanecem pendentes. O notebook e a composição do Dashboard são tratados pelo incremento 2; implementação e testes de módulo não substituem navegador/zoom/revisão da versão final.

## Incremento 2 implementado — notebook e Dashboard

- Notebook continua inicialmente fechado e não modal (`aria-modal=false`, z25), sem lock de body/trap. `notebook-geometry.ts` limita **dimensão antes de posição**, margem8, mínimos240×200 reduzidos à área útil; abertura centra o tamanho atual limitado. A área vem de `visualViewport` (offsets/width/height CSS), ou `innerWidth/innerHeight`; não soma scroll do documento nem DPR. Resize/scroll da visual viewport e resize da janela cancelam gestos e recuperam o retângulo, sem restaurar tamanho arbitrário ao ampliar.
- Mesma árvore de textarea/título permanece montada em resize. Header conserva fechar; corpo rola para alcançar ajustes, páginas, editor e salvar. Seletor de notebooks é nativo (**Selecionar notebook**); **Título da página** é sempre editável. **Ajustar à tela** restaura440×420 limitado e centra; **Ajustar janela** oferece X/Y/Largura/Altura/Aplicar. Entrada vazia/não finita ou dimensão não positiva anuncia erro sem aplicar/escrever. Alças são opcionais de ponteiro, não tabuláveis.
- Rascunho é protegido ao fechar/trocar/criar. Falha de salvar não continua a troca/criação encadeada nem limpa valores; falha ao ler outro notebook conserva o atual. Escape local do título cancela primeiro a edição do título; Escape seguinte usa proteção de fechamento. Confirmação tem foco contido/devolvido, ações com quebra e altura limitada; só ela recebe Escape quando aberta.
- Conteúdo do Dashboard entra em **modo compacto até1000px de largura OU600px de altura**, independente de revisão/estado da sidebar. Documento rola; controles/título, trilha horizontal delimitada, progresso/carrossel e cartão individual seguem no fluxo. Não há reserva312px nem condição de layout por existência do cartão. Desktop amplo/alto conserva âncoras/trilha/carrossel/cartão fixos.
- Uma instância de `SidebarRight` ocupa o slot comum de controles, inclusive sem curso/erro. Compacto: disclosure no fluxo, toggle visível, conteúdo fechado fora da árvore acessível/Tab, Escape local com retorno e sem trap. Desktop: painel fixo300px/right24/rebarba28. Consultas/estado aberto não mudam por resize.
- Seletor curso/sala reutiliza `Modal`/`ModalFechar`: foco contido/devolvido, fechar/Escape/fundo, lista rolável com1/2/3 colunas até760/1000/acima; cartões têm mínimo156px e altura natural, incluindo motivo de sala sem curso. Geometria/centralização da trilha respondem ao resize sem trocar seleção. Roda vertical não é capturada no compacto; desktop libera Ctrl+wheel e extremos sem avanço.
- Associações, payloads e elegibilidade não mudam: sala nunca recebe revisão; sem curso não se fabrica notebook/trilha/cartão. Abrir/ajustar/redimensionar não salva nem cria página/caderno/sessão. Limites e evidências de homologação deste incremento ficam em [Testes](testes.md); testes jsdom não comprovam clipping, zoom real, toque ou autorização SQL.

## Incremento 5 implementado — Perfil e demais páginas

Perfil, Amigos, Missões/detalhe, Notificações, Configurações, Catálogo, Ligas e detalhes aluno/educador de Salas receberam contenção local, quebra de textos e ações, mínimos encolhíveis e recuos responsivos. A tabela de alunos rola em região local; o pódio de Salas conserva nome/resultado completos em complemento textual. Páginas tocadas mantêm apenas o main da casca.

Amigos reutiliza `Modal` para o perfil próprio, sem nova integração com `Profile.tsx`; Configurações mantém confirmação inline. A moldura existente de Modal limita altura/largura com `vh`/`dvh`, corpo rolável e ações flexíveis; em altura curta a composição toda pode rolar, conservando o seletor do Dashboard. Não foram alterados estado, callbacks, regras, payloads, persistência ou revisão em Salas.

**Limites:** CRUD excluído por solicitação. Este recorte não é homologação global; execução, alcance e limitações ficam em [Testes](testes.md). Verificação manual final, hardware e outros navegadores não são inferidos do gate local.

## 1. Como usar e qual referência prevalece

**Incremento 4 — Caderno:** `/caderno` adapta cabeçalhos/ações, mínimos de campos/cartões e nomes longos da estante/editor, com páginas em scroller horizontal local e main único da casca. Resize/sidebar não remontam os campos; lógica, associação por título e proteções de rascunho foram preservadas. O gate específico de navegador continua separado da implementação; este recorte não modifica o notebook flutuante nem outras páginas.

**Incremento 3 — Criar Curso:** `/criar-curso` agora permite encolher campos/grids, quebrar cabeçalhos/ações e empilhar pares de associação até1000px; até760px reduz recuos aninhados para os quatro editores. O main é único (o da casca). Estado, validações e payloads não mudam. O recorte não adapta outras páginas; geometria e fluxos da versão final dependem do gate específico descrito em [Testes](testes.md).

1. Leia a [análise](analise-responsividade-issue-53.md), identifique o achado e confirme o código atual: esta base pode ter mudado.
2. Identifique a família visual no [guia de estilos](estilo-padrao.md). Ele permanece responsável por identidade, cores, fontes e variantes; este guia complementa sua composição responsiva, não o substitui.
3. Antes de alterar o layout compartilhado, levante todos os consumidores e overlays na [arquitetura](arquitetura.md) e no código. Determine quem reserva espaço, quem rola e quem posiciona cada controle.
4. Selecione as diretrizes das seções 3–8 e os casos da matriz da seção 9. Registre exceções e estados antes de implementar.
5. Implemente o menor ajuste que elimine a causa; valide a família inteira quando mudar a casca. Use o checklist da seção 10 para encerrar.

### Legenda de autoridade

| Rótulo | Significado |
| --- | --- |
| **Observado** | Leitura do código desta base ou resultado identificado da análise. Não implica comportamento satisfatório em todos os estados. |
| **Diretriz local** | Decisão deste guia para futuras mudanças no Athen; ainda precisa de implementação e evidência. Não é padrão universal da web. |
| **Referência web** | Mecanismo de CSS/HTML ou orientação de acessibilidade da fonte indicada junto ao tema. |
| **Exemplo ilustrativo** | Receita conceitual, não código existente, patch pronto ou API/tokens disponíveis no projeto. |

Requisitos da tarefa e regras de produto permanecem acima das escolhas ilustrativas. Divergências entre código e estilo devem ser registradas: preserve a intenção da regra, não promova um defeito atual a padrão. Exemplo: o estilo prevê recuos/título menores em Salas perto de 760px, mas a análise R3 encontra essa adaptação ausente. Alterar visual não autoriza mostrar revisão de curso em salas, mudar permissões ou remover ações para fazê-las caber.

## 2. Ponto de partida conferido (histórico anterior ao incremento 1)

| Observado na base | Consequência para quem implementar |
| --- | --- |
| [PageLayout](../codigo-base/src/components/layout/PageLayout.tsx) monta `SidebarLeft` e reserva 230px por `paddingLeft` inline; `bare` e `contained` têm responsabilidades diferentes. | Corrigir a casca antes dos grids locais. `offset={false}` transfere a responsabilidade à página; não fornece navegação móvel automaticamente. |
| [SidebarLeft](../codigo-base/src/components/sidebar/SidebarLeft.tsx) usa `fixed`, `w-57.5` e `h-screen`. | Largura e altura precisam ser compatíveis com a reserva e o espaço visível; incluir perfil/menu no ensaio. |
| [Dashboard.css](../codigo-base/src/pages/Dashboard.css), [Catalogo.css](../codigo-base/src/pages/Catalogo.css) e [Ligas.css](../codigo-base/src/pages/Ligas.css) convertem a sidebar em bloco superior até 760px. | É precedente local reaproveitável, não comportamento global já garantido. Conferir também páginas que não fazem essa conversão. |
| [index.css](../codigo-base/src/index.css) importa Tailwind, define raiz de 18px e reduz a 16px até 1024px. | Dimensões em `rem` variam com essa raiz; medidas explícitas em `px` não acompanham a troca da fonte raiz. |
| `@theme` da aplicação contém cores/fontes; não declara breakpoints próprios nem uma medida compartilhada que já resolva sidebar e offset. | Reaproveitar os tokens existentes para identidade. Qualquer nova centralização de layout é uma alteração futura explícita, não um recurso presumido. |
| [index.html](../codigo-base/index.html) tem `width=device-width, initial-scale=1.0`. | Preservar zoom; a tag sozinha não torna o conteúdo responsivo. |
| [LessonModal.css](../codigo-base/src/components/lesson/LessonModal.css) tem tratamento móvel de altura/ações; os demais diálogos não são equivalentes. | Reutilizar princípios, mas validar cada componente e não assumir foco/rolagem corretos por semelhança visual. |

As medições de sidebar, notebook e CRUD citadas em R2/R4/R8 pertencem à **análise**, não a uma execução nova deste guia. Seus ensaios foram em Chromium com dados HTTP simulados; não cobrem teclado virtual, zoom, todos os estados ou dispositivos físicos.

## 3. Layout compartilhado, navegação e unidades

### 3.1 Contrato de composição — R1, R2 e R3

**Diretrizes locais:**

- No modo lateral, a largura efetiva da sidebar deve ser exatamente a largura reservada pelo conteúdo e usada por controles ancorados à sua borda. A reserva acontece uma vez, sem somar padding da casca e margem da página para o mesmo fim.
- A casca centraliza essa medida nos tokens físicos/efetivos descritos no incremento 1. Não substituir a largura física por zero: controles móveis consomem o offset efetivo.
- No modo estreito, partir do padrão já existente de navegação superior **no fluxo**, sem reserva lateral residual. Centralizar a regra requer retirar/conciliar overrides por rota, não acrescentar uma segunda adaptação concorrente.
- A altura do bloco superior é determinada pelo conteúdo real: logo, links, perfil, avisos e textos longos. Não subtrair uma altura “de celular” presumida. O conteúdo principal começa depois da navegação e continua alcançável em telas baixas.
- Links horizontais podem rolar dentro da navegação, com indicação de continuidade e item focado alcançável. Menu de perfil não pode abrir para uma região recortada pelo wrapper rolável; verificar empilhamento, direção e espaço disponível.
- Preservar landmarks, nomes acessíveis, estado ativo e ordem lógica do DOM. Layout em linha não transforma links de navegação em um widget ARIA `menu`; só mudar semântica se implementar o respectivo padrão de interação.
- Dashboard tem composição especial: preservar trilha, seletor, revisão e painéis ao harmonizar a casca. Ele usa agora a reserva padrão; confira estilos inline e consumidores dos tokens, além das páginas `bare`/`contained`.

**Critério de saída:** em cada rota interna, o início da área principal coincide com o fim da sidebar no modo lateral; no modo superior não sobra faixa de 230px nem há conteúdo atrás da navegação. Perfil e todos os destinos continuam operáveis por teclado e toque, inclusive com baixa altura.

### 3.2 Causa histórica corrigida: `w-57.5` não é sempre 230px

**Observado na base anterior:** a sidebar usava `w-57.5`. Tailwind instalado é 4.3.3; seu tema padrão em `codigo-base/node_modules/tailwindcss/theme.css` fornece `--spacing: 0.25rem`. Não há override dessa escala em `src/index.css`. A [documentação oficial de width](https://tailwindcss.com/docs/width) define `w-<number>` como `calc(var(--spacing) * <number>)`. O incremento 1 substitui essa classe pelo token físico, sem mudar a fonte raiz.

Assim, `w-57.5` representa `57.5 × 0.25rem = 14.375rem`:

| Raiz computada | Largura anterior resultante | Reserva anterior de PageLayout |
| --- | --- | --- |
| 16px, até 1024px nesta base | 230px | 230px |
| 18px, acima de 1024px nesta base | 258,75px | 230px |

A análise mediu essa diferença em navegador. Padding local pode disfarçá-la, não eliminá-la. A mesma atenção vale para `px-6`, `top-6`, `bottom-6` e `w-72`: são baseados na escala, não números de pixels literais.

**Referência web:** [MDN, unidades de comprimento](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length) distingue `rem` (fonte raiz), `em` (contexto de fonte), `%` (base dependente da propriedade), `ch` (métrica do caractere) e `px` (pixel CSS, não necessariamente pixel físico). Zoom do navegador também amplia valores em px; a diferença acima diz respeito à troca de `font-size` do documento, não à impossibilidade de dar zoom em px.

**Diretriz local:** preferir limites fluidos (`width: 100%` com máximo apropriado) a larguras rígidas para conteúdo; usar unidades relativas onde a medida deve acompanhar a leitura. Não mudar a raiz global para esconder R2: isso afeta a plataforma inteira e requer escopo próprio. Medir `getComputedStyle`/retângulos antes e depois, incluindo 1024/1025px e zoom.

## 4. Breakpoints sem confundir biblioteca, conteúdo e dispositivo

**Referência web:** [MDN, media queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Using) permite consultar largura, altura, orientação e preferências. Nenhuma dessas fontes determina que “mobile termina em 760px”. Esse número é uma escolha recorrente do Athen.

**Observado:** o código mistura media queries em px, variantes arbitrárias e defaults Tailwind. O tema padrão instalado fornece:

| Variante Tailwind | Limite em media query | Equivalência com fonte inicial do navegador de 16px |
| --- | --- | --- |
| `sm` | 40rem | 640px |
| `md` | 48rem | 768px |
| `lg` | 64rem | 1024px |
| `xl` | 80rem | 1280px |
| `2xl` | 96rem | 1536px |

**Atenção:** `rem` em dimensão de um elemento e em condição de media query não tem a mesma base de resolução. [W3C, Media Queries 4, unidades](https://www.w3.org/TR/mediaqueries-4/#units) especifica unidades relativas em queries com base no valor **inicial**, não nas declarações da página. Logo, a raiz autoral de 18px não transforma automaticamente `md` em 864px. Preferências do navegador podem alterar a equivalência; conferir a condição efetiva com `matchMedia`. A versão consultada de Media Queries 4 é Candidate Recommendation Draft, não uma nova certificação do produto.

**Diretrizes locais para uma mudança:**

1. Começar pelo conteúdo estreito utilizável e acrescentar colunas/espaço quando couber. No [Tailwind mobile-first](https://tailwindcss.com/docs/responsive-design), utilitários sem prefixo valem em todos os tamanhos; `sm:` significa “a partir de sm”, não “somente celular”.
2. Preservar inicialmente a transição local de 760px da navegação ao consolidá-la. `md` a 768px não é substituição idêntica: há um intervalo entre os contratos.
3. Escolher novas transições quando conteúdo/ações deixarem de caber, e registrar motivo e componente afetado. Não criar um breakpoint por modelo de aparelho ou copiar todos os números do inventário para um sistema novo.
4. Reaproveitar o mecanismo existente no arquivo; inspecionar cascata, especificidade e estilo inline. Evitar misturar unidades em novos breakpoints de um mesmo conjunto Tailwind, pois a documentação alerta sobre ordenação inesperada.
5. Ensaiar cada limite alterado imediatamente abaixo, no limite e acima. Incluir larguras fracionárias ou redimensionamento contínuo para detectar lacunas entre `max-width: 760px` e `min-width: 761px`.
6. Não renomear todos os breakpoints nem introduzir tokens globais nesta etapa documental. Se uma implementação centralizar medidas, documentar então nomes, consumidores e migração.

Fronteiras iniciais prioritárias: **759/760/761px** (navegação), **1023/1024/1025px** (raiz/unidades), **559/560/561px** (modal de aula). Para componentes alterados, acrescentar seus limites próprios: 480/600/900/1000/1100px e faixas 1280/1440/1920px conforme o código, sem tratar todos como obrigatórios para todas as páginas.

## 5. Conteúdo que realmente cabe — R6, R7 e R8

### 5.1 Grids, flex, cabeçalhos e listas

**Referência web:** [MDN, min-width](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/min-width) explica que o mínimo automático de itens flex/grid pode depender de `min-content`. Por isso, `width: 100%` ou uma coluna `1fr` isoladamente não garante que o filho com texto/campo largo encolha.

**Diretrizes locais:**

- Investigar do shell até o descendente que excede a largura: mínimo intrínseco, campo, padding aninhado, `nowrap`, largura fixa, posição absoluta ou transformação. Aplicar `min-width: 0` nos itens que devem encolher, e `min-height: 0` nos corpos flex/grid que devem rolar.
- Grades de conteúdo começam com uma coluna quando necessário; distribuir colunas por espaço útil, não pela largura total antes de descontar sidebar e recuos. Em grids de colunas iguais, `minmax(0, 1fr)` pode evitar mínimo intrínseco indevido.
- Cabeçalho com título, busca, filtros e ações deve permitir quebra/empilhamento. Manter ordem de leitura e prioridade das ações, sem ícones sobre o texto nem CTA fora da tela.
- Encolher recuos antes de comprimir campos a faixas inutilizáveis; preservar as referências da família no estilo. Recuos menores não justificam eliminar toda separação nas bordas.
- Nomes, descrições, datas e XP podem ocupar mais de uma linha. Reservar espaço para controles absolutos de remover/fechar ou trazê-los ao fluxo; conferir avisos longos em Notificações e metadados de Missões.

**Exemplo ilustrativo — seletores e valores abaixo não existem como contrato compartilhado:**

```css
.exemplo-grade {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  gap: 1rem;
}
.exemplo-item { min-width: 0; }
.exemplo-acoes { display: flex; flex-wrap: wrap; gap: 0.75rem; }
```

O mínimo `16rem` é apenas demonstrativo; escolher pela família e conteúdo. Não aplicar a grade à trilha geométrica ou a tabelas com relações bidimensionais sem avaliar sua função.

### 5.2 Conteúdo longo e tipografia

**Diretrizes locais:** manter fontes e hierarquia do [estilo](estilo-padrao.md#tipografia-e-herança); permitir altura natural, títulos com quebra e controles com labels completos. Conferir a fonte carregada e seu fallback. Não reduzir toda a fonte para caber nem usar somente `vw` para dimensionar leitura; se adotar `clamp`, combinar limites legíveis com unidades relativas e verificar zoom real.

[MDN, overflow-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow-wrap) descreve a quebra de sequências sem espaços. Usar `overflow-wrap: anywhere` seletivamente em nomes, URLs e texto fornecido por usuários; evitar `word-break: break-all` indiscriminado que torna a leitura fragmentada. Não truncar enunciados, erro ou ação essencial. Quando resumo for truncado por intenção, oferecer acesso explícito ao texto completo também por teclado/toque; `title` ou hover sozinho não basta.

Fixture mínima para estresse: título de curso e nome de perfil com 80 caracteres, descrição com vários parágrafos, URL de 120 caracteres sem espaços, datas/prazos completos, contagens de vários dígitos e mensagem de erro detalhada. São **dados de teste propostos**, não novos limites do produto.

### 5.3 Imagens, ícones e mídia

**Diretrizes locais:** imagens informativas devem respeitar o contêiner, preservar proporção e não conter texto essencial ilegível ao reduzir. Para mídia comum, `max-width: 100%; height: auto` é um ponto de partida, não uma regra cega para avatar/banner recortado. Em recortes com `object-fit`, conferir que o conteúdo importante permaneça visível. Reservar proporção/dimensões quando conhecidas para evitar deslocamento de layout; manter texto alternativo adequado à função.

**Referência web:** [MDN, imagens responsivas](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images) separa resolução (`srcset`/`sizes`) de direção de arte (`picture`). Adotar apenas quando houver fontes adequadas e necessidade real; redimensionar com CSS não reduz automaticamente o arquivo baixado. Logos, vídeos e imagens das questões também precisam de teste no contêiner estreito.

### 5.4 Rolagem intencional versus clipping

| Situação | Diretriz local e verificação |
| --- | --- |
| Página comum, formulário, título, lista de avisos | Refluir sem rolagem horizontal global; toda informação/ação alcançável. |
| Carrossel, navegação em linha e abas | Rolagem interna horizontal permitida, com itens legíveis no espaço estreito e acesso ao primeiro/último; conferir teclado/toque. Não estender a largura do documento. |
| Tabela do CRUD | Wrapper restrito à largura disponível pode rolar; cabeçalho, formulário, ajuda e ações externas continuam refluindo. Verificar todas as entidades, não só a tabela vazia. |
| Trilha/diagrama com relações espaciais | Preservar geometria necessária em região delimitada e navegável. Justificar quais relações exigem duas dimensões; não declarar todo Dashboard exceção. Textos e controles ao redor continuam adaptáveis. |
| `overflow: hidden`/`clip` | Adequado para decoração descartável; não é correção de conteúdo essencial fora da tela. Inspecionar foco, menus, sombras que informam estado e descendentes posicionados. |

**Referência web:** [WAI, Reflow 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) explica reflow em 320 pixels CSS e exceções para partes que necessitam layout bidimensional. A exceção não se estende automaticamente a cabeçalhos, formulários ou parágrafos próximos. A contenção interna acima é uma escolha local de experiência, não uma afirmação de que qualquer scrollbar global é sempre uma violação WCAG.

`scrollWidth <= clientWidth` é um sinal útil, **não prova de aprovação**: a análise registrou conteúdo cortado sem overflow global. Inspecionar retângulos, capturas e ações após rolar, abrir menus e mover foco. Um cartão fora do recorte inicial mas alcançável por rolagem intencional é diferente de um botão permanentemente cortado.

## 6. Formulários, teclado e toque — R6

**Diretrizes locais:**

- Campos ocupam o espaço útil do grupo; pares passam a coluna quando labels, ajuda, erros ou controles deixam de caber. Incluir `select`, senha com botão, arquivos, cores, números e textareas, não só input textual vazio.
- Em CriarCurso, revisar cada nível de módulo/aula/questão e os quatro editores existentes. Os campos numéricos de 88px e linhas flex observados não devem obrigar o grupo inteiro a exceder a largura.
- Labels e mensagens permanecem associados e legíveis; placeholder não substitui label. Erro/carregamento não pode deslocar CTA para fora de região alcançável nem apagar preenchimento.
- Tab/Shift+Tab seguem a ordem lógica; Enter/Espaço acionam controles nativos de modo esperado. Foco visível não pode ser recortado ou ficar atrás de barra fixa.
- Em dispositivo móvel, focar primeiro e último campo, abrir teclado virtual, editar, rolar até erros e salvar/cancelar. Conferir campos próximos ao rodapé, incluindo login/cadastro, Configurações e editor de caderno.
- Evitar interação essencial só por hover, gesto ou arraste. Para ações frequentes de toque, **meta local de projeto: área acionável de aproximadamente 44×44px CSS ou maior**, sem diminuir legibilidade nem sobrepor alvos.

**Referência web:** [WAI, tamanho mínimo 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) usa 24×24px CSS com exceções específicas de espaçamento/equivalência/inline/controle do navegador/essencial; **não define 44px como mínimo AA universal**. Avaliar a área realmente acionável, não só o desenho do ícone. A meta local de 44px favorece toque e não equivale a uma auditoria de conformidade.

## 7. Modais, pop-ups e notebook — R4 e R6

### 7.1 Dimensão, rolagem e semântica

**Diretrizes locais:** limitar painel em largura **e altura**, com espaço para bordas e foco. Organizar cabeçalho, corpo e rodapé para conteúdo longo sem prender ações fora da área visível. O corpo rolável precisa poder encolher; quando cabeçalho/rodapé por si só excederem a altura disponível, permitir rolagem da composição inteira ou outra apresentação utilizável. Evitar dupla rolagem sem função clara.

**Exemplo ilustrativo — não é a implementação atual de Modal/ConfirmDialog:**

```css
.exemplo-painel {
  width: min(42rem, calc(100% - 1.5rem));
  max-height: calc(100vh - 1.5rem); /* fallback a conferir */
  max-height: calc(100dvh - 1.5rem);
  display: flex;
  flex-direction: column;
}
.exemplo-corpo { min-height: 0; overflow-y: auto; }
.exemplo-rodape { display: flex; flex-wrap: wrap; gap: 0.75rem; }
```

O percentual de largura pressupõe wrapper que representa a área disponível; conferir containing block. Os valores são ilustrativos, sem novos tokens do projeto.

**Referências web:** [MDN, unidades de viewport](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length) distingue `svh` (viewport pequena), `lvh`/`vh` (grande) e `dvh` (dinâmica). `dvh` ajuda com barras do navegador, mas não garante por si só tratamento de teclado virtual em todos os ambientes. A [VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport) distingue viewport visual e de layout; só acrescentar lógica JS se a validação demonstrar necessidade, incluindo limpeza dos listeners e sistema de coordenadas consistente.

Para **modal**, seguir [WAI-APG, Dialog Modal](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): nome acessível, foco inicial apropriado, Tab/Shift+Tab contidos, Escape, controle visível de saída, fundo inerte e retorno de foco ao gatilho ou destino lógico. `aria-modal="true"` sem bloquear interação de fundo não implementa isso. O APG orienta o padrão, não certifica componentes do Athen.

Validar separadamente aula/revisão, detalhes de Catálogo/Salas, perfil em Amigos e confirmações, inclusive com três ações. `LessonModal` tem comportamento documentado próprio no [estilo](estilo-padrao.md#revisão-no-dashboard-e-no-modal); isso não comprova os demais.

### 7.2 Notebook flutuante

**Histórico anterior ao incremento 2:** a análise de390px encontrou a borda direita do notebook em456px. O [CursoNotebook](../codigo-base/src/components/notebook/CursoNotebook.tsx) agora usa o helper e os controles descritos acima, mantendo o padrão440×420 limitado e semântica não modal. O relatório datado não deve ser reescrito para apagar o achado.

**Diretrizes locais:**

1. Em espaço estreito, oferecer apresentação limitada ao espaço visível com editor, seleção de páginas, salvar e fechar alcançáveis, sem exigir arraste/redimensionamento para recuperar controles.
2. Se mantiver janela flutuante em espaço amplo, limitar dimensões e depois posição, nessa ordem. Para uma margem `m`, buscar `largura <= área disponível - 2m` e posição entre as bordas permitidas; a mesma regra vale à altura, com mínimo que não supere o espaço disponível. Mínimo rígido maior que viewport inviabiliza o limite.
3. Recalcular após abrir, mudar tamanho/orientação/zoom e recuperar janela antes posicionada fora da área; preservar anotação e estado de edição. Conferir cabeçalho, abas e dropdown, que também podem exceder o painel.
4. Fornecer alternativa a movimentos de arrastar/redimensionar e operação por teclado quando essas funções forem mantidas. [WAI, Dragging Movements 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) distingue alternativa por clique/toque sem arraste de acessibilidade por teclado; uma não comprova a outra.
5. Manter a semântica não modal se o fundo continuar interativo; caso a apresentação passe a modal, implementar o contrato completo de foco/inércia e registrar a decisão.

**Critério de saída:** abrir, editar, trocar página, salvar, cancelar e fechar em retrato/paisagem, com teclado virtual e após redimensionar; nenhuma ação essencial depende de alcançar uma borda fora da viewport. Validar a página `/caderno` separadamente: o painel flutuante corrigido não resolve a estante/editor dessa rota.

## 8. Dashboard sem acoplar responsividade à revisão — R5

**Atual:** o incremento2 removeu `:has(.course-review-card)`/`dashboard-main--review-card`, a reserva312px e a exceção de expansão da r2. Composição compacta usa condições de espaço comuns aos três contextos, não elegibilidade. Em sala, o cartão continua ausente por regra de produto. [SidebarRight](../codigo-base/src/components/sidebar/SidebarRight.tsx) é disclosure no fluxo compacto e painel fixo no desktop amplo/alto.

**Diretrizes locais:**

- Separar condições de produto (há revisão elegível, há sala, há curso) de condições de espaço (navegação superior, altura curta, painel aberto). O conteúdo básico deve permanecer utilizável com ou sem cartão.
- Conferir seletor, título, trilha, carrossel/setas, notebook, ranking/missões e revisão como regiões concorrentes. Reserva de espaço deve corresponder à ocupação real, não depender de um número mágico que falha com texto longo/zoom.
- Preservar a geometria de desktop e exceções visuais descritas no estilo; mudar navegação não autoriza redesenhar a trilha inteira.
- No móvel, testar a rolagem até o último módulo e os controles das duas extremidades; capturar início e fim. Cartão fixo pode exigir região principal rolável/reserva, mas não pode cobrir foco/ações. Em altura curta, priorizar acesso ao conteúdo, admitindo apresentação no fluxo se a composição fixa não couber.
- Abrir/fechar SidebarRight e notebook nos três contextos: **curso individual**, **sala**, **sem curso/matrícula**. Em curso individual, incluir cartão vazio, preenchido e erro. Em sala, confirmar também que a adaptação não criou entrada de revisão indevida.

**Critério de saída:** cada contexto atende os mesmos requisitos de alcance e reflow, com evidência própria; um screenshot individual com cartão não aprova a composição de sala.

## 9. Plano executável de validação futura

Esta matriz é **diretriz local para implementar**, não uma lista de testes já executados nem declaração de suporte mínimo global. Pixels abaixo são CSS. Referências anteriores de 360/390/768/1440px foram combinadas com 320px para reflow e telas baixas para detectar perda de ações.

### 9.1 Tamanhos e modos

| Ensaio | Viewports/condições | Aplicação |
| --- | --- | --- |
| Estreito básico | 320×844, 360×800, 390×844 | Todas as rotas do inventário da análise; conteúdo vazio e preenchido. 320px é alvo de reflow, não exigência de aparelho específico. |
| Intermediário | 768×1024 e 1024×768 | Todas as famílias; sidebar/contêiner e formulários, com conteúdo longo. |
| Desktop | 1280×720, 1440×900 | Todas as famílias afetadas; atenção à altura de notebook/diálogos e largura real da sidebar. |
| Desktop amplo | 1920×1080 | Dashboard/trilha e componentes cuja geometria nessa faixa for afetada. |
| Fronteiras | Trincas da seção 4 e cada limite alterado, altura fixa registrada | Navegação e componente correspondente; arrastar largura continuamente entre os pontos. |
| Altura curta/paisagem | 844×390 e 568×320 | Navegação, Dashboard em cada contexto, notebook, autenticação e todos os diálogos afetados. Girar também com painel aberto. |
| Zoom de leitura | 100%, 125%, 150%, 200% em desktop, registrando viewport efetiva | Texto, labels, controles e mensagens sem perda; não substituir zoom real por `transform: scale`. |
| Reflow ampliado | Janela de conteúdo com largura inicial 1280px a 400% de zoom, confirmar largura efetiva próxima de 320px | Conteúdo não excetuado sem perda nem leitura em duas dimensões; registrar exceção por região. Ensaio a 320px sem zoom é complementar, não substituto de zoom. |
| Teclado/toque real | Android/Chrome e iOS/Safari, retrato/paisagem, barras abertas/retraídas, teclado aberto | Campos e overlays críticos; registrar aparelho, SO, navegador e limitações de acesso. Emulação não comprova teclado virtual real. |

**Referências web:** [WAI, Resize Text 1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) pede ampliação do texto até 200% sem perda, com exceções para legendas e imagens de texto; [Reflow 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) explica equivalência de 1280px a 400% com 320px CSS. São verificações relacionadas, não o mesmo ensaio. [Orientation 1.3.4](https://www.w3.org/WAI/WCAG22/Understanding/orientation.html) orienta não restringir orientação salvo necessidade essencial; não exigir que o usuário gire o dispositivo para salvar/fechar.

### 9.2 Estados e roteiros por família

Para **cada rota afetada**, exercitar carregamento, vazio, preenchido, erro/recuperação, seleção/desabilitação quando existirem; não inventar estados que o produto não oferece. Para mudança na casca, cobrir todas as rotas internas da análise, mesmo sem editar seus arquivos.

| Família | Roteiro mínimo adicional |
| --- | --- |
| Públicas e autenticação | Visitante/autenticado; menu móvel abrir/fechar e destinos; categorias/títulos longos; expandir ajuda; índice legal; login/cadastro com erro, senha e teclado virtual. |
| Listagens internas | Salas, Amigos, Notificações, Missões/detalhe e Ligas com dados, não só vazio; busca/filtros/abas; nome grande, prazo/XP, ações no fim da lista; missão ausente. |
| Catálogo e Perfil | Primeiro/último cartão e setas; filtro e retorno de foco; detalhe longo; perfil próprio em edição e perfil embutido em diálogo como contextos distintos. |
| Configurações/CriarCurso | Validação de campos; confirmação destrutiva sem executar exclusão real; todos os quatro tipos de questão e níveis aninhados; ações no fim. |
| Caderno | Estante, criar/editar, páginas longas, toolbar; painel flutuante pelo roteiro da seção 7.2. |
| Dashboard | Os três contextos e variações do cartão da seção 8; trilha longa; painéis laterais abertos; aula/revisão com enunciado longo e ações/feedback/resultado. |
| CRUD | Cada entidade/aba, formulários e linhas longas, tabela rolando até a última coluna; página permanece contida. Usar dados descartáveis e evitar operações destrutivas reais. |
| Status/erros | 403/erro/manutenção/404, mensagem e caminho longos, todas as ações; sem supor que ausência de sidebar elimina risco de clipping. |

Rodar inicialmente em Chromium para regressões determinísticas e repetir famílias críticas em Firefox e Safari/WebKit; registrar o que foi realmente executado. A [configuração Playwright atual](../codigo-base/playwright.config.ts) declara Chromium, não uma matriz multi-browser pronta. Ver [Testes](testes.md) para preparação, fixtures, comandos e coordenação de builds; não repetir comandos concorrentes que escrevem em `dist/`.

### 9.3 Como produzir evidência suficiente

1. Registrar base/diff, rota, contexto de produto, fixture, estado, navegador, viewport CSS, zoom e data. Usar dados simulados/locais sem credenciais ou informações pessoais nas capturas.
2. Medir largura do documento (`document.documentElement.scrollWidth` e `clientWidth`), retângulos de sidebar/main/painéis e raiz computada. No modo lateral, comparar largura da sidebar à reserva; no superior, verificar ausência de reserva residual.
3. Inspecionar visualmente início, conteúdo rolado e estado aberto; medir descendentes essenciais mesmo quando o documento não transborda. Capturar close/CTA/foco e extremos dos scrollers, não apenas a primeira dobra.
4. Operar sem clique forçado: Tab/Shift+Tab, Enter/Espaço, Escape onde pertinente; rolar com teclado e toque, abrir/fechar e conferir retorno de foco. Uma ação forçada por teste não prova que o usuário a alcança.
5. Acrescentar regressões focadas nas causas: igualdade reserva/largura, limites de painel, contexto sem revisão, formulário estreito e contenção do CRUD. Tolerâncias geométricas pequenas devem explicar arredondamento, não acomodar dezenas de pixels perdidos.
6. Aplicar também contraste, foco e movimento reduzido do [estilo](estilo-padrao.md#acessibilidade-e-critérios-de-conclusão) e o pipeline aplicável de [Testes](testes.md). Screenshot e teste de overflow não substituem acessibilidade nem execução funcional.

Registro sugerido, a preencher na implementação:

```text
Versão/base e diff:
Achado e causa eliminada:
Rota / contexto / estado / fixture:
Navegador / SO / dispositivo:
Viewport CSS / zoom / raiz computada:
Esperado / observado (medidas e interação):
Captura, trace ou teste reproduzível:
Resultado: PASSOU | FALHOU | NÃO EXECUTADO | NÃO APLICÁVEL
Exceção justificada / limitação / próximo passo:
```

## 10. Checklist de implementação e rastreabilidade R1–R8

| Achado da análise | Ação orientada neste guia | Evidência necessária para encerrar a correção |
| --- | --- | --- |
| R1 — navegação por página | Seção 3.1: contrato compartilhado com modo superior e consumidores conferidos | Todas as rotas internas em estreito/intermediário/desktop; destinos e perfil alcançáveis, sem offset residual. |
| R2 — rem versus px | Seção 3.2: mesma medida efetiva na sidebar/reserva/âncoras | Larguras computadas iguais em 1024/1025 e desktop; zoom e mudanças de raiz não geram sobreposição. |
| R3 — documentação divergente | Seções 1/3/4: preservar intenção e conferir família | Salas e Configurações com recuos/cabeçalho utilizáveis; comentários e referência técnica atualizados para o resultado real. |
| R4 — notebook fora da viewport | Seção 7.2: limitar dimensão/posição e oferecer uso estreito | Painel aberto antes/depois de giro/redimensionamento; edição e ações alcançáveis, teclado/toque sem recuperação por arraste obrigatório. |
| R5 — Dashboard sem revisão | Seção 8: separar espaço de elegibilidade de produto | Curso individual, sala e sem curso aprovados separadamente, incluindo altura curta e painel aberto. |
| R6 — editores/diálogos | Seções 5/6/7: quebra, mínimo intrínseco, altura e foco | Quatro editores, três ações de confirmação e detalhes longos operáveis com zoom/teclado virtual. |
| R7 — clipping oculto | Seção 5.4/9.3: medir, ver e interagir | Descendentes e foco alcançáveis mesmo com `overflow-hidden`; primeiro/último item e texto longo verificados. |
| R8 — overflow do CRUD | Seções 5.1/5.4/9.2: conter shell e restringir rolagem | Cada entidade em 320/390/768px; formulário reflui e só regiões intencionais rolam horizontalmente. |

- [ ] Confirmar base, fontes atuais, família visual, consumidores e dono da rolagem.
- [ ] Registrar medidas/breakpoints escolhidos e por que resolvem a causa, sem criar dependência/token fictício.
- [ ] Corrigir casca/unidades antes de compensar sintomas com paddings ou esconder overflow.
- [ ] Preservar identidade, conteúdo e regras de produto em todos os contextos.
- [ ] Executar tamanhos, estados e fronteiras aplicáveis da matriz, mais zoom, altura, teclado e toque.
- [ ] Vincular captura e regressão à versão final; repetir evidências afetadas pelo último ajuste.
- [ ] Atualizar a referência responsável pelo comportamento efetivamente implementado (estilo/arquitetura/testes), preservando a análise como diagnóstico datado.
- [ ] Relatar falhas e ensaios não executados explicitamente; obter revisão independente antes de declarar validação local.

## 11. Fontes, alcance e manutenção

Todas as URLs externas junto aos temas foram **efetivamente consultadas em 23/11/2026**: documentação oficial Tailwind 4, referências MDN e W3C/WAI. Tailwind foi confrontado com pacote/tema local 4.3.3; a documentação online pode evoluir. MDN documenta mecanismos; os textos WAI *Understanding* são explicativos e o APG é orientação de padrões, não certificado de conformidade. A especificação de media queries tem seu status indicado na seção 4.

Escolhas locais — navegação superior como ponto de partida, fronteira de 760px, meta de toque, viewports de regressão, fixtures de estresse e sequência de correção — são decisões operacionais deste guia, **não exigências universais dessas fontes**. Não foi feita auditoria completa WCAG, teste cross-browser, execução da aplicação ou medição nova em navegador para publicar este documento.

Na próxima mudança de layout, rever os trechos “Observado”, breakpoints e links contra o checkout usado; substituir diretriz por descrição de comportamento atual somente após implementar e verificar. Dimensão mínima suportada, critérios de homologação final e eventual redesenho da navegação exigem decisão explícita se o escopo futuro diferir deste guia.
