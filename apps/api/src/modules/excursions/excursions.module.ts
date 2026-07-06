import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExcursionsController } from './excursions.controller';
import { ExcursionsService } from './excursions.service';
import { PontosEmbarqueController } from './pontos-embarque.controller';
import { PontosEmbarqueService } from './pontos-embarque.service';
import { FotosController } from './fotos.controller';
import { FotosService } from './fotos.service';
import { InicioController } from './inicio.controller';
import { ContadorReservasService } from './contador-reservas.service';
import { ArquivoStorageService } from './storage/arquivo-storage.service';
import { S3ArquivoStorageService } from './storage/s3-arquivo-storage.service';
import { LocalArquivoStorageService } from './storage/local-arquivo-storage.service';

/**
 * Módulo `excursions` (excursão, ciclo de vida, pontos de embarque, fotos,
 * checklist legal, dashboard Início — H1.5–H1.7, H1.14, H3.4, H3.5,
 * `docs/api/excursions.yaml`).
 *
 * `ContadorReservasService` é um stub hoje (o módulo `bookings` ainda não
 * tem service/controller nesta fase — só o schema já existe) — ver
 * comentário na própria classe para o plano de substituição, mesmo padrão
 * de `VinculoExcursaoService` em `fleet`.
 *
 * `ArquivoStorageService` escolhe a implementação em runtime: S3 real
 * quando `S3_BUCKET` está configurado (produção), fake local caso
 * contrário (dev sem credenciais AWS e testes) — mesmo espírito do SES em
 * `notifications`, mas aqui a troca é condicionada porque um fake "no-op"
 * não serviria: os testes de fotos precisam de um arquivo de verdade para
 * validar o ciclo salvar → obter url → remover.
 */
@Module({
  controllers: [
    ExcursionsController,
    PontosEmbarqueController,
    FotosController,
    InicioController,
  ],
  providers: [
    ExcursionsService,
    PontosEmbarqueService,
    FotosService,
    ContadorReservasService,
    {
      provide: ArquivoStorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('S3_BUCKET')
          ? new S3ArquivoStorageService(config)
          : new LocalArquivoStorageService(),
    },
  ],
  exports: [ExcursionsService],
})
export class ExcursionsModule {}
