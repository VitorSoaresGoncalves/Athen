create extension if not exists "pgcrypto";   - Adiciona a extensão que permite geração de IDs automaticamente

do $$ - cria uma área com lógica de computação, para usar if, else, while etc…

select 1 from pg_type where typnamespace = 'public'::regnamespace
    and typname = 'course_level'
  ) then
    create type public.course_level as enum (
      'Beginner', 'Intermediate', 'Advanced'
    );

O SELECT 1 é uma convenção no SQL usada para verificar se um registro existe, sem gastar memória trazendo dados reais da tabela. Em vez de retornar colunas inteiras com informações pesadas, o banco apenas devolve o número 1 para cada linha encontrada.
pg_type é uma tabela de catálogo do sistema interna do PostgreSQL que funciona como um "dicionário" de todos os tipos de dados reconhecidos pelo seu banco.
ele busca em todas as informações públicas (esse nivel de acesso será definido posteriormente), ::regnamespace( busa por ID em vez do nome public), e caso a consulta confirme que esse tipo ainda não existe, o comando CREATE TYPE public.course_level AS ENUM ('Beginner', 'Intermediate', 'Advanced'); cria oficialmente esse novo tipo de dado personalizado dentro do schema public. Os ENUM no geral fazem isso, criam tipos de atributos que só aceitam alguns valores específicos no nosso banco de dados.

create table public."Usuario" (
  "ID" uuid primary key references auth.users (id) on delete cascade,
  "Nome_Display" text not null default 'Athen learner',
  "Avatar_Url" text,
  "Biografia" text not null default '',
  "Cargo" text not null default 'learner' check ("Cargo" in ('learner', 'creator', 'moderator')),
  "Nome_Usuario" text unique,
  "Data_Criacao" timestamptz not null default now(),
  "Data_Atualizacao" timestamptz not null default now()
);
crio todas as tabelas, 

"ID": Nome da coluna. As aspas duplas exigem que o PostgreSQL respeite exatamente as letras maiúsculas da palavra.

uuid: Tipo de dado da coluna (Universally Unique Identifier), um código numérico/hexadecimal único no mundo de 128 bits.

primary key: Marca o campo como a Chave Primária da tabela Usuario. Garante que não existam dois usuários com o mesmo ID e que o campo nunca fique em branco (NOT NULL).

references auth.users (id): Cria uma Chave Estrangeira (Foreign Key). Vincula este ID diretamente ao campo id da tabela interna do Supabase (auth.users), associando cada perfil público de usuário à sua conta de login real.

on delete cascade: Regra de exclusão em cascata. Se o cadastro do usuário for deletado da tabela principal de login (auth.users), o banco apaga automaticamente a linha correspondente nesta tabela Usuario, evitando dados órfãos no sistema.

timestamptz: Tipo de dado (Timestamp with Time Zone). Guarda a data e a hora exatas incluindo a informação do fuso horário. Ele ajusta automaticamente o horário exibido dependendo do fuso de quem está consultando os dados.

not null: Restrição de integridade. Impede que o campo fique vazio (NULL), garantindo que todo registro tenha uma data vinculada.

default now(): Valor padrão automático. Se a sua aplicação não enviar esse campo na hora de criar o registro, o próprio PostgreSQL executa a função now() e grava a data/hora exata do instante da inserção.

jsonb: Tipo de dado JSON binário. Em vez de salvar apenas um texto simples, ele permite guardar um documento estruturado (ex: {"texto": "Qual a saída?", "midia_url": "imagem.png"}) otimizado para pesquisas rápidas e indexação no banco.

DEFAULT '{}'::jsonb: Define o valor padrão atribuído automaticamente caso nenhum dado seja informado no cadastro. O '{}' representa um objeto JSON vazio, e o sintaxe ::jsonb faz a conversão de tipo explícita para que o banco processe esse texto como um objeto jsonb.

