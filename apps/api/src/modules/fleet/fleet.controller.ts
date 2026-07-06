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
import { FleetService } from './fleet.service';
import { CriarVeiculoDto } from './dto/criar-veiculo.dto';
import { AtualizarVeiculoDto } from './dto/atualizar-veiculo.dto';
import { ListarVeiculosQueryDto } from './dto/listar-veiculos-query.dto';
import { ExcluirVeiculoQueryDto } from './dto/excluir-veiculo-query.dto';
import { LayoutPadraoQueryDto } from './dto/layout-padrao-query.dto';

/** `docs/api/fleet.yaml` — bloco `/veiculos*`. Todas as rotas exigem JWT (não têm `@Public()`). */
@Controller('veiculos')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Get()
  listar(@Query() query: ListarVeiculosQueryDto) {
    return this.fleetService.listar(query.pagina, query.por_pagina);
  }

  // Precisa vir ANTES de `:veiculoId` — senão o Nest casa "layout-padrao" como id.
  @Get('layout-padrao')
  layoutPadrao(@Query() query: LayoutPadraoQueryDto) {
    return this.fleetService.layoutPadrao(query.tipo, query.quantidade_poltronas);
  }

  @Get(':veiculoId')
  obter(@Param('veiculoId', ParseUUIDPipe) veiculoId: string) {
    return this.fleetService.obter(veiculoId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  criar(@Body() dto: CriarVeiculoDto) {
    return this.fleetService.criar(dto);
  }

  @Patch(':veiculoId')
  atualizar(
    @Param('veiculoId', ParseUUIDPipe) veiculoId: string,
    @Body() dto: AtualizarVeiculoDto,
  ) {
    return this.fleetService.atualizar(veiculoId, dto);
  }

  @Delete(':veiculoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async excluir(
    @Param('veiculoId', ParseUUIDPipe) veiculoId: string,
    @Query() query: ExcluirVeiculoQueryDto,
  ): Promise<void> {
    await this.fleetService.excluir(veiculoId, query.confirmar);
  }
}
