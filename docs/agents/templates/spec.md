# Spec — <feature>

Template: copie para `.scratch/<feature-slug>/spec.md` somente quando não houver uma spec; preencha os campos pertinentes. Em tarefa simples, poucos parágrafos podem substituir as seções detalhadas.

- Origem: <issue/caminho ou solicitação direta sem issue informada>
- Revisão do contrato: 1
- Base Git e branch: <hash e branch reais>
- Objetivo e problema observado: <descrição verificável>
- Fora do escopo: <limites relevantes>

## Critérios de aceitação

| ID | Cenário/entrada | Resultado esperado |
| --- | --- | --- |
| CA-01 | <caminho positivo> | <comportamento observável> |
| CA-02 | <caso negativo pertinente> | <erro/estado/permissão esperado> |

## Contrato e impacto

- Arquivos e chamadores previstos: <caminhos exatos>
- Entradas, saídas e erros: <contrato entre os arquivos afetados>
- Invariantes e autorização: <regras de produto e local que as aplica>
- Dependências e ordem: <tarefas ou contratos dos quais depende>
- Verificações necessárias: <critérios cobertos e referência em docs/testes.md>
- Decisões e dúvidas: <justificativas e o que ainda precisa de definição>

## Revisões

| Revisão | Mudança e razão | Consumidores afetados |
| --- | --- | --- |
| 1 | <contrato inicial> | <responsáveis/caminhos> |
