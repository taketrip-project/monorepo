# 002 — Monorepo único para api e web

**Data:** 2026-07-06 · **Autor:** cto · **Status:** recomendação vigente (formato do repositório; detalhes internos são do backend-architect)

## Contexto

A fase 1 começa do zero e precisa de bootstrap do repositório. Opções: (a) monorepo com `apps/api` (NestJS) e `apps/web` (React); (b) dois repositórios separados. O time é de agentes de IA coordenados, o backend é um monólito modular e o produto é um único SaaS com uma página pública — não há times independentes nem ciclos de release distintos que justifiquem repositórios separados.

## Decisão

**Monorepo único**, com `apps/api` e `apps/web` e tooling compartilhado (lint, CI, tipos do contrato de API). Critério de simplicidade da governança: entre duas soluções, vence a com menos partes móveis — um repositório é um lugar só para PR, revisão do code-reviewer, CI e versionamento do contrato entre front e back.

## Consequências

- PRs que cruzam api e web (a maioria das histórias do backlog) são atômicos e revisáveis de uma vez.
- Contratos de API podem ser compartilhados como tipos no próprio repo, sem publicar pacote.
- O backend-architect decide a estrutura interna (workspaces, ferramenta de build, migrations); esta decisão fixa apenas o formato de um repositório.
- Se um dia a página pública exigir deploy/escala à parte, separa-se o deploy, não o repositório.
