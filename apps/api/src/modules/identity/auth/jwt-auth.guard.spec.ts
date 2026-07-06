import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantContextStorage } from '../../../common/tenant-context';
import { NaoAutenticadoException } from '../../../common/domain-exception';

function criarContextoFalso(headers: Record<string, string> = {}): ExecutionContext {
  const request = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard (guard global de tenant — ADR 003)', () => {
  it('permite acesso sem token em rota marcada @Public()', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    const jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, reflector);

    await expect(guard.canActivate(criarContextoFalso())).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejeita rota protegida sem header Authorization', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, reflector);

    await expect(guard.canActivate(criarContextoFalso())).rejects.toBeInstanceOf(
      NaoAutenticadoException,
    );
  });

  it('rejeita JWT inválido/expirado', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwtService = {
      verifyAsync: jest.fn().mockRejectedValue(new Error('expirado')),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, reflector);

    await expect(
      guard.canActivate(criarContextoFalso({ authorization: 'Bearer token-invalido' })),
    ).rejects.toBeInstanceOf(NaoAutenticadoException);
  });

  it('popula o TenantContext a partir do payload do JWT em rota protegida', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const payload = { sub: 'membro-1', organizacaoId: 'org-1', sid: 'sessao-1' };
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload) } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, reflector);

    // Em produção quem abre o escopo é o TenantContextMiddleware (ver
    // tenant-context.ts); no teste unitário do guard, simulamos isso
    // diretamente com `run()` para poder inspecionar o resultado.
    await TenantContextStorage.run(async () => {
      const resultado = await guard.canActivate(
        criarContextoFalso({ authorization: 'Bearer token-valido' }),
      );

      expect(resultado).toBe(true);
      expect(TenantContextStorage.get()).toEqual({
        organizacaoId: 'org-1',
        membroId: 'membro-1',
        sessaoId: 'sessao-1',
      });
    });
  });

  it('lança se o middleware global não abriu o escopo do contexto (bug de wiring)', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const payload = { sub: 'membro-1', organizacaoId: 'org-1', sid: 'sessao-1' };
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload) } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, reflector);

    await expect(
      guard.canActivate(criarContextoFalso({ authorization: 'Bearer token-valido' })),
    ).rejects.toThrow(/TenantContextMiddleware/);
  });
});
