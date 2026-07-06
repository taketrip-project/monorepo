---
name: multi-tenancy
description: >
  Padrão de isolamento multi-tenant do Taketrip (NestJS + Drizzle + PostgreSQL):
  escopo por organizacao_id, guards, índices e checklist de revisão. Use ao criar
  schema, implementar queries/endpoints ou revisar PRs de backend.
---

# Multi-tenancy — Taketrip

O Taketrip é SaaS multi-tenant com banco compartilhado. O tenant é a **Organizacao**. Vazamento de dados entre organizações é o defeito terminal do produto — este padrão não admite exceção.

## Modelo
- Tenancy por coluna: toda tabela operacional tem `organizacao_id uuid NOT NULL REFERENCES organizacao(id)`.
- Tabelas filhas (ex.: `ponto_embarque` sob `excursao`) TAMBÉM carregam `organizacao_id` desnormalizado — permite escopo direto sem join e constraint composta.
- Sem schema-per-tenant, sem database-per-tenant. Uma exceção pública: a página da excursão lê por id público da excursão publicada (endpoint público explicitamente marcado).

## Contexto de tenant no NestJS
1. JWT do organizador carrega `organizacaoId`.
2. Guard global extrai e valida, populando `TenantContext` (request-scoped ou AsyncLocalStorage).
3. Repositórios/services recebem o `organizacaoId` do contexto — nunca do body/query da requisição.
4. Endpoints públicos (página da excursão, webhook PIX) são anotados com decorator explícito (`@Public()`) e revisados individualmente.

## Regras de query (Drizzle)
- Toda query em tabela operacional inclui `eq(tabela.organizacaoId, ctx.organizacaoId)` — SELECT, UPDATE e DELETE.
- UPDATE/DELETE por id: sempre `where(and(eq(id, ...), eq(organizacaoId, ...)))`. Buscar-por-id-e-depois-checar é proibido (TOCTOU e esquecível).
- Preferir repositórios por módulo que já aplicam o escopo, em vez de espalhar `and(...)` pelos services.
- Índices: composto começando pelo tenant — ex.: `(organizacao_id, data_saida)` em excursao; `(excursao_id, poltrona)` UNIQUE parcial `WHERE status = 'ativa'` em reserva.

## Defesa em profundidade (opcional, recomendado pós-fase 1)
RLS do PostgreSQL com `current_setting('app.organizacao_id')` como cinto de segurança adicional. Não substitui o escopo na aplicação; adiciona.

## Checklist de revisão (code-reviewer)
- [ ] Tabela nova tem `organizacao_id NOT NULL` + índice composto?
- [ ] Alguma query sem escopo de tenant? → BLOQUEANTE
- [ ] `organizacaoId` vem do contexto autenticado, nunca do payload do cliente?
- [ ] Endpoint público novo tem `@Public()` + justificativa no PR?
- [ ] Teste de isolamento: org A não lê/edita dado da org B (teste de API, não de UI)?
