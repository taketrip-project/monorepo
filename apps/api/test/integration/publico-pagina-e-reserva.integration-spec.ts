import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { criarAppDeTeste, type TestAppContext } from './support/test-app';

/**
 * Testes de integração da página pública da excursão (H3.1) e da reserva do
 * passageiro pelo link (H3.2) — `docs/api/publico.yaml`, ADR 008 — contra
 * Postgres real: lookup por `codigo_publico` com 404 idêntico (anti-
 * enumeração), mapa reduzido sem dado de passageiro, reserva pública com
 * valor calculado NO SERVIDOR, poltrona única na UNIQUE do banco,
 * reaproveitamento de passageiro por WhatsApp, situação por `reservaId`
 * (token de posse) e isolamento entre tenants.
 *
 * O rate limit público fica desligado aqui (todas as requisições saem do
 * mesmo IP do supertest) — coberto à parte em
 * `publico-rate-limit.integration-spec.ts`.
 */
describe('publico: página da excursão e reserva do passageiro (banco real)', () => {
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
        evento_ancora: 'Réveillon',
        data_saida: '2026-12-10T08:00:00.000Z',
        data_retorno: '2026-12-10T20:00:00.000Z',
        tipo: 'bate_volta',
        veiculo_id: veiculoId,
        preco_centavos: precoCentavos,
      })
      .expect(201);
    return resposta.body as { id: string; codigo_publico: string };
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

  /** Van com 14 das 15 poltronas bloqueadas: capacidade 1 — uma reserva já lota. */
  async function criarVeiculoDeUmaPoltrona(cliente: ReturnType<typeof autenticado>) {
    const veiculo = await criarVeiculo(cliente, 'van', 15);
    await cliente
      .patch(`/api/v1/veiculos/${veiculo.id}`)
      .send({
        apelido: 'Van 1 poltrona',
        placa: 'LOT0001',
        tipo: 'van',
        quantidade_poltronas: 15,
        poltronas_bloqueadas: Array.from({ length: 14 }, (_, i) => i + 2),
      })
      .expect(200);
    return veiculo;
  }

  describe('GET /publico/excursoes/{codigo} — página pública (H3.1)', () => {
    it('caminho feliz: excursão publicada responde o contrato ExcursaoPublica, sem NENHUM dado de passageiro', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);

      // Uma reserva do organizador para provar que vagas são calculadas e que
      // nada do passageiro vaza na página.
      await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'Maria Silva', whatsapp: '11999998888' })
        .expect(201);

      const resposta = await http()
        .get(`/api/v1/publico/excursoes/${excursao.codigo_publico}`)
        .expect(200)
        .expect('Cache-Control', 'public, max-age=60');

      expect(resposta.body).toEqual({
        codigo: excursao.codigo_publico,
        destino: 'Praia Grande',
        evento_ancora: 'Réveillon',
        data_saida: '2026-12-10T08:00:00.000Z',
        data_retorno: '2026-12-10T20:00:00.000Z',
        tipo: 'bate_volta',
        preco_centavos: 18000,
        // Sinal default da organização: 50% de R$ 180,00.
        sinal_centavos: 9000,
        descricao: null,
        fotos: [],
        vagas: 23,
        capacidade: 24,
        aceita_reserva: true,
        organizacao_nome: 'Agência A',
        pontos_embarque: [
          { local: 'Praça Central', horario: '2026-12-10T06:00:00.000Z', ordem: 1 },
        ],
      });
      // Não expõe o UUID interno nem dados de quem já reservou.
      expect(JSON.stringify(resposta.body)).not.toContain(excursao.id);
      expect(JSON.stringify(resposta.body)).not.toContain('Maria');
    });

    it('anti-enumeração: rascunho, cancelada e código inexistente respondem o MESMO 404 excursao_indisponivel', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const rascunho = await criarExcursao(cliente, veiculo.id);
      const cancelada = await criarExcursaoPublicada(cliente, veiculo.id);
      await cliente
        .post(`/api/v1/excursoes/${cancelada.id}/cancelar`)
        .send({ motivo: 'Sem quórum' })
        .expect(200);

      const respostaRascunho = await http()
        .get(`/api/v1/publico/excursoes/${rascunho.codigo_publico}`)
        .expect(404);
      const respostaCancelada = await http()
        .get(`/api/v1/publico/excursoes/${cancelada.codigo_publico}`)
        .expect(404);
      const respostaInexistente = await http()
        .get('/api/v1/publico/excursoes/NAOEXISTE99')
        .expect(404);

      expect(respostaRascunho.body.erro.codigo).toBe('excursao_indisponivel');
      // Corpo idêntico nos três casos: nenhum sinal de que o código existe.
      expect(respostaCancelada.body).toEqual(respostaRascunho.body);
      expect(respostaInexistente.body).toEqual(respostaRascunho.body);
    });

    it('caso de borda: código digitado em minúsculas resolve a mesma excursão (normalização no lookup)', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);

      const resposta = await http()
        .get(`/api/v1/publico/excursoes/${excursao.codigo_publico.toLowerCase()}`)
        .expect(200);
      expect(resposta.body.codigo).toBe(excursao.codigo_publico);
    });

    it('caso de borda: excursão lotada continua visível (200), com vagas 0 e aceita_reserva false', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculoDeUmaPoltrona(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);
      await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'Maria', whatsapp: '11999998888' })
        .expect(201);

      const resposta = await http()
        .get(`/api/v1/publico/excursoes/${excursao.codigo_publico}`)
        .expect(200);
      expect(resposta.body.vagas).toBe(0);
      expect(resposta.body.capacidade).toBe(1);
      expect(resposta.body.aceita_reserva).toBe(false);
    });
  });

  describe('GET /publico/excursoes/{codigo}/mapa-poltronas — mapa público (H3.2)', () => {
    it('estados REDUZIDOS (livre · ocupada · bloqueada), sem nome nem reserva_id, com o mesmo layout do veículo', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente, 'van', 15);
      await cliente
        .patch(`/api/v1/veiculos/${veiculo.id}`)
        .send({
          apelido: 'Veículo de teste',
          placa: 'MAPA001',
          tipo: 'van',
          quantidade_poltronas: 15,
          poltronas_bloqueadas: [2],
        })
        .expect(200);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);
      const reserva = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'Maria Silva', whatsapp: '11999998888' })
        .expect(201);
      // Reserva paga também aparece só como "ocupada" para o público.
      await cliente
        .post(`/api/v1/reservas/${reserva.body.id}/status-pagamento`)
        .send({ status: 'pago' })
        .expect(200);

      const resposta = await http()
        .get(`/api/v1/publico/excursoes/${excursao.codigo_publico}/mapa-poltronas`)
        .expect(200);

      expect(Array.isArray(resposta.body.layout.fileiras)).toBe(true);
      expect(resposta.body.poltronas).toHaveLength(15);
      const porNumero = new Map(
        (resposta.body.poltronas as { numero: number; estado: string }[]).map((p) => [p.numero, p]),
      );
      expect(porNumero.get(1)).toEqual({ numero: 1, estado: 'ocupada' });
      expect(porNumero.get(2)).toEqual({ numero: 2, estado: 'bloqueada' });
      expect(porNumero.get(3)).toEqual({ numero: 3, estado: 'livre' });
      // Nunca pendente/pago, nunca nome de passageiro.
      expect(JSON.stringify(resposta.body)).not.toContain('Maria');
      expect(JSON.stringify(resposta.body)).not.toContain('pago');
    });

    it('caso de borda: excursão em rascunho responde o mesmo 404 excursao_indisponivel da página', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const rascunho = await criarExcursao(cliente, veiculo.id);

      const resposta = await http()
        .get(`/api/v1/publico/excursoes/${rascunho.codigo_publico}/mapa-poltronas`)
        .expect(404);
      expect(resposta.body.erro.codigo).toBe('excursao_indisponivel');
    });
  });

  describe('POST /publico/excursoes/{codigo}/reservas — reserva do passageiro (H3.2)', () => {
    it('caminho feliz (sinal): nasce ativa/pendente com origem pagina_publica e valor do SINAL calculado no servidor', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);

      const resposta = await http()
        .post(`/api/v1/publico/excursoes/${excursao.codigo_publico}/reservas`)
        .send({
          poltrona: 5,
          nome: 'João Passageiro',
          whatsapp: '11955556666',
          tipo_pagamento: 'sinal',
        })
        .expect(201);

      expect(resposta.body).toMatchObject({
        poltrona: 5,
        status_pagamento: 'pendente',
        cobranca: null,
      });
      expect(typeof resposta.body.reserva_id).toBe('string');
      expect(resposta.body.expira_em).not.toBeNull();
      expect(resposta.body.instrucoes).toContain('combine o sinal');
      // O passageiro nunca recebe dados além do contrato (nem valor, nem ids internos).
      expect(Object.keys(resposta.body).sort()).toEqual([
        'cobranca',
        'expira_em',
        'instrucoes',
        'poltrona',
        'reserva_id',
        'status_pagamento',
      ]);

      // Do lado do organizador, a MESMA reserva: origem pagina_publica e
      // valor = sinal (50% de 18000), calculado no servidor.
      const ficha = await cliente.get(`/api/v1/reservas/${resposta.body.reserva_id}`).expect(200);
      expect(ficha.body).toMatchObject({
        status: 'ativa',
        status_pagamento: 'pendente',
        origem: 'pagina_publica',
        valor_centavos: 9000,
        forma_pagamento: null,
        poltrona: 5,
      });
      expect(ficha.body.passageiro).toMatchObject({
        nome: 'João Passageiro',
        whatsapp: '5511955556666',
      });
    });

    it('caminho feliz (integral): valor = preço cheio da excursão', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id, 17990);

      const resposta = await http()
        .post(`/api/v1/publico/excursoes/${excursao.codigo_publico}/reservas`)
        .send({ poltrona: 1, nome: 'Ana', whatsapp: '11911112222', tipo_pagamento: 'integral' })
        .expect(201);
      expect(resposta.body.instrucoes).toContain('combine o pagamento');

      const ficha = await cliente.get(`/api/v1/reservas/${resposta.body.reserva_id}`).expect(200);
      expect(ficha.body.valor_centavos).toBe(17990);
    });

    it('segurança: payload malicioso com valor_centavos/forma_pagamento no corpo é IGNORADO — o servidor manda no valor', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);

      const resposta = await http()
        .post(`/api/v1/publico/excursoes/${excursao.codigo_publico}/reservas`)
        .send({
          poltrona: 3,
          nome: 'Esperto',
          whatsapp: '11933334444',
          tipo_pagamento: 'sinal',
          valor_centavos: 1,
          forma_pagamento: 'dinheiro',
        })
        .expect(201);

      const ficha = await cliente.get(`/api/v1/reservas/${resposta.body.reserva_id}`).expect(200);
      expect(ficha.body.valor_centavos).toBe(9000);
      expect(ficha.body.forma_pagamento).toBeNull();
    });

    it('poltrona já reservada (pelo organizador ou pelo link) → 409 poltrona_ocupada com sugestões', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);
      await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'Maria', whatsapp: '11999998888' })
        .expect(201);

      const resposta = await http()
        .post(`/api/v1/publico/excursoes/${excursao.codigo_publico}/reservas`)
        .send({ poltrona: 1, nome: 'João', whatsapp: '11955556666', tipo_pagamento: 'sinal' })
        .expect(409);

      expect(resposta.body.erro.codigo).toBe('poltrona_ocupada');
      expect(resposta.body.erro.detalhes.poltronas_livres).not.toContain(1);
      expect(resposta.body.erro.detalhes.poltronas_livres.length).toBeGreaterThan(0);
    });

    it('caso de borda do QA: excursão LOTADA cai em 409 poltrona_ocupada (toda poltrona válida ocupada), não trava em outro estado', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculoDeUmaPoltrona(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);
      await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'Maria', whatsapp: '11999998888' })
        .expect(201);

      const excursaoLotada = await cliente.get(`/api/v1/excursoes/${excursao.id}`).expect(200);
      expect(excursaoLotada.body.status).toBe('lotada');

      const resposta = await http()
        .post(`/api/v1/publico/excursoes/${excursao.codigo_publico}/reservas`)
        .send({ poltrona: 1, nome: 'João', whatsapp: '11955556666', tipo_pagamento: 'sinal' })
        .expect(409);
      expect(resposta.body.erro.codigo).toBe('poltrona_ocupada');
      expect(resposta.body.erro.detalhes.poltronas_livres).toEqual([]);
    });

    it('reserva pública zera as vagas → projeta publicada → lotada, igual ao fluxo do organizador', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculoDeUmaPoltrona(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);

      await http()
        .post(`/api/v1/publico/excursoes/${excursao.codigo_publico}/reservas`)
        .send({ poltrona: 1, nome: 'João', whatsapp: '11955556666', tipo_pagamento: 'sinal' })
        .expect(201);

      const ficha = await cliente.get(`/api/v1/excursoes/${excursao.id}`).expect(200);
      expect(ficha.body.status).toBe('lotada');
    });

    it('WhatsApp repetido reaproveita o passageiro da organização (mesma regra do cadastro rápido)', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);
      const doOrganizador = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'João', whatsapp: '11955556666' })
        .expect(201);

      const daPagina = await http()
        .post(`/api/v1/publico/excursoes/${excursao.codigo_publico}/reservas`)
        .send({
          poltrona: 2,
          nome: 'João Pedro',
          whatsapp: '(11) 95555-6666',
          tipo_pagamento: 'sinal',
        })
        .expect(201);

      const ficha = await cliente.get(`/api/v1/reservas/${daPagina.body.reserva_id}`).expect(200);
      expect(ficha.body.passageiro.id).toBe(doOrganizador.body.passageiro.id);

      const linhas = await ctx.db.execute(
        sql`SELECT count(*)::int AS total FROM passageiro WHERE whatsapp = '5511955556666'`,
      );
      expect((linhas.rows[0] as { total: number }).total).toBe(1);
    });

    it('segurança (ADR 008 item 6): POST público com nome/cpf divergentes NÃO sobrescreve o passageiro existente', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);
      const doOrganizador = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'Maria Original', whatsapp: '11944443333', cpf: '39053344705' })
        .expect(201);

      // Ator anônimo tenta "renomear" a passageira e trocar o CPF dela.
      const daPagina = await http()
        .post(`/api/v1/publico/excursoes/${excursao.codigo_publico}/reservas`)
        .send({
          poltrona: 2,
          nome: 'Nome Corrompido',
          whatsapp: '11944443333',
          cpf: '11144477735',
          tipo_pagamento: 'integral',
        })
        .expect(201);

      // A reserva nasce vinculada à passageira existente...
      const ficha = await cliente.get(`/api/v1/reservas/${daPagina.body.reserva_id}`).expect(200);
      expect(ficha.body.passageiro.id).toBe(doOrganizador.body.passageiro.id);
      // ...mas nome e CPF dela ficam intactos (lista de embarque é documento ANTT).
      expect(ficha.body.passageiro.nome).toBe('Maria Original');
      expect(ficha.body.passageiro.cpf).toBe('39053344705');
    });

    it('segurança (ADR 008 item 6): fluxo público PREENCHE cpf que estava vazio, sem tocar no nome', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);
      const doOrganizador = await cliente
        .post(`/api/v1/excursoes/${excursao.id}/reservas`)
        .send({ poltrona: 1, nome: 'Carlos', whatsapp: '11922221111' })
        .expect(201);

      const daPagina = await http()
        .post(`/api/v1/publico/excursoes/${excursao.codigo_publico}/reservas`)
        .send({
          poltrona: 2,
          nome: 'Carlos Alberto',
          whatsapp: '11922221111',
          cpf: '39053344705',
          tipo_pagamento: 'sinal',
        })
        .expect(201);

      const ficha = await cliente.get(`/api/v1/reservas/${daPagina.body.reserva_id}`).expect(200);
      expect(ficha.body.passageiro.id).toBe(doOrganizador.body.passageiro.id);
      expect(ficha.body.passageiro.nome).toBe('Carlos');
      expect(ficha.body.passageiro.cpf).toBe('39053344705');
    });

    it('validação: corpo sem tipo_pagamento (ou com valor fora do enum) → 422 no envelope padrão', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);

      const semTipo = await http()
        .post(`/api/v1/publico/excursoes/${excursao.codigo_publico}/reservas`)
        .send({ poltrona: 1, nome: 'João', whatsapp: '11955556666' })
        .expect(422);
      expect(semTipo.body.erro.codigo).toBe('validacao');

      const tipoInvalido = await http()
        .post(`/api/v1/publico/excursoes/${excursao.codigo_publico}/reservas`)
        .send({ poltrona: 1, nome: 'João', whatsapp: '11955556666', tipo_pagamento: 'fiado' })
        .expect(422);
      expect(tipoInvalido.body.erro.codigo).toBe('validacao');
    });

    it('caso de borda: excursão em rascunho não aceita reserva pública — 404 indisponível antes de qualquer validação', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const rascunho = await criarExcursao(cliente, veiculo.id);

      const resposta = await http()
        .post(`/api/v1/publico/excursoes/${rascunho.codigo_publico}/reservas`)
        .send({ poltrona: 1, nome: 'João', whatsapp: '11955556666', tipo_pagamento: 'sinal' })
        .expect(404);
      expect(resposta.body.erro.codigo).toBe('excursao_indisponivel');
    });
  });

  describe('GET /publico/reservas/{reservaId} — situação para o passageiro', () => {
    it('caminho feliz: o UUID da reserva (token de posse) devolve o mínimo para a tela de confirmação', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);
      const criada = await http()
        .post(`/api/v1/publico/excursoes/${excursao.codigo_publico}/reservas`)
        .send({ poltrona: 7, nome: 'João', whatsapp: '11955556666', tipo_pagamento: 'sinal' })
        .expect(201);

      const resposta = await http()
        .get(`/api/v1/publico/reservas/${criada.body.reserva_id}`)
        .expect(200);

      expect(resposta.body).toMatchObject({
        reserva_id: criada.body.reserva_id,
        poltrona: 7,
        status: 'ativa',
        status_pagamento: 'pendente',
        destino: 'Praia Grande',
        data_saida: '2026-12-10T08:00:00.000Z',
        cobranca: null,
      });
      expect(resposta.body.expira_em).not.toBeNull();
      expect(resposta.body.instrucoes).toContain('poltrona tá guardada');
      // Nunca expõe outras reservas nem o cadastro completo do passageiro.
      expect(resposta.body.passageiro).toBeUndefined();
    });

    it('depois que o organizador confirma o pagamento, o polling reflete pago e as instruções somem', async () => {
      const cliente = await autenticarNovaOrg('A');
      const veiculo = await criarVeiculo(cliente);
      const excursao = await criarExcursaoPublicada(cliente, veiculo.id);
      const criada = await http()
        .post(`/api/v1/publico/excursoes/${excursao.codigo_publico}/reservas`)
        .send({ poltrona: 1, nome: 'João', whatsapp: '11955556666', tipo_pagamento: 'integral' })
        .expect(201);
      await cliente
        .post(`/api/v1/reservas/${criada.body.reserva_id}/status-pagamento`)
        .send({ status: 'pago' })
        .expect(200);

      const resposta = await http()
        .get(`/api/v1/publico/reservas/${criada.body.reserva_id}`)
        .expect(200);
      expect(resposta.body.status_pagamento).toBe('pago');
      expect(resposta.body.expira_em).toBeNull();
      expect(resposta.body.instrucoes).toBeNull();
    });

    it('caso de borda: reservaId inexistente → 404 nao_encontrado', async () => {
      const resposta = await http()
        .get('/api/v1/publico/reservas/019394a5-0000-7000-8000-000000000000')
        .expect(404);
      expect(resposta.body.erro.codigo).toBe('nao_encontrado');
    });

    it('caso de borda: reservaId malformado (não-UUID) responde o MESMO 404 do inexistente — contrato só tem 200/404/429', async () => {
      const resposta = await http().get('/api/v1/publico/reservas/nao-e-um-uuid').expect(404);
      expect(resposta.body.erro.codigo).toBe('nao_encontrado');
    });
  });

  describe('isolamento multi-tenant nas rotas públicas (ADR 008)', () => {
    it('o código de uma organização nunca devolve dado de outra; a reserva pública nasce SÓ no tenant dono do código', async () => {
      const clienteA = await autenticarNovaOrg('A');
      const clienteB = await autenticarNovaOrg('B');
      const veiculoA = await criarVeiculo(clienteA);
      const veiculoB = await criarVeiculo(clienteB);
      const excursaoA = await criarExcursaoPublicada(clienteA, veiculoA.id);
      await criarExcursaoPublicada(clienteB, veiculoB.id);

      // A página do código de A é da organização A.
      const pagina = await http()
        .get(`/api/v1/publico/excursoes/${excursaoA.codigo_publico}`)
        .expect(200);
      expect(pagina.body.organizacao_nome).toBe('Agência A');

      // Reserva pública pelo código de A: passageiro nasce em A, nunca em B.
      const criada = await http()
        .post(`/api/v1/publico/excursoes/${excursaoA.codigo_publico}/reservas`)
        .send({ poltrona: 1, nome: 'João', whatsapp: '11955556666', tipo_pagamento: 'sinal' })
        .expect(201);

      const buscaEmA = await clienteA.get('/api/v1/passageiros?whatsapp=11955556666').expect(200);
      expect(buscaEmA.body).toHaveLength(1);
      const buscaEmB = await clienteB.get('/api/v1/passageiros?whatsapp=11955556666').expect(200);
      expect(buscaEmB.body).toEqual([]);

      // A organização B não vê a reserva criada pelo link de A (404, nunca 403).
      const fichaEmB = await clienteB
        .get(`/api/v1/reservas/${criada.body.reserva_id}`)
        .expect(404);
      expect(fichaEmB.body.erro.codigo).toBe('nao_encontrado');
      await clienteA.get(`/api/v1/reservas/${criada.body.reserva_id}`).expect(200);

      // A situação pública resolve a organização da PRÓPRIA linha: destino de A.
      const situacao = await http()
        .get(`/api/v1/publico/reservas/${criada.body.reserva_id}`)
        .expect(200);
      expect(situacao.body.destino).toBe('Praia Grande');
    });
  });
});
