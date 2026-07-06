import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FotosService, TAMANHO_MAXIMO_BYTES } from './fotos.service';

/** `docs/api/excursions.yaml` — bloco `/excursoes/{excursaoId}/fotos*` (S3). */
@Controller('excursoes/:excursaoId/fotos')
export class FotosController {
  constructor(private readonly fotosService: FotosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: memoryStorage(),
      limits: { fileSize: TAMANHO_MAXIMO_BYTES },
    }),
  )
  enviar(
    @Param('excursaoId', ParseUUIDPipe) excursaoId: string,
    @UploadedFile() arquivo?: Express.Multer.File,
  ) {
    return this.fotosService.enviar(excursaoId, arquivo);
  }

  @Delete(':fotoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(
    @Param('excursaoId', ParseUUIDPipe) excursaoId: string,
    @Param('fotoId', ParseUUIDPipe) fotoId: string,
  ): Promise<void> {
    await this.fotosService.remover(excursaoId, fotoId);
  }
}
