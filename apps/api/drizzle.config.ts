import { defineConfig } from 'drizzle-kit';
import { loadEnv } from './src/config/load-env';

loadEnv();

/**
 * Aponta para o barril de schemas de todos os módulos (db/schema.ts), que
 * apenas re-exporta o schema.ts de cada módulo em src/modules/*.
 * Gera migrations em ./drizzle a partir do schema — nunca o inverso.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://taketrip:taketrip@localhost:5432/taketrip',
  },
  verbose: true,
  strict: true,
});
