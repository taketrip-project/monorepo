import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { criarAppDeTeste, type TestAppContext } from './support/test-app';

/**
 * `GET /health` precisa responder SEM autenticação (NB-5 do release da
 * fase 1): docker healthcheck, CI e monitoramento sondam a API sem JWT.
 * Este teste sobe a aplicação completa (com o `JwtAuthGuard` global de
 * verdade) — o teste unitário do controller chama o método direto e nunca
 * detectaria a falta do `@Public()`.
 */
describe('app: GET /health (banco real, guard global ativo)', () => {
  let ctx: TestAppContext;
  let app: INestApplication;

  beforeAll(async () => {
    ctx = await criarAppDeTeste();
    app = ctx.app;
  });

  afterAll(async () => {
    await ctx.fecharTudo();
  });

  it('caminho feliz: responde 200 sem Authorization (fora do prefixo /api/v1)', async () => {
    const resposta = await request(app.getHttpServer()).get('/health').expect(200);
    expect(resposta.body).toEqual({ status: 'ok', servico: 'taketrip-api' });
  });

  it('caso de borda: @Public() não vaza para o resto da API — rota protegida segue exigindo JWT', async () => {
    const resposta = await request(app.getHttpServer()).get('/api/v1/organizacao').expect(401);
    expect(resposta.body.erro.codigo).toBe('nao_autenticado');
  });
});
