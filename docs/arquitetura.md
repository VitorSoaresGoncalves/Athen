# Arquitetura atual

Referência da arquitetura do projeto. O [diagrama atual](diagramas/arquitetura-atual.mmd) apresenta os componentes e suas integrações; versões e imagens anteriores estão identificadas no [índice de diagramas](diagramas/README.md).

## Caminho de uma interação

1. [Main.tsx](../codigo-base/src/Main.tsx) importa o CSS global e monta `Hub` dentro de `StrictMode`.
2. [Hub.tsx](../codigo-base/src/Hub.tsx) define as rotas. As páginas internas passam por `ProtectedRoute`, em [SupabaseConnect.tsx](../codigo-base/src/components/SupabaseConnect.tsx), que verifica sessão e acompanha mudanças de autenticação.
3. As telas mantêm estado com React e chamam os módulos de consulta em [repositories.ts](../codigo-base/src/data/repositories.ts). Também há chamadas diretas de autenticação e Storage nas telas.
4. O [cliente Supabase](../codigo-base/src/lib/supabase.ts) usa as variáveis de ambiente do Vite e os [tipos gerados](../codigo-base/src/types/database.ts).
5. O SDK acessa Auth, consultas sobre tabelas e views, RPCs SQL e Storage. As políticas RLS e funções SQL controlam as operações permitidas e os cálculos persistidos.

A proteção de rota verifica sessão, não permissão de administrador. A autorização de dados deve ser conferida no SQL; ocultar uma ação na tela não substitui essa autorização.

No dashboard, a ausência de matrícula e sala mantém a pessoa na página e apresenta o aviso de matrícula com um link para `/catalogo`. Uma sala com curso disponível pode fornecer a trilha inicial mesmo sem matrícula individual. Links para explorar cursos também usam a rota `/catalogo`, definida em `Hub.tsx`.

## Onde localizar uma mudança

Caminhos abaixo são relativos a `codigo-base/`.

| Assunto | Arquivos de entrada | Conhecimento concentrado hoje |
| --- | --- | --- |
| Rotas e sessão | `src/Hub.tsx`, `src/components/SupabaseConnect.tsx` | Rotas públicas/internas, redirecionamento sem sessão e listeners |
| Consultas e RPCs | `src/data/repositories.ts`, `src/lib/supabase.ts` | Acesso tipado ao banco e tradução de erros |
| Catálogo e matrícula | `src/pages/Catalogo.tsx` | Listagem, detalhe, avaliações e entrada em curso |
| Trilha de estudo | `src/pages/Dashboard.tsx` | Seleção de curso, composição de módulos/aulas, conclusões e geometria |
| Execução da aula | `src/components/lesson/LessonModal.tsx` | Questões, entrada de resposta, tentativa, feedback e conclusão |
| Revisão de curso | `src/pages/Dashboard.tsx`, `src/components/lesson/LessonModal.tsx`, `src/data/repositories.ts` | Entrada individual normal/bonificada, recibos na URL, amostra e resultado oficiais; renderização de questões compartilhada com a aula |
| Salas | `src/pages/Salas.tsx` | Participação, criação, detalhe, avisos e missões |
| Perfil e configuração | `src/pages/profile/Profile.tsx`, `src/pages/ConfigPage.tsx` | Edição de perfil, preferências e operações de conta |
| Perfil compartilhado | `src/components/sidebar/SidebarLeft.tsx` | Cache próprio, assinantes e evento de atualização de perfil |
| Caderno | `src/pages/Notebook.tsx`, `src/components/notebook/CursoNotebook.tsx` | Anotações e caderno associado ao curso |
| Social | `src/pages/Amigos.tsx`, `src/pages/Notificacoes.tsx` | Amizades e notificações |
| Temporadas e classificação | `src/pages/Ligas.tsx` | Grupo, classificação, projeções e histórico de temporada |
| Layout e tema | `src/components/layout/PageLayout.tsx`, `src/index.css` | Estrutura comum e tokens; regras no [guia de estilos](estilo-padrao.md) |
| Regras persistidas | `supabase/migrations/` | RLS, tentativas, XP, conclusões, rankings e demais regras SQL |

A implementação atual concentra muita composição de dados nas telas. Não há uma pasta `src/domain/` nem TanStack Query neste checkout; referências antigas a esses módulos não descrevem a estrutura presente. `repositories.ts` é um arquivo compartilhado com vários módulos por conceito, e não há uma implementação intermediária de servidor Node no código consultado.

