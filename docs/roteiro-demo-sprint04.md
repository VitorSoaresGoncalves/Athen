# Roteiro de demo da sprint04 — duas contas novas

## Base e uso do roteiro

Base consultada: [`sprint04`, commit `d8cb318`](https://github.com/VitorSoaresGoncalves/Athen/commit/d8cb3181a84f62baed0a2fabda4bddeb343d4036), incluindo o PR #43 e a restauração do aviso do dashboard sem cursos. Roteiro elaborado por leitura das rotas, telas, componentes, consultas, tipos, SQL e configuração versionados. Não representa execução integral em um banco remoto.

O percurso principal começa sem contas ou conteúdo preparados e usa apenas duas contas. Os apêndices completam a cobertura com operações técnicas e casos que exigem repetição ou passagem de dias. Seguir os blocos na ordem: uma conta prepara os dados que a outra utilizará. Cada bloco informa ações e resultados observáveis, sem falas para apresentação.

## 1. Preparação

- Abrir dois perfis independentes de navegador: **janela A** e **janela B**. Duas abas normais do mesmo perfil compartilham a sessão; não servem para manter identidades diferentes.
- Usar a aplicação correspondente à base acima, com acesso ao Supabase e migrações numeradas até `0022`, incluindo `0020` de correção da RLS das salas. Conferir o catálogo de medalhas da `0013`, necessário à concessão de conquistas.
- Separar dois e-mails acessíveis, senhas e imagens pequenas para avatar/banner. Usar imagens abaixo de **2 MB**, compatíveis também com o limite do bucket no script versionado, embora a tela aceite arquivos maiores.
- Para uploads, conferir o bucket público `avatars` e suas políticas. Para indicadores e destaques públicos da home, conferir as funções de `home_public_data.sql`; a tela tem fallback, mas o acesso público depende do ambiente.
- Escolher um sufixo curto e exclusivo, por exemplo `demo04x`. Substituir `SUFIXO` em todos os dados a seguir, inclusive nos slugs. Não registrar senhas neste documento.
- Não executar `supabase/seed.sql`: ele prepara outras contas e pontuações, contrariando o início com duas contas novas. Não executar o runner SQL legado durante a apresentação.
- Reservar aproximadamente **60–90 minutos** para o percurso completo pela interface, incluindo digitação dos cursos. Os apêndices aumentam essa duração.

| Identificação | Conta A | Conta B |
| --- | --- | --- |
| Cargo no cadastro | Educador | Estudante |
| Username inicial | `educador_SUFIXO` | `estudante_SUFIXO` |
| Nome de exibição | Educador Demo | Estudante Demo |
| Uso | Criar cursos/salas; também estudar para comparar PAC | Matricular-se, estudar, avaliar, entrar na sala |

**Navegação importante:** o login envia para `/dashboard`. Uma conta sem matrícula nem sala permanece nessa página e vê “Você ainda não está matriculado em nenhum curso. Escolha um no Catálogo.” Usar **Ver todos os cursos** para abrir `/catalogo`, sem precisar digitar outra rota. Se houver uma sala com curso disponível, sua trilha pode ser aberta mesmo sem matrícula individual. As demais rotas da sidebar são `/salas`, `/ligas`, `/amigos`, `/caderno`, `/notificacoes` e `/configuracoes`.

Fontes: [rotas](../codigo-base/src/Hub.tsx), [login](../codigo-base/src/pages/LoginPage.tsx), [dashboard](../codigo-base/src/pages/Dashboard.tsx), [banco atual](banco-de-dados/documentacao-bd.md), [Storage](../codigo-base/supabase/avatars/supabase-avatars), [dados públicos](../codigo-base/supabase/home_public_data.sql), [testes e limites do ambiente](testes.md).

## 2. Visitante e criação das duas contas

| Ordem | Janela | Ação | Resultado a conferir |
| --- | --- | --- | --- |
| 1 | A, sem login | Abrir `/`; percorrer hero, indicadores, categorias, cursos em destaque, funcionamento, gamificação, comunidade/depoimentos e rodapé. Usar **Ver como funciona**. | Página pública e rolagem para a seção correspondente; dados ou estados vazios reais. |
| 2 | A | Selecionar uma categoria dos destaques e voltar à seleção geral. | Cursos exibidos filtrados, se houver conteúdo no ambiente. Repetir ao fim, quando os cursos da demo existirem. |
| 3 | A | Usar **Criar conta** ou **Começar grátis**. Preencher e-mail, senha de ao menos seis caracteres, **Cargo → Educador** e username A. Alternar **Mostrar/Ocultar** e cadastrar. | Mensagem de cadastro realizado e **Ir para o login**. |
| 4 | A | Confirmar o e-mail se o ambiente exigir; usar **Ir para o login**, informar e-mail e senha. Após entrar, conferir o aviso de ausência de matrícula e usar **Ver todos os cursos**. | Sessão A ativa; dashboard permanece acessível e o link abre o Catálogo. |
| 5 | B | Repetir cadastro e login, escolhendo **Cargo → Estudante** e username B. Conferir o mesmo aviso no dashboard e clicar em **Ver todos os cursos**. | Segunda sessão independente; link abre o Catálogo sem redirecionamento automático. |
| 6 | Ambas | Abrir o menu do cartão inferior da sidebar e **Ver perfil**. Conferir estado inicial de XP, nível, sequência, cursos e conquistas. | Identidades distintas; sem progresso artificial. |
| 7 | Ambas | **Editar perfil**: preencher nome de exibição, bio e manter o username planejado. Usar **Trocar foto**, **Trocar banner**, conferir previews e **Salvar**. | Perfil e cartão da sidebar atualizados. Recarregar para comprovar persistência. |
| 8 | A | Reabrir edição, alterar a bio e **Cancelar**. | Bio salva anteriormente permanece. |
| 9 | B | Abrir **Salas**, **Amigos**, **Cadernos** e **Notificações** antes das interações. | Estados iniciais sem sala, amizade, caderno ou notificação da demo. Voltar ao Catálogo. |

Os links públicos **Explorar**, **Comunidade**, **Ranking** e cards de curso da home apontam para rotas ainda ausentes (`/explorar`, `/comunidade`, `/ranking`, `/curso/:slug`). Não os usar como transição para as telas internas. O formulário de cadastro também não reaproveita automaticamente o e-mail digitado no hero.

Fontes: [home e componentes](../codigo-base/src/pages/home-page/HomePage.tsx), [navegação pública](../codigo-base/src/pages/home-page/navigation.ts), [dados/links públicos](../codigo-base/src/pages/home-page/data.ts), [cadastro](../codigo-base/src/pages/RegisterPage.tsx), [perfil](../codigo-base/src/pages/profile/Profile.tsx), [sidebar](../codigo-base/src/components/sidebar/SidebarLeft.tsx).

## 3. Conta A — criar o material da apresentação

### 3.1 Curso individual

No **Catálogo**, usar **Criar curso**. Antes de preencher, tentar **Publicar** e conferir a validação dos campos obrigatórios. Preencher os dados abaixo.

| Campo | Valor |
| --- | --- |
| Título | `Demo Athen — Estudo individual SUFIXO` |
| Slug | `demo-athen-individual-SUFIXO` em minúsculas |
| Descrição | `Curso da demo com quatro tipos de questão, revisão e leitura sem questões.` |
| Categoria | `Tecnologia` |
| Tags | `demo, estudo, sprint04` |
| Visibilidade | **Pública (aparece no catálogo)** |

Observar o slug sugerido e editá-lo. Os módulos/aulas são ordenados pela sequência de criação; o editor não oferece arrastar para reordenar.

| Ordem | Módulo e cor | Aula | Conteúdo de apoio | Questões |
| --- | --- | --- | --- | --- |
| 1 | `Fundamentos`, ciano `#06b6d4` | `Quatro formas de praticar` | `Uma variável guarda valores. Um curso contém módulos; módulos contêm aulas. Revisar e praticar ajudam a aprender.` | Q1–Q4 abaixo, nessa ordem |
| 2 | `Revisão`, violeta `#a855f7` | `Revisão rápida` | `Revise a organização do curso antes de responder.` | Q5 abaixo |
| 3 | Mesmo módulo `Revisão` | `Leitura de encerramento` | `Conclusão: registre o que aprendeu no caderno e continue estudando.` | Nenhuma |

Usar **Adicionar módulo**, **Adicionar aula** e **Adicionar questão**, conforme necessário. Demonstrar adicionar e remover uma aula/questão temporária ainda no formulário, sem remover as que compõem a tabela. Alterar o tipo de uma questão antes de preenchê-la: a troca reinicializa sua configuração.

### 3.2 Enunciados, configurações e gabarito

| Questão | Tipo no editor | Enunciado e configuração | Gabarito | XP padrão |
| --- | --- | --- | --- | --- |
| Q1 | Associação (pares) | `Associe cada conceito à sua função.` Pares: `Variável` ↔ `Guarda um valor`; `Função` ↔ `Organiza uma tarefa`. Usar **Adicionar par**. | Ambos os pares corretos | 2 |
| Q2 | Múltipla escolha | `Quais ações ajudam a estudar?` Alternativas: `Revisar` correta; `Praticar` correta; `Ignorar o conteúdo` incorreta. Usar **Adicionar alternativa** e marcar **Correta** nas duas primeiras. | Marcar somente Revisar e Praticar | 4 |
| Q3 | Preencher lacuna | `Complete: a prática constante ajuda na _____.` Respostas aceitas: `aprendizagem` e `aprendizado`. Usar **Adicionar resposta aceita**. | Qualquer uma das respostas aceitas | 6 |
| Q4 | Somatório | `Marque as afirmativas corretas: 1 — um curso contém módulos; 2 — revisar impede aprender; 4 — um módulo contém aulas.` Valores 1, 2, 4; marcar corretas 1 e 4. | Soma 5 | 8 |
| Q5 | Múltipla escolha | `O que um módulo contém?` Alternativas: `Aulas` correta; `Senhas de outros usuários` incorreta. | Somente Aulas | 4 |

No somatório, as frases ficam no **enunciado**: o editor das afirmativas oferece valor numérico e marcação de correta, sem campo de texto. Conferir **Soma esperada: 5**. Na execução, selecionar os valores correspondentes; não procurar um campo para digitar a soma.

Antes de publicar, verificar títulos, três aulas, quatro questões na primeira aula, uma na segunda e zero na última. Usar **Publicar**, aguardar retorno ao Catálogo e conferir o curso. **Não usar Salvar rascunho no curso principal**: o editor atual não carrega um curso já salvo para retomada. O console técnico permite outra forma de gestão, descrita no apêndice.

### 3.3 Curso exclusivo para a sala

Criar e **Publicar** outro curso, também público:

| Campo | Valor |
| --- | --- |
| Título / slug | `Demo Athen — Desafio em sala SUFIXO` / `demo-athen-sala-SUFIXO` em minúsculas |
| Categoria / tags | `Tecnologia` / `demo, sala` |
| Descrição | `Questões novas, reservadas para demonstrar a pontuação interna da sala.` |
| Módulo | `Desafio coletivo`, laranja `#f97316` |
| Aula | `Primeiro desafio da turma` |
| Apoio | `A pontuação obtida nesta atividade será acompanhada dentro da sala.` |
| Questão | Múltipla escolha: `Qual ação fortalece uma turma de estudos?` |
| Alternativas | `Compartilhar dúvidas` correta; `Impedir a participação` incorreta |
| XP | 4 |

**Não responder essa questão pelo Catálogo/dashboard de curso antes do bloco de sala.** A regra que impede ganhar XP repetindo acertos vale também entre contextos. O segundo curso evita que os acertos do primeiro zerem o XP interno da demo.

Fontes: [criação e publicação](../codigo-base/src/pages/criar-curso/CriarCurso.tsx), [editor dos quatro tipos](../codigo-base/src/pages/criar-curso/EditarConfigQuestao.tsx), [configurações e XP](../codigo-base/src/pages/criar-curso/questionConfig.ts), [edição de conteúdo publicado](../codigo-base/supabase/migrations/0019_course_edit_gating.sql), [repetição de acertos](../codigo-base/supabase/migrations/0018_no_xp_for_already_correct.sql).

Para consultar as regras de cada formato, usar [Tipos de questão](tipos-de-questao.md). Somente os quatro tipos da seção de funcionalidades implementadas entram nesta demo; as seis propostas futuras do documento não fazem parte do percurso.

## 4. Duas contas — ciclo social completo

| Ordem | Conta | Ação | Resultado |
| --- | --- | --- | --- |
| 1 | A | **Amigos**; buscar o username B com ao menos dois caracteres. Abrir o perfil encontrado. | Nome, bio, banner, nível e dados sociais da conta correta. |
| 2 | A | **Adicionar** B; abrir **Pedidos enviados**; **Cancelar pedido**. | Pedido removido da lista de pendentes. |
| 3 | A | Buscar B e **Adicionar** novamente. | Novo pedido enviado. |
| 4 | B | Reabrir **Notificações**; abrir **Novo pedido de amizade**. Em Amigos, abrir **Pedidos recebidos** e **Recusar**. | Notificação marcada como lida; pedido recusado. |
| 5 | A → B | A envia novamente; B abre **Pedidos recebidos** e **Aceitar**. Ambas reabrem Amigos. | A e B aparecem em **Meus amigos**; contagem de amigos no perfil pode ser conferida ao reabri-lo. |
| 6 | A | No cartão/perfil de B, **Lembrar de fazer uma aula** (ícone 👆). | Feedback **Amigo incomodado!**. |
| 7 | B | Reabrir Notificações e abrir **Lembrete para estudar**. | Evento recebido; abertura marca como lido e leva à lista de Amigos. |
| 8 | B | **Configuração → Lembrete de estudo**: desativar e **Salvar alterações**. Sair da página e voltar. | Preferência persiste. Registrar a quantidade atual de lembretes. |
| 9 | A → B | A reabre Amigos e envia outro lembrete. B reabre Notificações. | Nenhum novo lembrete para B; os antigos não são apagados. |
| 10 | B | Reativar Lembrete de estudo e salvar. | Preferência pronta para as próximas etapas. |

As listas não têm atualização em tempo real: reabrir a rota ou recarregar após ações feitas na outra conta. O feedback do lembrete em A é local da tela; não representa um limite de envios no servidor. Não esperar notificação de aceitação da amizade, que não faz parte desse fluxo.

Fontes: [Amigos](../codigo-base/src/pages/Amigos.tsx), [Notificações](../codigo-base/src/pages/Notificacoes.tsx), [Configuração](../codigo-base/src/pages/ConfigPage.tsx), [regras sociais e preferências](../codigo-base/supabase/migrations/0016_notifications_social_account.sql).

## 5. Conta B — catálogo, matrícula e estudo individual

### 5.1 Localizar e entrar

1. Abrir **Catálogo**; pesquisar `Demo Athen` e depois o título individual. Aplicar a categoria Tecnologia. Demonstrar uma busca sem resultados e limpar a busca.
2. Ativar o filtro de cursos em que está matriculado antes da matrícula e depois desativá-lo. Conferir os dois cursos públicos da demo.
3. Abrir o detalhe do curso individual. Conferir autor, descrição, tags, quantidade de módulos/aulas, avaliações e conteúdo dos módulos. Expandir/recolher os módulos.
4. Conferir que a avaliação própria pede matrícula e que ainda não há desempenho de B.
5. **Matricular-se**. Conferir abertura da trilha. Voltar ao Catálogo e ao detalhe, verificar o estado matriculado e **Continuar curso**; retornar à trilha.

### 5.2 Trilha e primeira tentativa

1. Conferir título ativo, fundo e cor do módulo, nós, trecho tracejado, progresso e carrossel de módulos.
2. Demonstrar arraste horizontal e roda do mouse; usar as setas do carrossel para selecionar os módulos e observar a mudança de tema.
3. Selecionar uma aula posterior bloqueada e clicar nela novamente. Conferir o aviso para concluir a anterior. Voltar à primeira aula.
4. Um clique seleciona a aula; outro clique na aula selecionada abre o modal. Ler o apoio e conferir a quantidade de quatro questões e o XP potencial. Os tipos aparecem durante a execução.
5. **Começar atividade**. Responder Q1 corretamente e **Verificar**. Na Q2, marcar **somente Revisar**, deixando de marcar Praticar, para provocar um erro. Conferir o feedback e a resposta esperada. Responder Q3 com `APRENDIZAGEM` e Q4 com valores 1 e 4. Usar os controles de próxima questão até **Finalizar aula**.
6. Conferir resultado **3/4 acertos**, **75%**, **+16 XP**. A aula fica concluída porque todas as questões foram respondidas, mesmo havendo erro. Fechar o resultado e observar o avanço da seleção.
7. Reabrir a primeira aula e **Refazer atividade**. Acertar as quatro questões. No resultado oficial, conferir **4/4**, **100%**, **+4 XP**: somente o acerto novo da Q2 rende XP. O feedback de cada questão pode mostrar seu valor nominal; a pontuação efetivamente concedida é a da finalização.
8. Reabrir novamente se quiser comprovar a regra completa: uma terceira tentativa toda correta rende **0 XP** adicional. Esta repetição altera o PAC agregado; os números da tabela abaixo assumem apenas duas tentativas nessa aula.

### 5.3 Concluir o curso e a aula sem questões

1. Abrir **Revisão rápida**; acertar Q5, verificar e finalizar: **+4 XP**.
2. Abrir **Leitura de encerramento**, ler o conteúdo e usar **Marcar como concluída**.
3. Conferir a conclusão **sem XP** e a trilha atualizada. Não procurar **Começar atividade** nessa aula, pois ela não tem questões.
4. Reabrir Catálogo/detalhe e Perfil para conferir o progresso persistido. Sair e voltar a **Início** depois de já existir matrícula para demonstrar retomada; a seleção inicial é a primeira aula pendente, quando houver.

| Momento, sem tentativas extras | XP global de B | Desempenho acumulado de curso | Conclusões do curso |
| --- | --- | --- | --- |
| Primeira execução da aula Q1–Q4 | 16 | 3/4 = 75% | 1/3 aulas |
| Segunda execução, toda correta | 20 | 7/8 = 87,5% | Continua 1/3 |
| Q5 correta | 24 | 8/9 ≈ 88,89% | 2/3 |
| Leitura sem questões | 24 | Permanece 8/9 | 3/3 = 100% |

O PAC considera tentativas finalizadas, não apenas a melhor tentativa. A interface pode arredondar 87,5% para 88% e 88,89% para 89%. O progresso do rodapé do dashboard é **do módulo ativo**, enquanto o detalhe do Catálogo e o Perfil mostram o **curso**. Não confundir os dois indicadores.

Fontes: [Catálogo](../codigo-base/src/pages/Catalogo.tsx), [Dashboard](../codigo-base/src/pages/Dashboard.tsx), [modal e correção](../codigo-base/src/components/lesson/LessonModal.tsx), [XP/PAC e conclusão](../codigo-base/supabase/migrations/0018_no_xp_for_already_correct.sql), [aula vazia](../codigo-base/supabase/migrations/0022_complete_empty_lesson.sql).

## 6. Conta B — cadernos, páginas e avaliação

### 6.1 Caderno flutuante e estante

1. No dashboard do curso individual, clicar no botão **+** do caderno (**Criar notebook**). Conferir criação e abertura do editor flutuante.
2. Na primeira página, escrever `Revisar e praticar ajudam a aprender.`; renomear a aba com duplo clique para `Fundamentos` e **Salvar**.
3. Criar outra página pelo **+**, renomear para `Revisão`, escrever e salvar. Alternar entre as páginas.
4. Arrastar a janela pelo cabeçalho, redimensionar pelas bordas/cantos e fechar pelo **×**. Reabrir pelo botão do caderno e conferir o texto salvo.
5. Alterar o texto sem salvar e tentar trocar de página/fechar. Cancelar o descarte na confirmação, salvar e só então fechar.
6. Abrir **Cadernos** na sidebar (`/caderno`). Pesquisar pelo curso; demonstrar busca sem resultado e limpar.
7. Abrir o caderno criado no dashboard. Conferir as mesmas páginas/textos, usar **Editar nome → Concluir** no título de uma página, editar texto e **Salvar**.
8. **+ Nova página**; preencher uma página temporária, salvar, **Apagar página** e confirmar. Usar **Voltar para a estante**.
9. Para demonstrar renomeação do próprio notebook sem perder o vínculo de uso, **Editar nome** do notebook, salvar, conferir e restaurar **exatamente o título do curso** antes de voltar ao dashboard. O vínculo é procurado pelo título, não por uma coluna `course_id`.
10. Mais adiante, quando a sala estiver disponível, abrir seu curso pelo seletor e criar um segundo caderno. Voltar à estante para demonstrar **Trocar notebook** entre dois registros.

A estante não tem botão de criação livre: criar o caderno pelo dashboard. A exclusão de notebook inteiro é oferecida pelo editor flutuante; para demonstrá-la, usar o segundo caderno temporário, depois de conferir a troca entre eles. A conta A pode abrir Cadernos e comprovar que não vê as anotações pessoais de B.

### 6.2 Avaliar o curso

1. B abre **Catálogo → curso individual → Sua avaliação**.
2. Selecionar 4 estrelas, escrever `Pratiquei os quatro tipos de questão.` e **Enviar avaliação**.
3. Fechar/reabrir; conferir a nota e comentário persistidos. Alterar para 5 estrelas, ajustar o comentário e **Atualizar**.
4. A reabre o Catálogo e confere a média/quantidade da avaliação de B.
5. B usa **Remover**, confere a ausência da avaliação e envia novamente 5 estrelas com comentário. Manter essa avaliação para a volta à home.

O comentário dessa tela pertence à **avaliação do curso**. Não apresentar como mural público de comentários encadeados: há repositório para comentários, mas a interface atual não oferece esse fluxo.

Fontes: [caderno flutuante](../codigo-base/src/components/notebook/CursoNotebook.tsx), [estante/editor](../codigo-base/src/pages/Notebook.tsx), [avaliação](../codigo-base/src/pages/Catalogo.tsx), [persistência de cadernos e avaliações](../codigo-base/src/data/repositories.ts).

## 7. Conta A — estudar para comparar; ambas — TopDown, perfil e Ligas

1. A abre o curso individual no Catálogo e **Matricular-se**; executa a primeira aula acertando Q1–Q4 uma vez. Conferir **+20 XP**, PAC de curso **100%** e primeira aula concluída.
2. A e B reabrem o dashboard desse mesmo curso e o puxador superior direito **Abrir painel**. Conferir **Rank de amigos**: A e B, indicação de **Você** e comparação por PAC, não por XP global. No plano sem tentativas extras, A tem 100%; B aproximadamente 89%.
3. Conferir o bloco **Missões**. Sem preparação técnica, o resultado esperado é **Nenhuma missão ativa nas suas salas.** Fechar pelo puxador ou clique fora. O apêndice mostra como demonstrar leitura/persistência real de missões.
4. Ambas abrem **Ver perfil** novamente: conferir XP global, nível 1, sequência de estudo do dia, quantidade de aulas e amigos, última aula concluída, **Meus cursos**, **Em andamento/Concluídos** e **Continuar curso**.
5. **Editar perfil → Medalhas**: selecionar a conquista de primeira aula adquirida e **Salvar**. A outra conta reabre Amigos e confere a medalha no cartão/perfil e seu tooltip.
6. Ambas abrem **Ligas** (`/ligas`): conferir **Sua liga**, **Top 5 da liga**, **Sua jornada**, posição, XP acumulado, progresso para a próxima liga e identificação **VOCÊ**. Alternar ligas e observar listas reais ou estados vazios.

Com 20 e 24 XP, ambas continuam no nível 1/Bronze. A extensão de progressão adiante alcança o nível 2 sem editar pontuação manualmente. Ligas usa XP global/nível acumulado; o ranking de amigos usa PAC por curso; o ranking da sala usa métricas internas. Não há reinício semanal implementado.

Fontes: [TopDown](../codigo-base/src/components/sidebar/SidebarRight.tsx), [consultas do painel](../codigo-base/src/components/sidebar/top-down-dados.ts), [ranking no banco](../codigo-base/supabase/migrations/0015_rankings.sql), [Perfil](../codigo-base/src/pages/profile/Profile.tsx), [Ligas](../codigo-base/src/pages/Ligas.tsx), [medalhas e sequência](../codigo-base/supabase/migrations/0010_domain_functions.sql).

## 8. Ambas — sala, código, mural e atividade com XP interno

| Ordem | Conta | Ação | Resultado esperado |
| --- | --- | --- | --- |
| 1 | A | **Salas → Adicionar sala**. No formulário **Criar sala**, nomear `Turma Demo Sprint04 SUFIXO`, vincular **Desafio em sala** e escolher **Membros da sala** em **Quem pode ver o PAC dos alunos**. **Criar sala**. | Sala criada e código exibido. |
| 2 | A | Abrir o cartão; conferir curso/educador e **Copiar** código. | Inicialmente 0 membros: o criador não é matriculado automaticamente como participante da sala. |
| 3 | A → B | A usa **Desativar código**. B abre **Adicionar sala → Entrar com código**, informa o código e **Entrar na sala**. | Ingresso recusado enquanto o código estiver desativado. |
| 4 | A → B | A **Reativar código**. B repete o ingresso. | Sucesso e cartão da sala em B. A reabre a lista e confere 1 membro. |
| 5 | A | Abrir sala; em **Novo aviso**, preencher título `Atividade da turma` e mensagem `Resolva o primeiro desafio e registre uma anotação.`; **Publicar aviso**. | Aviso persistido com título, mensagem e data. |
| 6 | B | Fechar/reabrir o modal da sala. Conferir o mural e expandir o módulo em **Trilha de aprendizagem da sala**. | Aviso visível e aula disponível. |
| 7 | B | **Fazer aula** em **Primeiro desafio da turma**; começar, marcar Compartilhar dúvidas, verificar e finalizar. | Aula concluída, 1/1 acerto e +4 XP no contexto da sala. |
| 8 | B | Conferir **Seu desempenho na sala**, PAC, aulas concluídas e Top 5. Depois reabrir Perfil/Ligas. | XP interno da sala cresce; XP global de B permanece **24** neste ponto. |
| 9 | A | Reabrir a sala e conferir B no ranking. Para mostrar dois participantes, ingressar pelo próprio código e fazer a mesma aula na conta A. | Duas contas no ranking; cada uma tem acertos/XP próprios. XP global de A permanece 20. |
| 10 | Ambas | Buscar sala por nome/curso/educador. **Filtrar**: ordem alfabética e quantidade de membros; **Aplicar** e depois **Limpar**. | Busca/ordenação real, inclusive sem resultados. |
| 11 | B | Voltar ao dashboard de curso individual e abrir **≡ → Salas**; selecionar a turma. Conferir a trilha do curso vinculado e abrir uma aula. Depois **≡ → Cursos** e voltar ao individual. | Seleção de curso/sala sem misturar os registros de conclusão. Repetir atividade já acertada pode render zero XP. |
| 12 | B | No contexto da sala, criar/abrir o segundo caderno citado no bloco 6; depois conferir ambos na estante. | Anotações disponíveis sem alterar o XP. |

Para demonstrar a outra opção de visibilidade de PAC, A pode criar uma segunda sala de teste com **Só o educador**. A e B devem ingressar pelo código para haver dois participantes: B vê a própria métrica, mas não o PAC de A; A, como educador, pode ver o PAC de B. Para o estado sem conteúdo, criar uma sala temporária com **Sem curso** e abrir seu detalhe. Nenhuma dessas salas exige uma terceira conta.

Não colocar leitura sem questões como primeira etapa da trilha de sala: a conclusão sem questões só existe no contexto de curso. A tela de Salas também não oferece remover participante, sair da sala, editar/apagar aviso ou criar missão; não reservar cliques para botões inexistentes.

Fontes: [Salas](../codigo-base/src/pages/Salas.tsx), [ingresso e acesso](../codigo-base/supabase/migrations/0010_domain_functions.sql), [RLS das salas](../codigo-base/supabase/migrations/0020_fix_room_members_rls_recursion.sql), [pontuação por contexto](../codigo-base/supabase/migrations/0018_no_xp_for_already_correct.sql), [seletor da trilha](../codigo-base/src/pages/Dashboard.tsx).

## 9. Extensão pela interface — subida de nível e conquistas

Executar antes das alterações finais de conta caso seja necessário mostrar mudança de nível, e não apenas seus indicadores.

1. A cria um terceiro curso público, `Maratona da Demo SUFIXO`, com slug exclusivo, um módulo e **10 aulas distintas**. Cada aula recebe uma questão de Somatório com os valores 1, 2 e 4, marcando 1 e 4 como corretos. Usar títulos `Prática 01` a `Prática 10` e o enunciado `Marque os valores 1 e 4.`. Publicar.
2. B se matricula e executa as dez aulas, acertando cada uma: **10 × 8 = 80 XP novos**. Não reutilizar IDs de questões antigas pelo console; a criação pela interface produz novas questões.
3. Reabrir Perfil e Ligas em B: **24 + 80 = 104 XP**, **nível 2/Prata**, sem somar os 4 XP internos da sala. Conferir a medalha por dez aulas distintas, se o catálogo de medalhas estiver provisionado. Destacar a nova conquista e conferi-la em Amigos na conta A.
4. Para a conquista de cinco cursos concluídos, A cria mais **três cursos públicos mínimos**, cada um com um módulo e uma aula de leitura sem questões. B se matricula e conclui cada leitura. Junto ao individual e à Maratona, são cinco cursos concluídos, sem ganhar XP adicional pelas leituras. Reabrir Perfil e conferir a conquista correspondente.
5. A conquista de sequência de sete dias exige atividades em **sete dias consecutivos**. Em demo de uma sessão, mostrar a conquista bloqueada e a sequência do primeiro dia; não alterar relógio ou dados para simular aquisição real.

Fontes: [constantes e concessão de medalhas](../codigo-base/supabase/migrations/0010_domain_functions.sql), [catálogo de medalhas](../codigo-base/supabase/migrations/0013_seed.sql), [níveis e Ligas](../codigo-base/src/pages/Ligas.tsx).

## 10. Fechamento pela interface — configurações, notificações e sessão

1. B abre **Configuração**; altera **Nome display**, salva, sai e reabre a página. Se alterar também o username, anotar o novo valor e não reutilizar o antigo nas buscas sociais dos apêndices.
2. Alternar **Atualização de curso** e **Pedido de amizade**, salvar e reabrir para conferir persistência; deixar ambos ativados antes de gerar os eventos técnicos do apêndice.
3. Na seção Senha, preencher nova senha e confirmação diferentes, **Salvar alterações** e conferir a validação. Em seguida informar uma nova senha válida e confirmação iguais e salvar. O campo **Senha atual** existe, mas o submit atual não o usa para reautenticar: não apresentá-lo como verificação efetiva da senha anterior.
4. Menu inferior **Sair da conta**. Tentar abrir `/profile` sem sessão: conferir retorno à home. Fazer login com e-mail e **nova senha**, conferindo que o acesso volta a funcionar.
5. Abrir **Notificações**, examinar os eventos recebidos e **Marcar todas como lidas**. Conferir o estado **Tudo em dia.** quanto às não lidas. Não esperar exclusão dos registros.
6. A sair da conta e voltar à home pública. Selecionar a categoria Tecnologia e localizar os cursos publicados; conferir indicadores e avaliação/comentário de B caso os critérios e funções públicas do ambiente os incluam. A ordem/limite dos destaques pode impedir que um registro específico apareça. Reentrar se for executar os apêndices.
7. Em B, abrir **Excluir conta** e **Cancelar** no roteiro principal. Confirmar a desativação somente após terminar todos os apêndices e comparações, se essa operação fizer parte da apresentação.

A operação chamada **Excluir conta** usa desativação: anonimiza dados pessoais, marca o perfil como desativado, cancela pedidos pendentes e remove participações ativas. Não é apagamento físico do usuário Auth, dos cursos ou do histórico. Não demonstrar como garantia de impossibilidade de novo login. Alteração de e-mail, recuperação de senha, login por username, OAuth e OTP não têm fluxo de usuário final nessas telas.

Fontes: [Configuração](../codigo-base/src/pages/ConfigPage.tsx), [proteção de sessão](../codigo-base/src/components/SupabaseConnect.tsx), [Notificações](../codigo-base/src/pages/Notificacoes.tsx), [desativação](../codigo-base/supabase/migrations/0016_notifications_social_account.sql), [dados públicos](../codigo-base/src/pages/home-page/services.ts).

## 11. Apêndice técnico — recursos persistidos sem fluxo completo de produto

Este bloco é parte da cobertura técnica, separado do caminho pela interface. Executar apenas em ambiente de demonstração. Os exemplos de console abaixo exigem **servidor Vite de desenvolvimento**, o navegador já autenticado como A ou B e o mesmo endereço usado pela aplicação. Não funcionam como comandos de console de um build estático. Usam a sessão normal e suas políticas RLS, sem chaves administrativas.

### 11.1 Missões e progresso preparado

Não há editor de missões na tela de Salas nem no console CRUD. Há repositórios, políticas, notificação e leitura no TopDown. Não há automação versionada que converta respostas em progresso de missão ou credite `reward_xp`. O roteiro demonstra **registros preparados manualmente**, sem atribuir a eles uma conquista automática.

1. Depois de B ingressar na turma, abrir o console do navegador **A** e executar, substituindo o sufixo:

```js
var demoRepos = await import('/src/data/repositories.ts');
var demoCliente = (await import('/src/lib/supabase.ts')).supabase;
var demoA = (await demoCliente.auth.getUser()).data.user;
var demoSala = (await demoRepos.salaRepository.listar()).find(
  s => s.name === 'Turma Demo Sprint04 SUFIXO' && s.educator_id === demoA?.id
);
if (!demoA || !demoSala) throw new Error('Conta A ou sala própria não encontrada.');
var demoMissao = await demoRepos.missaoRepository.criar({
  room_id: demoSala.id,
  author_id: demoA.id,
  title: 'Missão de demonstração',
  description: 'Registro manual para demonstrar leitura e persistência.',
  deadline: new Date(Date.now() + 86400000).toISOString(),
  reward_xp: 10,
  min_correct: 1,
  status: 'published',
});
await demoRepos.missaoRepository.notificarSala(demoMissao.id);
```

2. B reabre Notificações: conferir o evento de missão e sua navegação para Salas. Abrir o dashboard de um curso e o painel superior: conferir título, prazo, rótulo +10 XP e progresso inicial. As missões visíveis podem vir de qualquer sala autorizada, com limite de três missões ativas.
3. No console do navegador **B**, preparar progresso de 50%:

```js
var demoRepos = await import('/src/data/repositories.ts');
var demoCliente = (await import('/src/lib/supabase.ts')).supabase;
var demoB = (await demoCliente.auth.getUser()).data.user;
var demoSala = (await demoRepos.salaRepository.listar()).find(
  s => s.name === 'Turma Demo Sprint04 SUFIXO'
);
if (!demoB || !demoSala) throw new Error('Conta B ou sala não encontrada.');
var demoMissao = (await demoRepos.missaoRepository.listarPorSala(demoSala.id))
  .find(m => m.title === 'Missão de demonstração');
if (!demoMissao) throw new Error('Missão não encontrada.');
await demoRepos.progressoMissaoRepository.salvar({
  mission_id: demoMissao.id, user_id: demoB.id,
  progress: 50, completed: false,
});
```

4. Recarregar o dashboard de B e abrir o painel: conferir 50%. Executar a mesma chamada final com `progress: 100, completed: true`, recarregar e conferir **Concluída**. O XP global não deve aumentar por esse registro manual. `min_correct` não tem cálculo automático implementado.

### 11.2 Convite de sala e aviso de atualização de curso

Com A autenticada, a turma existente e B já matriculada no curso individual, executar no console **A**. Os dois eventos têm RPC/repositório, mas não botões correspondentes no fluxo principal:

```js
var demoRepos = await import('/src/data/repositories.ts');
var demoCliente = (await import('/src/lib/supabase.ts')).supabase;
var demoA = (await demoCliente.auth.getUser()).data.user;
if (!demoA) throw new Error('Entrar na conta A antes de continuar.');
var demoB = await demoRepos.usuarioRepository.obterPorUsername('estudante_SUFIXO');
var demoSala = (await demoRepos.salaRepository.listar()).find(
  s => s.name === 'Turma Demo Sprint04 SUFIXO' && s.educator_id === demoA?.id
);
var demoCurso = (await demoRepos.cursoRepository.listarPorCriador(demoA.id))
  .find(c => c.slug === 'demo-athen-individual-SUFIXO'.toLowerCase());
if (!demoA || !demoB || !demoSala || !demoCurso) throw new Error('Dados da demo não encontrados.');
await demoRepos.salaRepository.convidarUsuario(demoSala.id, demoB.id);
await demoRepos.cursoRepository.notificarAtualizacao(demoCurso.id);
```

Em B, reabrir Notificações e conferir convite/atualização. Os links levam a listas gerais, não abrem automaticamente o item identificado. O convite é uma notificação; **não inscreve B na sala**. A chamada de atualização é um envio explícito de aviso para a demo; não comprova edição do conteúdo nem disparo automático ao editar. Repetir o aviso com a preferência Atualização de curso desativada em B para conferir a supressão, depois reativá-la.

### 11.3 Console CRUD e rascunhos

1. A acessa **`/crud`** diretamente. Percorrer **Usuários, Cursos, Módulos, Aulas, Questões, Salas e Matrículas**, usando **Atualizar lista**. A rota exige sessão, não uma verificação de administrador; as operações continuam limitadas pelas políticas do banco.
2. Editar somente o próprio perfil e salvar. Não usar **Criar usuário**, que geraria uma terceira conta e pode trocar a sessão atual.
3. Para demonstrar **Salvar rascunho**, A cria pela tela `/criar-curso` um curso temporário `Rascunho Demo SUFIXO`, com um módulo e uma aula mínima, e salva como rascunho. Conferir sua ausência no catálogo público e sua existência na aba Cursos de `/crud`.
4. No console, selecionar esse rascunho por título/ID, **Alterar**, mudar a descrição e salvar. Anotar os IDs do curso, módulo e aula nas abas correspondentes. Na aba Questões, criar uma questão temporária vinculada à aula, inspecionar seu JSON, XP e posição; alterar e remover essa questão. Não alterar questões do curso principal já publicado.
5. Se desejar demonstrar publicação e privacidade de um registro persistido, alterar esse rascunho para `published` e `private` no console: B não deve encontrá-lo no catálogo; A o encontra no console. Depois mudar a visibilidade para `public` e conferir sua aparição no catálogo de B. Deixar claro que a gestão ocorre pelo console técnico, e não por retomada no editor de criação.
6. Para concluir o CRUD sem apagar material principal, excluir somente o curso temporário e conferir a lista atualizada. As relações filhas podem ser removidas por cascata. Não excluir os perfis das duas contas.
7. Demonstrar criação/edição/exclusão de uma sala temporária sem curso pela aba Salas. Em Matrículas, mostrar a própria matrícula e progresso, sem sobrescrever os registros usados para conferir XP/conclusão da demo.

O console expõe operações técnicas que não são uma experiência administrativa completa. Os scripts em `supabase/administrador/` usam nomes de tabelas legadas; não os usar para promover essas contas. O cadastro Educador/Estudante não concede privilégios de administrador.

Fontes do apêndice: [repositórios](../codigo-base/src/data/repositories.ts), [missões e progresso](../codigo-base/supabase/migrations/0005_rooms_members_announcements_missions.sql), [políticas](../codigo-base/supabase/migrations/0011_rls_policies.sql), [notificações por ação](../codigo-base/supabase/migrations/0016_notifications_social_account.sql), [TopDown](../codigo-base/src/components/sidebar/top-down-dados.ts), [console CRUD](../codigo-base/src/pages/CrudConsole.tsx).

## 12. Cobertura e limites para conferência antes da apresentação

| Área implementada | Onde demonstrar | Limite a respeitar |
| --- | --- | --- |
| Home com dados, filtro e seções | Blocos 2 e 10 | Links públicos sem rota e dependências das funções públicas; sem prometer depoimento específico no destaque |
| Cadastro, cargos, login e sessão | Blocos 2 e 10 | Só e-mail/senha na interface; confirmação depende do Auth |
| Dashboard sem matrícula nem sala e acesso ao Catálogo | Bloco 2 | Deve permanecer no dashboard com o aviso; o acesso por sala continua disponível quando houver curso vinculado |
| Perfil, bio, avatar, banner e cancelamento | Bloco 2 | Storage precisa estar provisionado |
| Criação de curso/módulo/aula e quatro tipos de questão | Bloco 3 | Sem edição/retomada no editor principal; sem campo de ícone de módulo ou explicação de questão nesse editor |
| Publicação, privado/rascunho e gestão técnica | Blocos 3 e 11 | O catálogo principal só lista públicos publicados; restrições de edição pós-publicação vêm do banco |
| Catálogo, busca, categoria, matrícula, detalhes | Bloco 5 | Usar `/catalogo`; não pressupor fluxo de abandono de matrícula pela UI |
| Trilha, bloqueio, temas, carrossel e retomada | Bloco 5 | Progresso de módulo é diferente do curso; acesso a conteúdo privado segue RLS |
| Correção, erros, nova tentativa e XP sem repetição | Bloco 5 | Resultado oficial é o da finalização; acerto antigo não gera novo XP, mesmo entre curso/sala |
| Conclusão sem questões | Bloco 5 | Só contexto de curso e migração `0022` aplicada |
| Caderno pessoal, páginas, busca, edição, persistência e exclusão | Bloco 6 | Criação no dashboard; associação por título; sem compartilhamento social de caderno |
| Avaliar, atualizar e remover avaliação | Bloco 6 | Comentário da avaliação não é sistema de discussão encadeada |
| Amigos, pedidos, cancelamento, recusa, aceite e lembrete | Bloco 4 | Cursos realizados pelo amigo não estão implementados no modal |
| Rank de amigos por PAC | Bloco 7 | Precisa amizade aceita e tentativas no mesmo curso; sem misturar com XP global |
| Salas, código, PAC, mural, aula e ranking interno | Bloco 8 | Sem gestão de participantes/missões pela tela de salas |
| Nível, Ligas, sequência, medalhas e destaque | Blocos 7 e 9 | Sete dias de sequência não cabem em sessão única; sem reset semanal nem medalha a cada módulo |
| Preferências, senha, leitura de notificações e desativação | Blocos 4 e 10 | E-mail desabilitado; senha atual não é validada; desativação não é exclusão física |
| Missões, progresso, convite e aviso de atualização | Bloco 11 | Parte técnica/manual; não há progresso/recompensa automática de missão |
| CRUD de entidades e inspeção técnica | Bloco 11 | Sem terceira conta; respeitar RLS e usar registros temporários |

Pagamento de cursos, chat, cronômetro de estudo, desafios diários automáticos, certificados, OAuth/SMS e administração irrestrita não devem ser apresentados como recursos concluídos apenas por aparecerem em textos, diagramas, dependências ou métodos auxiliares. Configuração de build, CI, testes e scripts é material técnico de apoio, não uma terceira jornada de usuário; consultar [arquitetura](arquitetura.md), [tecnologias](tecnologias-utilizadas.md) e [testes](testes.md).

### Checklist de ensaio

- [ ] As duas sessões estão separadas e a identidade foi conferida antes de cada troca.
- [ ] Antes da primeira matrícula, ambas as contas permaneceram no dashboard com o aviso e abriram o Catálogo por **Ver todos os cursos**.
- [ ] Slugs/usernames são exclusivos e as duas caixas de e-mail estão acessíveis.
- [ ] A confirmou os dois cursos publicados e o curso de sala tem questões distintas.
- [ ] B percorreu matrícula → tentativa com erro → revisão → leitura vazia → curso concluído.
- [ ] Os totais observados foram anotados; tentativas adicionais foram consideradas no PAC.
- [ ] Caderno flutuante e estante mostram os mesmos dados de B; A não vê o caderno de B.
- [ ] Amizade e lembrete foram observados nos dois lados, reabrindo as rotas.
- [ ] Sala exibiu ingresso, mural e atividade no contexto correto; XP global não foi somado ao interno.
- [ ] Perfil, medalhas e Ligas foram recarregados antes da comparação.
- [ ] Casos técnicos/manuais foram identificados como tais; nenhuma missão foi apresentada como automática.
- [ ] Alterações de senha e eventual desativação ficaram para o final.
- [ ] Cada divergência do ambiente foi registrada; o roteiro não foi tratado como prova de banco remoto validado.
