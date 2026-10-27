# Athen

Plataforma colaborativa de aprendizagem gamificada, desenvolvida na UC de Engenharia de Software. Reúne cursos, aulas com questões, salas de aprendizagem, recursos sociais e cadernos de anotações.

## Começar

- **Agentes de desenvolvimento:** leia [AGENTS.md](AGENTS.md).
- **Executar a aplicação:** siga o [README de codigo-base](codigo-base/README.md).
- **Encontrar documentação:** consulte o [índice por tarefa](docs/README.md).
- **Entender o produto:** consulte a [visão do projeto](docs/definicao-do-projeto.md) e o [glossário](GLOSSARY.md).

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `codigo-base/` | Aplicação React/TypeScript, configurações, testes e SQL do Supabase |
| `docs/` | Referências atuais, regras de desenvolvimento e material histórico identificado |
| `.agents/skills/` | Skills versionadas, compartilhadas por todas as ferramentas |
| `scripts/` | Configuração dos links de compatibilidade das skills |

A [arquitetura atual](docs/arquitetura.md) explica como o cliente web acessa o Supabase. Dependências e comandos executáveis ficam em [package.json](codigo-base/package.json); a instalação reproduzível usa o lockfile da aplicação.

## Diagrama de arquitetura

O diagrama abaixo reproduz a [fonte Mermaid atual](docs/diagramas/arquitetura-atual.mmd). Ao atualizar essa fonte, atualize também este bloco. Consulte a [documentação de arquitetura](docs/arquitetura.md) para os detalhes.

```mermaid
flowchart TB
  classDef client fill:#f3eefb,stroke:#54318c,color:#352044;
  classDef data fill:#ffeb99,stroke:#a486d5,color:#54318c;
  classDef remote fill:#f3f4f6,stroke:#6b7280,color:#111827;

  subgraph Client["Client — codigo-base/ (Vite + React + TS)"]
    SPA["React SPA — Main.tsx / Hub.tsx"]:::client
    Guard["ProtectedRoute + SupabaseConnect.tsx<br/>verificação de sessão no navegador"]:::client
    Pages["Telas React<br/>estado e composição dos dados"]:::client
    Cache["SidebarLeft<br/>cache próprio de perfil"]:::client
    Repos["repositories.ts + supabase.ts<br/>consultas, RPCs e SDK tipado"]:::data
    SPA --> Guard
    Guard -->|"rotas internas"| Pages
    SPA -->|"rotas públicas"| Pages
    Pages --> Repos
    Cache --> Repos
    Guard -->|"sessão via SDK"| Repos
  end

  subgraph Supabase["Supabase — backend gerenciado"]
    Auth["Auth / GoTrue"]:::remote
    REST["PostgREST API<br/>tabelas, views e chamadas RPC"]:::remote
    Storage["Storage — avatares<br/>avatar e banner no bucket avatars"]:::remote
    subgraph Database["PostgreSQL — migrações numeradas"]
      Rules["RLS policies + RPC + triggers<br/>políticas e funções SQL no banco"]:::data
      DB[("Dados persistidos")]:::remote
      Rules --> DB
    end
    Edge["Edge Functions"]:::remote
    Auth --> DB
    REST --> Rules
    Edge -->|"acesso a dados"| DB
  end

  subgraph External["Integrações externas"]
    Google["Google OAuth"]:::remote
    SMS["SMS provider (OTP)"]:::remote
    SMTP["Resend SMTP"]:::remote
    Mail["E-mail do destinatário — Gmail"]:::remote
    SMTP -->|"entrega de e-mail"| Mail
  end

  subgraph CI["CI/CD — .github/workflows/ci.yml"]
    GH["GitHub Actions"]:::remote
    Checks["Lint, tipos, testes, build e E2E"]:::data
    CLI["Supabase CLI / migrações"]:::data
    GH --> Checks
  end

  Repos --> Auth
  Repos --> REST
  Pages -->|"Auth e Storage diretos via SDK"| Repos
  Repos --> Storage
  Auth -->|"OAuth"| Google
  Auth -->|"OTP"| SMS
  Auth -->|"e-mails de autenticação"| SMTP
  Edge -->|"envio de e-mail"| SMTP
  CLI -->|"aplicação de migrações"| Rules
```