## Aula, conclusão e XP

No modo de aula, `LessonModal` carrega questões e inicia uma tentativa ao começar a atividade. Salva cada resposta, solicita feedback opcional e finaliza pela RPC `finalize_attempt`. O resultado oficial vem do banco. Para aula sem questões em curso, usa `complete_empty_lesson`, com zero XP.

Curso e Sala são contextos diferentes de execução e pontuação. Consulte as fontes e os detalhes de idempotência, autorização e progresso em [Banco de dados](banco-de-dados/documentacao-bd.md); uma implementação de teste em memória não comprova essas regras SQL.

## Revisão de curso: fluxo separado

O [Dashboard](../codigo-base/src/pages/Dashboard.tsx) monta o [CourseReviewCard](../codigo-base/src/components/course-review/CourseReviewCard.tsx) somente no curso individual selecionado, sem ação de revisão no cabeçalho ou em salas. O cartão fica no canto inferior direito e consulta a elegibilidade oficial, a ocorrência corrente e a última sessão finalizada. O único botão **Revisar curso** abre o mesmo modal: usa `/dashboard?revisao=<ocorrência>`, com o curso no estado de navegação, quando há bônus disponível para esse curso; nos demais casos, `revisao=normal`. Aviso e prazo do bônus aparecem separados do botão; uma sessão normal já iniciada mantém seu modo.

`obterUltimaFinalizada` consulta sessões concluídas, filtradas explicitamente por usuário autenticado e curso, ordenadas por finalização/ID, com limite um e RLS de proprietário. O cartão mostra acertos, nota, aprovação, XP oficial e data, distinguindo histórico vazio de falha. Recarrega ao finalizar, por foco/visibilidade e periodicamente; cancela respostas obsoletas ao trocar curso/autenticação.

[Notificacoes](../codigo-base/src/pages/Notificacoes.tsx) resolve a ocorrência própria por RPC antes de navegar para o curso oficial. Ler/apagar o aviso não consome prêmio. A caixa oferece **Remover** em cada aviso e **Limpar lidas** no cabeçalho; a lista só remove IDs confirmados pelo servidor e preserva avisos em caso de falha. A exclusão usa a RLS de destinatário já existente, sem chamar RPC de revisão. A preferência em [ConfigPage](../codigo-base/src/pages/ConfigPage.tsx) controla somente a entrega; a atividade e o bônus continuam descobertos pelo Dashboard mesmo sem aviso.

A RPC `my_current_course_review` seleciona o período calculado pela agenda global (âncora e intervalos de 168 horas), conforme [0045](../codigo-base/supabase/migrations/0045_current_course_review_period.sql). Retorna zero ou uma ocorrência mesmo se uma simulação local alterar a âncora e deixar janelas antigas sobrepostas. Histórico e resolução por ID continuam preservados.

`LessonModal` distingue props de aula e revisão, reutilizando os campos dos quatro tipos de questão e o mesmo diálogo. A revisão não aceita aula/sala/callback de conclusão, não fabrica uma aula e não chama `attempts`, `answers`, `finalize_attempt` ou `complete_empty_lesson`. A intro só consulta dados. **Começar revisão** e **Tentar novamente** geram uma intenção explícita: `pedido=<UUID>` é gravado na URL antes da RPC; o sucesso troca esse recibo por `sessao=<id>`. Retry/reload repete o recibo ou retoma a sessão persistida, sem novo sorteio. Na ocorrência sem recibo, o servidor informa a sessão inacabada mais recente ou o último resultado.

O Catálogo, o seletor e os avisos levam o curso no estado de navegação (`courseId`), sem acrescentar `curso` à URL. Links existentes com `curso=<id>` continuam aceitos. Registrar pedido/sessão e fechar a revisão preservam esse estado, inclusive após reload; fechar remove apenas `revisao`, `pedido` e `sessao`. Trocar curso/sala descarta esses recibos; `sala=<id>` explicita o contexto do seletor e impede montar o cartão ou abrir a revisão. Curso, modo e ocorrência da sessão são conferidos contra a entrada. Cancelamento e versão de requisição impedem que resposta atrasada abra/substitua uma revisão em outro contexto. Uma URL copiada sem `curso` não transporta o estado de navegação para outra aba.

