# Issue 53 — guia de responsividade

**Origem:** issue 53. **Data:** 24/11/2026. **Estado atual:** r6, gates locais concluídos; aceite final conforme parecer independente. r1–r5 permanecem registrados em seus recortes. **Base:** `1b371689ba81b20fc9c4aa34b808fa5dbb3ab976`, branch `issue/53-responsividade`; contrato r6. A verificação não homologa a issue 53 inteira.

## Problema e solução

Na etapa documental r1, a análise encontrou adaptações móveis diferentes entre páginas: algumas transformavam a navegação lateral em barra superior, enquanto outras ainda reservavam 230px para uma sidebar fixa. Também registrou divergência de largura, clipping em conteúdo e um painel de caderno que podia ultrapassar a tela. A entrega r1 produziu um guia para orientar implementações futuras; não corrigiu esses comportamentos nem declarou a aplicação responsiva ou homologada.

O [guia de responsividade](../../responsividade.md) criado em r1 distingue observações do código, diretrizes locais e exemplos ilustrativos; mapeia os achados R1–R8 para ações e evidências futuras. Ele complementa, não substitui, o [guia de estilos](../../estilo-padrao.md). A [análise da issue 53](../../analise-responsividade-issue-53.md) continua sendo a fonte do inventário, medições e limites do diagnóstico.

## Conceitos ligados à implementação

- **Casca e componente:** a casca compartilhada organiza a página; componentes e páginas compõem seu conteúdo. No Athen, `PageLayout` reserva espaço para `SidebarLeft`. Ajustar apenas um cartão não corrige uma reserva errada aplicada à página inteira.
- **`rem` e `px`:** `rem` é relativo ao tamanho da fonte raiz; `px` é pixel CSS. O exemplo real analisado combina `w-57.5` (14,375rem) com uma reserva fixa de 230px. Com a raiz observada de 18px, a sidebar calcula 258,75px, diferente da reserva. O guia recomenda investigar a medida efetiva compartilhada, não mascarar a diferença com padding.
- **Reflow e clipping:** reflow é a reorganização do conteúdo para caber na largura disponível; clipping é conteúdo recortado, às vezes sem aumentar a largura total da página. Por isso, `scrollWidth <= clientWidth` não basta: é preciso olhar os elementos, mover o foco e testar as ações.
- **Evidência de validação:** uma captura ou medida só sustenta o estado, rota, viewport, navegador e versão testados. O guia propõe uma matriz; ela não representa testes já executados nesta entrega.

## Caminho das instruções e verificação

Para uma futura implementação, comece pela análise, confirme o código do checkout e a família visual no guia de estilos; em seguida identifique consumidores da casca, selecione os critérios do guia, implemente e registre evidências por rota/estado. O guia orienta conferir também limites de breakpoint, zoom, teclado e toque, sem transformar exemplos ou metas locais em padrões universais.

O [parecer independente](../../../.scratch/issue-53/revisao-guia.md) aprovou o guia e o índice no diff r1 e, depois, este registro ainda parcial no diff 2, sem achados nos eixos de requisitos e convenções. A [conferência técnica adicional](../../../.scratch/issue-53/validacao-guia.md), substitutiva da evidência que não veio do tester, concluiu PASSOU: conferiu 20 links locais (incluindo três âncoras), 15 fontes oficiais com HTTP 200 e conteúdo pertinente, coerência dos achados R1–R8 com os fatos de código e `git diff --check`. Não se atribui aprovação ao tester.

Com a conferência concluída, a etapa exclusivamente documental r1 foi validada localmente. A revisão independente aprovou sem achados a consolidação do registro no diff 3 (parecer em [revisao-guia.md](../../../.scratch/issue-53/revisao-guia.md)). Naquela etapa não houve correção do produto; o incremento executável r2-dev2 e seu estado estão registrados separadamente abaixo. As fontes externas e limitações do guia estão detalhadas no próprio documento.

**Para explorar:** abra `PageLayout.tsx` e `SidebarLeft.tsx`; compare a reserva de 230px com a largura computada e procure quais rotas transferem à página a responsabilidade pelo offset.

## Incremento 1 — casca responsiva, navegação recolhível e Salas

