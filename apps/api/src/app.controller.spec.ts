import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { IS_PUBLIC_KEY } from './common/public.decorator';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('retorna status ok no health check', () => {
    expect(controller.health()).toEqual({ status: 'ok', servico: 'taketrip-api' });
  });

  it('health é @Public() — senão o JwtAuthGuard global bloqueia as sondas com 401 (NB-5)', () => {
    // Chamar o método direto não passa pelo guard; o que garante o acesso
    // sem JWT é a metadata IS_PUBLIC_KEY no handler. O caminho HTTP completo
    // (guard de verdade) é coberto por health.integration-spec.ts.
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AppController.prototype.health)).toBe(true);
  });
});