O uso de índices evita a leitura completa da tabela durante uma busca, otimizando o tempo de resposta do banco, o index define quais colunas devem ser consultadas. Ao adicionar o modificador desc, os dados são salvos pré-ordenados do valor mais recente para o mais antigo, permitindo que consultas por históricos ou atividades recentes entreguem o resultado instantaneamente, sem o custo computacional de reordenar as linhas na hora da execução. 
Funções de Automação e Regras de Negócio (PL/pgSQL)
O uso de blocos e funções em PL/pgSQL permite criar rotinas procedurais no banco de dados,
algumas funções usadas: create or replace function ... security definer: Cria ou atualiza a função de gatilho e define que ela será executada com permissões de administrador. Isso garante que a atualização das tabelas ocorra com segurança, independentemente das permissões do usuário que disparou a ação.
if tg_op <> 'DELETE' then: Estrutura condicional que identifica qual operação disparou o gatilho, garantindo que o bloco de código só seja executado se a ação for uma inserção (INSERT) ou alteração (UPDATE), e não uma exclusão. tg_op diz se é insert, update ou delete, <> é o operador de “diferente”
select count(*)::integer ...: Executa a contagem total de linhas da tabela para uma determinada condição (como o total de matrículas de um curso) e faz a conversão do resultado para o tipo numérico inteiro (::integer).
select count(*)::integer, coalesce(avg("Avaliacao"), 0): Calcula a quantidade total de avaliações e a média das notas. A função coalesce serve para tratar o valor nulo: caso o curso ainda não tenha nenhuma avaliação, o banco retorna 0 em vez de NULL.
FUNÇÕES:


Atualização Automática de Data (atualizar_data_atualizacao)
Atualiza automaticamente o campo Data_Atualizacao com o timestamp corrente sempre que uma linha é alterada em uma tabela. Seu objetivo é garantir a rastreabilidade e a auditoria de modificações dos registros do sistema.

Controle de XP e Frequência (atualizar_xp_matricula)
Gerencia a pontuação do aluno calculando a variação do XP diário, atualizando o saldo acumulado e registrando a data do último acesso. Também bloqueia alterações manuais ou não autorizadas no total de pontuação.

Recálculo Local de Aulas Finalizadas (recalcular_aulas_finalizadas_matricula)
Calcula a quantidade total de aulas concluídas por um estudante em um curso específico diretamente durante eventos na matrícula. Seu objetivo é atualizar o contador interno de progresso no momento da operação.

Sincronização de Conclusão de Aula (atualizar_aulas_finalizadas)
Sincroniza o progresso do aluno na tabela de matrículas sempre que uma nova aula é concluída. A função identifica a qual curso a aula pertence e atualiza o total global de aulas finalizadas correspondente.

Contagem de Estudantes por Curso (atualizar_contagem_estudantes)
Recalcula e atualiza o total de inscritos diretamente no cadastro do curso sempre que ocorre uma nova matrícula ou cancelamento. Seu objetivo é manter o número total de estudantes denormalizado e atualizado para leitura rápida.

Imutabilidade da Avaliação (impedir_alteracao_avaliacao)
Garante que a nota atribuída a um curso seja definitiva. Seu objetivo é abortar a operação e lançar um erro caso o usuário tente modificar uma avaliação que já tenha sido registrada anteriormente.

Agregação de Avaliações do Curso (atualizar_avaliacao_curso)
Recalcula a média das notas e a quantidade total de avaliações enviadas a um curso sempre que uma nota é inserida, alterada ou removida, mantendo a nota média arredondada e sincronizada na tabela do curso.

Proteção de Dados da Matrícula (proteger_campos_derivados_matricula)
Impede a alteração dos vínculos de usuário e curso em matrículas já existentes e força o recálculo do campo de aulas finalizadas pelo próprio banco, evitando que dados manipulados sejam gravados na aplicação.

Proteção de Dados do Curso (proteger_campos_derivados_curso)
Bloqueia tentativas de alteração manual de métricas agregadas da tabela de cursos, como total de estudantes, contagem de avaliações e média de notas, garantindo que esses valores venham exclusivamente de cálculos do banco.

Criação Automática de Usuário (lidar_novo_user)
Cria o perfil do usuário na tabela pública do sistema assim que o cadastro na camada de autenticação é concluído. Seu objetivo é extrair metadados como nome, avatar e nome de usuário, gerando o registro inicial de forma automatizada.

1. Gatilhos de Automação e Integridade (Triggers)

Os gatilhos (triggers) atuam como escutadores de eventos (INSERT, UPDATE, DELETE) nas tabelas, disparando as funções de automação e regras de negócio de forma totalmente transparente para a aplicação.

Atualização de Timestamps (trg_*_data_atualizacao): Disparados antes de qualquer atualização (BEFORE UPDATE) nas tabelas Curso, Sala, Usuario, matricula, Notebook, Anotacoes, Aula, Modulo e Questao. Executam a função que grava o momento exato da alteração em Data_Atualizacao.

