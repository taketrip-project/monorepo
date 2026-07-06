import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TenantContextStorage } from './tenant-context';

/**
 * Abre o escopo do AsyncLocalStorage para TODA a requisição, antes de
 * qualquer guard rodar (ADR 003). Aplicado globalmente pelo módulo identity
 * (`IdentityModule.configure`), efetivo em toda a aplicação — ver o
 * comentário em `tenant-context.ts` sobre por que isso precisa ser
 * middleware (`run`) em vez de `enterWith()` dentro do guard.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    TenantContextStorage.run(() => next());
  }
}
