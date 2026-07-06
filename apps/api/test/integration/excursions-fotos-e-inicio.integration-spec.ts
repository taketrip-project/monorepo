import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { criarAppDeTeste, type TestAppContext } from './support/test-app';

/**
 * Testes de integração de `/excursoes/{id}/fotos*` (S3 — via
 * `LocalArquivoStorageService`, ativo em teste porque `S3_BUCKET` não está
 * configurado no `.env` de teste) e de `GET /inicio` (H1.14), contra
 * Postgres real.
 */
describe('excursions: /excursoes/{id}/fotos* e /inicio (banco real)', () => {
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
      post: (url: string) => http().post(url).set('Authorization', `Bearer ${accessToken}`),
      delete: (url: string) => http().delete(url).set('Authorization', `Bearer ${accessToken}`),
    };
  }

  async function autenticarNovaOrg(sufixo: string) {
    const dono = await registrar(`dono${sufixo}@teste.dev`, `Agência ${sufixo}`);
    return autenticado(dono.tokens.access_token);
  }

  async function criarVeiculo(cliente: ReturnType<typeof autenticado>) {
    const placa = `F${Math.random().toString(36).slice(2, 8)}`.toUpperCase().slice(0, 7);
    const resposta = await cliente
      .post('/api/v1/veiculos')
      .send({ apelido: 'Micro 1', placa, tipo: 'micro_onibus', quantidade_poltronas: 24 })
      .expect(201);
    return resposta.body as { id: string };
  }

  async function criarExcursao(
    cliente: ReturnType<typeof autenticado>,
    veiculoId: string,
    dataSaida = '2026-12-10T08:00:00.000Z',
  ) {
    const resposta = await cliente
      .post('/api/v1/excursoes')
      .send({
        destino: 'Praia Grande',
        data_saida: dataSaida,
        data_retorno: '2026-12-10T20:00:00.000Z',
        tipo: 'bate_volta',
        veiculo_id: veiculoId,
        preco_centavos: 18000,
      })
      .expect(201);
    return resposta.body as { id: string };
  }

  describe('POST /fotos', () => {
    it('caminho feliz: envia foto, ordem 1 vira a capa', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursao(cliente, veiculo.id);

      const resposta = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/fotos`)
        .attach('arquivo', Buffer.from('conteudo-fake-da-imagem'), 'capa.jpg')
        .expect(201);

      expect(resposta.body.ordem).toBe(1);
      expect(resposta.body.url).toEqual(expect.any(String));

      const detalhe = await cliente.get(`/api/v1/excursoes/${excursao.id}`).expect(200);
      expect(detalhe.body.foto_capa_url).toBe(resposta.body.url);
      expect(detalhe.body.fotos).toEqual([
        { id: resposta.body.id, url: resposta.body.url, ordem: 1 },
      ]);
    });

    it('caso de borda: formato não suportado retorna 422 arquivo_invalido', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursao(cliente, veiculo.id);

      const resposta = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/fotos`)
        .attach('arquivo', Buffer.from('nao e uma imagem'), 'documento.pdf')
        .expect(422);
      expect(resposta.body.erro.codigo).toBe('arquivo_invalido');
    });
  });

  describe('DELETE /fotos/{fotoId}', () => {
    it('caminho feliz: remove e a foto seguinte assume a ordem 1 (nova capa)', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursao(cliente, veiculo.id);

      const foto1 = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/fotos`)
        .attach('arquivo', Buffer.from('primeira'), 'um.png')
        .expect(201);
      const foto2 = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/fotos`)
        .attach('arquivo', Buffer.from('segunda'), 'dois.png')
        .expect(201);

      await cliente
        .delete(`/api/v1/excursoes/${excursao.id}/fotos/${foto1.body.id}`)
        .expect(204);

      const detalhe = await cliente.get(`/api/v1/excursoes/${excursao.id}`).expect(200);
      expect(detalhe.body.fotos).toEqual([{ id: foto2.body.id, url: foto2.body.url, ordem: 1 }]);
      expect(detalhe.body.foto_capa_url).toBe(foto2.body.url);
    });

    it('caso de borda: foto de outra organização retorna 404 (nunca 403)', async () => {
      const clienteA = await autenticarNovaOrg('A');
      const clienteB = await autenticarNovaOrg('B');
      const veiculoB = await criarVeiculo(clienteB);
      const excursaoB = await criarExcursao(clienteB, veiculoB.id);

      const fotoB = await clienteB
        .post(`/api/v1/excursoes/${excursaoB.id}/fotos`)
        .attach('arquivo', Buffer.from('da B'), 'b.png')
        .expect(201);

      const resposta = await clienteA
        .delete(`/api/v1/excursoes/${excursaoB.id}/fotos/${fotoB.body.id}`)
        .expect(404);
      expect(resposta.body.erro.codigo).toBe('nao_encontrado');
    });
  });

  describe('GET /inicio', () => {
    it('retorna null quando não há nenhuma excursão futura', async () => {
      const cliente = await autenticarNovaOrg('A');

      const resposta = await cliente.get('/api/v1/inicio').expect(200);
      expect(resposta.body).toEqual({ proxima_excursao: null });
    });

    it('caminho feliz: retorna a excursão futura com menor data_saida, mesmo em rascunho ela some do dashboard', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);

      // Rascunho não deve aparecer (H1.5: fora de qualquer listagem operacional).
      await criarExcursao(cliente, veiculo.id, '2026-08-01T08:00:00.000Z');

      const maisProxima = await criarExcursao(cliente, veiculo.id, '2026-09-01T08:00:00.000Z');
      await cliente
        .post(`/api/v1/excursoes/${maisProxima.id}/pontos-embarque`)
        .send({ local: 'Praça Central', horario: '2026-09-01T07:00:00.000Z' })
        .expect(201);
      await cliente.post(`/api/v1/excursoes/${maisProxima.id}/publicar`).expect(200);

      const maisDistante = await criarExcursao(cliente, veiculo.id, '2026-10-01T08:00:00.000Z');
      await cliente
        .post(`/api/v1/excursoes/${maisDistante.id}/pontos-embarque`)
        .send({ local: 'Praça Central', horario: '2026-10-01T07:00:00.000Z' })
        .expect(201);
      await cliente.post(`/api/v1/excursoes/${maisDistante.id}/publicar`).expect(200);

      const resposta = await cliente.get('/api/v1/inicio').expect(200);
      expect(resposta.body.proxima_excursao.id).toBe(maisProxima.id);
    });

    it('caso de borda: org A nunca vê a próxima excursão da org B', async () => {
      const clienteA = await autenticarNovaOrg('A');
      const clienteB = await autenticarNovaOrg('B');
      const veiculoB = await criarVeiculo(clienteB);
      const excursaoB = await criarExcursao(clienteB, veiculoB.id);
      await clienteB
        .post(`/api/v1/excursoes/${excursaoB.id}/pontos-embarque`)
        .send({ local: 'Praça Central', horario: '2026-12-10T07:00:00.000Z' })
        .expect(201);
      await clienteB.post(`/api/v1/excursoes/${excursaoB.id}/publicar`).expect(200);

      const resposta = await clienteA.get('/api/v1/inicio').expect(200);
      expect(resposta.body).toEqual({ proxima_excursao: null });
    });
  });
});
