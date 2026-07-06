import { loadEnv } from '../config/load-env';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from './db.provider';

loadEnv();

/**
 * Aplica as migrations geradas em ./drizzle na base apontada por
 * DATABASE_URL. Usado em dev (`npm run db:migrate`) e em CI, antes dos
 * testes de integração (aponta DATABASE_URL para a base de teste nesse caso).
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não configurada. Copie .env.example para .env.');
  }

  const { db, pool } = createDatabase(connectionString);
  console.log(`Aplicando migrations em ${connectionString.replace(/:[^:@]+@/, ':***@')}...`);
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations aplicadas com sucesso.');
  await pool.end();
}

main().catch((err) => {
  console.error('Falha ao aplicar migrations:', err);
  process.exit(1);
});
