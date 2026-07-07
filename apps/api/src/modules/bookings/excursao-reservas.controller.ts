import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReservasService } from './reservas.service';
import { CriarReservaDto } from './dto/criar-reserva.dto';
import { ListarReservasQueryDto } from './dto/listar-reservas-query.dto';
import { ImpressaoQueryDto } from './dto/impressao-query.dto';

/**
 * `docs/api/bookings.yaml` — rotas aninhadas em `/excursoes/{excursaoId}*`:
 * mapa de poltronas (H1.8), cadastro rápido + busca (H1.9/H1.11), lista de
 * embarque (H1.12) e lista imprimível (H1.13).
 */
@Controller('excursoes/:excursaoId')
export class ExcursaoReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Get('mapa-poltronas')
  mapaPoltronas(@Param('excursaoId', ParseUUIDPipe) excursaoId: string) {
    return this.reservasService.mapaPoltronas(excursaoId);
  }

  @Get('reservas')
  listar(
    @Param('excursaoId', ParseUUIDPipe) excursaoId: string,
    @Query() query: ListarReservasQueryDto,
  ) {
    return this.reservasService.listarReservas(excursaoId, query);
  }

  @Post('reservas')
  @HttpCode(HttpStatus.CREATED)
  criar(@Param('excursaoId', ParseUUIDPipe) excursaoId: string, @Body() dto: CriarReservaDto) {
    return this.reservasService.criarReserva(excursaoId, dto);
  }

  @Get('lista-embarque')
  listaEmbarque(@Param('excursaoId', ParseUUIDPipe) excursaoId: string) {
    return this.reservasService.listaEmbarque(excursaoId);
  }

  @Get('lista-passageiros/impressao')
  async impressao(
    @Param('excursaoId', ParseUUIDPipe) excursaoId: string,
    @Query() query: ImpressaoQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const documento = await this.reservasService.listaPassageirosImpressao(excursaoId, query.formato);
    res.setHeader('Content-Type', documento.contentType);
    res.setHeader('Content-Disposition', `inline; filename="lista-passageiros.${query.formato}"`);
    res.status(HttpStatus.OK).send(documento.conteudo);
  }
}
