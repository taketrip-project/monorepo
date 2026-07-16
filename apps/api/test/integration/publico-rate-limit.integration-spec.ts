import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { criarAppDeTeste, type TestAppContext } from './support/test-app';

/**
 * Rate limit das rotas públicas (ADR 008, `docs/api/publico.yaml`): por IP,
 * em memória, SÓ na superfície pública — leituras 30/min, criação de reserva
 * 5/min, consulta de situação 60/min. O 429 sai no envelope de erro único da
 * API (`muitas_tentativas`) com `Retry-After`, não no formato default do
 * throttler. Spec separado do fluxo funcional porque aqui o guard fica
 * LIGADO (`manterRateLimitPublico`) e todas as requisições do supertest
 * saem do mesmo IP.
 *
 * O throttler conta ANTES do handler executar, então dá para estourar o
 * limite sem tocar no banco (código inexistente/corpo inválido) — cada rota
 * tem o próprio contador, um teste não contamina o outro.
 */
describe('publico: rate limit por IP (ADR 008)', () => {
  let ctx: TestAppContext;
  let app: INestApplication;

  beforeAll(async () => {
    ctx = await criarAppDeTeste({ manterRateLimitPublico: true });
    app = ctx.app;
  });

  afterAll(async () => {
    await ctx.fecharTudo();
  });

  const http = () => request(app.getHttpServer());

  it('criação de reserva pública: a 6ª tentativa no minuto leva 429 muitas_tentativas com Retry-After', async () => {
    for (let i = 0; i < 5; i++) {
      // Corpo vazio: o guard conta a requisição e o handler responde 422.
      await http().post('/api/v1/publico/excursoes/QUALQUER01/reservas').send({}).expect(422);
    }

    const resposta = await http()
      .post('/api/v1/publico/excursoes/QUALQUER01/reservas')
      .send({})
      .expect(429);

    expect(resposta.body.erro.codigo).toBe('muitas_tentativas');
    expect(resposta.body.erro.mensagem).toBeTruthy();
    expect(Number(resposta.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('leitura da página pública: a 31ª requisição no minuto leva 429; rotas autenticadas NÃO passam pelo throttler público', async () => {
    for (let i = 0; i < 30; i++) {
      await http().get('/api/v1/publico/excursoes/QUALQUER01').expect(404);
    }
    const resposta = await http().get('/api/v1/publico/excursoes/QUALQUER01').expect(429);
    expect(resposta.body.erro.codigo).toBe('muitas_tentativas');

    // A rota autenticada equivalente continua respondendo 401 (sem token),
    // nunca 429 — o rate limit é SÓ da superfície pública.
    const autenticada = await http().get('/api/v1/excursoes').expect(401);
    expect(autenticada.body.erro.codigo).toBe('nao_autenticado');
  });

  it('consulta de situação: o limite próprio (60/min) é mais folgado que o de leitura — a 31ª ainda passa', async () => {
    const idInexistente = '019394a5-0000-7000-8000-000000000000';
    for (let i = 0; i < 31; i++) {
      await http().get(`/api/v1/publico/reservas/${idInexistente}`).expect(404);
    }
  });
});
