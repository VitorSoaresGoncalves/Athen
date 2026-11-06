# Tipos de questão da plataforma

Este documento separa o comportamento **implementado atualmente** das **ideias para implementação futura**. A parte atual foi conferida no código da branch `sprint04`, commit `ae1caf0`. As propostas não representam funcionalidades disponíveis nem decisões de implementação aprovadas.

Uma questão é uma atividade de uma aula que recebe uma resposta para correção. Uma aula pode reunir questões de tipos diferentes ou conter somente material de estudo. Os termos de produto seguem o [glossário](../GLOSSARY.md).

## 1. Tipos implementados atualmente

Existem **quatro tipos** no editor de criação, na execução da aula e no corretor do banco:

| Tipo | Identificador no código | Interação do estudante | XP padrão no editor |
| --- | --- | --- | --- |
| Associação de pares | `match` | Escolher a correspondência de cada item | 2 |
| Múltipla escolha | `multiple_choice` | Marcar uma ou mais alternativas | 4 |
| Preenchimento de lacuna | `fill_blank` | Digitar uma resposta textual curta | 6 |
| Somatório | `sum_alternatives` | Marcar afirmativas e enviar a soma de seus valores | 8 |

Os valores da tabela são os padrões do editor de criação. A questão persistida possui seu próprio valor de XP; o console técnico permite alterá-lo. A pontuação efetivamente concedida depende da correção e do histórico de acertos, conforme as regras comuns abaixo.

### 1.1 Associação de pares

**Descrição:** relaciona conceitos de uma lista às suas correspondências. Serve para trabalhar vocabulário, definições, funções, causas e efeitos.

**Criação:** o autor informa os dois lados de cada par e pode adicionar ou remover pares. O editor exige ao menos um par, com ambos os lados preenchidos.

**Resposta:** para cada item à esquerda, o estudante escolhe uma opção em uma lista de seleção. As opções da direita são embaralhadas de forma estável por questão. A interface atual não usa linhas desenhadas nem arrastar e soltar. Todos os itens precisam receber uma seleção antes de verificar.

**Correção:** a questão conta como correta somente quando todos os pares estão certos. Entretanto, o corretor admite **XP parcial**, proporcional aos pares corretos, arredondado para baixo. Assim, uma questão pode render algum XP e ainda contar como incorreta no PAC.

**Exemplo:** `HTML → Estrutura` e `CSS → Aparência`. Com XP padrão 2, acertar somente um dos dois pares rende 1 XP no cálculo inicial; acertar ambos rende 2 XP e registra a questão como correta.

**Cuidado de autoria:** usar itens da esquerda distintos, pois a interface identifica as escolhas por esse texto. A validação atual não impede textos repetidos.

### 1.2 Múltipla escolha

**Descrição:** apresenta alternativas e pede que o estudante selecione todas as corretas. Pode ter apenas uma resposta correta ou várias; não há um tipo separado de seleção única.

**Criação:** o autor escreve o enunciado, informa ao menos duas alternativas preenchidas e marca ao menos uma como correta.

**Resposta:** o estudante marca ou desmarca alternativas, como caixas de seleção. É necessário selecionar ao menos uma para verificar. Mesmo quando só existe uma correta, a interface permite marcar várias.

**Correção:** compara o conjunto selecionado com o conjunto correto. Não pode faltar alternativa correta nem sobrar incorreta. A pontuação é integral no acerto e zero no erro, sem XP parcial.

**Exemplo:** na pergunta “Quais ações ajudam a estudar?”, `Revisar` e `Praticar` são corretas; `Ignorar o conteúdo` é incorreta. Marcar apenas Revisar não basta. Marcar Revisar e Praticar rende os 4 XP padrão, sujeito ao histórico de acertos.

### 1.3 Preenchimento de lacuna

**Descrição:** pede uma resposta textual curta para completar uma frase ou identificar um conceito. A lacuna é indicada pelo autor no enunciado; a tela oferece **um campo de resposta**, sem distribuir vários campos dentro da frase.

**Criação:** o autor fornece uma ou mais respostas aceitas. Por exemplo, pode aceitar dois sinônimos. Deve existir ao menos uma resposta não vazia.

**Resposta:** o estudante digita um texto e usa Verificar; o campo também permite envio por Enter. Texto vazio ou composto apenas de espaços não habilita a verificação.

**Correção:** compara a resposta às opções aceitas após remover diferenças de maiúsculas/minúsculas e acentos, aparar espaços das extremidades e reduzir sequências de espaços. Não há interpretação semântica de frases, correção aproximada de erros de digitação nem equivalência numérica com tolerância.

**Exemplo:** “A prática constante ajuda na _____.” O autor aceita `aprendizagem` e `aprendizado`. `APRENDIZAGEM` é aceita; `aprender` só será aceita se também estiver no gabarito. O acerto rende os 6 XP padrão; o erro rende zero.

### 1.4 Somatório

**Descrição:** atribui um valor numérico a cada afirmativa. O estudante seleciona as afirmativas consideradas corretas, e a resposta enviada é a **soma dos valores selecionados**.

