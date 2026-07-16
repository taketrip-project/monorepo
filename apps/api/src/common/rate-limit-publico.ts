import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule, type ThrottlerLimitDetail } from '@nestjs/throttler';
import { MuitasTentativasException } from './domain-exception';

/** Janela de contagem do rate limit público: sempre por minuto (ADR 008). */
export const JANELA_RATE_LIMIT_MS = 60_000;

/** Leituras públicas (página da excursão e mapa de poltronas): 30 req/min por IP. */
export const LIMITE_LEITURA_PUBLICA = 30;
/** Criação de reserva pública: 5 req/min por IP — a corretude é da UNIQUE do banco. */
export const LIMITE_CRIACAO_RESERVA_PUBLICA = 5;
/** Consulta de situação da reserva: 60 req/min por IP (polling da tela de confirmação). */
export const LIMITE_CONSULTA_SITUACAO_PUBLICA = 60;

/**
 * Rate limiting SÓ das rotas públicas (ADR 008): em memória, por IP —
 * processo único na VPS, sem Redis. Não é registrado como `APP_GUARD`
 * de propósito: rotas autenticadas não passam por aqui (força bruta de
 * login já tem proteção própria em identity). Cada controller público
 * aplica `@UseGuards(PublicoThrottlerGuard)` + `@Throttle` por rota.
 *
 * O default (30/min) é o limite das leituras; as demais rotas sobrescrevem
 * com `@Throttle` — mas todo handler público declara o próprio limite
 * explicitamente, para a revisão não depender do default.
 *
 * ⚠️ PRÉ-DEPLOY: o tracker é `req.ip`. Atrás de proxy reverso (nginx/caddy
 * fazendo TLS na VPS), TODO o tráfego chega com o IP do proxy e o limite de
 * 5/min de reserva vale para o Brasil inteiro — é preciso `app.set('trust
 * proxy', ...)` restrito ao proxy real (nunca `true` cru, que torna o limite
 * spoofável via X-Forwarded-For). Decidir junto com a topologia de deploy.
 */
export const RateLimitPublicoModule = ThrottlerModule.forRoot([
  { ttl: JANELA_RATE_LIMIT_MS, limit: LIMITE_LEITURA_PUBLICA },
]);

/**
 * `ThrottlerGuard` com o 429 no envelope de erro ÚNICO da API
 * (`MuitasTentativasException` → `{ erro: { codigo: 'muitas_tentativas', ... } }`
 * + header `Retry-After` via `ErroFilter`), em vez do formato default do
 * throttler.
 */
@Injectable()
export class PublicoThrottlerGuard extends ThrottlerGuard {
  protected throwThrottlingException(
    _context: ExecutionContext,
    detalhe: ThrottlerLimitDetail,
  ): Promise<void> {
    // `timeToBlockExpire` chega em segundos; garante ao menos 1s para o
    // header `Retry-After` nunca sair zerado.
    throw new MuitasTentativasException(Math.max(Math.ceil(detalhe.timeToBlockExpire), 1));
  }
}
