import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { DATABASE_CONNECTION } from './db.provider';

export const DATABASE_POOL = 'DATABASE_POOL';

/**
 * Módulo global de banco: expõe uma única instância do client Drizzle
 * (`DATABASE_CONNECTION`) para toda a aplicação via injeção de dependência.
 * Módulos de domínio (identity, fleet, ...) injetam este provider — nunca
 * abrem conexão própria. O pool cru também é exposto (`DATABASE_POOL`) só
 * para o NestJS poder encerrá-lo de forma limpa no shutdown.
 */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Pool({ connectionString: config.getOrThrow<string>('DATABASE_URL') }),
    },
    {
      provide: DATABASE_CONNECTION,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool) => drizzle(pool, { schema }),
    },
  ],
  exports: [DATABASE_CONNECTION, DATABASE_POOL],
})
export class DbModule {}