**Problema e solução.** A etapa documental apontou duas causas na estrutura compartilhada: a largura Tailwind da sidebar variava com a fonte-raiz, mas a página reservava 230px fixos; e em muitas rotas a barra lateral móvel continuava ocupando espaço fora da tela. Este incremento substitui a dimensão por um token físico de 230px, calcula uma reserva compartilhada de 230px no desktop e zero até 760px inclusive, e oferece navegação móvel inicialmente recolhida. Também aplica o primeiro ajuste de conteúdo à listagem e ao painel “Adicionar sala”. O recorte não resolve todos os achados da issue 53.

**Conceitos necessários:**

- **Largura física e offset efetivo:** o token `--sidebar-left-width` representa a largura real desktop; `--sidebar-left-offset` representa quanto o conteúdo reserva. Em [PageLayout.css](../../../codigo-base/src/components/layout/PageLayout.css), o offset é o token no desktop e `0px` no breakpoint móvel. Assim, os controles ancorados podem acompanhar o mesmo offset, sem confundir a largura móvel do bloco superior com a reserva lateral.
- **Disclosure:** padrão para mostrar/ocultar um grupo a partir de um controle. Aqui o botão nativo “Abrir navegação” atualiza `aria-expanded` e controla o grupo; não é um menu ARIA nem um diálogo modal. O foco segue a ordem normal, Escape fecha primeiro as opções da conta e depois a navegação, com retorno ao controle apropriado. O grupo fechado usa `hidden`, portanto links e perfil não recebem foco por Tab.
- **Contêiner de rolagem:** elemento que limita conteúdo rolável. Na [sidebar](../../../codigo-base/src/components/sidebar/SidebarLeft.css), a moldura externa mantém `overflow: visible` e a decoração do Dashboard; `.sidebarL__scroll` contém a rolagem vertical desktop. Separar esses papéis evita que o gradiente externo seja recortado, a regressão S1 identificada na revisão.
- **Fixture HTTP:** resposta simulada usada para exercitar a interface sem depender do serviço real. Ela ajuda a testar estados e payloads de Salas, mas não prova as regras de autorização SQL/RLS; estas exigem validação própria.

**Caminho da implementação.** [index.css](../../../codigo-base/src/index.css) define a medida física; [PageLayout](../../../codigo-base/src/components/layout/PageLayout.tsx) monta a sidebar, aplica a reserva única e mantém `bare`, `contained`, `offset` e overlays. [SidebarLeft](../../../codigo-base/src/components/sidebar/SidebarLeft.tsx) mantém os dados/cache da conta e implementa o disclosure, teclado, foco, Escape e mudança de breakpoint. Dashboard, Catálogo e Ligas deixam de manter regras concorrentes; Dashboard e a âncora do [CursoNotebook](../../../codigo-base/src/components/notebook/CursoNotebook.tsx) usam o offset efetivo. Abrir a navegação no Dashboard relaxa a composição que cortaria o menu e move o cartão existente ao fluxo; não cria revisão em salas. Em [Salas.tsx](../../../codigo-base/src/pages/Salas.tsx) e [Salas.css](../../../codigo-base/src/pages/Salas.css), o landmark `main` aninhado foi removido, a lista ganha uma coluna no estreito e cabeçalho/formulários de adição se ajustam. Fluxos, validação e dados de salas permanecem os mesmos.

**Verificação do incremento e limites.** Os registros locais [implementação r2](../../../.scratch/issue-53/implementacao-r2.md), [testes r2](../../../.scratch/issue-53/testes-r2.md) e [revisão da implementação](../../../.scratch/issue-53/revisao-implementacao-r2.md) documentam o diff r2-dev2 e suas evidências; `.scratch/` é ignorado pelo Git e não acompanha clones. Para o fingerprint acima, o gate salvo registrou PASSOU em lint, typecheck, test:check, build, **125 E2E Chromium, 41 Vitest e 39 testes focais**. Os focais cobrem casca, Salas e regressões do Dashboard; as contagens e limites estão na referência técnica [Testes](../../testes.md). O tester também exercitou zoom nativo real em 200% e 400%: disclosure/conta por teclado, opções alcançadas com rolagem e Escape com retorno de foco; em Salas, campos e seleções, CTAs e feedback de erro/entrada/criação foram alcançados por rolagem normal e acionados sem `force`. As **16 capturas físicas PNG**, pareadas com JSON de medidas/ações em `evidence-zoom-actions/`, foram conferidas pelo reviewer; não são os PNGs antigos rasterizados em tamanho CSS. O reviewer aprovou localmente o recorte r2-dev2 sem achados abertos em Spec/Normas e encerrou T1 residual e P3 de contagens.

