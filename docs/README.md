# Documentação do Athen

Use este índice para escolher a referência da tarefa. As referências técnicas foram conferidas com o código local em 2026-10-23; isso não atesta a configuração de um ambiente remoto.

## Referências atuais

| Preciso de | Documento | Fonte que permite conferir |
| --- | --- | --- |
| Instruções comuns a qualquer agente | [AGENTS.md](../AGENTS.md) | Entrada canônica; os arquivos por ferramenta apenas apontam para ela |
| Instalação e execução | [README da aplicação](../codigo-base/README.md) | `package.json`, cliente Supabase e workflow de CI |
| Processo de colaboração com IA | [Fluxo de trabalho](fluxo-de-trabalho-ia.md) | Regras de trabalho da equipe |
| Commits, branches e nomes | [Convenções](convencoes.md) | Regras da equipe e `eslint.config.js` |
| Responsabilidades e navegação no código | [Arquitetura](arquitetura.md) | Entradas, rotas, consultas e migrações referenciadas |
| Tecnologias e configuração | [Tecnologias](tecnologias-utilizadas.md) | Manifesto, lockfile e configurações da aplicação |
| Paleta, tipografia e layout | [Estilo](estilo-padrao.md) | Regras visuais e tokens de `src/index.css` |
| Modelo de dados e regras persistidas | [Banco de dados](banco-de-dados/documentacao-bd.md) | SQL numerado e tipos gerados |
| Comandos e alcance das verificações | [Testes](testes.md) | Scripts, configurações e testes existentes |
| Vocabulário do produto | [Glossário](../GLOSSARY.md) | Definições; mapeamento técnico na referência de banco |
| Trabalho das skills | [Tracker local](agents/issue-tracker.md), [triagem](agents/triage-labels.md), [domínio](agents/domain.md) | Convenções específicas do repositório |

## Visão de produto e material histórico

| Material | Status e uso |
| --- | --- |
| [Definição do projeto](definicao-do-projeto.md) | Visão de produto; distingue intenção original de evidência de implementação |
| [Diagramas](diagramas/README.md) | Aponta para o diagrama atual e identifica versões e imagens históricas |
| [Notas do banco legado](historico/banco-de-dados-legado.md) | Esquema antigo com nomes como `Usuario`; não corresponde ao modelo atual |
| [Histórico do trabalho local](relatorio-trabalho-local.md) | Três partes cumulativas: páginas/banco, setup de skills e revisão documental do Codex; arquivos e validações para reprodução manual no upstream |
| [Setup de skills — parte 2 do histórico](relatorio-trabalho-local.md#2-skills-e-configuração-comum-de-agentes) | Conteúdo consolidado; instruções atuais de uso no README da aplicação |
| [Revisão de arquitetura de 2026-10-23](architecture-review-20261023-182214.html) | Propostas de refatoração; não são decisões aprovadas nem arquitetura implementada |
| `sketch-dashboard/`, `sketch-amigos/` e `video-ideia-layout-perfil.mp4` | Esboços e referências visuais; não definem comportamento implementado |
| `dashboard/`, `pagina-amigos/` e `pagina-notebook/` | Capturas de tela; conferir o código antes de usar como referência atual |
| Imagens e PDF em `banco-de-dados/` | Artefatos de modelagem sem equivalência atual verificada; conferir o SQL numerado |

## Como manter

1. Atualize a referência do assunto quando mudar comportamento, configuração ou regra.
2. Cite o caminho da fonte verificável. Versões exatas e listas de comandos completos devem ser consultadas na configuração, evitando cópias que envelhecem.
3. Identifique cada documento como referência atual, regra, proposta ou histórico; uma proposta só passa a descrever o sistema depois de implementada.
4. Preserve registros históricos com aviso de status e link para a referência atual. Mantenha redirecionamentos quando consolidar caminhos já usados.
5. Confira links locais, exemplos e divergências entre documentos antes de concluir uma mudança documental. Para código, execute as [validações correspondentes](testes.md).