**Criação:** o autor informa os valores e marca quais afirmativas são corretas. O editor sugere 1, 2 e 4 e calcula a soma esperada. Na interface atual de criação, cada afirmativa tem valor e marcação de correta, mas **não possui campo próprio de texto**: as frases devem ser escritas no enunciado. Na execução, a ausência de texto individual é apresentada como “Afirmativa de valor 1”, por exemplo.

**Resposta:** o estudante marca as afirmativas, acompanha a soma exibida e usa Verificar. É necessário selecionar ao menos uma; não há campo para digitar diretamente o total.

**Correção:** o banco compara a soma enviada à soma esperada. No fluxo do editor, a soma esperada vem dos valores marcados como corretos; configurações técnicas também podem fornecer um total explícito. O acerto rende o XP integral e o erro rende zero, sem pontuação parcial.

**Exemplo:** `1 — um curso contém módulos`, `2 — revisar impede aprender`, `4 — um módulo contém aulas`. As corretas são 1 e 4; a soma é 5 e o valor padrão é 8 XP.

**Cuidado de autoria:** preferir potências de dois distintas, como 1, 2, 4 e 8. O corretor compara o total, não o conjunto de afirmativas: com valores repetidos ou combinações que produzam a mesma soma, uma seleção diferente pode ser aceita. O editor atual não impede essa ambiguidade.

### 1.5 Regras comuns e limites atuais

- **Correção oficial:** Verificar pode oferecer feedback imediato, mas a finalização da tentativa no servidor determina o resultado persistido e o XP efetivo.
- **Repetição de acertos:** uma questão já acertada em outra tentativa finalizada pelo mesmo usuário não rende novo XP. A verificação desse histórico também abrange a mudança entre contexto de curso e de sala. O feedback imediato pode mostrar o valor nominal; conferir o total final.
- **Contextos:** atividades de curso podem gerar XP global; atividades de sala geram XP interno da sala. São métricas diferentes.
- **Conclusão e acerto:** responder todas as questões permite concluir a aula; não é necessário acertar todas. O PAC expressa acertos por questão, não o percentual de pares ou afirmativas acertados dentro de uma questão.
- **Aula sem questões:** não é um quinto tipo. É uma aula de conteúdo que pode ser marcada como concluída com zero XP no contexto de curso, pela função existente `complete_empty_lesson`. Esse caminho não conclui aulas vazias no contexto de sala.
- **Variações:** verdadeiro/falso pode ser representado por uma questão de múltipla escolha com essas duas alternativas, mas não existe como tipo independente. Menções a ordenação em material legado também não significam disponibilidade na versão atual.

### Fontes do comportamento atual

| Responsabilidade | Fonte |
| --- | --- |
| Tipos aceitos pelo modelo atual | [Enum de questões](../codigo-base/supabase/migrations/0001_extensions_and_enums.sql) |
| Nomes, valores padrão e validação de autoria | [Configuração das questões](../codigo-base/src/pages/criar-curso/questionConfig.ts) |
| Campos de criação para cada tipo | [Editor de configuração](../codigo-base/src/pages/criar-curso/EditarConfigQuestao.tsx) |
| Interações, respostas e feedback | [Modal de aula](../codigo-base/src/components/lesson/LessonModal.tsx) |
| Comparação de respostas e XP parcial de associação | [Função `grade_answer`](../codigo-base/supabase/migrations/0010_domain_functions.sql) |
| Finalização, contextos e repetição de acertos | [Regra de finalização vigente](../codigo-base/supabase/migrations/0018_no_xp_for_already_correct.sql) |
| Conclusão de conteúdo sem questões | [Função `complete_empty_lesson`](../codigo-base/supabase/migrations/0022_complete_empty_lesson.sql) |

## 2. Propostas de novos tipos — ainda não implementados

As seis ideias abaixo ampliam as formas de responder. **Nenhuma está disponível como tipo no editor, no modal ou no corretor atuais.** Exemplos de correção são propostas, não regras vigentes. Valores de XP, prioridade e critérios de aceitação ainda precisariam ser definidos.

### 2.1 Ordenação de sequência

**Ideia:** organizar itens em uma ordem lógica, cronológica ou de execução.

**Exemplo:** ordenar as etapas `Analisar o problema → Planejar a solução → Implementar → Testar`.

**Experiência proposta:** o autor cadastra os itens e a ordem esperada; o estudante move os itens com arraste ou controles de subir/descer acessíveis por teclado.

**Correção proposta:** comparar a sequência final com o gabarito. Definir se haverá crédito parcial por posições corretas e se mais de uma sequência poderá ser aceita.

**O que acrescenta:** avalia relações de precedência, que a associação de pares não representa diretamente. Embora um identificador de ordenação apareça como legado no repositório, esta proposta exigiria implementação no modelo atual.

### 2.2 Classificação em categorias

**Ideia:** distribuir vários itens entre grupos, permitindo que diferentes itens pertençam à mesma categoria.

