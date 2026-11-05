# Contas de demonstração de ligas e missões

Seed opcional de desenvolvimento em [demo-users.sql](../codigo-base/supabase/seeds/demo-users.sql), compatível com a migração `0041`. Não é migração e não é executado automaticamente pelo `db reset`. Não deve ser aplicado em produção.

## Acesso

Todas as 125 contas usam a senha **`test123!`**, com e-mail confirmado. Na aplicação apontada para `testeAthen`, saia da conta atual e entre com uma das contas abaixo: a classificação é restrita ao próprio grupo, portanto contas anteriores não passam a ver os grupos de demonstração.

| Conta | Cenário inicial |
| --- | --- |
| `demo.prata.01@athen.test` | Promoção, 1.200 XP e missões concluídas/em progresso |
| `demo.prata.10@athen.test` | Permanência |
| `demo.prata.18@athen.test` | Rebaixamento com XP positivo, visível durante toda a semana |
| `demo.prata.19@athen.test` | Zero XP; projeção de queda no servidor e marca na lista nas últimas 24 horas |
| `demo.bronze.01@athen.test` | Piso Bronze, sem rebaixamento |
| `demo.mestre.01@athen.test` | Teto Mestre, sem promoção |
| `demo.pequeno.01@athen.test` | Grupo Ouro com três participantes; proteção dos positivos em grupo pequeno |
| `demo.educador@athen.test` | Educador autor do curso de demonstração, sem inscrição em liga |
| `demo.sem-liga@athen.test` | Estudante sem inscrição; estado de entrada na liga e missões sem progresso |

As contas regulares seguem `demo.<categoria>.<01–20>@athen.test`: `bronze`, `prata`, `ouro`, `platina`, `diamante` e `mestre`. Há ainda `demo.pequeno.01–03@athen.test` e as duas contas especiais. O nome de usuário corresponde à parte anterior a `@`.

## Dados criados

- Seis grupos de vinte, com dezoito participantes com XP e dois zerados. O empate em 900 XP atravessa o corte de promoção; nas categorias intermediárias, cinco usuários têm projeção de promoção e seis de queda (incluindo os dois zerados).
- A posição 5 de cada grupo tem identidade oculta. Outros perfis alternam foto sintética e iniciais de fallback.
- Inscrições novas alternam rótulos sintéticos de entrada inicial/tardia. São fixtures deliberadas, assim como a categoria atribuída e os valores de XP; não simulam uma carreira prévia de promoções.
- Curso público **Laboratório de ligas e missões**, com três aulas, seis questões, matrículas, respostas, tentativas e conclusões sintéticas. O gabarito é **2** em todas as questões. O progresso das missões e seus bônus são calculados pelas funções existentes a partir dessas atividades.
- O XP de demonstração é gravado no ledger como aprendizagem de curso. Bônus de missão ficam separados e não pontuam a temporada. Essas contas também aparecem no ranking global do ambiente de teste.

## Execução

A partir de `codigo-base/`, com Supabase CLI autenticada:

```bash
# Banco local descartável iniciado e migrado até 0041
npm run seed:demo:local
npx supabase db query --local --file supabase/seeds/check-demo.sql

# Exclusivamente testeAthen, com referência fixada no script npm
npm run seed:demo:remote
npx supabase db query --linked --project-ref ugsfebcxqpdujjocdhhj --file supabase/seeds/check-demo.sql
```

O seed usa UUIDs, marcador de metadados e chaves de idempotência estáveis. Pode ser repetido na mesma semana sem duplicar XP de aprendizagem. Repetido em outro dia, cria as atividades e os bônus diários correspondentes. Preserva senhas já alteradas, progresso realizado após a carga e inscrições/grupos/categorias já atribuídos; não desloca contas existentes para os grupos de demonstração.

Os cenários variam com o calendário real. Após a virada, a categoria é a que resultar do fechamento e a formação normal pode redistribuir participantes. Execute a verificação imediatamente após uma carga nova, antes de usar as contas ou virar a semana: os números exatos do ensaio não são invariantes de contas que continuam sendo utilizadas.

## Verificações

Em 2026-11-05, a carga foi aplicada ao `testeAthen`: 125 contas e 123 inscrições de demonstração. A verificação SQL passou nesse remoto, assim como o login real das contas Prata 01/18, educador e sem-liga. O seed respeita também o trigger legado `answers_guard`, gravando respostas antes de preencher `finished_at`.

[check-demo.sql](../codigo-base/supabase/seeds/check-demo.sql) verifica as 125 contas, 123 inscrições, grupo de vinte, empate nos cortes, privacidade, ausência de grupo para a conta sem liga e missões concluídas/em progresso pelas RPCs usadas pela aplicação. O ensaio de reexecução também compara contagens de contas, identidades, tentativas, inscrições, eventos, atribuições de missão e saldo global antes/depois. O login por e-mail/senha é conferido separadamente pela API Auth.
