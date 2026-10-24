# Diagramas de arquitetura

## Referência atual

[arquitetura-atual.mmd](arquitetura-atual.mmd) é a fonte Mermaid da arquitetura e está reproduzida no [README da raiz](../../README.md#diagrama-de-arquitetura). Mantenha os dois blocos sincronizados. A [referência de arquitetura](../arquitetura.md) explica os caminhos e as responsabilidades correspondentes.

O diagrama organiza a arquitetura em Client, Supabase, Integrações externas e CI/CD. Representa o cliente React, o SDK, os serviços Supabase, Google OAuth, SMS, envio de e-mail por Resend SMTP ao Gmail e ferramentas de validação e migração. O estado local pertence às telas e à sidebar, sem TanStack Query.

## Artefatos históricos

| Arquivo | Status |
| --- | --- |
| [athen-arch-diagram-v1.mmd](athen-arch-diagram-v1.mmd) e [imagem JPG](athen-arch-diagram-v1.jpg) | Retrato antigo com pendências da sprint03; não é inventário atual |
| [athen-arch-diagram-v2.mmd](athen-arch-diagram-v2.mmd) e [imagem PNG](athen-arch-diagram-v2.png) | Versão anterior com TanStack Query; não corresponde ao checkout atual |

As imagens antigas foram preservadas como histórico. Nenhuma delas é uma renderização do novo diagrama atual. Ao exportar uma nova imagem, vincule-a à fonte correspondente e atualize este índice.
