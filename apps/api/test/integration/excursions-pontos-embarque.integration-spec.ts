import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { criarAppDeTeste, type TestAppContext } from './support/test-app';

/**
 * Testes de integração do bloco `/excursoes/{id}/pontos-embarque*`
 * (`docs/api/excursions.yaml`, H1.6), contra Postgres real. Cobre:
 * ordem 1..N mantida pela aplicação, reordenação total via PUT, remoção com
 * renumeração e o bloqueio real "excursão publicada não fica com zero
 * pontos" (409 `ultimo_ponto`).
 *
 * NOTA (extensão futura, mesmo padrão de `fleet`): remover ponto com
 * passageiros vinculados (409 `ponto_com_passageiros`) depende do módulo
 * `bookings` (`ContadorReservasService.pontoTemReservaVinculada`), que
 * ainda não existe — hoje sempre "sem passageiros vinculados". QUANDO
 * `bookings` existir, este arquivo precisa GANHAR um teste que cria uma
 * reserva de verdade no ponto e confirma o 409.
 */
describe('excursions: /excursoes/{id}/pontos-embarque* (banco real)', () => {
  let ctx: TestAppContext;
  let app: INestApplication;

  beforeAll(async () => {
    ctx = await criarAppDeTeste();
    app = ctx.app;
  });

  afterAll(async () => {
    await ctx.fecharTudo();
  });

  beforeEach(async () => {
    await ctx.db.execute(sql`TRUNCATE TABLE organizacao CASCADE`);
  });

  const http = () => request(app.getHttpServer());

  async function registrar(email: string, nomeOrganizacao: string) {
    const resposta = await http()
      .post('/api/v1/auth/registro')
      .send({ nome: 'Dono', email, senha: 'senhaForte123', nome_organizacao: nomeOrganizacao })
      .expect(201);
    return resposta.body as { tokens: { access_token: string } };
  }

  function autenticado(accessToken: string) {
    return {
      get: (url: string) => http().get(url).set('Authorization', `Bearer ${accessToken}`),
      patch: (url: string) => http().patch(url).set('Authorization', `Bearer ${accessToken}`),
      post: (url: string) => http().post(url).set('Authorization', `Bearer ${accessToken}`),
      put: (url: string) => http().put(url).set('Authorization', `Bearer ${accessToken}`),
      delete: (url: string) => http().delete(url).set('Authorization', `Bearer ${accessToken}`),
    };
  }

  async function autenticarNovaOrg(sufixo: string) {
    const dono = await registrar(`dono${sufixo}@teste.dev`, `Agência ${sufixo}`);
    return autenticado(dono.tokens.access_token);
  }

  async function criarVeiculo(cliente: ReturnType<typeof autenticado>) {
    const placa = `P${Math.random().toString(36).slice(2, 8)}`.toUpperCase().slice(0, 7);
    const resposta = await cliente
      .post('/api/v1/veiculos')
      .send({ apelido: 'Micro 1', placa, tipo: 'micro_onibus', quantidade_poltronas: 24 })
      .expect(201);
    return resposta.body as { id: string };
  }

  async function criarExcursao(cliente: ReturnType<typeof autenticado>, veiculoId: string) {
    const resposta = await cliente
      .post('/api/v1/excursoes')
      .send({
        destino: 'Praia Grande',
        data_saida: '2026-12-10T08:00:00.000Z',
        data_retorno: '2026-12-10T20:00:00.000Z',
        tipo: 'bate_volta',
        veiculo_id: veiculoId,
        preco_centavos: 18000,
      })
      .expect(201);
    return resposta.body as { id: string };
  }

  describe('POST/GET /pontos-embarque', () => {
    it('caminho feliz: adiciona 3 pontos e a ordem 1..3 é preservada na listagem', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursao(cliente, veiculo.id);

      await cliente
        .post(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .send({ local: 'Praça Central', horario: '2026-12-10T06:00:00.000Z' })
        .expect(201);
      await cliente
        .post(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .send({ local: 'Terminal Rodoviário', horario: '2026-12-10T06:30:00.000Z' })
        .expect(201);
      const terceiro = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .send({ local: 'Posto BR', horario: '2026-12-10T07:00:00.000Z' })
        .expect(201);

      expect(terceiro.body.ordem).toBe(3);

      const listagem = await cliente
        .get(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .expect(200);
      expect(listagem.body.map((p: { local: string; ordem: number }) => [p.local, p.ordem])).toEqual([
        ['Praça Central', 1],
        ['Terminal Rodoviário', 2],
        ['Posto BR', 3],
      ]);
    });

    it('caso de borda: excursão de outra organização retorna 404 (nunca 403)', async () => {
      const clienteA = await autenticarNovaOrg('A');
      const clienteB = await autenticarNovaOrg('B');
      const veiculoB = await criarVeiculo(clienteB);
      const excursaoB = await criarExcursao(clienteB, veiculoB.id);

      const resposta = await clienteA
        .post(`/api/v1/excursoes/${excursaoB.id}/pontos-embarque`)
        .send({ local: 'Tentativa', horario: '2026-12-10T06:00:00.000Z' })
        .expect(404);
      expect(resposta.body.erro.codigo).toBe('nao_encontrado');
    });
  });

  describe('PUT /pontos-embarque (reordenar)', () => {
    it('caminho feliz: reescreve a ordem 1..N a partir da lista completa de ids enviada', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursao(cliente, veiculo.id);

      const p1 = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .send({ local: 'Primeiro', horario: '2026-12-10T06:00:00.000Z' })
        .expect(201);
      const p2 = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .send({ local: 'Segundo', horario: '2026-12-10T06:30:00.000Z' })
        .expect(201);
      const p3 = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .send({ local: 'Terceiro', horario: '2026-12-10T07:00:00.000Z' })
        .expect(201);

      const reordenado = await cliente
        .put(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .send({ ordem: [p3.body.id, p1.body.id, p2.body.id] })
        .expect(200);

      expect(
        reordenado.body.map((p: { id: string; ordem: number }) => [p.id, p.ordem]),
      ).toEqual([
        [p3.body.id, 1],
        [p1.body.id, 2],
        [p2.body.id, 3],
      ]);
    });

    it('caso de borda: lista de ids incompleta retorna 422', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursao(cliente, veiculo.id);

      const p1 = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .send({ local: 'Primeiro', horario: '2026-12-10T06:00:00.000Z' })
        .expect(201);
      await cliente
        .post(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .send({ local: 'Segundo', horario: '2026-12-10T06:30:00.000Z' })
        .expect(201);

      const resposta = await cliente
        .put(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .send({ ordem: [p1.body.id] })
        .expect(422);
      expect(resposta.body.erro.codigo).toBe('validacao');
    });
  });

  describe('DELETE /pontos-embarque/{pontoId}', () => {
    it('caminho feliz: remove e renumera os pontos restantes', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursao(cliente, veiculo.id);

      const p1 = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .send({ local: 'Primeiro', horario: '2026-12-10T06:00:00.000Z' })
        .expect(201);
      const p2 = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .send({ local: 'Segundo', horario: '2026-12-10T06:30:00.000Z' })
        .expect(201);
      const p3 = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .send({ local: 'Terceiro', horario: '2026-12-10T07:00:00.000Z' })
        .expect(201);

      await cliente
        .delete(`/api/v1/excursoes/${excursao.id}/pontos-embarque/${p1.body.id}`)
        .expect(204);

      const listagem = await cliente
        .get(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .expect(200);
      expect(
        listagem.body.map((p: { id: string; ordem: number }) => [p.id, p.ordem]),
      ).toEqual([
        [p2.body.id, 1],
        [p3.body.id, 2],
      ]);
    });

    it('caso de borda: remover o ÚLTIMO ponto de uma excursão PUBLICADA retorna 409 ultimo_ponto', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursao(cliente, veiculo.id);

      const ponto = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .send({ local: 'Único ponto', horario: '2026-12-10T06:00:00.000Z' })
        .expect(201);
      await cliente.post(`/api/v1/excursoes/${excursao.id}/publicar`).expect(200);

      const resposta = await cliente
        .delete(`/api/v1/excursoes/${excursao.id}/pontos-embarque/${ponto.body.id}`)
        .expect(409);
      expect(resposta.body.erro.codigo).toBe('ultimo_ponto');
    });

    it('removendo o último ponto de uma excursão em RASCUNHO é permitido (regra só vale a partir de publicada)', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursao(cliente, veiculo.id);

      const ponto = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/pontos-embarque`)
        .send({ local: 'Único ponto', horario: '2026-12-10T06:00:00.000Z' })
        .expect(201);

      await cliente
        .delete(`/api/v1/excursoes/${excursao.id}/pontos-embarque/${ponto.body.id}`)
        .expect(204);
    });
  });
});
