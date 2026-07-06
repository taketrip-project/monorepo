/**
 * Taketrip — Módulo `bookings` — Schema Drizzle (PostgreSQL)
 * ==========================================================
 * Movido do artefato de design da fase 0 (`docs/schema/bookings.schema.ts`)
 * no bootstrap do repositório (item 1.0). Conteúdo inalterado; apenas os
 * imports relativos entre módulos foram ajustados para o novo caminho.
 *
 * Regras de domínio cobertas (H1.8–H1.13, H2.4, H3.2):
 * - Vagas = capacidade − reservas ativas: SEMPRE calculado (COUNT), nunca
 *   armazenado.
 * - POLTRONA ÚNICA garantida NO BANCO: índice UNIQUE parcial em
 *   (excursao_id, poltrona) entre reservas que ocupam poltrona
 *   (status IN ('ativa','embarcada')). Duas tentativas simultâneas →
 *   exatamente uma vence; a outra recebe 23505 → API responde 409.
 *   NOTA: a skill multi-tenancy exemplifica `WHERE status = 'ativa'`;
 *   incluí `embarcada` porque reserva embarcada continua ocupando a
 *   poltrona — sem isso, o check-in liberaria a poltrona para dupla
 *   reserva durante a viagem. Registrado no ADR 003.
 * - Passageiro identificado por WhatsApp dentro da organização (H1.9):
 *   UNIQUE (organizacao_id, whatsapp) — recadastrar reaproveita.
 * - Estados de reserva: ativa → embarcada | expirada | cancelada.
 * - Pagamento: pendente → sinal_pago → pago; cancelado explícito.
 *   Nunca regride silenciosamente (validação de transição no service).
 * - LGPD: coleta mínima — nome + WhatsApp; CPF opcional.
 */
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';
import { organizacao } from '../identity/schema';
import { excursao, pontoEmbarque } from '../excursions/schema';

export const statusReservaEnum = pgEnum('status_reserva', [
  'ativa',
  'embarcada',
  'expirada',
  'cancelada',
]);

export const statusPagamentoEnum = pgEnum('status_pagamento', [
  'pendente',
  'sinal_pago',
  'pago',
  'cancelado',
]);

export const origemReservaEnum = pgEnum('origem_reserva', [
  'organizador',
  'pagina_publica',
]);

/** Forma de pagamento informativa da fase 1 (marcação manual — H1.10). */
export const formaPagamentoEnum = pgEnum('forma_pagamento', [
  'dinheiro',
  'pix_manual',
  'pix_plataforma',
  'outro',
]);

/**
 * Passageiro: sem conta, sem senha. WhatsApp é o identificador dentro
 * da organização. Pertence ao tenant (o mesmo telefone em duas
 * organizações são dois registros — isolamento total).
 */
export const passageiro = pgTable(
  'passageiro',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacao.id),
    nome: text('nome').notNull(),
    /** Normalizado E.164 sem símbolos (ex.: 5511999998888) antes de gravar. */
    whatsapp: text('whatsapp').notNull(),
    /** Opcional (LGPD: coleta mínima). Somente dígitos. */
    cpf: text('cpf'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('passageiro_org_whatsapp_uq').on(t.organizacaoId, t.whatsapp),
    /**
     * Busca por nome tolerante a acento/caixa (H1.11): a migration da fase 1
     * deve criar `CREATE EXTENSION IF NOT EXISTS unaccent` e um índice de
     * expressão `lower(unaccent(nome))` via SQL custom — Drizzle não expressa
     * índice funcional com extensão; fica documentado aqui.
     */
    index('passageiro_org_nome_idx').on(t.organizacaoId, t.nome),
  ],
);

export const reserva = pgTable(
  'reserva',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacao.id),
    excursaoId: uuid('excursao_id')
      .notNull()
      .references(() => excursao.id),
    passageiroId: uuid('passageiro_id')
      .notNull()
      .references(() => passageiro.id),
    /** Ponto onde o passageiro embarca (lista de embarque agrupa por ele). */
    pontoEmbarqueId: uuid('ponto_embarque_id').references(() => pontoEmbarque.id),
    poltrona: integer('poltrona').notNull(),
    status: statusReservaEnum('status').notNull().default('ativa'),
    statusPagamento: statusPagamentoEnum('status_pagamento')
      .notNull()
      .default('pendente'),
    origem: origemReservaEnum('origem').notNull().default('organizador'),
    formaPagamento: formaPagamentoEnum('forma_pagamento'),
    /** Valor combinado em centavos (default: preço da excursão; editável — H1.9 campo "Valor"). */
    valorCentavos: integer('valor_centavos').notNull(),
    /**
     * Quando a reserva pendente expira (H2.4): criado_em + prazo da
     * organização. NULL = não expira (ex.: após sinal_pago o service zera).
     * O cron de expiração varre `status='ativa' AND status_pagamento='pendente'
     * AND expira_em < now()`.
     */
    expiraEm: timestamp('expira_em', { withTimezone: true }),
    /** Check-in de embarque (H1.12): 1 toque marca com horário; desfazer volta a NULL + status ativa. */
    embarcadaEm: timestamp('embarcada_em', { withTimezone: true }),
    canceladaEm: timestamp('cancelada_em', { withTimezone: true }),
    motivoCancelamento: text('motivo_cancelamento'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** GARANTIA CENTRAL: poltrona única por excursão entre reservas que ocupam assento. */
    uniqueIndex('reserva_excursao_poltrona_ativa_uq')
      .on(t.excursaoId, t.poltrona)
      .where(sql`status IN ('ativa', 'embarcada')`),
    /** Mapa de poltronas, listas e contagem de vagas de uma excursão. */
    index('reserva_org_excursao_idx').on(t.organizacaoId, t.excursaoId),
    /** Aba Pagto: pendentes primeiro (H2.5). */
    index('reserva_org_status_pag_idx').on(t.organizacaoId, t.statusPagamento),
    /** Cron de expiração (H2.4) — varredura global, parcial e barata. */
    index('reserva_expiracao_idx')
      .on(t.expiraEm)
      .where(sql`status = 'ativa' AND status_pagamento = 'pendente'`),
  ],
);

/**
 * Pendência de estorno (H1.7): cancelar excursão com reservas pagas registra
 * a pendência — o estorno em si é MANUAL, fora do sistema (recusado no
 * backlog: estorno automático). Vive em bookings (não em billing) porque é
 * criada na fase 1 pelo fluxo de cancelamento, antes de existir billing;
 * a conciliação (H2.6) apenas a lê.
 */
export const pendenciaEstorno = pgTable(
  'pendencia_estorno',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacao.id),
    reservaId: uuid('reserva_id')
      .notNull()
      .references(() => reserva.id),
    valorCentavos: integer('valor_centavos').notNull(),
    motivo: text('motivo').notNull(),
    resolvidaEm: timestamp('resolvida_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('pendencia_estorno_org_idx')
      .on(t.organizacaoId)
      .where(sql`resolvida_em IS NULL`),
  ],
);
