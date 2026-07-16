import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { DATABASE_CONNECTION, createDatabase, type Database } from '../../../src/db/db.provider';
import { DATABASE_POOL } from '../../../src/db/db.module';
import { EmailService } from '../../../src/modules/notifications/email/email.service';
import { paraErroDeValidacao } from '../../../src/common/validation.util';
import { PublicoThrottlerGuard } from '../../../src/common/rate-limit-publico';
import { InMemoryEmailService } from './in-memory-email.service';

export interface TestAppContext {
  app: INestApplication;
  db: Database;
  emailService: InMemoryEmailService;
  fecharTudo: () => Promise<void>;
}

export interface OpcoesAppDeTeste {
  /**
   * Por default o rate limit das rotas públicas (ADR 008) é DESLIGADO nos
   * testes de integração — todas as requisições saem do mesmo IP do
   * supertest e estourariam os limites por minuto entre um teste e outro.
   * O spec dedicado de rate limit liga com `true`.
   */
  manterRateLimitPublico?: boolean;
}

/**
 * Sobe a aplicação Nest completa (`AppModule`, mesmos módulos/guards/filtros
 * do `main.ts`) para testes de integração via supertest, mas:
 * - conecta no banco de TESTE (`DATABASE_URL_TEST`), nunca no de dev —
 *   sobrescrevendo os providers de conexão em vez de mexer em `process.env`;
 * - troca o `EmailService` real (SES) por um fake em memória, para os
 *   testes poderem ler o token enviado por e-mail sem bater na AWS;
 * - desliga o throttler das rotas públicas, a menos que o spec peça para manter.
 */
export async function criarAppDeTeste(opcoes: OpcoesAppDeTeste = {}): Promise<TestAppContext> {
  const connectionString = process.env.DATABASE_URL_TEST;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL_TEST não configurada. Copie .env.example para .env e rode `npm run db:migrate` apontando para a base de teste (ver README).',
    );
  }
  const { db, pool } = createDatabase(connectionString);

  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DATABASE_POOL)
    .useValue(pool)
    .overrideProvider(DATABASE_CONNECTION)
    .useValue(db)
    .overrideProvider(EmailService)
    .useClass(InMemoryEmailService);

  if (!opcoes.manterRateLimitPublico) {
    builder.overrideGuard(PublicoThrottlerGuard).useValue({ canActivate: () => true });
  }

  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: paraErroDeValidacao,
    }),
  );
  await app.init();

  const emailService = moduleRef.get(EmailService) as InMemoryEmailService;

  return {
    app,
    db,
    emailService,
    fecharTudo: async () => {
      await app.close();
      await pool.end();
    },
  };
}
