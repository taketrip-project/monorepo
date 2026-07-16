import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerLimitDetail, ThrottlerStorage } from '@nestjs/throttler';
import type { Reflector } from '@nestjs/core';
import { MuitasTentativasException } from './domain-exception';
import { PublicoThrottlerGuard } from './rate-limit-publico';

describe('PublicoThrottlerGuard', () => {
  // O guard real recebe options/storage/reflector do ThrottlerModule; para
  // testar SÓ o formato do 429 (a única lógica própria daqui), instancia com
  // dublês vazios — `throwThrottlingException` não toca em nenhum deles.
  const guard = new PublicoThrottlerGuard(
    { throttlers: [] },
    {} as ThrottlerStorage,
    {} as Reflector,
  );

  function detalhe(timeToBlockExpire: number): ThrottlerLimitDetail {
    return {
      ttl: 60_000,
      limit: 5,
      key: 'chave',
      tracker: '127.0.0.1',
      totalHits: 6,
      timeToExpire: timeToBlockExpire,
      isBlocked: true,
      timeToBlockExpire,
    };
  }

  function estourarLimite(timeToBlockExpire: number): Promise<void> {
    // Método protected — acessado via cast, como o Nest faria por herança.
    return (
      guard as unknown as {
        throwThrottlingException(c: ExecutionContext, d: ThrottlerLimitDetail): Promise<void>;
      }
    ).throwThrottlingException({} as ExecutionContext, detalhe(timeToBlockExpire));
  }

  it('estourar o limite lança MuitasTentativasException no envelope único da API', () => {
    expect(() => estourarLimite(37)).toThrow(MuitasTentativasException);
    try {
      estourarLimite(37);
    } catch (erro) {
      const excecao = erro as MuitasTentativasException;
      expect(excecao.getStatus()).toBe(429);
      expect(excecao.retryAfterSegundos).toBe(37);
      expect(excecao.getResponse()).toMatchObject({
        erro: { codigo: 'muitas_tentativas' },
      });
    }
  });

  it('Retry-After nunca sai zerado (mínimo de 1 segundo)', () => {
    try {
      estourarLimite(0);
    } catch (erro) {
      expect((erro as MuitasTentativasException).retryAfterSegundos).toBe(1);
    }
  });
});
