import { Controller, Get } from '@nestjs/common';
import { Public } from './common/public.decorator';

/**
 * Health check público, fora do escopo de tenant (nenhum dado de negócio).
 * Usado pelo docker-compose/CI/monitoramento para saber se a API subiu e
 * está aceitando requisições — por isso `@Public()`: sondas não têm JWT
 * (sem o decorator, o `JwtAuthGuard` global responderia 401 — NB-5 do QA).
 */
@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', servico: 'taketrip-api' };
  }
}
