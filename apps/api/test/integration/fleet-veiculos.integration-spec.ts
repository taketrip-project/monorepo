import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { criarAppDeTeste, type TestAppContext } from './support/test-app';

/**
 * Testes de integração do bloco `/veiculos*` (`docs/api/fleet.yaml`, H1.4),
 * contra Postgres real. Cobre: geração de layout no cadastro, placa única
 * por organização (409, sem race condition), validação de faixa de
 * poltronas por tipo (422), bloqueio de poltrona fora do layout (422),
 * exclusão lógica (soft delete), paginação, preview de layout sem persistir
 * e isolamento entre organizações.
 */
describe('fleet: /veiculos* (banco real)', () => {
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
    return resposta.body as {
      tokens: { access_token: string };
      membro: { id: string };
      organizacao: { id: string };
    };
  }

  function autenticado(accessToken: string) {
    return {
      get: (url: string) => http().get(url).set('Authorization', `Bearer ${accessToken}`),
      patch: (url: string) => http().patch(url).set('Authorization', `Bearer ${accessToken}`),
      post: (url: string) => http().post(url).set('Authorization', `Bearer ${accessToken}`),
      delete: (url: string) => http().delete(url).set('Authorization', `Bearer ${accessToken}`),
    };
  }

  async function autenticarNovaOrg(sufixo: string) {
    const dono = await registrar(`dono${sufixo}@teste.dev`, `Agência ${sufixo}`);
    return autenticado(dono.tokens.access_token);
  }

  describe('POST /veiculos', () => {
    it('caminho feliz: cadastra micro-ônibus e gera o layout 2+corredor+2', async () => {
      const cliente = await autenticarNovaOrg('A');

      const resposta = await cliente
        .post('/api/v1/veiculos')
        .send({ apelido: 'Marcopolo 1', placa: 'ABC1D23', tipo: 'micro_onibus', quantidade_poltronas: 24 })
        .expect(201);

      expect(resposta.body.id).toEqual(expect.any(String));
      expect(resposta.body.tipo).toBe('micro_onibus');
      expect(resposta.body.quantidade_poltronas).toBe(24);
      expect(resposta.body.poltronas_bloqueadas).toEqual([]);
      expect(resposta.body.capacidade).toBe(24);
      expect(resposta.body.layout.fileiras).toHaveLength(6);
      expect(resposta.body.layout.fileiras[0]).toEqual([1, 2, null, 3, 4]);
    });

    it('caminho feliz: cadastra van e gera o layout próprio (1+corredor+2)', async () => {
      const cliente = await autenticarNovaOrg('A');

      const resposta = await cliente
        .post('/api/v1/veiculos')
        .send({ apelido: 'Sprinter 1', placa: 'VAN1A11', tipo: 'van', quantidade_poltronas: 15 })
        .expect(201);

      expect(resposta.body.layout.fileiras).toEqual([
        [1, null, 2, 3],
        [4, null, 5, 6],
        [7, null, 8, 9],
        [10, null, 11, 12],
        [13, null, 14, 15],
      ]);
      expect(resposta.body.capacidade).toBe(15);
    });

    it('caso de borda: quantidade de poltronas fora da faixa do tipo retorna 422', async () => {
      const cliente = await autenticarNovaOrg('A');

      const resposta = await cliente
        .post('/api/v1/veiculos')
        .send({ apelido: 'Ônibus pequeno demais', placa: 'XYZ9Z99', tipo: 'onibus', quantidade_poltronas: 30 })
        .expect(422);

      expect(resposta.body.erro.codigo).toBe('validacao');
    });

    it('caso de borda: placa duplicada na MESMA organização retorna 409 placa_ja_cadastrada', async () => {
      const cliente = await autenticarNovaOrg('A');

      await cliente
        .post('/api/v1/veiculos')
        .send({ apelido: 'Van 1', placa: 'REP1T01', tipo: 'van', quantidade_poltronas: 15 })
        .expect(201);

      const resposta = await cliente
        .post('/api/v1/veiculos')
        .send({ apelido: 'Van 2 (mesma placa)', placa: 'REP1T01', tipo: 'van', quantidade_poltronas: 16 })
        .expect(409);

      expect(resposta.body.erro.codigo).toBe('placa_ja_cadastrada');
    });

    it('caso de borda: a MESMA placa em organizações diferentes não gera conflito', async () => {
      const clienteA = await autenticarNovaOrg('A');
      const clienteB = await autenticarNovaOrg('B');

      await clienteA
        .post('/api/v1/veiculos')
        .send({ apelido: 'Van da A', placa: 'IGU4L01', tipo: 'van', quantidade_poltronas: 15 })
        .expect(201);

      await clienteB
        .post('/api/v1/veiculos')
        .send({ apelido: 'Van da B', placa: 'IGU4L01', tipo: 'van', quantidade_poltronas: 15 })
        .expect(201);
    });
  });

  describe('GET /veiculos/layout-padrao (preview)', () => {
    it('gera o layout sem salvar nada', async () => {
      const cliente = await autenticarNovaOrg('A');

      const resposta = await cliente
        .get('/api/v1/veiculos/layout-padrao')
        .query({ tipo: 'onibus', quantidade_poltronas: 42 })
        .expect(200);

      expect(resposta.body.fileiras).toHaveLength(11);
      expect(resposta.body.fileiras[10]).toEqual([41, 42]);

      const listagem = await cliente.get('/api/v1/veiculos').expect(200);
      expect(listagem.body.dados).toHaveLength(0);
      expect(listagem.body.paginacao.total).toBe(0);
    });

    it('caso de borda: quantidade fora da faixa do tipo no preview retorna 422', async () => {
      const cliente = await autenticarNovaOrg('A');

      const resposta = await cliente
        .get('/api/v1/veiculos/layout-padrao')
        .query({ tipo: 'van', quantidade_poltronas: 20 })
        .expect(422);

      expect(resposta.body.erro.codigo).toBe('validacao');
    });
  });

  describe('GET /veiculos (listagem paginada)', () => {
    it('pagina resultados com pagina/por_pagina/total', async () => {
      const cliente = await autenticarNovaOrg('A');

      for (let i = 0; i < 3; i++) {
        await cliente
          .post('/api/v1/veiculos')
          .send({ apelido: `Van ${i}`, placa: `PAG${i}A01`, tipo: 'van', quantidade_poltronas: 15 })
          .expect(201);
      }

      const pagina1 = await cliente
        .get('/api/v1/veiculos')
        .query({ pagina: 1, por_pagina: 2 })
        .expect(200);
      expect(pagina1.body.dados).toHaveLength(2);
      expect(pagina1.body.paginacao).toEqual({ pagina: 1, por_pagina: 2, total: 3 });

      const pagina2 = await cliente
        .get('/api/v1/veiculos')
        .query({ pagina: 2, por_pagina: 2 })
        .expect(200);
      expect(pagina2.body.dados).toHaveLength(1);
    });
  });

  describe('PATCH /veiculos/{veiculoId}', () => {
    it('caminho feliz: bloqueia poltrona e a capacidade é recalculada', async () => {
      const cliente = await autenticarNovaOrg('A');

      const criado = await cliente
        .post('/api/v1/veiculos')
        .send({ apelido: 'Micro 1', placa: 'BLQ1E01', tipo: 'micro_onibus', quantidade_poltronas: 24 })
        .expect(201);

      const atualizado = await cliente
        .patch(`/api/v1/veiculos/${criado.body.id}`)
        .send({
          apelido: 'Micro 1',
          placa: 'BLQ1E01',
          tipo: 'micro_onibus',
          quantidade_poltronas: 24,
          poltronas_bloqueadas: [3],
        })
        .expect(200);

      expect(atualizado.body.poltronas_bloqueadas).toEqual([3]);
      expect(atualizado.body.capacidade).toBe(23);
    });

    it('caso de borda: bloquear poltrona fora da faixa do layout retorna 422', async () => {
      const cliente = await autenticarNovaOrg('A');

      const criado = await cliente
        .post('/api/v1/veiculos')
        .send({ apelido: 'Micro 1', placa: 'FOR1A01', tipo: 'micro_onibus', quantidade_poltronas: 24 })
        .expect(201);

      const resposta = await cliente
        .patch(`/api/v1/veiculos/${criado.body.id}`)
        .send({
          apelido: 'Micro 1',
          placa: 'FOR1A01',
          tipo: 'micro_onibus',
          quantidade_poltronas: 24,
          poltronas_bloqueadas: [30],
        })
        .expect(422);

      expect(resposta.body.erro.codigo).toBe('validacao');
    });

    it('reduzir quantidade de poltronas regenera o layout', async () => {
      const cliente = await autenticarNovaOrg('A');

      const criado = await cliente
        .post('/api/v1/veiculos')
        .send({ apelido: 'Ônibus 1', placa: 'RED1U01', tipo: 'onibus', quantidade_poltronas: 45 })
        .expect(201);

      const atualizado = await cliente
        .patch(`/api/v1/veiculos/${criado.body.id}`)
        .send({ apelido: 'Ônibus 1', placa: 'RED1U01', tipo: 'onibus', quantidade_poltronas: 42 })
        .expect(200);

      expect(atualizado.body.quantidade_poltronas).toBe(42);
      expect(atualizado.body.capacidade).toBe(42);
      const numeros = atualizado.body.layout.fileiras
        .flat()
        .filter((n: number | null) => n !== null);
      expect(Math.max(...numeros)).toBe(42);
    });

    /**
     * NOTA (extensão futura): hoje `VinculoExcursaoService` é um stub que
     * sempre responde "sem excursão vinculada" — os módulos `excursions` e
     * `bookings` ainda não existem. Por isso editar sem `confirmar` funciona
     * de ponta a ponta abaixo. QUANDO esses módulos existirem, este teste
     * precisa GANHAR o caso real: criar uma excursão PUBLICADA vinculada a
     * este veículo e então (a) confirmar que o PATCH sem `confirmar: true`
     * responde 409 `veiculo_em_uso_requer_confirmacao`, e (b) que bloquear
     * uma poltrona com reserva ativa responde 409 `poltrona_com_reserva`.
     */
    it('hoje edita sem `confirmar` normalmente (sem excursions/bookings, não há vínculo real ainda)', async () => {
      const cliente = await autenticarNovaOrg('A');

      const criado = await cliente
        .post('/api/v1/veiculos')
        .send({ apelido: 'Van 1', placa: 'EXT1E01', tipo: 'van', quantidade_poltronas: 15 })
        .expect(201);

      await cliente
        .patch(`/api/v1/veiculos/${criado.body.id}`)
        .send({ apelido: 'Van 1 renomeada', placa: 'EXT1E01', tipo: 'van', quantidade_poltronas: 15 })
        .expect(200);
    });

    it('caso de borda: veículo de outra organização retorna 404 (nunca 403)', async () => {
      const clienteA = await autenticarNovaOrg('A');
      const clienteB = await autenticarNovaOrg('B');

      const criadoB = await clienteB
        .post('/api/v1/veiculos')
        .send({ apelido: 'Van da B', placa: 'ISO1L01', tipo: 'van', quantidade_poltronas: 15 })
        .expect(201);

      const resposta = await clienteA
        .patch(`/api/v1/veiculos/${criadoB.body.id}`)
        .send({ apelido: 'Tentativa', placa: 'ISO1L01', tipo: 'van', quantidade_poltronas: 15 })
        .expect(404);

      expect(resposta.body.erro.codigo).toBe('nao_encontrado');
    });
  });

  describe('DELETE /veiculos/{veiculoId} (soft delete)', () => {
    it('caminho feliz: exclusão é lógica — some da listagem mas continua existindo', async () => {
      const cliente = await autenticarNovaOrg('A');

      const criado = await cliente
        .post('/api/v1/veiculos')
        .send({ apelido: 'Van a excluir', placa: 'DEL1E01', tipo: 'van', quantidade_poltronas: 15 })
        .expect(201);

      await cliente.delete(`/api/v1/veiculos/${criado.body.id}`).expect(204);

      await cliente.get(`/api/v1/veiculos/${criado.body.id}`).expect(404);
      const listagem = await cliente.get('/api/v1/veiculos').expect(200);
      expect(listagem.body.dados).toHaveLength(0);

      const linhas = await ctx.db.execute(
        sql`SELECT excluido_em FROM veiculo WHERE id = ${criado.body.id}`,
      );
      expect((linhas.rows[0] as { excluido_em: Date | null }).excluido_em).not.toBeNull();
    });

    it('caso de borda: excluir veículo de outra organização retorna 404 (nunca 403)', async () => {
      const clienteA = await autenticarNovaOrg('A');
      const clienteB = await autenticarNovaOrg('B');

      const criadoB = await clienteB
        .post('/api/v1/veiculos')
        .send({ apelido: 'Van da B', placa: 'ISO2L02', tipo: 'van', quantidade_poltronas: 15 })
        .expect(201);

      const resposta = await clienteA.delete(`/api/v1/veiculos/${criadoB.body.id}`).expect(404);
      expect(resposta.body.erro.codigo).toBe('nao_encontrado');

      // Veículo da B continua intacto.
      await clienteB.get(`/api/v1/veiculos/${criadoB.body.id}`).expect(200);
    });
  });

  describe('isolamento multi-tenant (critério de aceite permanente do backlog)', () => {
    it('org A não lista veículo da org B', async () => {
      const clienteA = await autenticarNovaOrg('A');
      const clienteB = await autenticarNovaOrg('B');

      await clienteB
        .post('/api/v1/veiculos')
        .send({ apelido: 'Van da B', placa: 'LST1B01', tipo: 'van', quantidade_poltronas: 15 })
        .expect(201);

      const listagemA = await clienteA.get('/api/v1/veiculos').expect(200);
      expect(listagemA.body.dados).toHaveLength(0);
      expect(listagemA.body.paginacao.total).toBe(0);
    });
  });
});
