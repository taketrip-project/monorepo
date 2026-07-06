/**
 * Taketrip — Módulo `identity` — Schema Drizzle (PostgreSQL)
 * =========================================================
 * Movido do artefato de design da fase 0 (`docs/schema/identity.schema.ts`)
 * no bootstrap do repositório (item 1.0). Conteúdo inalterado; apenas os
 * imports relativos entre módulos foram ajustados para o novo caminho.
 *
 * Padrões (não negociáveis — ver ADR 003 e skill multi-tenancy):
 * - PK: UUID v7 gerado na aplicação (`uuidv7`), nunca serial.
 * - Timestamps: sempre `timestamptz`.
 * - `organizacao` é o tenant; toda tabela operacional carrega
 *   `organizacao_id NOT NULL` + índice composto começando pelo tenant.
 * - Tokens (convite, redefinição, refresh) são armazenados como HASH
 *   (sha256) — o valor em claro só existe no e-mail/resposta enviada.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

/**
 * O tenant. Agência pequena ou MEI autônomo.
 * Configurações operacionais moram aqui (H2.1); credenciais PIX ficam no
 * módulo billing (`configuracao_pix`) — segredo de pagamento não é identidade.
 */
export const organizacao = pgTable('organizacao', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  nome: text('nome').notNull(),
  /** Prazo para reserva `pendente` sem sinal expirar (H2.4). Default 48h. */
  prazoExpiracaoReservaHoras: integer('prazo_expiracao_reserva_horas')
    .notNull()
    .default(48),
  /** Sinal default da organização, em percentual inteiro (0–100). Default 50. */
  sinalDefaultPercentual: integer('sinal_default_percentual').notNull().default(50),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Membro da organização (o organizador e até 2 colegas — H1.3).
 * Sem papéis no MVP: todo membro pode tudo dentro da organização.
 * Remoção é soft (`removido_em`) para auditoria; sessões são revogadas na hora.
 */
export const membro = pgTable(
  'membro',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacao.id),
    nome: text('nome').notNull(),
    email: text('email').notNull(),
    /** Hash argon2id (ver ADR 004). Nunca armazenar senha em claro. */
    senhaHash: text('senha_hash').notNull(),
    /** Proteção de força bruta (H1.2): espera progressiva após 5 falhas. */
    tentativasLoginFalhas: integer('tentativas_login_falhas').notNull().default(0),
    bloqueadoAte: timestamp('bloqueado_ate', { withTimezone: true }),
    removidoEm: timestamp('removido_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** E-mail único GLOBAL entre membros ativos (login é por e-mail, sem tenant na URL). */
    uniqueIndex('membro_email_uq').on(t.email).where(sql`removido_em IS NULL`),
    index('membro_org_idx').on(t.organizacaoId),
  ],
);

/**
 * Sessão de refresh token (ADR 004: JWT curto + refresh rotativo persistido).
 * Persistir o refresh permite o critério de H1.3: membro removido perde
 * acesso imediatamente (revoga-se todas as sessões do membro).
 */
export const sessao = pgTable(
  'sessao',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacao.id),
    membroId: uuid('membro_id')
      .notNull()
      .references(() => membro.id),
    /** sha256 do refresh token; o token em claro só vai ao cliente. */
    refreshTokenHash: text('refresh_token_hash').notNull(),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    revogadaEm: timestamp('revogada_em', { withTimezone: true }),
    /**
     * Aponta para a sessão emitida na rotação legítima que revogou esta
     * (ADR 004). Distingue "revogada porque foi trocada por um token novo
     * na hora" (preenchido) de "revogada por outro motivo" — logout,
     * redefinição de senha, remoção de membro, ou a varredura de segurança
     * quando um refresh já revogado é reapresentado fora da janela de 30s
     * ("rouba a família") — caso em que fica NULL. Sem essa distinção, a
     * tolerância de 30s para corrida entre abas acabaria também tolerando
     * reuso de um token revogado por logout/roubo que por acaso caiu dentro
     * da mesma janela de tempo (bug encontrado nos testes de integração).
     */
    substituidaPorId: uuid('substituida_por_id').references((): AnyPgColumn => sessao.id),
    userAgent: text('user_agent'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sessao_refresh_hash_uq').on(t.refreshTokenHash),
    index('sessao_org_membro_idx').on(t.organizacaoId, t.membroId),
  ],
);

/**
 * Convite de membro (H1.3). O convidado cria senha via token e cai na
 * mesma organização. Token expira e só funciona uma vez (`aceito_em`).
 */
export const convite = pgTable(
  'convite',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacao.id),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull(),
    criadoPorMembroId: uuid('criado_por_membro_id')
      .notNull()
      .references(() => membro.id),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    aceitoEm: timestamp('aceito_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('convite_token_hash_uq').on(t.tokenHash),
    /** No máximo 1 convite pendente por e-mail por organização. */
    uniqueIndex('convite_org_email_pendente_uq')
      .on(t.organizacaoId, t.email)
      .where(sql`aceito_em IS NULL`),
  ],
);

/**
 * Token de redefinição de senha (H1.2): enviado por e-mail (SES),
 * expira e só funciona uma vez (`usado_em`).
 */
export const tokenRedefinicaoSenha = pgTable(
  'token_redefinicao_senha',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    /** Desnormalizado do membro para manter o padrão de escopo por tenant. */
    organizacaoId: uuid('organizacao_id')
      .notNull()
      .references(() => organizacao.id),
    membroId: uuid('membro_id')
      .notNull()
      .references(() => membro.id),
    tokenHash: text('token_hash').notNull(),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    usadoEm: timestamp('usado_em', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('token_redef_hash_uq').on(t.tokenHash),
    index('token_redef_membro_idx').on(t.membroId),
  ],
);
