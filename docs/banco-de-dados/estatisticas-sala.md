# Estatísticas de sala — issue 56

Referência da [migration 0046](../../codigo-base/supabase/migrations/0046_room_stats.sql), corrigida na branch `issue/56-requisicoes-banco-sala`. A compatibilidade foi conferida com o SQL da `issue/47-revisao-esporadica` em `8066a2c`. Esta alteração não incorpora commits ou migrations daquela branch e não aplica SQL em banco remoto.

## Correções e limites do escopo

- **Numeração:** `0042_room_stats.sql` passa a `0046_room_stats.sql`, pois a issue 47 usa `0042–0045`. Os números intermediários não foram copiados para esta branch: serão fornecidos pela integração dos dois PRs. Confira se `0046` continua livre antes da integração. Caso o arquivo antigo já tenha sido aplicado a algum destino, reconcilie seu histórico antes de executar a versão renumerada; renomear um arquivo não atualiza o histórico do banco.
- **Atenção abaixo de 50%:** a decisão usa a razão sem arredondamento. O retorno visual continua inteiro: 50 acertos em 101 primeiras respostas aparecem como 50%, mas marcam atenção; exatamente 50% não marca atenção por desempenho.
- **Primeira resposta:** entre tentativas finalizadas da mesma sala, considera a menor `answers.created_at`, com desempate por `attempts.started_at` e ID da tentativa. Finalizar uma execução posterior antes da anterior não substitui a primeira resposta.
- **Conclusão por módulo:** exige uma tentativa finalizada na própria sala, com total de respostas computado na finalização suficiente para as questões atuais e respostas presentes para cada uma delas. Acrescentar respostas depois de finalizar uma tentativa parcial não basta, nem várias tentativas parciais são somadas para fabricar uma execução completa. Conta cada par aluno/aula uma vez, independentemente de acerto e de repetições. Considera membros ativos e aulas publicadas do curso vinculado; sem membros ou aulas, o percentual é zero; sem curso, não retorna módulos. Aula sem questões não passa a ter conclusão por tentativa de sala.
- **Questões difíceis:** o top 3 é ordenado pela razão exata de acertos, arredondando somente o retorno visual. Entre taxas exatas iguais, prioriza quantidade de respostas e usa o ID como desempate estável. Assim, 33/100 é escolhido antes de 34/103, embora ambos sejam exibidos como 33%.

As mudanças ficam nas funções novas da issue 56. Não redefinem `finalize_attempt`, `complete_empty_lesson`, `recompute_room_metrics`, helpers de revisão, triggers, XP, PAC, missões ou políticas das migrations anteriores. O campo `progress` de aluno/visão geral continua lendo `room_members.progress`, calculado pela função existente; o novo critério de conclusão integral foi aplicado somente a `completion_pct` dos módulos. As assinaturas das sete funções e as permissões permanecem iguais.

## RPCs e autorização

Todas as RPCs recebem `p_room_id uuid` e exigem usuário autenticado que seja o educador proprietário da sala. Sala alheia ou inexistente gera `42501`, sem diferenciar sua existência. Ser aluno ou outro educador não autoriza a leitura; não há exceção nova para admin.

| RPC | Retorno |
| --- | --- |
| `room_stats_overview` | Membros ativos, média de progresso, média de acerto de primeira e quantidade que precisa de atenção |
| `room_stats_students` | ID/nome do membro, XP interno, progresso, taxa de primeira resposta, último acesso, dias parado e atenção; ordenado por XP e nome |
| `room_stats_modules` | ID/título/posição do módulo, quantidade de aulas publicadas e percentual de conclusão integral por pares aluno/aula |
| `room_stats_hard_questions` | Até três questões com menor taxa de primeira resposta, exigindo ao menos três membros com primeira resposta; enunciado, aula, taxa e quantidade |

“Último acesso” é o início de tentativa mais recente na sala, ou `room_members.joined_at` quando não há tentativa; não é um registro de login. Seis dias completos de inatividade também marcam atenção. Sem respostas, a taxa individual é NULL e não produz alerta de desempenho por si só. As médias do overview continuam sendo médias das taxas por aluno, sem ponderação pela quantidade de respostas.

As funções públicas são `STABLE SECURITY DEFINER` e chamam `assert_room_educator` antes das leituras. `assert_room_educator`, `room_first_answers` e `room_student_metrics` são helpers internos sem EXECUTE para PUBLIC, anon ou authenticated. As RPCs só concedem EXECUTE ao authenticated entre esses papéis. As políticas de `attempts`/`answers` não são ampliadas: o educador recebe indicadores, sem ganhar leitura direta das respostas alheias.

## Integração com a issue 47

O estado integrado esperado é `0001–0045` da issue 47 mais `0046_room_stats.sql` desta branch. Não há dependência funcional das RPCs de revisão nas estatísticas: `0001–0041 + 0046` também foi ensaiado. A renumeração reserva uma sequência única para a integração, sem repetir as mudanças de revisão de curso.

O frontend e `src/types/database.ts` não foram alterados nesta correção SQL. A issue 47 já contém sua própria regeneração dos tipos; depois de integrar os esquemas, regenere o arquivo a partir do banco-alvo completo para acrescentar as quatro RPCs de estatísticas, sem editar tipos à mão ou copiar a regeneração da outra branch. Não existe consumo dessas RPCs no frontend desta branch.

## Verificação

O [harness da issue 56](../../codigo-base/supabase/testes-issue-56/harness.sql) cria fixtures próprias em transação e termina com ROLLBACK. Execute somente em banco local descartável com `0001–0041 + 0046` ou a sequência integrada. Com `psql` conectado explicitamente a esse alvo local:

```text
psql -X -v ON_ERROR_STOP=1 -f supabase/testes-issue-56/harness.sql
```

O comando é relativo a `codigo-base/`; configure a conexão local no ambiente do processo. `ON_ERROR_STOP` é obrigatório para propagar falhas das asserções. O arquivo não verifica o destino da conexão: confirme o alvo descartável antes da execução. Não execute fixtures no banco principal.

O teste cobre as quatro RPCs como dono, negação para aluno/outro educador/anon, helpers bloqueados, sala vazia/sem curso, membro removido e ausência de leitura direta de respostas alheias. As nove regressões verificam 50/101 versus exatamente 50%, primeira resposta em tentativas sobrepostas, tentativa parcial versus integral finalizada pela RPC real, respostas acrescentadas após finalizar, isolamento entre salas, seis dias de inatividade e seleção exata das três questões difíceis com taxas próximas.

Em 2026-11-16, o teste falhou contra a migration original e passou após a correção, sobre `0001–0041` e depois do upgrade para `0045`. Os ensaios usaram PostgreSQL 17.11 em container temporário sem rede, com bootstrap mínimo de papéis/Auth e rollback das fixtures. Não comprovam Auth/PostgREST completos, desempenho em volume ou aplicação no remoto. A reprodução e os logs locais ficam em `.scratch/review-issue56/`; resultados do pipeline geral são registrados ali separadamente. O teste SQL é executado diretamente, sem alterar os scripts de testes ou a CI compartilhados com a outra issue.

Na versão final, as nove regressões passaram nas duas bases. Também passaram `lint`, `typecheck`, os 26 testes de `test:run`, `test:check`, `build` e os 70 cenários de `test:e2e`. A primeira execução E2E percorreu os cenários, mas não encerrou o processo; a repetição fora da restrição de execução concluiu com código zero. A revisão independente não encontrou bloqueadores adicionais. O build mantém o aviso preexistente de tamanho de bundle; nenhum arquivo de frontend foi alterado para tratá-lo.
