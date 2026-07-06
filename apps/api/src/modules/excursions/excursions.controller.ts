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
  Query,
} from '@nestjs/common';
import { ExcursionsService } from './excursions.service';
import { CriarExcursaoDto } from './dto/criar-excursao.dto';
import { AtualizarExcursaoDto } from './dto/atualizar-excursao.dto';
import { CancelarExcursaoDto } from './dto/cancelar-excursao.dto';
import { ChecklistLegalDto } from './dto/checklist-legal.dto';
import { ListarExcursoesQueryDto } from './dto/listar-excursoes-query.dto';

/** `docs/api/excursions.yaml` — bloco `/excursoes*` (sem os sub-recursos, que têm controller próprio). */
@Controller('excursoes')
export class ExcursionsController {
  constructor(private readonly excursionsService: ExcursionsService) {}

  @Get()
  listar(@Query() query: ListarExcursoesQueryDto) {
    return this.excursionsService.listar(query.filtro, query.pagina, query.por_pagina);
  }

  @Get(':excursaoId')
  obter(@Param('excursaoId', ParseUUIDPipe) excursaoId: string) {
    return this.excursionsService.obter(excursaoId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  criar(@Body() dto: CriarExcursaoDto) {
    return this.excursionsService.criar(dto);
  }

  @Patch(':excursaoId')
  atualizar(
    @Param('excursaoId', ParseUUIDPipe) excursaoId: string,
    @Body() dto: AtualizarExcursaoDto,
  ) {
    return this.excursionsService.atualizar(excursaoId, dto);
  }

  @Delete(':excursaoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async excluir(@Param('excursaoId', ParseUUIDPipe) excursaoId: string): Promise<void> {
    await this.excursionsService.excluir(excursaoId);
  }

  @Post(':excursaoId/publicar')
  @HttpCode(HttpStatus.OK)
  publicar(@Param('excursaoId', ParseUUIDPipe) excursaoId: string) {
    return this.excursionsService.publicar(excursaoId);
  }

  @Post(':excursaoId/cancelar')
  @HttpCode(HttpStatus.OK)
  cancelar(
    @Param('excursaoId', ParseUUIDPipe) excursaoId: string,
    @Body() dto: CancelarExcursaoDto,
  ) {
    return this.excursionsService.cancelar(excursaoId, dto.motivo);
  }

  @Patch(':excursaoId/checklist-legal')
  atualizarChecklist(
    @Param('excursaoId', ParseUUIDPipe) excursaoId: string,
    @Body() dto: ChecklistLegalDto,
  ) {
    return this.excursionsService.atualizarChecklist(excursaoId, dto);
  }
}
