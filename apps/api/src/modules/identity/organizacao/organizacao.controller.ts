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
} from '@nestjs/common';
import { OrganizacaoService } from './organizacao.service';
import { AtualizarOrganizacaoDto } from '../dto/atualizar-organizacao.dto';
import { CriarConviteDto } from '../dto/criar-convite.dto';

/** `docs/api/identity.yaml` — bloco `/organizacao*`. Todas as rotas exigem JWT (não têm `@Public()`). */
@Controller('organizacao')
export class OrganizacaoController {
  constructor(private readonly organizacaoService: OrganizacaoService) {}

  @Get()
  obter() {
    return this.organizacaoService.obter();
  }

  @Patch()
  atualizar(@Body() dto: AtualizarOrganizacaoDto) {
    return this.organizacaoService.atualizar(dto);
  }

  @Get('membros')
  listarMembros() {
    return this.organizacaoService.listarMembros();
  }

  @Delete('membros/:membroId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removerMembro(@Param('membroId', ParseUUIDPipe) membroId: string): Promise<void> {
    await this.organizacaoService.removerMembro(membroId);
  }

  @Get('convites')
  listarConvites() {
    return this.organizacaoService.listarConvites();
  }

  @Post('convites')
  @HttpCode(HttpStatus.CREATED)
  criarConvite(@Body() dto: CriarConviteDto) {
    return this.organizacaoService.criarConvite(dto);
  }

  @Delete('convites/:conviteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelarConvite(@Param('conviteId', ParseUUIDPipe) conviteId: string): Promise<void> {
    await this.organizacaoService.cancelarConvite(conviteId);
  }
}
