import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';
import { ErroFilter } from '../../common/erro.filter';
import { TenantContextMiddleware } from '../../common/tenant-context.middleware';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { OrganizacaoController } from './organizacao/organizacao.controller';
import { OrganizacaoService } from './organizacao/organizacao.service';

/**
 * Módulo `identity` (conta, organização/tenant, membros, sessões, convites —
 * H1.1–H1.3, `docs/api/identity.yaml`).
 *
 * Responsável pela infraestrutura global de tenant (ADR 003/004), registrada
 * aqui mas efetiva em toda a aplicação (Nest aplica `APP_GUARD`/`APP_FILTER`
 * e middleware `forRoutes('*')` globalmente, independente do módulo que os
 * declara, desde que o módulo esteja na árvore de imports do `AppModule` —
 * está):
 * - `TenantContextMiddleware`: abre o escopo do AsyncLocalStorage para toda
 *   requisição, antes de qualquer guard rodar.
 * - `JwtAuthGuard`: guard global de tenant, valida o JWT e preenche o
 *   `TenantContext` já aberto pelo middleware.
 * - `ErroFilter`: formato único de erro da API.
 */
@Module({
  imports: [
    NotificationsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController, OrganizacaoController],
  providers: [
    AuthService,
    OrganizacaoService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: ErroFilter },
  ],
})
export class IdentityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
