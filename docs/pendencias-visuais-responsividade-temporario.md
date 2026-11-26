# Pendências visuais de responsividade (temporário)

Registro dos três pontos solicitados para melhoria e correção visual ainda na branch `issue/53-responsividade`. Implementação realizada em 24/11/2026; validação registrada em [Testes](testes.md). A descrição abaixo preserva o pedido original.

## 1. Notificações e navegação

- O botão de notificações deve ficar sempre ao lado do botão de mostrar a sidebar, com espaçamento adequado entre os controles.

## 2. Ícones das ligas

- Na página de Ligas, clicar nos ícones de bronze, prata, ouro e demais ligas não deve executar nenhuma ação nem mudar sua cor.
- Remover a indicação visual de que esses ícones são botões interativos; atualmente a mudança de cor ao clicar sugere uma ação inexistente.

## 3. Layout do Dashboard

- No popup de seleção de cursos e salas, todos os cards devem ter o mesmo tamanho, inclusive o curso com a tag “Atual”, que hoje fica um pouco maior.
- O bloco da trilha, incluindo o fundo, deve ocupar toda a tela e não permitir rolagem vertical.
- O seletor de cursos e salas, o botão de notebook, a barra TopDown e o card de revisão devem se sobrepor à trilha.
- No mobile (até 760px), posicionar o botão de notebook abaixo do seletor de cursos e salas, em vez de ao lado. No desktop, manter no canto inferior esquerdo, com tamanho de 84px e os recuos anteriores.
- Posicionar o botão da TopDown no canto superior direito, em vez de centralizado.
- Exibir o card de revisão somente ao clicar no botão “Revisar”. Esse botão deve aparecer acima do carrossel de seleção de módulos apenas quando o usuário já tiver concluído o curso selecionado.
- O botão “Revisar” deve mostrar um ícone de exclamação (“!”) quando o curso selecionado tiver o bônus de XP de revisão ativo.

Ajuste desktop posterior: sidebar ampliada para 260px pelo token compartilhado, aumentando também links e perfil. A notificação se afasta do nome athen, conservando o recuo da borda direita.
