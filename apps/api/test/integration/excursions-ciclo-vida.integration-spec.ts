import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { criarAppDeTeste, type TestAppContext } from './support/test-app';

/**
 * Testes de integração do bloco `/excursoes*` (`docs/api/excursions.yaml`,
 * H1.5–H1.7, H3.4, H3.5), contra Postgres real. Cobre: criação em rascunho
 * (fora de listagem operacional), sinal resolvido (percentual com floor,
 * fixo, default da organização), capacidade derivada do veículo (fleet já
 * pronto), máquina de estados (publicar/cancelar), checklist legal,
 * viabilidade e isolamento entre organizações.
 *
 * NOTA (extensão futura, mesmo padrão de `fleet-veiculos.integration-spec.ts`):
 * `vagas`, `pagos` e `pendentes` dependem do módulo `bookings`
 * (`ContadorReservasService`), que ainda não existe — hoje sempre
 * `vagas = capacidade`, `pagos = 0`, `pendentes = 0`. QUANDO `bookings`
 * existir, os testes abaixo marcados com "STUB DE RESERVAS" precisam
 * GANHAR o caso real: criar reservas de verdade e confirmar que os
 * contadores refletem o estado do banco.
 */
describe('excursions: /excursoes* (banco real)', () => {
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
      put: (url: string) => http().put(url).set('Authorization', `Bearer ${accessToken}`),
      delete: (url: string) => http().delete(url).set('Authorization', `Bearer ${accessToken}`),
    };
  }

  async function autenticarNovaOrg(sufixo: string) {
    const dono = await registrar(`dono${sufixo}@teste.dev`, `Agência ${sufixo}`);
    return autenticado(dono.tokens.access_token);
  }

  async function criarVeiculo(
    cliente: ReturnType<typeof autenticado>,
    overrides: Partial<{ apelido: string; placa: string; tipo: string; quantidade_poltronas: number }> = {},
  ) {
    const resposta = await cliente
      .post('/api/v1/veiculos')
      .send({
        apelido: 'Micro 1',
        placa: `V${Math.random().toString(36).slice(2, 8)}`.toUpperCase().padEnd(7, '0').slice(0, 7),
        tipo: 'micro_onibus',
        quantidade_poltronas: 24,
        ...overrides,
      })
      .expect(201);
    return resposta.body as { id: string; capacidade: number };
  }

  function payloadExcursao(veiculoId: string, overrides: Record<string, unknown> = {}) {
    return {
      destino: 'Praia Grande',
      data_saida: '2026-12-10T08:00:00.000Z',
      data_retorno: '2026-12-10T20:00:00.000Z',
      tipo: 'bate_volta',
      veiculo_id: veiculoId,
      preco_centavos: 18000,
      ...overrides,
    };
  }

  describe('POST /excursoes', () => {
    it('caminho feliz: nasce em rascunho, sinal default 50% herdado da organização, com floor', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);

      const resposta = await cliente
        .post('/api/v1/excursoes')
        .send(payloadExcursao(veiculo.id, { preco_centavos: 17990 }))
        .expect(201);

      expect(resposta.body.status).toBe('rascunho');
      expect(resposta.body.sinal_tipo).toBe('percentual');
      expect(resposta.body.sinal_valor).toBe(50);
      expect(resposta.body.sinal_centavos).toBe(8995);
      expect(resposta.body.capacidade).toBe(veiculo.capacidade);
      expect(resposta.body.vagas).toBe(veiculo.capacidade); // STUB DE RESERVAS: sempre = capacidade hoje.
      expect(resposta.body.pagos).toBe(0); // STUB DE RESERVAS
      expect(resposta.body.pendentes).toBe(0); // STUB DE RESERVAS
      expect(resposta.body.codigo_publico).toEqual(expect.any(String));
      expect(resposta.body.url_publica).toContain(resposta.body.codigo_publico);
      expect(resposta.body.viabilidade).toBeNull();
      expect(resposta.body.checklist_legal).toEqual({
        licenca_antt: false,
        seguro_passageiros: false,
        lista_impressa: false,
      });
    });

    it('caminho feliz: sinal fixo em centavos é usado tal como informado', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);

      const resposta = await cliente
        .post('/api/v1/excursoes')
        .send(payloadExcursao(veiculo.id, { sinal_tipo: 'fixo', sinal_valor: 5000 }))
        .expect(201);

      expect(resposta.body.sinal_tipo).toBe('fixo');
      expect(resposta.body.sinal_valor).toBe(5000);
      expect(resposta.body.sinal_centavos).toBe(5000);
    });

    it('caso de borda: sinal_tipo fixo sem sinal_valor retorna 422', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);

      const resposta = await cliente
        .post('/api/v1/excursoes')
        .send(payloadExcursao(veiculo.id, { sinal_tipo: 'fixo' }))
        .expect(422);

      expect(resposta.body.erro.codigo).toBe('validacao');
    });

    it('caso de borda: sinal_valor percentual acima de 100 retorna 422', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);

      const resposta = await cliente
        .post('/api/v1/excursoes')
        .send(payloadExcursao(veiculo.id, { sinal_tipo: 'percentual', sinal_valor: 150 }))
        .expect(422);

      expect(resposta.body.erro.codigo).toBe('validacao');
    });

    it('caso de borda: veículo inexistente na organização retorna 404', async () => {
      const cliente = await autenticarNovaOrg('A');

      const resposta = await cliente
        .post('/api/v1/excursoes')
        .send(payloadExcursao('00000000-0000-7000-8000-000000000000'))
        .expect(404);

      expect(resposta.body.erro.codigo).toBe('nao_encontrado');
    });

    it('rascunho não aparece em NENHUMA listagem operacional (H1.5)', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);

      await cliente.post('/api/v1/excursoes').send(payloadExcursao(veiculo.id)).expect(201);

      const proximas = await cliente.get('/api/v1/excursoes').expect(200);
      expect(proximas.body.dados).toHaveLength(0);

      const hoje = await cliente.get('/api/v1/excursoes').query({ filtro: 'hoje' }).expect(200);
      expect(hoje.body.dados).toHaveLength(0);

      const concluidas = await cliente
        .get('/api/v1/excursoes')
        .query({ filtro: 'concluidas' })
        .expect(200);
      expect(concluidas.body.dados).toHaveLength(0);

      const rascunhos = await cliente
        .get('/api/v1/excursoes')
        .query({ filtro: 'rascunho' })
        .expect(200);
      expect(rascunhos.body.dados).toHaveLength(1);
    });
  });

  describe('POST /excursoes/{excursaoId}/publicar', () => {
    it('caso de borda: publicar sem nenhum ponto de embarque retorna 409 sem_ponto_embarque', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const criada = await cliente
        .post('/api/v1/excursoes')
        .send(payloadExcursao(veiculo.id))
        .expect(201);

      const resposta = await cliente
        .post(`/api/v1/excursoes/${criada.body.id}/publicar`)
        .expect(409);

      expect(resposta.body.erro.codigo).toBe('sem_ponto_embarque');
    });

    it('caminho feliz: com ao menos 1 ponto de embarque, publica e aparece em "próximas"', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const criada = await cliente
        .post('/api/v1/excursoes')
        .send(payloadExcursao(veiculo.id))
        .expect(201);

      await cliente
        .post(`/api/v1/excursoes/${criada.body.id}/pontos-embarque`)
        .send({ local: 'Praça Central', horario: '2026-12-10T07:00:00.000Z' })
        .expect(201);

      const publicada = await cliente
        .post(`/api/v1/excursoes/${criada.body.id}/publicar`)
        .expect(200);

      expect(publicada.body.status).toBe('publicada');
      expect(publicada.body.codigo_publico).toBe(criada.body.codigo_publico);

      const proximas = await cliente.get('/api/v1/excursoes').expect(200);
      expect(proximas.body.dados.map((e: { id: string }) => e.id)).toContain(criada.body.id);
    });

    it('caso de borda: publicar excursão já publicada retorna 409 transicao_invalida', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const criada = await cliente
        .post('/api/v1/excursoes')
        .send(payloadExcursao(veiculo.id))
        .expect(201);
      await cliente
        .post(`/api/v1/excursoes/${criada.body.id}/pontos-embarque`)
        .send({ local: 'Praça Central', horario: '2026-12-10T07:00:00.000Z' })
        .expect(201);
      await cliente.post(`/api/v1/excursoes/${criada.body.id}/publicar`).expect(200);

      const resposta = await cliente
        .post(`/api/v1/excursoes/${criada.body.id}/publicar`)
        .expect(409);
      expect(resposta.body.erro.codigo).toBe('transicao_invalida');
    });
  });

  describe('POST /excursoes/{excursaoId}/cancelar', () => {
    it('caso de borda: cancelar sem motivo retorna 422', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const criada = await cliente
        .post('/api/v1/excursoes')
        .send(payloadExcursao(veiculo.id))
        .expect(201);

      const resposta = await cliente
        .post(`/api/v1/excursoes/${criada.body.id}/cancelar`)
        .send({})
        .expect(422);
      expect(resposta.body.erro.codigo).toBe('validacao');
    });

    it.each(['rascunho', 'publicada'] as const)(
      'caminho feliz: cancela a partir de %s com motivo, sempre com pendencias_estorno = [] (STUB DE RESERVAS)',
      async (estadoAlvo) => {
        const cliente = await autenticarNovaOrg('A');
        const veiculo = await criarVeiculo(cliente);
        const criada = await cliente
          .post('/api/v1/excursoes')
          .send(payloadExcursao(veiculo.id))
          .expect(201);

        if (estadoAlvo === 'publicada') {
          await cliente
            .post(`/api/v1/excursoes/${criada.body.id}/pontos-embarque`)
            .send({ local: 'Praça Central', horario: '2026-12-10T07:00:00.000Z' })
            .expect(201);
          await cliente.post(`/api/v1/excursoes/${criada.body.id}/publicar`).expect(200);
        }

        const resposta = await cliente
          .post(`/api/v1/excursoes/${criada.body.id}/cancelar`)
          .send({ motivo: 'Poucos inscritos, teremos que remarcar.' })
          .expect(200);

        expect(resposta.body.excursao.status).toBe('cancelada');
        expect(resposta.body.excursao.motivo_cancelamento).toBe(
          'Poucos inscritos, teremos que remarcar.',
        );
        expect(resposta.body.pendencias_estorno).toEqual([]); // STUB DE RESERVAS
      },
    );

    it('caso de borda: cancelar excursão já cancelada retorna 409 transicao_invalida', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const criada = await cliente
        .post('/api/v1/excursoes')
        .send(payloadExcursao(veiculo.id))
        .expect(201);
      await cliente
        .post(`/api/v1/excursoes/${criada.body.id}/cancelar`)
        .send({ motivo: 'Motivo qualquer para o primeiro cancelamento.' })
        .expect(200);

      const resposta = await cliente
        .post(`/api/v1/excursoes/${criada.body.id}/cancelar`)
        .send({ motivo: 'Segunda tentativa de cancelamento.' })
        .expect(409);
      expect(resposta.body.erro.codigo).toBe('transicao_invalida');
    });
  });

  describe('DELETE /excursoes/{excursaoId}', () => {
    it('caminho feliz: exclui rascunho (204)', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const criada = await cliente
        .post('/api/v1/excursoes')
        .send(payloadExcursao(veiculo.id))
        .expect(201);

      await cliente.delete(`/api/v1/excursoes/${criada.body.id}`).expect(204);
      await cliente.get(`/api/v1/excursoes/${criada.body.id}`).expect(404);
    });

    it('caso de borda: excluir excursão publicada retorna 409 apenas_rascunho_exclui', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const criada = await cliente
        .post('/api/v1/excursoes')
        .send(payloadExcursao(veiculo.id))
        .expect(201);
      await cliente
        .post(`/api/v1/excursoes/${criada.body.id}/pontos-embarque`)
        .send({ local: 'Praça Central', horario: '2026-12-10T07:00:00.000Z' })
        .expect(201);
      await cliente.post(`/api/v1/excursoes/${criada.body.id}/publicar`).expect(200);

      const resposta = await cliente.delete(`/api/v1/excursoes/${criada.body.id}`).expect(409);
      expect(resposta.body.erro.codigo).toBe('apenas_rascunho_exclui');
    });
  });

  describe('PATCH /excursoes/{excursaoId}/checklist-legal', () => {
    it('caminho feliz: atualização parcial nunca bloqueia nenhuma ação (H3.5)', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const criada = await cliente
        .post('/api/v1/excursoes')
        .send(payloadExcursao(veiculo.id))
        .expect(201);

      const resposta = await cliente
        .patch(`/api/v1/excursoes/${criada.body.id}/checklist-legal`)
        .send({ licenca_antt: true })
        .expect(200);

      expect(resposta.body).toEqual({
        licenca_antt: true,
        seguro_passageiros: false,
        lista_impressa: false,
      });

      // Ainda em rascunho — checklist informativo não impede publicar depois de ter ponto.
      await cliente
        .post(`/api/v1/excursoes/${criada.body.id}/pontos-embarque`)
        .send({ local: 'Praça Central', horario: '2026-12-10T07:00:00.000Z' })
        .expect(201);
      await cliente.post(`/api/v1/excursoes/${criada.body.id}/publicar`).expect(200);
    });
  });

  describe('PATCH /excursoes/{excursaoId} — viabilidade (H3.4)', () => {
    it('caminho feliz: custo_total_centavos alimenta ponto_equilibrio_pagos (ceil)', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const criada = await cliente
        .post('/api/v1/excursoes')
        .send(payloadExcursao(veiculo.id, { preco_centavos: 18000 }))
        .expect(201);
      expect(criada.body.viabilidade).toBeNull();

      const atualizada = await cliente
        .patch(`/api/v1/excursoes/${criada.body.id}`)
        .send(payloadExcursao(veiculo.id, { preco_centavos: 18000, custo_total_centavos: 460000 }))
        .expect(200);

      expect(atualizada.body.viabilidade).toEqual({
        custo_total_centavos: 460000,
        ponto_equilibrio_pagos: 26,
        pagos_atuais: 0, // STUB DE RESERVAS
      });
    });
  });

  describe('isolamento multi-tenant (critério de aceite permanente do backlog)', () => {
    it('org A não lista, obtém, edita, publica nem cancela excursão da org B (sempre 404, nunca 403)', async () => {
      const clienteA = await autenticarNovaOrg('A');
      const clienteB = await autenticarNovaOrg('B');
      const veiculoB = await criarVeiculo(clienteB);

      const criadaB = await clienteB
        .post('/api/v1/excursoes')
        .send(payloadExcursao(veiculoB.id))
        .expect(201);

      const listagemA = await clienteA.get('/api/v1/excursoes').query({ filtro: 'rascunho' }).expect(200);
      expect(listagemA.body.dados).toHaveLength(0);

      await clienteA.get(`/api/v1/excursoes/${criadaB.body.id}`).expect(404);

      const respostaPatch = await clienteA
        .patch(`/api/v1/excursoes/${criadaB.body.id}`)
        .send(payloadExcursao(veiculoB.id))
        .expect(404);
      expect(respostaPatch.body.erro.codigo).toBe('nao_encontrado');

      await clienteA.post(`/api/v1/excursoes/${criadaB.body.id}/publicar`).expect(404);
      await clienteA
        .post(`/api/v1/excursoes/${criadaB.body.id}/cancelar`)
        .send({ motivo: 'Tentativa de cancelar excursão de outra organização.' })
        .expect(404);
      await clienteA.delete(`/api/v1/excursoes/${criadaB.body.id}`).expect(404);

      // Excursão da B continua intacta.
      await clienteB.get(`/api/v1/excursoes/${criadaB.body.id}`).expect(200);
    });
  });
});