Esses E2E usam respostas HTTP simuladas: sucesso de criação/entrada e detalhe de educador comprovam o fluxo cliente e payload/feedback, não autorização SQL/RLS. Separadamente, `test:db` passou em banco local descartável para os ensaios SQL/ACL das RPCs `room_stats`; isso não corresponde a uma mudança de SQL — nenhum SQL, banco de produto ou autenticação foi alterado. Os gates não foram reexecutados nesta atualização documental. Permanecem fora do recorte os miolos/estatísticas de Salas, a correção do tamanho/posição do notebook móvel (sua alteração foi somente a âncora), a SidebarRight em viewport estreita, a composição completa do Dashboard e outras prioridades de responsividade R3–R8. Firefox/WebKit, dispositivos físicos/teclado virtual, CI remoto, deploy e revisão humana/PR não foram realizados. A validação local deste incremento não homologa a issue 53 inteira nem os próximos incrementos.

**Para explorar:** inspecione `--sidebar-left-offset` em 760px e 761px e siga-o até o `main` e a âncora do Dashboard. Depois localize no E2E como a fixture HTTP confirma o envio de criação sem alegar que executou a autorização do banco.

## Incremento 2 — notebook e Dashboard (r3-dev1)

**Problema e solução.** O notebook flutuante podia ficar fora da área visível após redimensionar; seu editor era reconstruído entre modos de tela e uma falha de salvamento podia deixar a ação encadeada prosseguir. O Dashboard também condicionava a rolagem e o espaço do conteúdo à existência do cartão de revisão, embora cursos, salas e estados sem curso tenham composições diferentes. O incremento limita a janela, mantém o editor enquanto a geometria muda e só continua troca/criação se o salvamento confirmar sucesso. No Dashboard, layouts compactos entram no fluxo normal da página e não dependem da elegibilidade para revisão.

**Conceitos ligados ao código:**

- **Limitar dimensão antes de posição:** primeiro calcula-se um tamanho que cabe, depois a posição com margem de 8px. O helper puro [notebook-geometry.ts](../../../codigo-base/src/components/notebook/notebook-geometry.ts) aplica essa ordem aos retângulos. Assim, uma janela maior que a área visível não fica impossível de posicionar.
- **Viewport visual:** é a região efetivamente visível ao usuário e pode diferir da área de layout, por exemplo durante zoom. [CursoNotebook.tsx](../../../codigo-base/src/components/notebook/CursoNotebook.tsx) usa dimensões e offsets CSS da `visualViewport` quando disponíveis, com fallback; não multiplica por DPR (densidade de pixels do dispositivo). Resize/zoom reaplicam o limite sem salvar ou recarregar o caderno.
- **Estado de edição independente do layout:** a árvore do editor permanece a mesma ao mudar a viewport. Isso evita perder o texto não salvo por uma troca de apresentação; “Ajustar à tela” muda a geometria, não os dados.
- **Modalidade e confirmação:** o notebook continua não modal (`aria-modal=false`), então o fundo permanece interativo e o foco não fica preso nele. Já a confirmação de descarte/salvamento é um diálogo superior. Se salvar falha, a operação que dependia do salvamento para trocar/criar é cancelada e o rascunho fica preservado.

**Caminho dos dados e composição.** `CursoNotebook.tsx` mantém associação e operações atuais; [CursoNotebook.css](../../../codigo-base/src/components/notebook/CursoNotebook.css) organiza campos, seletores e área rolável. A geometria é recalculada ao abrir, arrastar/redimensionar, resize e mudança da viewport visual; gestos são cancelados e limpos ao interromper a interação. A janela oferece **Ajustar à tela** e controles numéricos X/Y/largura/altura; o seletor de caderno usa `<select>` nativo em vez de dropdown recortável. A falha de `saveNotebook` agora é distinta de sucesso antes de permitir ações encadeadas. No [Dashboard](../../../codigo-base/src/pages/Dashboard.tsx) e seu [CSS](../../../codigo-base/src/pages/Dashboard.css), modo compacto ocorre com largura até 1000px **ou** altura até 600px: controles, trilha, progresso/carrossel e cartão, quando elegível, ficam no fluxo vertical. A trilha mantém rolagem horizontal delimitada e recalcula sua geometria sem trocar seleção. [SidebarRight](../../../codigo-base/src/components/sidebar/SidebarRight.tsx) vira disclosure no fluxo compacto; o seletor de curso/sala continua modal. Salas não recebe revisão. Não foi adicionada persistência, autenticação ou SQL.

