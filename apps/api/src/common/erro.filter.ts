import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { MuitasTentativasException } from './domain-exception';

/**
 * Filtro global (`APP_FILTER`, registrado pelo módulo identity — ver ADR
 * 003/004): garante o formato ÚNICO de erro `{ erro: { codigo, mensagem,
 * detalhes? } }` em toda a API, inclusive para exceções que não passaram
 * por `DomainException` (ex.: `NotFoundException` de rota inexistente,
 * erros não tratados).
 */
@Catch()
export class ErroFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErroFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof MuitasTentativasException) {
      response.setHeader('Retry-After', String(exception.retryAfterSegundos));
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'object' && body !== null && 'erro' in body) {
        response.status(status).json(body);
        return;
      }

      const mensagem =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] })?.message ?? 'Erro inesperado.');

      response.status(status).json({
        erro: {
          codigo: this.codigoPadrao(status),
          mensagem: Array.isArray(mensagem) ? mensagem.join('; ') : mensagem,
        },
      });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      erro: {
        codigo: 'erro_interno',
        mensagem: 'Erro interno. Tente novamente em instantes.',
      },
    });
  }

  private codigoPadrao(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'requisicao_invalida';
      case HttpStatus.UNAUTHORIZED:
        return 'nao_autenticado';
      case HttpStatus.FORBIDDEN:
        return 'nao_autorizado';
      case HttpStatus.NOT_FOUND:
        return 'nao_encontrado';
      case HttpStatus.CONFLICT:
        return 'conflito';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'validacao';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'muitas_tentativas';
      default:
        return 'erro_inesperado';
    }
  }
}
