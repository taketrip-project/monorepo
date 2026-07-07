import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { AtualizarReservaDto } from './dto/atualizar-reserva.dto';
import { StatusPagamentoDto } from './dto/status-pagamento.dto';
import { CancelarReservaDto } from './dto/cancelar-reserva.dto';

/**
 * `docs/api/bookings.yaml` — bloco `/reservas/{reservaId}*`: ficha, edição,
 * pagamento manual (H1.10), cancelamento e embarque (H1.12).
 */
@Controller('reservas/:reservaId')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Get()
  obter(@Param('reservaId', ParseUUIDPipe) reservaId: string) {
    return this.reservasService.obterReserva(reservaId);
  }

  @Patch()
  atualizar(
    @Param('reservaId', ParseUUIDPipe) reservaId: string,
    @Body() dto: AtualizarReservaDto,
  ) {
    return this.reservasService.atualizarReserva(reservaId, dto);
  }

  @Post('status-pagamento')
  @HttpCode(HttpStatus.OK)
  statusPagamento(
    @Param('reservaId', ParseUUIDPipe) reservaId: string,
    @Body() dto: StatusPagamentoDto,
  ) {
    return this.reservasService.marcarStatusPagamento(reservaId, dto.status);
  }

  @Post('cancelar')
  @HttpCode(HttpStatus.OK)
  cancelar(@Param('reservaId', ParseUUIDPipe) reservaId: string, @Body() dto: CancelarReservaDto) {
    return this.reservasService.cancelar(reservaId, dto.motivo ?? null);
  }

  @Post('embarque')
  @HttpCode(HttpStatus.OK)
  embarcar(@Param('reservaId', ParseUUIDPipe) reservaId: string) {
    return this.reservasService.marcarEmbarque(reservaId);
  }

  @Delete('embarque')
  @HttpCode(HttpStatus.OK)
  desfazerEmbarque(@Param('reservaId', ParseUUIDPipe) reservaId: string) {
    return this.reservasService.desfazerEmbarque(reservaId);
  }
}
