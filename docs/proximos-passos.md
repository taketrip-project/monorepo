# Taketrip — Próximos Passos

> Atualizado em 06/07/2026, ao fim da fase 0. Este arquivo é o ponteiro operacional de "onde estamos e o que vem agora". Detalhes de cada história: `docs/backlog.md`. Quem faz o quê: `docs/ai-organization.md`.

## Onde estamos

- ✅ **Organização de IA criada** — 7 agentes (`.claude/agents/`), 4 skills (`.claude/skills/`)
- ✅ **Stack confirmada** — NestJS + Drizzle + PostgreSQL · React + TS · Docker Compose/VPS
- ✅ **Fase 0 (fundação) concluída** — backlog, decisões 001–006, schema Drizzle (`docs/schema/`), contratos OpenAPI (`docs/api/`)
- ⬜ Fase 1 — núcleo operacional ← **PRÓXIMO PASSO**
- ⬜ Fase 2 — dinheiro (PIX)
- ⬜ Fase 3 — venda e release

## Pendências do arquiteto humano (não são dos agentes)

| # | Pendência | Bloqueia |
|---|---|---|
| 1 | Aprovar **ADR 005 — provedor PIX** (`docs/decisions/005-provedor-pix.md`; recomendação: Efí) | Toda a fase 2. Não bloqueia a fase 1 — dá pra decidir em paralelo |
| 2 | Definir **política LGPD** de retenção/exclusão de dados de passageiros | Vira história só depois da decisão |

## Fase 1 — Núcleo operacional (passo a passo)

Objetivo: o organizador larga a planilha **antes** de existir pagamento online. Ciclo completo: criar excursão → reservar poltrona → marcar pago manualmente → embarcar.

1. **Bootstrap do monorepo** (backend-engineer) — item 1.0 do backlog, decisão 002:
   - `git init` + monorepo com `apps/api` (NestJS + Drizzle) e `apps/web` (React), Docker Compose com PostgreSQL
   - mover `docs/schema/*.schema.ts` para `apps/api/src/modules/<modulo>/schema.ts` + primeira migration
   - CI mínima (lint + testes) e seed de desenvolvimento
2. **identity** (backend-engineer) — H1.1–H1.3: cadastro da organização, login (JWT + refresh rotativo, ADR 004), membros sem papéis; guard multi-tenant global (ADR 003)
3. **fleet** (backend-engineer) — H1.4: veículos com layout de poltronas
4. **excursions** (backend-engineer) — H1.5–H1.7: CRUD, estados, pontos de embarque, cancelamento com motivo
5. **bookings** (backend-engineer) — H1.8–H1.13: reserva com poltrona (constraint no banco, 409 em conflito), cadastro rápido (4 campos), pagamento manual, busca tolerante a acento, lista de embarque com check-in de 1 toque
6. **Frontend em paralelo a partir do passo 2** (frontend-engineer): componentes do design system (`src/ui/`) → login → excursões → mapa de poltronas → cadastro rápido → embarque → dashboard (H1.14)
7. **Todo PR passa pelo code-reviewer** antes do merge (bloqueantes: query sem escopo de tenant, violação do design system, abstração sem justificativa)
8. **Fecho da fase** (qa): fluxos críticos "vender/operar/embarcar" verdes → relatório de release ao cto

Critério de saída da fase 1: os critérios de aceite de H1.1–H1.14 do `docs/backlog.md` passando, testado no viewport 375px.

## Fase 2 — Dinheiro (resumo; detalhes no backlog)

Pré-requisito: ADR 005 aprovado + credenciais do provedor. Billing-specialist implementa: config PIX por organização → cobrança (sinal/integral) → webhook idempotente → expiração de reserva → tela Pagto → conciliação diária → templates WhatsApp. Regra de ouro: **billing é aditivo** — sem PIX configurado o app continua 100% funcional (decisões 001 e 006).

## Fase 3 — Venda e release (resumo)

Página pública da excursão + reserva do passageiro (com e sem PIX — decisão 006), polling curto para "Pendente → Pago sem refresh", indicador de viabilidade, checklist legal (ANTT/seguro/CADASTUR, informativo), suíte e2e completa do qa e relatório final de release do MVP.

## Fluxo operacional (quem faz o quê)

1. **IA gera o código** seguindo os agentes e skills do projeto (code-reviewer e qa são a primeira barreira de qualidade).
2. **Matheus valida** — testes manuais + revisão de código/padrões — **antes de subir**. Cada entrega para em estado "pronto para validação", com instruções de como rodar e o que testar.
3. Nada sobe (push/deploy) sem o OK explícito do Matheus.

## Como retomar numa sessão nova

Diga **"segue pra fase 1"** — o fluxo é: backend-engineer (bootstrap), depois backend-engineer + frontend-engineer por módulo, code-reviewer em todo PR, qa no fecho. Decisões novas de escopo passam pelo cto; schema/contratos mudam só via backend-architect.