**Exemplo:** classificar `HTML` e `CSS` em Apresentação, e `PostgreSQL` e `SQLite` em Banco de dados.

**Experiência proposta:** o autor define categorias, itens e seus destinos; o estudante escolhe uma categoria por item ou os move entre grupos.

**Correção proposta:** conferir a categoria de cada item, com possibilidade de pontuação proporcional. A primeira versão poderia exigir uma única categoria por item; participação em vários grupos precisaria de regra específica.

**O que acrescenta:** oferece uma interação de agrupamento de vários itens em poucas categorias, em vez de apenas selecionar correspondências individuais na associação atual.

### 2.3 Resposta numérica com tolerância e unidade

**Ideia:** responder a cálculos ou medições com um número, considerando arredondamento e unidade quando necessário.

**Exemplo:** para uma distância de 100 m percorrida em 20 s, responder `5 m/s`. Em outro exercício, aceitar `3,14` ou `3,1416` dentro da tolerância declarada.

**Experiência proposta:** o autor informa valor esperado, unidade e tolerância; o estudante preenche um campo numérico e, quando exigido, a unidade.

**Correção proposta:** converter a entrada para uma representação numérica e comparar com uma tolerância absoluta ou relativa definida pelo autor. Definir tratamento de vírgula/ponto decimal, unidades equivalentes e entradas inválidas.

**O que acrescenta:** a lacuna atual compara textos normalizados; ela não reconhece automaticamente equivalência entre números, unidades ou aproximações.

### 2.4 Resposta discursiva com avaliação por critérios

**Ideia:** elaborar uma explicação, justificativa ou solução em texto livre.

**Exemplo:** “Explique por que revisar um conteúdo em dias diferentes pode ajudar no aprendizado e proponha uma rotina de revisão.”

**Experiência proposta:** o autor define o enunciado e critérios de avaliação; o estudante envia o texto e acompanha o estado da correção. O educador atribui resultado e devolutiva.

**Correção proposta:** avaliação manual por critérios explícitos na primeira versão. O fluxo precisaria distinguir resposta enviada, avaliação pendente e resultado corrigido, além de decidir quando aplicar conclusão, PAC e XP. Comparação por palavras-chave não deveria ser tratada como avaliação suficiente do argumento.

**O que acrescenta:** avalia raciocínio e comunicação além da coincidência com uma resposta curta. Não pressupõe correção por IA nem disponibilidade imediata de nota automática.

### 2.5 Identificação de regiões em imagem

**Ideia:** identificar uma área, estrutura ou componente de uma imagem.

**Exemplo:** localizar o coração em um diagrama do corpo humano ou identificar a memória RAM em uma imagem de componentes de computador.

**Experiência proposta:** o autor envia uma imagem e delimita as regiões aceitas; o estudante seleciona uma região. Deve existir uma alternativa de interação por teclado e uma descrição adequada do conteúdo visual.

**Correção proposta:** verificar se a região selecionada corresponde ao gabarito, usando coordenadas normalizadas para preservar o resultado após redimensionamento. Definir margem nas bordas e regras para várias regiões corretas.

**O que acrescenta:** avalia reconhecimento espacial, sem reduzir a resposta à escolha de um rótulo textual. Exigiria armazenamento de imagens, editor de regiões e tratamento de acessibilidade.

### 2.6 Desafio de programação

**Ideia:** escrever um pequeno programa ou função para resolver um problema.

**Exemplo:** implementar `somar(a, b)` e verificar seu comportamento com diferentes entradas, incluindo valores negativos.

**Experiência proposta:** o autor escolhe uma linguagem, prepara o enunciado, código inicial e casos de teste; o estudante escreve o código, executa exemplos e envia a solução.

**Correção proposta:** executar os testes em um ambiente isolado, com limites de tempo, memória e acesso a recursos. Definir quais testes são visíveis, como resultados parciais serão apresentados e quando a tentativa será considerada concluída.

**O que acrescenta:** verifica comportamento executável, não apenas o texto do código. Exigiria um serviço de execução isolada; não deve executar código submetido diretamente no banco ou no processo principal da aplicação.

## 3. Pontos a definir antes de implementar uma proposta

Para transformar qualquer ideia em funcionalidade, detalhar:

1. Objetivo de aprendizagem, configuração do autor e formato da resposta do estudante.
2. Regras de correção: acerto completo, parcial, pendência de avaliação e feedback.
3. Efeito sobre conclusão, PAC, XP global, XP da sala e repetição de acertos.
4. Migração do modelo, tipos gerados, editor, modal e corretor oficial do servidor, conforme a [arquitetura](arquitetura.md) e a [referência de banco](banco-de-dados/documentacao-bd.md).
5. Validação de autoria, navegação por teclado, adaptação de tela e testes de respostas corretas, incorretas e incompletas.

Melhorias nos tipos existentes — como adicionar texto às afirmativas do somatório, impedir pares ambíguos ou oferecer seleção única explícita — podem ser planejadas separadamente. Elas não constituem novos tipos já implementados.
