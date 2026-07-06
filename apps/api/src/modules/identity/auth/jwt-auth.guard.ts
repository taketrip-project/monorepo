import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/public.decorator';
import { NaoAutenticadoException } from '../../../common/domain-exception';
import { TenantContextStorage } from '../../../common/tenant-context';
import type { AccessTokenPayload } from './jwt-payload.interface';

/**
 * Guard global de tenant (ADR 003), registrado via `APP_GUARD` pelo módulo
 * identity — aplica-se a toda a aplicação, mesmo a rotas de outros módulos.
 *
 * Rotas com `@Public()` (registro, login, refresh, esqueci-senha,
 * redefinir-senha, aceitar-convite — ver `security: []` nos contratos)
 * pulam a validação. Toda outra rota exige `Authorization: Bearer <jwt>`
 * válido; o guard popula o `TenantContext` (AsyncLocalStorage) a partir do
 * JWT — nunca aceita `organizacao_id` de body/query.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extrairToken(request);
    if (!token) {
      throw new NaoAutenticadoException();
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new NaoAutenticadoException('Sessão expirada. Entre novamente.');
    }

    // Muta o store já aberto pelo `TenantContextMiddleware` (ver comentário
    // em `tenant-context.ts` — `enterWith()` aqui não funcionaria).
    TenantContextStorage.set({
      organizacaoId: payload.organizacaoId,
      membroId: payload.sub,
      sessaoId: payload.sid,
    });

    return true;
  }

  private extrairToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [tipo, token] = header.split(' ');
    if (tipo !== 'Bearer' || !token) return null;
    return token;
  }
}
