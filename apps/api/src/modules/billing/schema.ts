/**
 * Taketrip — Módulo `billing` — Schema Drizzle (PostgreSQL)
 * =========================================================
 * Movido do artefato de design da fase 0 (`docs/schema/billing.schema.ts`)
 * no bootstrap do repositório (item 1.0). Conteúdo inalterado; apenas os
 * imports relativos entre módulos foram ajustados para o novo caminho.
 *
 * IMPLEMENTAÇÃO EXCLUSIVA DO billing-specialist (governança). O schema e o
 * contrato são do backend-architect; o código, não.
 *
 * Regras cobertas (H2.1–H2.6, skill pix-cobranca):
 * - Cobrança dinâmica PIX: uma `cobranca` local por intenção de pagamento,
 *   com txid do provedor — chave de conciliação.
 * - EVENTO BRUTO ANTES DE PROCESSAR: `webhook_evento` grava o payload cru
 *   e a idempotência é garantida por UNIQUE no id do evento do provedor.
 * - Processamento por estado-alvo ("esta cobrança está paga?"), tolerante a
 *   retries e fora de ordem.
 * - Transições de cobrança: pendente → paga | expirada | cancelada. Sem
 *   regressão silenciosa.
 * - Provedor atrás da interface `PixProvider` (troca barata) — ADR 005.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';
import { organizacao } from '../identity/schema';
import { reserva } from '../bookings/schema';

export const provedorPixEnum = pgEnum('provedor_pix', [
  'mercado_pago',
  'efi',
  'asaas',
]);

export const tipoCobrancaEnum = pgEnum('tipo_cobranca', [
  'sinal',
  'integral',
  'restante',
]);

export const statusCobrancaEnum = pgEnum('status_cobranca', [
  'pendente',
  'paga',
  'expirada',
  'cancelada',
]);

export const tipoAlertaEnum = pgEnum('tipo_alerta_operacional', [
  'pix_pos_expiracao_sem_vaga',
  'txid_desconhecido',
  'divergencia_conciliacao',
]);

/**
 * Configuração PIX da organização (H2.1). 1:1 com o tenant.
 * Sem registro aqui (ou `ativo = false`), o app opera 100% no modo manual
 * da fase 1 — billing é aditivo, nunca bloqueante.
 */
export const configuracaoPix = pgTable(
  'configuracao_pix',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacao.id),
    provedor: provedorPixEnum('provedor').notNull(),
    /** Chave PIX de recebimento da organização. */
    chavePix: text('chave_pix').notNull(),
    /**
     * Credenciais do provedor CIFRADAS NA APLICAÇÃO (AES-256-GCM com chave
     * de ambiente) antes de persistir. NUNCA em claro, NUNCA logadas.
     */
    credenciaisCriptografadas: text('credenciais_criptografadas').notNull(),
    ativo: boolean('ativo').notNull().default(false),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('configuracao_pix_org_uq').on(t.organizacaoId)],
);

/**
 * Cobrança PIX (H2.2). Uma por intenção de pagamento (sinal | integral |
 * restante). Valores em centavos; arredondamento do sinal: floor, e o
 * `restante` fecha o total exato da reserva.
 */
export const cobranca = pgTable(
  'cobranca',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacao.id),
    reservaId: uuid('reserva_id')
      .notNull()
      .references(() => reserva.id),
    tipo: tipoCobrancaEnum('tipo').notNull(),
    valorCentavos: integer('valor_centavos').notNull(),
    status: statusCobrancaEnum('status').notNull().default('pendente'),
    provedor: provedorPixEnum('provedor').notNull(),
    /** txid da cob dinâmica no provedor — chave de conciliação e rastreio na ficha. */
    txid: text('txid').notNull(),
    /** Payload do QR Code (imagem gerada na borda) e copia-e-cola. */
    copiaECola: text('copia_e_cola').notNull(),
    /** Alinhada à expiração da reserva (prazo da organização, default 48h). */
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    pagaEm: timestamp('paga_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** txid é único no provedor; lookup do webhook entra por aqui. */
    uniqueIndex('cobranca_txid_uq').on(t.txid),
    index('cobranca_org_status_idx').on(t.organizacaoId, t.status),
    index('cobranca_reserva_idx').on(t.reservaId),
  ],
);

/**
 * Evento bruto de webhook PIX (H2.3). Grava-se ANTES de qualquer
 * processamento; o processamento é idempotente e re-executável (cron de
 * retry varre `processado_em IS NULL` — sem SQS no MVP).
 *
 * EXCEÇÃO DOCUMENTADA AO PADRÃO MULTI-TENANT: `organizacao_id` é NULLABLE
 * porque o webhook chega sem contexto de tenant — a organização só é
 * conhecida após resolver o txid → cobranca. Evento de txid desconhecido
 * fica com organizacao_id NULL, gera alerta e responde 200 (não crashar,
 * não fazer o provedor re-tentar para sempre). Ver ADR 003.
 */
export const webhookEvento = pgTable(
  'webhook_evento',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    provedor: provedorPixEnum('provedor').notNull(),
    /** Id do evento no provedor, quando existir — base da idempotência. */
    idEventoProvedor: text('id_evento_provedor'),
    txid: text('txid'),
    payload: jsonb('payload').notNull(),
    assinaturaValida: boolean('assinatura_valida').notNull(),
    /** Preenchido após resolver txid → cobranca; NULL para txid desconhecido. */
    organizacaoId: uuid('organizacao_id').references(() => organizacao.id),
    cobrancaId: uuid('cobranca_id').references(() => cobranca.id),
    recebidoEm: timestamp('recebido_em', { withTimezone: true }).notNull().defaultNow(),
    processadoEm: timestamp('processado_em', { withTimezone: true }),
    tentativas: integer('tentativas').notNull().default(0),
    erroProcessamento: text('erro_processamento'),
  },
  (t) => [
    /** Idempotência: o mesmo evento entregue 2+ vezes insere 1 linha (ON CONFLICT DO NOTHING). */
    uniqueIndex('webhook_evento_provedor_id_uq')
      .on(t.provedor, t.idEventoProvedor)
      .where(sql`id_evento_provedor IS NOT NULL`),
    index('webhook_evento_txid_idx').on(t.txid),
    /** Fila de reprocessamento do cron. */
    index('webhook_evento_pendente_idx')
      .on(t.recebidoEm)
      .where(sql`processado_em IS NULL AND assinatura_valida = true`),
  ],
);

/**
 * Alerta operacional de dinheiro (H2.4, H2.6): PIX pós-expiração sem vaga,
 * txid desconhecido, divergência de conciliação. Dinheiro nunca some
 * silenciosamente — sempre vira um alerta acionável com link para resolver.
 */
export const alertaOperacional = pgTable(
  'alerta_operacional',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    /**
     * NOT NULL: alerta de txid desconhecido sem tenant resolvível é gravado
     * na organização dona da configuração PIX que recebeu o webhook; se nem
     * isso for resolvível, fica só no log de operação (fora do produto).
     */
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacao.id),
    tipo: tipoAlertaEnum('tipo').notNull(),
    cobrancaId: uuid('cobranca_id').references(() => cobranca.id),
    reservaId: uuid('reserva_id').references(() => reserva.id),
    detalhes: jsonb('detalhes'),
    resolvidoEm: timestamp('resolvido_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('alerta_org_aberto_idx')
      .on(t.organizacaoId, t.criadoEm)
      .where(sql`resolvido_em IS NULL`),
  ],
);
