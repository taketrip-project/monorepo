/**
 * Taketrip — Módulo `fleet` — Schema Drizzle (PostgreSQL)
 * =======================================================
 * Movido do artefato de design da fase 0 (`docs/schema/fleet.schema.ts`)
 * no bootstrap do repositório (item 1.0). Conteúdo inalterado; apenas os
 * imports relativos entre módulos foram ajustados para o novo caminho.
 *
 * Regras de domínio cobertas (H1.4):
 * - Tipos: van (15/16) · micro-ônibus (24–33) · ônibus (42–50).
 * - Capacidade é DERIVADA: quantidade_poltronas − poltronas bloqueadas.
 *   Nunca existe coluna "capacidade" digitada à parte.
 * - Poltronas bloqueadas (guia, quebrada) não contam como vaga.
 * - Exclusão é soft (`excluido_em`): veículo com excursão publicada
 *   vinculada nunca é apagado fisicamente — reservas existentes não podem
 *   ser corrompidas.
 */
import { sql } from 'drizzle-orm';
import {
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

export const tipoVeiculoEnum = pgEnum('tipo_veiculo', [
  'van',
  'micro_onibus',
  'onibus',
]);

/**
 * Formato do layout (jsonb):
 * { "fileiras": [[1, 2, null, 3, 4], [5, 6, null, 7, 8], ...] }
 * - Cada fileira é um array de números de poltrona; `null` é corredor/vazio.
 * - Padrão 2 + corredor + 2; van tem layout próprio (gerado pelo tipo).
 * - O layout é GERADO pela aplicação a partir de (tipo, quantidade_poltronas)
 *   e persistido para render estável do mapa; a numeração é 1..N.
 */
export interface LayoutVeiculo {
  fileiras: (number | null)[][];
}

export const veiculo = pgTable(
  'veiculo',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacao.id),
    apelido: text('apelido').notNull(),
    placa: text('placa').notNull(),
    tipo: tipoVeiculoEnum('tipo').notNull(),
    /** Total de poltronas físicas do layout (van 15/16, micro 24–33, ônibus 42–50). */
    quantidadePoltronas: integer('quantidade_poltronas').notNull(),
    layout: jsonb('layout').$type<LayoutVeiculo>().notNull(),
    /**
     * Números de poltrona bloqueados (guia, quebrada). Poltrona bloqueada
     * não conta como vaga e não pode receber reserva (validação na aplicação;
     * o mapa a exibe como `bloqueada`).
     */
    poltronasBloqueadas: integer('poltronas_bloqueadas')
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    excluidoEm: timestamp('excluido_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('veiculo_org_idx').on(t.organizacaoId),
    /** Placa única por organização entre veículos não excluídos. */
    uniqueIndex('veiculo_org_placa_uq')
      .on(t.organizacaoId, t.placa)
      .where(sql`excluido_em IS NULL`),
  ],
);
