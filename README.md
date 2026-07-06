# Taketrip

SaaS multi-tenant para agências pequenas e MEIs que organizam excursões rodoviárias no Brasil (vans, micro-ônibus, ônibus). Substitui WhatsApp + planilha por um app mobile-first: cadastro de excursão, mapa de poltronas, reserva, cobrança PIX e lista de embarque.

Contexto de produto e regras de negócio: `.claude/skills/dominio-excursoes/SKILL.md`. Backlog e critérios de aceite: `docs/backlog.md`. Decisões de arquitetura: `docs/decisions/`.

## Stack

- **apps/api** — NestJS + Drizzle ORM + PostgreSQL.
- **apps/web** — React + TypeScript (Vite), mobile-first.
- Monorepo com **npm workspaces** (decisão registrada em `docs/decisions/002-monorepo.md`).
- PostgreSQL via Docker Compose para desenvolvimento local.

## Requisitos

- Node.js ≥ 22 (testado com Node 24) e npm ≥ 10.
- Docker + Docker Compose (para o PostgreSQL de dev).

## Setup do zero (≤10 passos)

```bash
# 1. Clonar o repositório e entrar na pasta
git clone <url-do-repo> taketrip && cd taketrip

# 2. Copiar as variáveis de ambiente (já batem com o docker-compose.yml)
cp .env.example .env

# 3. Instalar TODAS as dependências (api + web) com um único comando
npm install

# 4. Subir o PostgreSQL de desenvolvimento (Docker)
npm run db:up

# 5. Aplicar as migrations no banco
npm run db:migrate

# 6. (opcional, recomendado) Popular dados mínimos de desenvolvimento
npm run db:seed

# 7. Subir api + web juntas, em modo dev, com um único comando
npm run dev
```

Depois do passo 7:
- API: http://localhost:3333/health (health check) — rotas de negócio ficam sob `/api/v1`.
- Web: http://localhost:5173

Para parar o banco: `npm run db:down`.

## Estrutura do repositório

```
apps/
  api/                    # NestJS + Drizzle
    src/
      modules/
        identity/         # conta, organização (tenant), membros, sessões
        fleet/            # veículos e layout de poltronas
        excursions/       # excursão, estados, pontos de embarque
        bookings/         # passageiro, reserva, mapa de poltronas, embarque
        billing/          # PIX — território exclusivo do billing-specialist
        notifications/    # mensagens prontas (WhatsApp deep-link, e-mail SES)
      db/                 # client Drizzle, barril de schema, script de migration
    drizzle/              # migrations SQL geradas (drizzle-kit)
    seed/                 # seed de desenvolvimento
    test/integration/     # testes contra Postgres real (docker compose)
  web/                    # React + TS, mobile-first
    src/
docker/postgres/init.sql  # cria a base de teste + extensão unaccent
docker-compose.yml        # PostgreSQL de dev
docs/                     # backlog, decisões (ADRs), contratos OpenAPI
.claude/                  # agentes e skills do time de IA (não editar aqui)
```

Cada pasta em `apps/api/src/modules/*` reflete um módulo do backlog (`docs/backlog.md`) e tem seu próprio `schema.ts`, migrado a partir de `docs/schema/*.schema.ts` (fase 0). O módulo `billing` é implementado exclusivamente pelo `billing-specialist`.

## Comandos úteis

Rodados a partir da raiz (workspaces):

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe API (porta 3333) e Web (porta 5173) juntas, com reload. |
| `npm run build` | Build de produção de api e web. |
| `npm run lint` | Lint de api e web. |
| `npm run test` | Testes unitários de api e web. |
| `npm run test:integration` | Testes de integração da api contra Postgres real. |
| `npm run db:up` / `db:down` | Sobe/derruba o PostgreSQL de dev (Docker). |
| `npm run db:generate` | Gera uma nova migration a partir do schema Drizzle. |
| `npm run db:migrate` | Aplica as migrations pendentes (usa `DATABASE_URL` do `.env`). |
| `npm run db:seed` | Popula o banco com dados mínimos de desenvolvimento. |

## Testes

- **Unitários** (`npm run test`): não tocam banco; rodam em qualquer máquina sem Docker.
- **Integração** (`npm run test:integration`, só na api): batem em Postgres real. Requer:
  1. `npm run db:up` (o `docker-compose.yml` já cria a base `taketrip_test` ao lado de `taketrip`, via `docker/postgres/init.sql`);
  2. migrations aplicadas na base de teste — rode uma vez:
     ```bash
     DATABASE_URL=postgres://taketrip:taketrip@localhost:5432/taketrip_test npm run db:migrate -w apps/api
     ```
  3. `DATABASE_URL_TEST` configurada no `.env` (já vem preenchida no `.env.example`).

Todo endpoint novo nasce com teste de integração cobrindo o caminho feliz + o caso de borda principal (ver `.claude/agents/backend-engineer.md`). O teste de isolamento multi-tenant (`test/integration/multi-tenancy.integration-spec.ts`) é o critério de aceite permanente do backlog: nenhuma query da organização A pode ler ou afetar dados da organização B.

## CI

`.github/workflows/ci.yml` roda em todo PR: lint → migrations na base de teste → testes unitários → testes de integração → build, para api e web. PR com qualquer etapa falhando não pode ser mesclado.

## Banco de dados

- Schema Drizzle por módulo em `apps/api/src/modules/<modulo>/schema.ts`; o barril `apps/api/src/db/schema.ts` reexporta tudo para o `drizzle-kit` (config em `apps/api/drizzle.config.ts`).
- Toda tabela operacional tem `organizacao_id` (tenant) — ver `.claude/skills/multi-tenancy/SKILL.md`. Nenhuma query deve ler/escrever sem esse escopo.
- A migration inicial (`apps/api/drizzle/0000_complete_whirlwind.sql`) inclui, além do que o Drizzle gera, a extensão `unaccent` e um índice funcional para a busca de passageiro tolerante a acento/caixa (H1.11) — documentado no próprio arquivo e em `modules/bookings/schema.ts`.

## Variáveis de ambiente

Ver `.env.example`. Um único `.env` na raiz serve api e web (Vite só expõe as variáveis prefixadas com `VITE_`).

## Estado deste bootstrap

Este é o item 1.0 do backlog: monorepo, banco, migrations e CI prontos. Os módulos de domínio (`identity`, `fleet`, `excursions`, `bookings`) ainda não têm controllers/services de negócio — isso é implementado nas histórias seguintes (H1.1 em diante), seguindo os contratos em `docs/api/*.yaml`.
