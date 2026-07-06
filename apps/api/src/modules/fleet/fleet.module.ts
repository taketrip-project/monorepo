import { Module } from '@nestjs/common';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';
import { VinculoExcursaoService } from './vinculo-excursao.service';

/**
 * Módulo `fleet` (veículos e layout de poltronas — H1.4, `docs/api/fleet.yaml`).
 * `VinculoExcursaoService` é um stub hoje (excursions/bookings ainda não
 * existem) — ver comentário na própria classe para o plano de substituição.
 */
@Module({
  controllers: [FleetController],
  providers: [FleetService, VinculoExcursaoService],
})
export class FleetModule {}
