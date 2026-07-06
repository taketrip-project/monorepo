import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

/**
 * Cria o client Drizzle a partir de uma connection string. Usado tanto pelo
 * DbModule (app rodando) quanto pelo script de migration e pelos testes de
 * integração — uma única fábrica evita configuração duplicada do pool.
 */
export function createDatabase(connectionString: string): {
  db: Database;
  pool: Pool;
} {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
