import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { criarAppDeTeste, type TestAppContext } from './support/test-app';

/**
 * Testes de integração do módulo `bookings` (`docs/api/bookings.yaml`,
 * H1.8–H1.10) contra Postgres real: cadastro rápido, poltrona única sob
 * concorrência real, reaproveitamento de passageiro por WhatsApp, edição de
 * reserva, pagamento manual sem regressão, cancelamento com liberação de
 * poltrona + reversão `lotada → publicada`, pendência de estorno e
 * isolamento de tenant.
 */
describe('bookings: cadastro rápido, pagamento e cancelamento (banco real)', () => {
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
      delete: (url: string) => http().delete(url).set('Authorization', `Bearer ${accessToken}`),
    };
  }

  async function autenticarNovaOrg(sufixo: string) {
    const dono = await registrar(`dono${sufixo}@teste.dev`, `Agência ${sufixo}`);
    return autenticado(dono.tokens.access_token);
  }

  async function criarVeiculo(
    cliente: ReturnType<typeof autenticado>,
    tipo: 'van' | 'micro_onibus' | 'onibus' = 'micro_onibus',
    quantidadePoltronas = 24,
  ) {
    const placa = `P${Math.random().toString(36).slice(2, 8)}`.toUpperCase().slice(0, 7);
    const resposta = await cliente
      .post('/api/v1/veiculos')
      .send({ apelido: 'Veículo de teste', placa, tipo, quantidade_poltronas: quantidadePoltronas })
      .expect(201);
    return resposta.body as { id: string };
  }

  async function criarExcursao(
    cliente: ReturnType<typeof autenticado>,
    veiculoId: string,
    precoCentavos = 18000,
  ) {
    const resposta = await cliente
      .post('/api/v1/excursoes')
      .send({
        destino: 'Praia Grande',
        data_saida: '2026-12-10T08:00:00.000Z',
        data_retorno: '2026-12-10T20:00:00.000Z',
        tipo: 'bate_volta',
        veiculo_id: veiculoId,
        preco_centavos: precoCentavos,
      })
      .expect(201);
    return resposta.body as { id: string; preco_centavos: number };
  }

  async function publicarExcursao(cliente: ReturnType<typeof autenticado>, excursaoId: string) {
    await cliente
      .post(`/api/v1/excursoes/${excursaoId}/pontos-embarque`)
      .send({ local: 'Praça Central', horario: '2026-12-10T06:00:00.000Z' })
      .expect(201);
    await cliente.post(`/api/v1/excursoes/${excursaoId}/publicar`).expect(200);
  }

  async function criarExcursaoPublicada(
    cliente: ReturnType<typeof autenticado>,
    veiculoId: string,
    precoCentavos = 18000,
  ) {
    const excursao = await criarExcursao(cliente, veiculoId, precoCentavos);
    await publicarExcursao(cliente, excursao.id);
    return excursao;
  }

  describe('POST /excursoes/{id}/reservas — cadastro rápido (H1.9)', () => {
    it('caminho feliz: cria passageiro + reserva ativa/pendente e aparece no mapa de poltronas', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);

      const resposta = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'Maria Silva', whatsapp: '11999998888' })
        .expect(201);

      expect(resposta.body).toMatchObject({
        excursao_id: excursao.id,
        poltrona: 1,
        status: 'ativa',
        status_pagamento: 'pendente',
        origem: 'organizador',
        valor_centavos: 18000,
      });
      expect(resposta.body.passageiro).toMatchObject({ nome: 'Maria Silva', whatsapp: '5511999998888' });

      const mapa = await cliente.get(`/api/v1/excursoes/${excursao.id}/mapa-poltronas`).expect(200);
      const poltrona1 = mapa.body.poltronas.find((p: { numero: number }) => p.numero === 1);
      expect(poltrona1.estado).toBe('pendente');
      expect(poltrona1.passageiro_nome).toBe('Maria Silva');
      expect(mapa.body.capacidade).toBe(24);
      expect(mapa.body.vagas).toBe(23);
    });

    it('caso de borda: poltrona única — duas tentativas simultâneas na mesma poltrona, exatamente uma vence', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);

      const [r1, r2] = await Promise.all([
        cliente
          .post(`/api/v1/excursoes/${excursao.id}/reservas`)
          .send({ poltrona: 5, nome: 'Passageiro 1', whatsapp: '11911112222' }),
        cliente
          .post(`/api/v1/excursoes/${excursao.id}/reservas`)
          .send({ poltrona: 5, nome: 'Passageiro 2', whatsapp: '11933334444' }),
      ]);

      const statusCodes = [r1.status, r2.status].sort();
      expect(statusCodes).toEqual([201, 409]);

      const perdedor = r1.status === 409 ? r1 : r2;
      expect(perdedor.body.erro.codigo).toBe('poltrona_ocupada');
      expect(Array.isArray(perdedor.body.erro.detalhes.poltronas_livres)).toBe(true);
      expect(perdedor.body.erro.detalhes.poltronas_livres).not.toContain(5);
      expect(perdedor.body.erro.detalhes.poltronas_livres.length).toBeGreaterThan(0);
    });

    it('recadastrar o mesmo WhatsApp reaproveita o passageiro (não duplica)', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);

      const r1 = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'João', whatsapp: '11955556666' })
        .expect(201);
      const r2 = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 2, nome: 'João Pedro', whatsapp: '(11) 95555-6666' })
        .expect(201);

      expect(r1.body.passageiro.id).toBe(r2.body.passageiro.id);
      // Nome atualizado na segunda tentativa (decisão documentada em `passageiros.service.ts`).
      expect(r2.body.passageiro.nome).toBe('João Pedro');

      const linhas = await ctx.db.execute(
        sql`SELECT count(*)::int AS total FROM passageiro WHERE whatsapp = '5511955556666'`,
      );
      expect((linhas.rows[0] as { total: number }).total).toBe(1);
    });

    it('caso de borda: excursão em rascunho não aceita reserva (409 excursao_nao_aceita_reserva)', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursao(cliente, veiculo.id);

      const resposta = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'Maria', whatsapp: '11999998888' })
        .expect(409);
      expect(resposta.body.erro.codigo).toBe('excursao_nao_aceita_reserva');
    });

    it('caso de borda: poltrona fora do layout (409 poltrona_inexistente) e poltrona bloqueada (409 poltrona_bloqueada)', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente, 'van', 15);
      await cliente
        .patch(`/api/v1/veiculos/${veiculo.id}`)
        .send({ apelido: 'Veículo de teste', placa: 'BLOQ001', tipo: 'van', quantidade_poltronas: 15, poltronas_bloqueadas: [2] })
        .expect(200);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);

      const foraDoLayout = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 99, nome: 'Maria', whatsapp: '11999998888' })
        .expect(409);
      expect(foraDoLayout.body.erro.codigo).toBe('poltrona_inexistente');

      const bloqueada = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 2, nome: 'Maria', whatsapp: '11999998888' })
        .expect(409);
      expect(bloqueada.body.erro.codigo).toBe('poltrona_bloqueada');
    });
  });

  describe('PATCH /reservas/{id} — editar reserva', () => {
    it('troca de poltrona segue a mesma garantia de unicidade (409 poltrona_ocupada)', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);

      await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'Ana', whatsapp: '11911112222' })
        .expect(201);
      const r2 = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 2, nome: 'Bia', whatsapp: '11933334444' })
        .expect(201);

      const conflito = await cliente
        .patch(`/api/v1/reservas/${r2.body.id}`)
        .send({ poltrona: 1 })
        .expect(409);
      expect(conflito.body.erro.codigo).toBe('poltrona_ocupada');

      const sucesso = await cliente.patch(`/api/v1/reservas/${r2.body.id}`).send({ poltrona: 3 }).expect(200);
      expect(sucesso.body.poltrona).toBe(3);

      const mapa = await cliente.get(`/api/v1/excursoes/${excursao.id}/mapa-poltronas`).expect(200);
      const poltrona2 = mapa.body.poltronas.find((p: { numero: number }) => p.numero === 2);
      expect(poltrona2.estado).toBe('livre');
    });
  });

  describe('POST /reservas/{id}/status-pagamento (H1.10)', () => {
    it('caminho feliz: avança pendente → sinal_pago → pago, sem regredir', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);
      const reserva = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'Maria', whatsapp: '11999998888' })
        .expect(201);

      const sinal = await cliente
        .post(`/api/v1/reservas/${reserva.body.id}/status-pagamento`)
        .send({ status: 'sinal_pago' })
        .expect(200);
      expect(sinal.body.status_pagamento).toBe('sinal_pago');

      const pago = await cliente
        .post(`/api/v1/reservas/${reserva.body.id}/status-pagamento`)
        .send({ status: 'pago' })
        .expect(200);
      expect(pago.body.status_pagamento).toBe('pago');

      const regressao = await cliente
        .post(`/api/v1/reservas/${reserva.body.id}/status-pagamento`)
        .send({ status: 'sinal_pago' })
        .expect(409);
      expect(regressao.body.erro.codigo).toBe('transicao_pagamento_invalida');
    });

    it('marcar status_pagamento como "cancelado" cancela a reserva por completo (libera a poltrona)', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);
      const reserva = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'Maria', whatsapp: '11999998888' })
        .expect(201);

      const resposta = await cliente
        .post(`/api/v1/reservas/${reserva.body.id}/status-pagamento`)
        .send({ status: 'cancelado' })
        .expect(200);
      expect(resposta.body.status).toBe('cancelada');

      const mapa = await cliente.get(`/api/v1/excursoes/${excursao.id}/mapa-poltronas`).expect(200);
      const poltrona1 = mapa.body.poltronas.find((p: { numero: number }) => p.numero === 1);
      expect(poltrona1.estado).toBe('livre');
    });
  });

  describe('POST /reservas/{id}/cancelar (H1.10)', () => {
    it('libera a poltrona na hora, reverte lotada → publicada e registra pendência de estorno quando já havia pagamento', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente, 'van', 15);
      // Bloqueia 14 das 15 poltronas: capacidade vira 1, então a única
      // reserva já deixa a excursão "lotada" — fácil de testar sem criar 15 reservas.
      const bloqueadas = Array.from({ length: 14 }, (_, i) => i + 2);
      await cliente
        .patch(`/api/v1/veiculos/${veiculo.id}`)
        .send({
          apelido: 'Van 1 poltrona',
          placa: 'LOT0001',
          tipo: 'van',
          quantidade_poltronas: 15,
          poltronas_bloqueadas: bloqueadas,
        })
        .expect(200);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);

      const reserva = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'Maria', whatsapp: '11999998888' })
        .expect(201);

      const excursaoLotada = await cliente.get(`/api/v1/excursoes/${excursao.id}`).expect(200);
      expect(excursaoLotada.body.status).toBe('lotada');
      expect(excursaoLotada.body.vagas).toBe(0);

      await cliente
        .post(`/api/v1/reservas/${reserva.body.id}/status-pagamento`)
        .send({ status: 'pago' })
        .expect(200);

      const cancelada = await cliente
        .post(`/api/v1/reservas/${reserva.body.id}/cancelar`)
        .send({ motivo: 'Passageiro desistiu' })
        .expect(200);
      expect(cancelada.body.status).toBe('cancelada');

      const excursaoLivre = await cliente.get(`/api/v1/excursoes/${excursao.id}`).expect(200);
      expect(excursaoLivre.body.status).toBe('publicada');
      expect(excursaoLivre.body.vagas).toBe(1);

      const pendencias = await ctx.db.execute(
        sql`SELECT valor_centavos FROM pendencia_estorno WHERE reserva_id = ${reserva.body.id}`,
      );
      expect(pendencias.rows).toHaveLength(1);
      expect((pendencias.rows[0] as { valor_centavos: number }).valor_centavos).toBe(18000);
    });

    it('caso de borda: cancelar reserva já cancelada retorna 409 transicao_invalida', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);
      const reserva = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'Maria', whatsapp: '11999998888' })
        .expect(201);

      await cliente.post(`/api/v1/reservas/${reserva.body.id}/cancelar`).send({}).expect(200);
      const resposta = await cliente
        .post(`/api/v1/reservas/${reserva.body.id}/cancelar`)
        .send({})
        .expect(409);
      expect(resposta.body.erro.codigo).toBe('transicao_invalida');
    });
  });

  describe('GET /passageiros?whatsapp=', () => {
    it('retorna 0 resultado antes do cadastro e 1 depois, com WhatsApp normalizado', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);

      const antes = await cliente.get('/api/v1/passageiros?whatsapp=11999998888').expect(200);
      expect(antes.body).toEqual([]);

      await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'Maria', whatsapp: '11999998888' })
        .expect(201);

      const depois = await cliente.get('/api/v1/passageiros?whatsapp=(11)%2099999-8888').expect(200);
      expect(depois.body).toHaveLength(1);
      expect(depois.body[0].whatsapp).toBe('5511999998888');
    });
  });

  describe('isolamento de tenant (org A nunca vê/edita reserva da org B)', () => {
    it('GET/PATCH/cancelar de reserva de outra organização retorna 404 (nunca 403)', async () => {
      const clienteA = await autenticarNovaOrg('A');
      const clienteB = await autenticarNovaOrg('B');
      const veiculoB = await criarVeiculo(clienteB);
      const excursaoB = await criarExcursaoPublicada(clienteB, veiculoB.id);
      const reservaB = await clienteB
        .post(`/api/v1/excursoes/${excursaoB.id}/reservas`)
        .send({ poltrona: 1, nome: 'Passageiro B', whatsapp: '11999998888' })
        .expect(201);

      const getResp = await clienteA.get(`/api/v1/reservas/${reservaB.body.id}`).expect(404);
      expect(getResp.body.erro.codigo).toBe('nao_encontrado');

      const patchResp = await clienteA
        .patch(`/api/v1/reservas/${reservaB.body.id}`)
        .send({ valor_centavos: 1 })
        .expect(404);
      expect(patchResp.body.erro.codigo).toBe('nao_encontrado');

      const cancelResp = await clienteA
        .post(`/api/v1/reservas/${reservaB.body.id}/cancelar`)
        .send({})
        .expect(404);
      expect(cancelResp.body.erro.codigo).toBe('nao_encontrado');

      const mapaResp = await clienteA.get(`/api/v1/excursoes/${excursaoB.id}/mapa-poltronas`).expect(404);
      expect(mapaResp.body.erro.codigo).toBe('nao_encontrado');

      const listarResp = await clienteA.get(`/api/v1/excursoes/${excursaoB.id}/reservas`).expect(404);
      expect(listarResp.body.erro.codigo).toBe('nao_encontrado');

      // A reserva de B continua intacta.
      const aindaLa = await clienteB.get(`/api/v1/reservas/${reservaB.body.id}`).expect(200);
      expect(aindaLa.body.status).toBe('ativa');
    });
  });
});
