import { Controller, Get, Query } from '@nestjs/common';
import { PassageirosService } from './passageiros.service';
import { mapPassageiro } from './bookings.mapper';
import { BuscarPassageiroQueryDto } from './dto/buscar-passageiro-query.dto';

/** `docs/api/bookings.yaml` — `GET /passageiros?whatsapp=`: pré-preencher o cadastro rápido (H1.9). */
@Controller('passageiros')
export class PassageirosController {
  constructor(private readonly passageirosService: PassageirosService) {}

  @Get()
  async buscar(@Query() query: BuscarPassageiroQueryDto) {
    const encontrado = await this.passageirosService.buscarPorWhatsapp(query.whatsapp);
    return encontrado ? [mapPassageiro(encontrado)] : [];
  }
}
