import type { organizacao, membro, convite } from './schema';

/** Converte linhas Drizzle (camelCase) para o formato dos schemas OpenAPI (snake_case). */

export function mapOrganizacao(row: typeof organizacao.$inferSelect) {
  return {
    id: row.id,
    nome: row.nome,
    prazo_expiracao_reserva_horas: row.prazoExpiracaoReservaHoras,
    sinal_default_percentual: row.sinalDefaultPercentual,
    criado_em: row.criadoEm.toISOString(),
  };
}

export function mapMembro(row: typeof membro.$inferSelect) {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    criado_em: row.criadoEm.toISOString(),
  };
}

export function mapConvite(row: typeof convite.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    expira_em: row.expiraEm.toISOString(),
    criado_em: row.criadoEm.toISOString(),
  };
}
