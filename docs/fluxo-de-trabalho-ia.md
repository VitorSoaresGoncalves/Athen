# Fluxo de trabalho com agentes de IA

Regra de colaboração para qualquer agente que participe do desenvolvimento do Athen, independentemente da ferramenta. [Convenções](convencoes.md), [estilo](estilo-padrao.md) e [testes](testes.md) são as referências dos respectivos assuntos e têm precedência sobre sugestões de skills.

## Contexto antes da execução

1. Leia [AGENTS.md](../AGENTS.md) e a referência correspondente à tarefa no [índice](README.md).
2. Identifique o escopo e os critérios de conclusão da solicitação. O trabalho da equipe é rastreado no YouTrack; specs e tickets das skills usam o [tracker local](agents/issue-tracker.md).
3. Confira código e configurações relevantes antes de confiar em descrições, diagramas ou capturas antigas. Distinga regra pretendida, comportamento observado e proposta de mudança.

## Capacidade da ferramenta

Escolha a ferramenta por seus acessos e recursos disponíveis nesta sessão: leitura do repositório, edição, terminal, testes e integrações. O nome do produto não determina se ela consegue alterar arquivos ou validar uma entrega.

- Com acesso ao repositório, o agente lê as fontes diretamente e relata o que alterou e verificou.
- Sem esse acesso, forneça os trechos e documentos pertinentes; trate a saída como rascunho até integração e validação local.
- Os arquivos específicos de ferramenta e o steering remetem a `AGENTS.md`. As skills canônicas ficam em `.agents/skills/`; o [setup da aplicação](../codigo-base/README.md) explica os links de compatibilidade.

## Execução e responsabilidade

- A pessoa responsável pelo commit/PR deve compreender e revisar o código produzido com IA.
- Mantenha mudanças pequenas, revisáveis e dentro de um único escopo. O fluxo de branches e PRs está em [Convenções](convencoes.md).
- Preserve alterações locais existentes e mantenha credenciais, tokens e conteúdo de `.env` fora de prompts, commits e logs compartilhados.
- Reaproveite as dependências e padrões existentes. Justifique dependências novas pela necessidade da tarefa.
- Consulte as regras de nomes em [Convenções](convencoes.md), a configuração efetiva em [ESLint](../codigo-base/eslint.config.js) e as regras visuais em [Estilo](estilo-padrao.md).
- `codigo-base/src/types/database.ts` é gerado: regenere a partir do esquema correspondente, em vez de editar manualmente. Veja [Banco de dados](banco-de-dados/documentacao-bd.md).

## Validação e entrega

Para mudanças de código, execute o pipeline local descrito em [Testes](testes.md) antes de encaminhar para PR. Acrescente as verificações específicas de UI ou banco quando aplicáveis. Relate falhas e limitações sem apresentar execução parcial como aprovação completa.

Para mudanças exclusivamente documentais, confira os links, os caminhos e as afirmações alteradas contra suas fontes; registre as verificações realizadas. Esse tipo de revisão não comprova a execução da aplicação.

PRs seguem a base de sprint e a revisão humana definidas em [Convenções](convencoes.md). Registre o uso de IA na descrição:

```markdown
### Uso de IA
- Ferramenta(s): <utilizadas nesta mudança>
- Escopo gerado por IA: <arquivos ou comportamento>
- Revisado e validado localmente por: <responsável>
```

Ao concluir, informe o resultado, as verificações realizadas e as pendências que afetem o uso. Atualize a documentação responsável pelo comportamento alterado.