Proteção do Curso (trg_proteger_campos_derivados_curso): Executado antes de inserções ou atualizações na tabela Curso. Garante que métricas como notas e contagem de alunos não sejam forçadas manualmente por chamadas externas.

Controle de XP (trg_atualizar_xp_matricula): Disparado em inserções ou atualizações na tabela matricula. Impede a edição direta do XP_Total e gerencia o acúmulo de pontos com base na frequência do usuário.

Integridade da Matrícula (trg_proteger_matricula): Executa antes de cadastrar ou alterar uma matrícula para impedir a troca de dono ou curso e recalcular o total de aulas concluídas.

Imutabilidade de Avaliações (trg_impedir_alteracao_avaliacao): Disparado especificamente quando há tentativa de alteração na coluna Avaliacao da tabela matricula. Bloqueia modificações caso o curso já tenha sido avaliado.

Métricas da Matrícula (trg_contagem_estudantes e trg_avaliacao_curso): Disparados após inserções, edições de nota ou deleções na tabela matricula. Atualizam automaticamente a contagem de alunos, a média de avaliações e o total de notas diretamente no cadastro do curso afetado.

Progresso do Aluno (trg_aulas_finalizadas): Disparado após o registro de conclusão de uma aula na tabela conclui. Recalcula e sincroniza o progresso global do usuário na sua matrícula.

Criação de Perfil (on_auth_user_created): Escuta a criação de contas no sistema de autenticação (auth.users) e dispara a função para gerar automaticamente o perfil público na tabela Usuario.

2. Funções Auxiliares de Segurança (Security Definer Helpers)

Essas funções fornecem verificações reaproveitáveis que simplificam as regras de segurança do banco, rodando com permissões elevadas para consultar dados sem expor as tabelas diretamente.

usuario_e_criador_curso: Verifica se o usuário autenticado (auth.uid()) é o criador do curso informado. Retorna verdadeiro ou falso para autorizar modificações nos conteúdos do curso.

usuario_participa_sala: Checa se o usuário autenticado está registrado como membro de uma determinada sala na tabela participa.

3. Políticas de Segurança em Nível de Linha (Row Level Security - RLS)

O RLS restringe quais linhas de cada tabela um usuário pode ler, inserir, atualizar ou deletar, aplicando isolamento de dados diretamente na camada do PostgreSQL.

Perfis de Usuário (Usuario): A política permite que qualquer usuário leia ou edite estritamente o seu próprio registro (ID = auth.uid()).

Cursos e Conteúdos (Curso, Modulo, Aula, Questao): Conteúdos com status published ficam visíveis para leitura pública. A criação, edição e exclusão de qualquer elemento da hierarquia do curso são restritas exclusivamente ao seu criador.

Matrículas e Progresso (matricula, conclui): O usuário tem permissão para visualizar, criar e atualizar apenas os seus próprios registros de matrícula e de conclusões de aulas.

Salas e Comunidades (Sala, participa): Qualquer usuário autenticado pode listar salas. A gestão da sala pertence ao criador, enquanto a leitura de interações na tabela participa é liberada apenas para quem é membro daquela sala.

Notebooks e Anotações (Notebook, Anotacoes): O usuário possui controle total (leitura, escrita e deleção) sobre seus próprios blocos de notas e anotações vinculadas.

4. Concessão de Privilégios (Grants e Revokes)

Define o nível de acesso direto que as rotas de API anônimas e autenticadas possuem sobre as tabelas e funções do banco.

Nível do Schema: Concede permissão de uso do schema public para usuários anônimos (anon) e autenticados (authenticated).

Acesso Anônimo e Autenticado: Libera acesso de leitura (SELECT) em tabelas públicas do sistema, como catálogo de cursos, módulos, aulas, questões e salas.

Acesso Autenticado: Concede permissões operacionais de escrita e leitura (SELECT, INSERT, UPDATE, DELETE) para tabelas de uso pessoal do aluno, como matrículas, conclusões de aulas, histórico de participação, notebooks e anotações.

Isolamento de Funções: Revoga a execução pública das funções auxiliares de segurança (REVOKE ALL) e libera a execução (GRANT EXECUTE) apenas para usuários autenticados, prevenindo execuções não autorizadas.
