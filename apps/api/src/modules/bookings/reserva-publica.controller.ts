import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/public.decorator';
import { NaoEncontradoException } from '../../common/domain-exception';
import {
  JANELA_RATE_LIMIT_MS,
  LIMITE_CONSULTA_SITUACAO_PUBLICA,
  LIMITE_CRIACAO_RESERVA_PUBLICA,
  LIMITE_LEITURA_PUBLICA,
  PublicoThrottlerGuard,
} from '../../common/rate-limit-publico';
import { ReservasService } from './reservas.service';
import { CriarReservaPublicaDto } from './dto/criar-reserva-publica.dto';

/**
 * `docs/api/publico.yaml` — reserva pelo link público (H3.2). Rotas PÚBLICAS
 * (ADR 008): sem JWT, o tenant é resolvido por chave de capacidade opaca —
 * `codigo_publico` da excursão ou o UUID v7 da reserva (token de posse: só
 * quem reservou recebeu o link). Rate limit por IP só nesta superfície; a
 * garantia contra dupla-reserva continua sendo a UNIQUE do banco.
 */
@Public()
@UseGuards(PublicoThrottlerGuard)
@Controller('publico')
export class ReservaPublicaController {
  constructor(private readonly reservasService: ReservasService) {}

  @Get('excursoes/:codigo/mapa-poltronas')
  @Throttle({ default: { limit: LIMITE_LEITURA_PUBLICA, ttl: JANELA_RATE_LIMIT_MS } })
  mapaPoltronas(@Param('codigo') codigo: string) {
    return this.reservasService.mapaPoltronasPublico(codigo);
  }

  @Post('excursoes/:codigo/reservas')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: LIMITE_CRIACAO_RESERVA_PUBLICA, ttl: JANELA_RATE_LIMIT_MS } })
  criarReserva(@Param('codigo') codigo: string, @Body() dto: CriarReservaPublicaDto) {
    return this.reservasService.criarReservaPublica(codigo, dto);
  }

  @Get('reservas/:reservaId')
  @Throttle({ default: { limit: LIMITE_CONSULTA_SITUACAO_PUBLICA, ttl: JANELA_RATE_LIMIT_MS } })
  situacao(
    // UUID malformado responde o MESMO 404 de reserva inexistente — o
    // contrato público só documenta 200/404/429, e diferenciar "malformado"
    // de "não existe" não ajuda quem digitou o link errado.
    @Param(
      'reservaId',
      new ParseUUIDPipe({
        exceptionFactory: () => new NaoEncontradoException('Reserva não encontrada.'),
      }),
    )
    reservaId: string,
  ) {
    return this.reservasService.consultarSituacaoPublica(reservaId);
  }
}
