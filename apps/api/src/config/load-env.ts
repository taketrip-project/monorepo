import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Carrega o `.env` da raiz do monorepo (um único arquivo para api + web —
 * ver README). Scripts standalone (migrate, seed) rodam via `tsx` a partir
 * de diretórios diferentes dependendo de como são chamados (`npm run -w
 * apps/api`, direto de dentro de apps/api, etc.), então checamos os
 * caminhos mais prováveis em vez de confiar só no cwd.
 *
 * O NestJS (main.ts/app.module.ts) usa seu próprio `ConfigModule` com
 * `envFilePath`, então este helper serve só aos scripts fora do Nest.
 */
export function loadEnv(): void {
  const candidatos = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(__dirname, '../../.env'), // apps/api/.env
    resolve(__dirname, '../../../../.env'), // raiz do monorepo
  ];

  const caminho = candidatos.find((c) => existsSync(c));
  config(caminho ? { path: caminho } : undefined);
}
