import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { Database } from '../../../db/db.provider';
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

/**
 * Fake mínimo da cadeia Drizzle usada pelo guard para conferir a sessão:
 * `select().from().innerJoin().where().limit()` → linhas.
 */
function criarDbFalso(
  linhas: Array<{ revogadaEm?: Date | null; substituidaPorId?: string | null }>,
): Database {
  return {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: async () => linhas,
          }),
        }),
      }),
    }),
  } as unknown as Database;
}

describe('JwtAuthGuard (guard global de tenant — ADR 003)', () => {
  const payload = { sub: 'membro-1', organizacaoId: 'org-1', sid: 'sessao-1' };

  it('permite acesso sem token em rota marcada @Public()', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    const jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(criarDbFalso([]), jwtService, reflector);

    await expect(guard.canActivate(criarContextoFalso())).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejeita rota protegida sem header Authorization', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(criarDbFalso([]), jwtService, reflector);

    await expect(guard.canActivate(criarContextoFalso())).rejects.toBeInstanceOf(
      NaoAutenticadoException,
    );
  });

  it('rejeita JWT inválido/expirado', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwtService = {
      verifyAsync: jest.fn().mockRejectedValue(new Error('expirado')),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(criarDbFalso([]), jwtService, reflector);

    await expect(
      guard.canActivate(criarContextoFalso({ authorization: 'Bearer token-invalido' })),
    ).rejects.toBeInstanceOf(NaoAutenticadoException);
  });

  it('rejeita JWT assinado cuja sessão foi revogada ou cujo membro foi removido (H1.3/NB-1)', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload) } as unknown as JwtService;
    // Banco não devolve sessão ativa para o `sid` do token — revogada,
    // membro removido, ou claims não batem com a linha da sessão.
    const guard = new JwtAuthGuard(criarDbFalso([]), jwtService, reflector);

    await TenantContextStorage.run(async () => {
      await expect(
        guard.canActivate(criarContextoFalso({ authorization: 'Bearer token-assinado' })),
      ).rejects.toBeInstanceOf(NaoAutenticadoException);
      // O contexto de tenant NUNCA é populado quando a sessão está encerrada.
      expect(() => TenantContextStorage.get()).toThrow();
    });
  });

  it('rejeita sessão revogada sem rotação (logout/redefinição/remoção) mesmo segundos atrás', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload) } as unknown as JwtService;
    const guard = new JwtAuthGuard(
      criarDbFalso([{ revogadaEm: new Date(Date.now() - 1000), substituidaPorId: null }]),
      jwtService,
      reflector,
    );

    await TenantContextStorage.run(async () => {
      await expect(
        guard.canActivate(criarContextoFalso({ authorization: 'Bearer token-assinado' })),
      ).rejects.toBeInstanceOf(NaoAutenticadoException);
    });
  });

  it('tolera sessão rotacionada há menos de 30s (requisição em voo durante a rotação de refresh)', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload) } as unknown as JwtService;
    const guard = new JwtAuthGuard(
      criarDbFalso([{ revogadaEm: new Date(Date.now() - 1000), substituidaPorId: 'sessao-2' }]),
      jwtService,
      reflector,
    );

    await TenantContextStorage.run(async () => {
      await expect(
        guard.canActivate(criarContextoFalso({ authorization: 'Bearer token-assinado' })),
      ).resolves.toBe(true);
    });
  });

  it('rejeita sessão rotacionada há mais de 30s (fora da janela de tolerância)', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload) } as unknown as JwtService;
    const guard = new JwtAuthGuard(
      criarDbFalso([{ revogadaEm: new Date(Date.now() - 31_000), substituidaPorId: 'sessao-2' }]),
      jwtService,
      reflector,
    );

    await TenantContextStorage.run(async () => {
      await expect(
        guard.canActivate(criarContextoFalso({ authorization: 'Bearer token-assinado' })),
      ).rejects.toBeInstanceOf(NaoAutenticadoException);
    });
  });

  it('popula o TenantContext a partir do payload do JWT em rota protegida com sessão ativa', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload) } as unknown as JwtService;
    const guard = new JwtAuthGuard(
      criarDbFalso([{ revogadaEm: null, substituidaPorId: null }]),
      jwtService,
      reflector,
    );

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
    const jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload) } as unknown as JwtService;
    const guard = new JwtAuthGuard(
      criarDbFalso([{ revogadaEm: null, substituidaPorId: null }]),
      jwtService,
      reflector,
    );

    await expect(
      guard.canActivate(criarContextoFalso({ authorization: 'Bearer token-valido' })),
    ).rejects.toThrow(/TenantContextMiddleware/);
  });
});
