import { Controller, Get } from '@nestjs/common';
import { ExcursionsService } from './excursions.service';

/** `docs/api/excursions.yaml` — `GET /inicio` (H1.14, dashboard mínimo). */
@Controller('inicio')
export class InicioController {
  constructor(private readonly excursionsService: ExcursionsService) {}

  @Get()
  async obter() {
    return { proxima_excursao: await this.excursionsService.obterProximaExcursao() };
  }
}