Amostra, respostas fixadas, correção e resultado vêm das RPCs próprias no [repository](../codigo-base/src/data/repositories.ts), que valida os DTOs e preserva código SQL com mensagem pt-BR. A reprovação permite nova sessão/amostra dentro do prazo; não altera o resultado anterior. Só o bônus efetivamente retornado pelo servidor é exibido. Quando premiada, a revisão emite `athen:profile-updated` para reler o perfil, sem somar saldo local nem avançar a trilha.

A agenda global, sorteio semanal de um curso, quotas por módulo, meta, prêmio único, rollout e isolamento dos demais efeitos estão definidos na [referência do banco](banco-de-dados/documentacao-bd.md#revisão-de-curso). Os estados visuais e critérios de acessibilidade estão no [guia de estilos](estilo-padrao.md#revisão-no-dashboard-e-no-modal). A implementação não equivale à aprovação dos ensaios SQL, jornada real ou auditoria visual; consulte [Testes](testes.md#revisão-de-curso-issue-47).

## Hospedagem e integrações

Até 760px, o Catálogo usa a navegação superior com rolagem horizontal já adotada em Ligas, liberando a largura do conteúdo e dos carrosséis. O teste de 390px verifica ausência de rolagem horizontal na página e o início do conteúdo em `x=0`.

O Catálogo usa `catalog_course_feed()` para compor carrosséis de recomendações, matrículas recentes e notas ponderadas; os critérios ficam na [referência do banco](banco-de-dados/documentacao-bd.md#catálogo-em-carrosséis-0047). O pop-up mantém a entrada de revisão do curso e a navegação por estado descritas acima. Filtros permitem exibir a grade completa; Escape devolve o foco ao botão de filtros e as setas respeitam redução de movimento.

`Hub.tsx` também define as páginas públicas `/sobre`, `/ajuda`, `/termos` e `/privacidade`, as telas `/acesso-negado`, `/erro`, `/manutencao` e o fallback 404. O botão “Ver todos” da landing usa a rota compartilhada `/catalogo`. As páginas de erro não implementam captura global de exceções nem autorização de dados.

`VITE_MAINTENANCE_MODE=true` substitui a aplicação inteira pela página de manutenção. `VITE_MAINTENANCE_UNTIL` aceita uma data ISO opcional para a previsão de retorno; valor inválido omite a previsão. Como são variáveis de build do Vite, alterar o modo exige novo build/deploy. Omitir o modo, ou usar valor diferente de `true`, mantém as rotas normais.

O build produz assets estáticos em `codigo-base/dist/`. Vercel é o destino citado no material histórico; `codigo-base/vercel.json` define o fallback das rotas para `index.html`, sem declarar testes. A configuração local `codigo-base/supabase/config.toml` permite iniciar a pilha de ensaio. Deploy, variáveis e comandos do painel da hospedagem precisam ser verificados no ambiente.

O perfil usa o bucket `avatars` para avatar e banner. A existência do bucket e suas políticas precisam ser verificadas no ambiente; a chamada no cliente não garante o provisionamento do recurso.

No diagrama, `Resend SMTP` representa o envio de e-mails de autenticação e a entrega ao Gmail do destinatário. Google OAuth representa autenticação com uma conta Google, enquanto `SMS provider (OTP)` representa o envio de códigos por SMS.

`Edge Functions` representa a execução de funções no backend, com acesso ao banco e envio de e-mails por meio do Resend SMTP.

O [workflow de CI](../.github/workflows/ci.yml) executa lint, verificação de tipos, Vitest, build e E2E simulados. O job `integration` também inicia Supabase descartável, executa o harness SQL e uma jornada real pelo navegador; veja [Testes](testes.md). O agrupamento CI/CD reúne GitHub Actions e `Supabase CLI / migrações`, com responsabilidades distintas: validação da aplicação e aplicação das migrações SQL, respectivamente.

## Propostas e divergências conhecidas

A [revisão de arquitetura de 2026-10-23](architecture-review-20261023-182214.html) sugere aprofundamentos dos módulos de leitura de curso, execução de aula e perfil. São propostas, ainda sem decisão ou implementação.

A leitura atual interpreta matrícula de forma diferente entre cartão, detalhe e trilha. Não use essa divergência como uma regra nova do produto: confira o fluxo afetado antes de modificá-lo. O relatório registra as evidências para discussão.
