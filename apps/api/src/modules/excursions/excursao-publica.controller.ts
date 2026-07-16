import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/public.decorator';
import {
  JANELA_RATE_LIMIT_MS,
  LIMITE_LEITURA_PUBLICA,
  PublicoThrottlerGuard,
} from '../../common/rate-limit-publico';
import { ExcursionsService } from './excursions.service';

/**
 * `docs/api/publico.yaml` — página pública da excursão (H3.1). Rota PÚBLICA
 * (ADR 008): sem JWT, o tenant é resolvido pelo `codigo_publico` (chave de
 * capacidade opaca) dentro do service — nunca de payload nem de contexto
 * ambiente. Rate limit por IP (30/min) só nesta superfície pública.
 */
@Public()
@UseGuards(PublicoThrottlerGuard)
@Controller('publico/excursoes')
export class ExcursaoPublicaController {
  constructor(private readonly excursionsService: ExcursionsService) {}

  @Get(':codigo')
  @Throttle({ default: { limit: LIMITE_LEITURA_PUBLICA, ttl: JANELA_RATE_LIMIT_MS } })
  // Cache curto (60s, `publico.yaml`): abrir rápido em 4G sem servir vagas
  // velhas por muito tempo.
  @Header('Cache-Control', 'public, max-age=60')
  obterPaginaPublica(@Param('codigo') codigo: string) {
    return this.excursionsService.obterPaginaPublica(codigo);
  }
}
