# Aprendizado por issue

Registros didáticos do que foi implementado no Athen. O [educator](../../../.opencode/agents/educator.md) escreve a partir do diff final e das evidências recebidas pelo [protocolo do time](../../agents/time-opencode.md).

## Organização

Registro disponível: [issue 47 — revisão esporádica de curso](issue-47-revisao-esporadica.md), com explicação de prática/bônus, autoridade do servidor, idempotência e validação.

- Uma issue por arquivo: `issue-<numero>-<slug>.md`, com o identificador real.
- Para solicitação sem issue informada, use `solicitacao-<slug>.md` e declare a origem; não invente um número.
- Atualize o mesmo arquivo ao corrigir a entrega da issue. Identifique data, base Git e revisão do diff quando ainda não houver commit.
- Estado: final quando a entrega estiver validada localmente; parcial quando houver critério ou validação pendente. PR, aprovação humana e deploy têm estados próprios.

## Conteúdo

Comece com origem, data, estado e referência do código analisado. Desenvolva:

1. **Problema:** o que acontecia e qual comportamento era esperado.
2. **Solução e motivo:** o que mudou e por que essa escolha atende ao problema.
3. **Conceitos:** dois a quatro fundamentos necessários, explicados no primeiro uso e ligados ao código real.
4. **Caminho dos dados:** arquivos e responsabilidades, com links relativos; em mudança documental, explique o caminho das instruções.
5. **Verificação:** o que foi executado, o que os resultados demonstram e seus limites. Aponte para evidências existentes em vez de copiar logs.
6. **Exploração:** uma atividade curta para o aluno quando isso trouxer aprendizado útil.

Use linguagem equilibrada: explique o fundamento sem tratar o leitor como especialista nem preencher o texto com analogias. Em geral, 400–800 palavras bastam para uma funcionalidade; adapte à complexidade. Trechos curtos de código devem corresponder à versão analisada.

Esses documentos são históricos de aprendizado. Regras atuais continuam no [índice técnico](../../README.md); quando o comportamento mudar, atualize também a referência responsável. Não carregue todo este diretório no contexto dos agentes: consulte o registro da issue pertinente.
