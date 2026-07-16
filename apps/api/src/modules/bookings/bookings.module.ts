import { Module } from '@nestjs/common';
import { RateLimitPublicoModule } from '../../common/rate-limit-publico';
import { ExcursionsModule } from '../excursions/excursions.module';
import { ExcursaoReservasController } from './excursao-reservas.controller';
import { ReservasController } from './reservas.controller';
import { ReservaPublicaController } from './reserva-publica.controller';
import { PassageirosController } from './passageiros.controller';
import { ReservasService } from './reservas.service';
import { PassageirosService } from './passageiros.service';
import { ListaImpressaoService } from './lista-impressao.service';

/**
 * Módulo `bookings` (passageiro, reserva, mapa de poltronas, embarque —
 * H1.8–H1.13, `docs/api/bookings.yaml`). Depende de `ExcursionsModule`
 * (via `ExcursionsService.buscarExcursaoOuFalhar`, mesmo padrão usado por
 * `PontosEmbarqueService`/`FotosService`) para resolver excursão + veículo
 * escopados no tenant. A dependência é de mão única: `ExcursionsModule` NUNCA
 * importa `BookingsModule` de volta — `ContadorReservasService` (em
 * `excursions`) e `VinculoExcursaoService` (em `fleet`) leem a tabela
 * `reserva` diretamente via `DATABASE_CONNECTION`, não através de um
 * provider deste módulo, para não fechar um ciclo de DI.
 */
@Module({
  // `RateLimitPublicoModule` (ADR 008): provê o storage/opções do throttler
  // para o `PublicoThrottlerGuard` aplicado SÓ no controller público.
  imports: [ExcursionsModule, RateLimitPublicoModule],
  controllers: [
    ExcursaoReservasController,
    ReservaPublicaController,
    ReservasController,
    PassageirosController,
  ],
  providers: [ReservasService, PassageirosService, ListaImpressaoService],
  exports: [ReservasService],
})
export class BookingsModule {}
