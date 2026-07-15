import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/public.decorator';
import { NaoAutenticadoException } from '../../../common/domain-exception';
import { TenantContextStorage } from '../../../common/tenant-context';
import { DATABASE_CONNECTION, type Database } from '../../../db/db.provider';
import { membro, sessao } from '../schema';
import type { AccessTokenPayload } from './jwt-payload.interface';
import { JANELA_TOLERANCIA_CORRIDA_MS } from './sessao.constants';

/**
 * Guard global de tenant (ADR 003), registrado via `APP_GUARD` pelo módulo
 * identity — aplica-se a toda a aplicação, mesmo a rotas de outros módulos.
 *
 * Rotas com `@Public()` (registro, login, refresh, esqueci-senha,
 * redefinir-senha, aceitar-convite — ver `security: []` nos contratos)
 * pulam a validação. Toda outra rota exige `Authorization: Bearer <jwt>`
 * válido; o guard popula o `TenantContext` (AsyncLocalStorage) a partir do
 * JWT — nunca aceita `organizacao_id` de body/query.
 *
 * Além da assinatura do JWT, o guard confere no banco que a sessão (`sid`)
 * ainda está ativa e que o membro não foi removido (H1.3: membro removido
 * perde acesso IMEDIATAMENTE, não só quando o access token de 15 min
 * expirar). É uma única query indexada (PK de `sessao` + join pela PK de
 * `membro`) por requisição autenticada — barato de propósito, sem cache.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
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

    await this.garantirSessaoAtiva(payload);

    // Muta o store já aberto pelo `TenantContextMiddleware` (ver comentário
    // em `tenant-context.ts` — `enterWith()` aqui não funcionaria).
    TenantContextStorage.set({
      organizacaoId: payload.organizacaoId,
      membroId: payload.sub,
      sessaoId: payload.sid,
    });

    return true;
  }

  /**
   * 401 quando a sessão do token foi revogada (logout, redefinição de senha,
   * remoção de membro) ou o membro não pertence mais à organização. Todas as
   * claims do payload entram no WHERE por defesa em profundidade — um `sid`
   * válido nunca autentica outro membro/tenant.
   *
   * Exceção: sessão revogada por rotação LEGÍTIMA de refresh
   * (`substituidaPorId` preenchido) é tolerada por
   * `JANELA_TOLERANCIA_CORRIDA_MS` — o mesmo compromisso que o
   * `AuthService.refresh()` já faz para a corrida entre abas. Sem isso, um
   * access token ainda válido tomaria 401 no instante da rotação (requisição
   * em voo disparada com o token antigo). Revogações intencionais nunca têm
   * `substituidaPorId` e continuam derrubando o acesso imediatamente.
   */
  private async garantirSessaoAtiva(payload: AccessTokenPayload): Promise<void> {
    const [sessaoRow] = await this.db
      .select({ revogadaEm: sessao.revogadaEm, substituidaPorId: sessao.substituidaPorId })
      .from(sessao)
      .innerJoin(membro, eq(membro.id, sessao.membroId))
      .where(
        and(
          eq(sessao.id, payload.sid),
          eq(sessao.membroId, payload.sub),
          eq(sessao.organizacaoId, payload.organizacaoId),
          eq(membro.organizacaoId, payload.organizacaoId),
          isNull(membro.removidoEm),
        ),
      )
      .limit(1);

    if (!sessaoRow) {
      throw new NaoAutenticadoException('Sessão encerrada. Entre novamente.');
    }

    if (sessaoRow.revogadaEm) {
      const foiRotacaoLegitima = sessaoRow.substituidaPorId !== null;
      const decorridoMs = Date.now() - sessaoRow.revogadaEm.getTime();
      if (!foiRotacaoLegitima || decorridoMs > JANELA_TOLERANCIA_CORRIDA_MS) {
        throw new NaoAutenticadoException('Sessão encerrada. Entre novamente.');
      }
    }
  }

  private extrairToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [tipo, token] = header.split(' ');
    if (tipo !== 'Bearer' || !token) return null;
    return token;
  }
}
