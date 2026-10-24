# AGENTS.md

Entrada comum para qualquer agente neste repositório. Leia este arquivo inteiro.
`CLAUDE.md`, `KIRO.md` e o steering do Kiro remetem a ele; as regras independem da ferramenta.

## Antes de trabalhar

1. Leia [o fluxo de trabalho com IA](docs/fluxo-de-trabalho-ia.md), que define o processo do projeto e tem precedência sobre skills.
2. Carregue as referências pertinentes à tarefa pela tabela abaixo. Para outros assuntos ou material histórico, consulte o [índice da documentação](docs/README.md).
3. Confira o estado local com `git status --short` e preserve alterações que já existiam. Para entender o comportamento implementado, confira os arquivos-fonte indicados na documentação.

## Referências por tarefa

| Ao trabalhar com | Leia |
| --- | --- |
| Git, commits, branches ou nomenclatura | [Convenções](docs/convencoes.md) |
| Estrutura do código, navegação ou fluxo de dados | [Arquitetura atual](docs/arquitetura.md) |
| Configuração e execução local | [README da aplicação](codigo-base/README.md) |
| Interface visual, layout ou acessibilidade | [Guia de estilos](docs/estilo-padrao.md) |
| Persistência, permissões, XP ou migrações | [Banco de dados atual](docs/banco-de-dados/documentacao-bd.md) |
| Verificação de mudanças | [Testes e validações](docs/testes.md) |
| Conceitos de produto | [Glossário](GLOSSARY.md) e [regras dos docs de domínio](docs/agents/domain.md) |
| Specs ou tickets locais para skills | [Issue tracker](docs/agents/issue-tracker.md) |
| Triagem de tickets | [Triage labels](docs/agents/triage-labels.md) |

## Skills

A fonte canônica é `.agents/skills/<nome>/SKILL.md`.

1. No início da tarefa, descubra as skills lendo as descrições do frontmatter em `.agents/skills/*/SKILL.md`; a lista instalada pode mudar.
2. Leia por inteiro o `SKILL.md` aplicável antes de usá-lo e siga os arquivos de apoio exigidos por ele.
3. Se houver dúvida sobre o fluxo adequado, consulte `.agents/skills/ask-matt/SKILL.md`.

`.claude/skills` e `.kiro/skills` são links gerados para compatibilidade; consulte sempre os arquivos canônicos. Configuração e reparo dos links estão no [README da aplicação](codigo-base/README.md).

## Fontes e manutenção

- Regras do projeto: os guias apontados acima. Skills complementam essas regras.
- Comportamento atual: código e configuração versionados. Se divergirem de uma regra documentada, registre a divergência e preserve a intenção da regra até resolver o conflito.
- Histórico, propostas e capturas de tela têm status indicado no [índice](docs/README.md); use-os para contexto, sem assumir que descrevem o estado atual.
- Ao mudar comportamento, atualize a referência responsável pelo assunto. Prefira links à repetição de regras, listas de versões ou catálogos de skills.
