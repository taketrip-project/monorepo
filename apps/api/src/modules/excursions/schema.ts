/**
 * Taketrip — Módulo `excursions` — Schema Drizzle (PostgreSQL)
 * ============================================================
 * Movido do artefato de design da fase 0 (`docs/schema/excursions.schema.ts`)
 * no bootstrap do repositório (item 1.0). Conteúdo inalterado; apenas os
 * imports relativos entre módulos foram ajustados para o novo caminho.
 *
 * Regras de domínio cobertas (H1.5–H1.7, H3.1, H3.4, H3.5):
 * - Estados: rascunho → publicada → lotada ⇄ publicada → em_andamento →
 *   concluida; cancelada a partir de qualquer estado antes de em_andamento,
 *   sempre com motivo.
 * - NOTA sobre `lotada`: vagas são SEMPRE calculadas (capacidade − reservas
 *   ativas). O status `lotada` existe no enum porque o backlog fixa a máquina
 *   de estados literalmente, mas ele é uma PROJEÇÃO do cálculo de vagas:
 *   a transição publicada ⇄ lotada é aplicada pelo módulo bookings na MESMA
 *   transação que cria/cancela/expira reserva. Nenhum código decide "tem
 *   vaga?" lendo o status — decide contando reservas.
 * - Preço e sinal em centavos (integer). Sinal: percentual OU fixo por
 *   excursão (default herdado da organização: 50%).
 * - `custo_total_centavos` alimenta o indicador de viabilidade (H3.4) —
 *   informativo, nunca bloqueia.
 * - `codigo_publico`: identificador curto e não sequencial da página pública
 *   (H3.1) — o link compartilhável não expõe o UUID interno.
 */
import {
  boolean,
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
import { veiculo } from '../fleet/schema';

export const statusExcursaoEnum = pgEnum('status_excursao', [
  'rascunho',
  'publicada',
  'lotada',
  'em_andamento',
  'concluida',
  'cancelada',
]);

export const tipoExcursaoEnum = pgEnum('tipo_excursao', ['bate_volta', 'pernoite']);

export const tipoSinalEnum = pgEnum('tipo_sinal', ['percentual', 'fixo']);

export const excursao = pgTable(
  'excursao',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacao.id),
    veiculoId: uuid('veiculo_id')
      .notNull()
      .references(() => veiculo.id),
    destino: text('destino').notNull(),
    /** Show, jogo, festa religiosa... Opcional. */
    eventoAncora: text('evento_ancora'),
    dataSaida: timestamp('data_saida', { withTimezone: true }).notNull(),
    dataRetorno: timestamp('data_retorno', { withTimezone: true }).notNull(),
    tipo: tipoExcursaoEnum('tipo').notNull(),
    /** Preço por passageiro, em centavos. Ex.: R$ 180,00 = 18000. */
    precoCentavos: integer('preco_centavos').notNull(),
    sinalTipo: tipoSinalEnum('sinal_tipo').notNull().default('percentual'),
    /**
     * Se sinal_tipo = percentual: inteiro 0–100 (default 50).
     * Se sinal_tipo = fixo: valor em centavos.
     * Arredondamento do sinal percentual: floor para o restante fechar o
     * total exato (50% de 17990 = 8995; restante = 8995).
     */
    sinalValor: integer('sinal_valor').notNull().default(50),
    descricao: text('descricao'),
    status: statusExcursaoEnum('status').notNull().default('rascunho'),
    motivoCancelamento: text('motivo_cancelamento'),
    /** Custo total (fretamento + ingressos + extras) em centavos — viabilidade H3.4. */
    custoTotalCentavos: integer('custo_total_centavos'),
    /** Código curto aleatório (ex.: base32 de 10 chars) da URL pública. */
    codigoPublico: text('codigo_publico').notNull(),
    /** Checklist legal informativo (H3.5) — nunca bloqueia nenhuma ação. */
    checklistLicencaAntt: boolean('checklist_licenca_antt').notNull().default(false),
    checklistSeguroPassageiros: boolean('checklist_seguro_passageiros')
      .notNull()
      .default(false),
    checklistListaImpressa: boolean('checklist_lista_impressa').notNull().default(false),
    publicadaEm: timestamp('publicada_em', { withTimezone: true }),
    canceladaEm: timestamp('cancelada_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** Listagem cronológica com filtros (H1.7): sempre escopada pelo tenant. */
    index('excursao_org_data_idx').on(t.organizacaoId, t.dataSaida),
    index('excursao_org_status_idx').on(t.organizacaoId, t.status),
    /** Lookup da página pública — única exceção de leitura sem tenant (endpoint @Public). */
    uniqueIndex('excursao_codigo_publico_uq').on(t.codigoPublico),
  ],
);

/**
 * Ponto de embarque ordenado com local e horário (H1.6).
 * Toda excursão publicada tem ≥1 (validado na transição rascunho → publicada).
 * `ordem` é 1..N mantida pela aplicação (reordenação reescreve em transação);
 * sem UNIQUE em (excursao_id, ordem) para não travar reordenação — a
 * consistência da sequência é responsabilidade do service.
 */
export const pontoEmbarque = pgTable(
  'ponto_embarque',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    /** Desnormalizado (padrão multi-tenancy): escopo direto sem join. */
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacao.id),
    excursaoId: uuid('excursao_id')
      .notNull()
      .references(() => excursao.id),
    local: text('local').notNull(),
    horario: timestamp('horario', { withTimezone: true }).notNull(),
    ordem: integer('ordem').notNull(),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ponto_embarque_org_excursao_idx').on(t.organizacaoId, t.excursaoId, t.ordem),
  ],
);

/**
 * Foto da excursão (S3). `ordem` define a foto de capa (ordem = 1),
 * usada no preview do link no WhatsApp (H3.1).
 */
export const fotoExcursao = pgTable(
  'foto_excursao',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacao.id),
    excursaoId: uuid('excursao_id')
      .notNull()
      .references(() => excursao.id),
    /** Chave do objeto no S3; URL pública montada na borda de apresentação. */
    s3Key: text('s3_key').notNull(),
    ordem: integer('ordem').notNull().default(1),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('foto_excursao_org_excursao_idx').on(t.organizacaoId, t.excursaoId)],
);