**Verificação e limites.** A [implementação r3](../../../.scratch/issue-53/implementacao-r3.md), [gate final](../../../.scratch/issue-53/gate-r3-final.md), [testes r3](../../../.scratch/issue-53/testes-r3.md), [parecer do reviewer](../../../.scratch/issue-53/revisao-implementacao-r3.md), evidências de [zoom](../../../.scratch/issue-53/zoom-r3-final.md) e [T2](../../../.scratch/issue-53/t2-r3-final.md) são registros locais ignorados pelo Git. O reviewer aprovou o recorte técnico r3-dev1 sem bloqueadores de Spec/Normas; T1 (zoom real a 200/400%), T2 (gestos, contextos/matriz e painéis), T3 (manifestos), T4 (fixture) e T5 (vínculo entre testes e gate) estão encerrados. Foram conferidos 32 pares PNG/JSON físicos de zoom e 24 de T2, com ações e medidas registradas.

O gate final PASSOU em lint, typecheck, **52 Vitest**, test:check, build e **146 E2E Chromium**. Os três casos novos passaram em foco; `dashboard-responsive.spec.ts` passou **10/10**. A fixture longa agora prepara módulos e aulas nos dois cursos extremos; o cenário HTTP 503 mantém a falha e dá tempo para as retentativas antes de verificar o erro. Os **143 E2E e 24 focais** são do snapshot anterior, com sete casos no arquivo; ficam apenas como histórico e não validavam os três casos novos. O gate de 146 corresponde à versão atual. T1/T2 não foram repetidos nessa rodada de gate porque a fonte r3 permaneceu inalterada; reviewer revisou e encerrou essas evidências separadamente. Hash executável citado acima permanece estável; manifestos de documentos e combinado serão regenerados pelo orchestrator após a consolidação textual.

O alcance não inclui `/caderno`, demais páginas/miolos, nem homologação completa do Dashboard ou da issue 53. A verificação foi em Chromium local com HTTP simulado: fixtures demonstram a interface, não SQL/RLS; nenhum código de autenticação, SQL ou regra de autoridade foi alterado. Firefox/WebKit, dispositivos físicos/teclado virtual, CI, deploy e revisão humana/PR não foram realizados.

**Para explorar:** em `notebook-geometry.ts`, teste mentalmente uma janela maior que 320×201 e siga o clamp até `CursoNotebook.tsx`. Depois compare o estado de curso individual e sala no Dashboard: a composição compacta pode ser a mesma, mas o cartão de revisão só existe no contexto elegível.

## R4-FINAL — Criar Curso

- CSS e estrutura ajustados nos quatro editores; valores são preservados no resize e o payload não mudou.
- Cinco focais, 150 E2E Chromium, 52 Vitest, lint, tipos e build passaram ([testes](../../testes.md)); reviewer favorável, sem bloqueadores Spec/Normas ([parecer R4](../../../.scratch/issue-53/revisao-implementacao-r4.md)).
- Base/branch iguais às acima. Limites: Chromium local; sem hardware, Firefox/WebKit, CI, deploy ou PR.

## R5 — Caderno

- Estante/editor de `/caderno`: reflow local preserva valores no resize; lógica e payload não mudaram.
- Focais 5/5; 154 E2E Chromium, 52 Vitest, lint, typecheck, test:check e build passaram ([evidências](../../../.scratch/issue-53/testes-r5.md)). Fixture HTTP; sem validação SQL/RLS.
- Gates locais concluídos; aceite final conforme [parecer independente](../../../.scratch/issue-53/revisao-implementacao-r5.md). Firefox/WebKit, hardware, CI, deploy e PR não executados.

## R6 — páginas restantes

- Escopo: Perfil, Amigos, Missões-detalhe, Notificações, Configurações, Catálogo, Ligas e detalhes de Salas; CRUD excluído. Amigos reutiliza Modal; estados/payloads preservados.
- Gate: 52 Vitest, lint, typecheck, test:check, build e 157 E2E Chromium passaram ([evidências](../../../.scratch/issue-53/testes-r6.md)). Sem campanha integrada nem manual do usuário.
- Gates locais concluídos; aceite final conforme [parecer independente](../../../.scratch/issue-53/revisao-implementacao-r6.md). Sem homologação global/SQL, hardware, Firefox/WebKit, CI, deploy ou PR.
