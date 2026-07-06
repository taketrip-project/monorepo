import { Controller, Get } from '@nestjs/common';

/**
 * Health check público, fora do escopo de tenant (nenhum dado de negócio).
 * Usado pelo docker-compose/CI/monitoramento para saber se a API subiu e
 * está aceitando requisições.
 */
@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', servico: 'taketrip-api' };
  }
}
