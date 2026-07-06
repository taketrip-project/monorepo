import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { PontosEmbarqueService } from './pontos-embarque.service';
import { PontoEmbarqueEntradaDto } from './dto/ponto-embarque-entrada.dto';
import { ReordenarPontosDto } from './dto/reordenar-pontos.dto';

/** `docs/api/excursions.yaml` — bloco `/excursoes/{excursaoId}/pontos-embarque*` (H1.6). */
@Controller('excursoes/:excursaoId/pontos-embarque')
export class PontosEmbarqueController {
  constructor(private readonly pontosEmbarqueService: PontosEmbarqueService) {}

  @Get()
  listar(@Param('excursaoId', ParseUUIDPipe) excursaoId: string) {
    return this.pontosEmbarqueService.listar(excursaoId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  adicionar(
    @Param('excursaoId', ParseUUIDPipe) excursaoId: string,
    @Body() dto: PontoEmbarqueEntradaDto,
  ) {
    return this.pontosEmbarqueService.adicionar(excursaoId, dto);
  }

  @Put()
  reordenar(
    @Param('excursaoId', ParseUUIDPipe) excursaoId: string,
    @Body() dto: ReordenarPontosDto,
  ) {
    return this.pontosEmbarqueService.reordenar(excursaoId, dto.ordem);
  }

  @Patch(':pontoId')
  editar(
    @Param('excursaoId', ParseUUIDPipe) excursaoId: string,
    @Param('pontoId', ParseUUIDPipe) pontoId: string,
    @Body() dto: PontoEmbarqueEntradaDto,
  ) {
    return this.pontosEmbarqueService.editar(excursaoId, pontoId, dto);
  }

  @Delete(':pontoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(
    @Param('excursaoId', ParseUUIDPipe) excursaoId: string,
    @Param('pontoId', ParseUUIDPipe) pontoId: string,
  ): Promise<void> {
    await this.pontosEmbarqueService.remover(excursaoId, pontoId);
  }
}
