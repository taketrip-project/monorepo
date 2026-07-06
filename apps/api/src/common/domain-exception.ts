import { HttpException, HttpStatus } from '@nestjs/common';

export interface ErroBody {
  erro: {
    codigo: string;
    mensagem: string;
    detalhes?: Record<string, unknown>;
  };
}

/**
 * Exceção com o formato ÚNICO de erro da API Taketrip
 * (`{ erro: { codigo, mensagem, detalhes? } }` — ver schema `Erro` em
 * qualquer `docs/api/*.yaml`). Toda regra de negócio que precisa devolver um
 * código estável em pt-BR lança esta exceção (ou uma subclasse) em vez de
 * `HttpException` cru — o `ErroFilter` global apenas repassa o corpo.
 */
export class DomainException extends HttpException {
  constructor(
    status: HttpStatus,
    codigo: string,
    mensagem: string,
    detalhes?: Record<string, unknown>,
  ) {
    const body: ErroBody = {
      erro: { codigo, mensagem, ...(detalhes ? { detalhes } : {}) },
    };
    super(body, status);
  }
}

/** 401 — token ausente, inválido ou expirado. */
export class NaoAutenticadoException extends DomainException {
  constructor(mensagem = 'Faça login para continuar.') {
    super(HttpStatus.UNAUTHORIZED, 'nao_autenticado', mensagem);
  }
}

/** 404 — SEMPRE a resposta para recurso de outro tenant (nunca 403, ver ADR 003). */
export class NaoEncontradoException extends DomainException {
  constructor(mensagem = 'Recurso não encontrado.') {
    super(HttpStatus.NOT_FOUND, 'nao_encontrado', mensagem);
  }
}

/**
 * 429 com header `Retry-After` (ADR 004, força bruta de login). Genérica o
 * bastante para qualquer módulo que precise de espera progressiva, não só
 * identity — por isso vive em `common`, não em `modules/identity`.
 */
export class MuitasTentativasException extends DomainException {
  constructor(
    public readonly retryAfterSegundos: number,
    mensagem = 'Muitas tentativas. Aguarde antes de tentar novamente.',
  ) {
    super(HttpStatus.TOO_MANY_REQUESTS, 'muitas_tentativas', mensagem, {
      retry_after_segundos: retryAfterSegundos,
    });
  }
}
