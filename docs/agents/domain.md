# Documentação de domínio

O repositório tem um único contexto de produto.

## Quando consultar

Antes de explorar comportamento de produto ou propor mudanças de arquitetura, leia o [glossário](../../GLOSSARY.md) e os ADRs pertinentes em `docs/adr/`, se existirem. A implementação está em `codigo-base/`; o [mapa de arquitetura](../arquitetura.md) e a [referência de banco](../banco-de-dados/documentacao-bd.md) apontam para as fontes.

Use os termos do glossário ao nomear conceitos em código, testes, propostas e tickets. Ele contém definições de domínio; caminhos, tabelas e detalhes técnicos pertencem às referências de implementação.

## Quando atualizar

Ao esclarecer ou mudar o significado de um termo, use `.agents/skills/domain-modeling/SKILL.md` para manter `GLOSSARY.md` coerente. Se houver divergência entre definição e comportamento, mostre a evidência antes de tratar um deles como mudança aprovada.

Crie `docs/adr/` apenas quando existir uma decisão arquitetural a registrar: difícil de reverter, surpreendente sem contexto e resultante de alternativas reais. A pasta pode estar ausente; isso não impede o trabalho nem exige criar registros vazios ou decisões retroativas.

Se uma proposta contrariar um ADR existente, cite a decisão e explique a razão para reabri-la. Relatórios e diagramas propostos não substituem uma decisão aceita.
