import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Carrega o `.env` da raiz do monorepo (um único arquivo para api + web —
 * ver README). Scripts standalone (migrate, seed) rodam via `tsx` a partir
 * de dois cwd possíveis: raiz do monorepo (`npm run -w apps/api`, cwd =
 * raiz, workspace resolve `.env` lá) ou dentro de `apps/api` (ex.:
 * `drizzle-kit` local, cwd = apps/api, `.env` está um nível acima). Não há
 * caso de uso real além desses dois, então checamos só esses caminhos em
 * vez de confiar só no cwd.
 *
 * O NestJS (main.ts/app.module.ts) usa seu próprio `ConfigModule` com
 * `envFilePath`, então este helper serve só aos scripts fora do Nest.
 */
export function loadEnv(): void {
  const candidatos = [
    resolve(process.cwd(), '.env'), // cwd = raiz do monorepo
    resolve(process.cwd(), '../../.env'), // cwd = apps/api
  ];

  const caminho = candidatos.find((c) => existsSync(c));
  config(caminho ? { path: caminho } : undefined);
}
