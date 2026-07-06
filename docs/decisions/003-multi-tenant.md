# 003 — Isolamento multi-tenant por coluna `organizacao_id`

**Data:** 2026-07-06 · **Autor:** backend-architect · **Status:** vigente

## Contexto

O Taketrip é SaaS B2B multi-tenant em banco PostgreSQL compartilhado numa VPS única. Vazamento de dados entre organizações é falha terminal do produto (risco nº 2 do blueprint). Alternativas: schema-per-tenant, database-per-tenant ou coluna discriminadora. As duas primeiras multiplicam migrations, conexões e backup numa operação de uma VPS — partes móveis demais para o porte do produto.

## Decisão

1. **Tenancy por coluna:** toda tabela operacional tem `organizacao_id uuid NOT NULL REFERENCES organizacao(id)`. Tabelas filhas (ex.: `ponto_embarque`, `reserva`) carregam `organizacao_id` desnormalizado — escopo direto sem join.
2. **Contexto no NestJS:** o JWT carrega `organizacaoId`; um guard global popula o `TenantContext` (AsyncLocalStorage). Repositórios recebem o tenant do contexto — **nunca** do body/query. UPDATE/DELETE por id sempre com `and(eq(id), eq(organizacaoId))` na mesma cláusula (buscar-e-depois-checar é proibido).
3. **Índices compostos começando pelo tenant:** `(organizacao_id, data_saida)`, `(organizacao_id, status_pagamento)` etc. — ver `docs/schema/`.
4. **Exceções públicas explícitas** (decorator `@Public()`, revisão individual): página da excursão (lookup por `codigo_publico`, não pelo UUID), reserva do passageiro e webhook PIX. Contrato em `docs/api/publico.yaml`.
5. **Exceção documentada de schema:** `webhook_evento.organizacao_id` é NULLABLE — o webhook chega sem tenant; a organização só é conhecida após resolver `txid → cobranca`. Evento de txid desconhecido fica sem tenant e vira alerta.
6. **RLS como defesa em profundidade (pós-fase 1):** habilitar Row Level Security com `current_setting('app.organizacao_id')` como cinto de segurança adicional. Não substitui o escopo na aplicação; adiciona. Entra como hardening após o núcleo operacional estar estável — não bloqueia a fase 1.
7. **Ajuste técnico registrado:** o índice UNIQUE parcial de poltrona cobre `status IN ('ativa','embarcada')`, não só `'ativa'` como o exemplo da skill — reserva embarcada continua ocupando a poltrona; sem isso o check-in liberaria o assento para dupla reserva durante a viagem.

## Consequências

- Um banco, uma migration, um backup — compatível com a VPS única e com o critério de simplicidade da governança.
- 404 (nunca 403) para id de outro tenant: não confirma a existência de dados alheios.
- Teste de aceite permanente (backlog): toda listagem/busca/escrita da org A retorna/afeta zero registros da org B.
- O custo é disciplina: o escopo depende de código; por isso o checklist do code-reviewer trata query sem tenant como BLOQUEANTE, e o RLS entra depois como rede de proteção.
