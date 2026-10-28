# Arquitetura atual

Referência da arquitetura do projeto. O [diagrama atual](diagramas/arquitetura-atual.mmd) apresenta os componentes e suas integrações; versões e imagens anteriores estão identificadas no [índice de diagramas](diagramas/README.md).

## Caminho de uma interação

1. [Main.tsx](../codigo-base/src/Main.tsx) importa o CSS global e monta `Hub` dentro de `StrictMode`.
2. [Hub.tsx](../codigo-base/src/Hub.tsx) define as rotas. As páginas internas passam por `ProtectedRoute`, em [SupabaseConnect.tsx](../codigo-base/src/components/SupabaseConnect.tsx), que verifica sessão e acompanha mudanças de autenticação.
3. As telas mantêm estado com React e chamam os módulos de consulta em [repositories.ts](../codigo-base/src/data/repositories.ts). Também há chamadas diretas de autenticação e Storage nas telas.
4. O [cliente Supabase](../codigo-base/src/lib/supabase.ts) usa as variáveis de ambiente do Vite e os [tipos gerados](../codigo-base/src/types/database.ts).
5. O SDK acessa Auth, consultas sobre tabelas e views, RPCs SQL e Storage. As políticas RLS e funções SQL controlam as operações permitidas e os cálculos persistidos.

A proteção de rota verifica sessão, não permissão de administrador. A autorização de dados deve ser conferida no SQL; ocultar uma ação na tela não substitui essa autorização.

## Onde localizar uma mudança

Caminhos abaixo são relativos a `codigo-base/`.

| Assunto | Arquivos de entrada | Conhecimento concentrado hoje |
| --- | --- | --- |
| Rotas e sessão | `src/Hub.tsx`, `src/components/SupabaseConnect.tsx` | Rotas públicas/internas, redirecionamento sem sessão e listeners |
| Consultas e RPCs | `src/data/repositories.ts`, `src/lib/supabase.ts` | Acesso tipado ao banco e tradução de erros |
| Catálogo e matrícula | `src/pages/Catalogo.tsx` | Listagem, detalhe, avaliações e entrada em curso |
| Trilha de estudo | `src/pages/Dashboard.tsx` | Seleção de curso, composição de módulos/aulas, conclusões e geometria |
| Execução da aula | `src/components/lesson/LessonModal.tsx` | Questões, entrada de resposta, tentativa, feedback e conclusão |
| Salas | `src/pages/Salas.tsx` | Participação, criação, detalhe, avisos e missões |
| Perfil e configuração | `src/pages/profile/Profile.tsx`, `src/pages/ConfigPage.tsx` | Edição de perfil, preferências e operações de conta |
| Perfil compartilhado | `src/components/sidebar/SidebarLeft.tsx` | Cache próprio, assinantes e evento de atualização de perfil |
| Caderno | `src/pages/Notebook.tsx`, `src/components/notebook/CursoNotebook.tsx` | Anotações e caderno associado ao curso |
| Social | `src/pages/Amigos.tsx`, `src/pages/Notificacoes.tsx`, `src/pages/Ranking.tsx` | Amizades, notificações e apresentação de classificação |
| Layout e tema | `src/components/layout/PageLayout.tsx`, `src/index.css` | Estrutura comum e tokens; regras no [guia de estilos](estilo-padrao.md) |
| Regras persistidas | `supabase/migrations/` | RLS, tentativas, XP, conclusões, rankings e demais regras SQL |

A implementação atual concentra muita composição de dados nas telas. Não há uma pasta `src/domain/` nem TanStack Query neste checkout; referências antigas a esses módulos não descrevem a estrutura presente. `repositories.ts` é um arquivo compartilhado com vários módulos por conceito, e não há uma implementação intermediária de servidor Node no código consultado.

## Aula, conclusão e XP

`LessonModal` carrega questões e inicia uma tentativa ao começar a atividade. Salva cada resposta, solicita feedback opcional e finaliza pela RPC `finalize_attempt`. O resultado oficial vem do banco. Para aula sem questões em curso, usa `complete_empty_lesson`, com zero XP.

Curso e Sala são contextos diferentes de execução e pontuação. Consulte as fontes e os detalhes de idempotência, autorização e progresso em [Banco de dados](banco-de-dados/documentacao-bd.md); uma implementação de teste em memória não comprova essas regras SQL.

## Hospedagem e integrações

O build produz assets estáticos em `codigo-base/dist/`. Vercel é o destino citado no material histórico; o deploy e o fallback das rotas precisam ser verificados no ambiente de hospedagem. Este checkout não contém `vercel.json` nem configuração local `supabase/config.toml`.

O perfil usa o bucket `avatars` para avatar e banner. A existência do bucket e suas políticas precisam ser verificadas no ambiente; a chamada no cliente não garante o provisionamento do recurso.

No diagrama, `Resend SMTP` representa o envio de e-mails de autenticação e a entrega ao Gmail do destinatário. Google OAuth representa autenticação com uma conta Google, enquanto `SMS provider (OTP)` representa o envio de códigos por SMS.

`Edge Functions` representa a execução de funções no backend, com acesso ao banco e envio de e-mails por meio do Resend SMTP.

O [workflow de CI](../.github/workflows/ci.yml) executa lint, verificação de tipos, testes, build e E2E. O agrupamento CI/CD reúne GitHub Actions e `Supabase CLI / migrações`, com responsabilidades distintas: validação da aplicação e aplicação das migrações SQL, respectivamente.

## Propostas e divergências conhecidas

A [revisão de arquitetura de 2026-10-23](architecture-review-20261023-182214.html) sugere aprofundamentos dos módulos de leitura de curso, execução de aula e perfil. São propostas, ainda sem decisão ou implementação.

A leitura atual interpreta matrícula de forma diferente entre cartão, detalhe e trilha. Não use essa divergência como uma regra nova do produto: confira o fluxo afetado antes de modificá-lo. O relatório registra as evidências para discussão.
