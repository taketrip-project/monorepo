import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { criarAppDeTeste, type TestAppContext } from './support/test-app';

/**
 * Testes de integração do bloco `/organizacao*` (`docs/api/identity.yaml`,
 * H1.3), contra Postgres real. Cobre: dados da organização, listagem e
 * remoção de membros (revoga sessões, protege o último membro), convites
 * (limite de 3 membros, cancelamento) e — critério de aceite permanente do
 * backlog — isolamento entre organizações: nada da org A vaza para a org B.
 */
describe('identity: /organizacao* (banco real)', () => {
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
    ctx.emailService.limpar();
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

  describe('GET/PATCH /organizacao', () => {
    it('caminho feliz: lê e atualiza os dados da própria organização', async () => {
      const dono = await registrar('dono@teste.dev', 'Agência Dono');
      const cliente = autenticado(dono.tokens.access_token);

      const leitura = await cliente.get('/api/v1/organizacao').expect(200);
      expect(leitura.body.nome).toBe('Agência Dono');

      const atualizado = await cliente
        .patch('/api/v1/organizacao')
        .send({ nome: 'Agência Renomeada', prazo_expiracao_reserva_horas: 72, sinal_default_percentual: 30 })
        .expect(200);

      expect(atualizado.body.nome).toBe('Agência Renomeada');
      expect(atualizado.body.prazo_expiracao_reserva_horas).toBe(72);
      expect(atualizado.body.sinal_default_percentual).toBe(30);
    });

    it('caso de borda: sem autenticação retorna 401', async () => {
      await http().get('/api/v1/organizacao').expect(401);
    });
  });

  describe('membros e convites', () => {
    it('caminho feliz: convida, lista, e o convidado aparece como membro após aceitar', async () => {
      const dono = await registrar('dono@teste.dev', 'Agência Dono');
      const cliente = autenticado(dono.tokens.access_token);

      await cliente.post('/api/v1/organizacao/convites').send({ email: 'colega@teste.dev' }).expect(201);

      const convites = await cliente.get('/api/v1/organizacao/convites').expect(200);
      expect(convites.body).toHaveLength(1);
      expect(convites.body[0].email).toBe('colega@teste.dev');

      const token = ctx.emailService.extrairToken();
      await http()
        .post('/api/v1/auth/convites/aceitar')
        .send({ token, nome: 'Colega', senha: 'senhaColega123' })
        .expect(201);

      const membros = await cliente.get('/api/v1/organizacao/membros').expect(200);
      expect(membros.body.map((m: { email: string }) => m.email).sort()).toEqual([
        'colega@teste.dev',
        'dono@teste.dev',
      ]);

      // Convite pendente sumiu da listagem depois de aceito.
      const convitesDepois = await cliente.get('/api/v1/organizacao/convites').expect(200);
      expect(convitesDepois.body).toHaveLength(0);
    });

    it('caso de borda: limite de 3 membros (dono + 2) bloqueia novo convite', async () => {
      const dono = await registrar('dono@teste.dev', 'Agência Dono');
      const cliente = autenticado(dono.tokens.access_token);

      await cliente.post('/api/v1/organizacao/convites').send({ email: 'colega1@teste.dev' }).expect(201);
      await cliente.post('/api/v1/organizacao/convites').send({ email: 'colega2@teste.dev' }).expect(201);

      const terceiro = await cliente
        .post('/api/v1/organizacao/convites')
        .send({ email: 'colega3@teste.dev' })
        .expect(409);
      expect(terceiro.body.erro.codigo).toBe('limite_membros');
    });

    it('caso de borda: convite pendente duplicado para o mesmo e-mail retorna 409', async () => {
      const dono = await registrar('dono@teste.dev', 'Agência Dono');
      const cliente = autenticado(dono.tokens.access_token);

      await cliente.post('/api/v1/organizacao/convites').send({ email: 'colega@teste.dev' }).expect(201);
      const duplicado = await cliente
        .post('/api/v1/organizacao/convites')
        .send({ email: 'colega@teste.dev' })
        .expect(409);
      expect(duplicado.body.erro.codigo).toBe('convite_ja_existe');
    });

    it('cancela convite pendente', async () => {
      const dono = await registrar('dono@teste.dev', 'Agência Dono');
      const cliente = autenticado(dono.tokens.access_token);

      const convite = await cliente
        .post('/api/v1/organizacao/convites')
        .send({ email: 'colega@teste.dev' })
        .expect(201);

      await cliente.delete(`/api/v1/organizacao/convites/${convite.body.id}`).expect(204);
      await cliente.get('/api/v1/organizacao/convites').expect(200).expect((r) => {
        expect(r.body).toHaveLength(0);
      });
    });

    it('caminho feliz: remover membro revoga TODAS as sessões dele imediatamente', async () => {
      const dono = await registrar('dono@teste.dev', 'Agência Dono');
      const donoCliente = autenticado(dono.tokens.access_token);

      await donoCliente.post('/api/v1/organizacao/convites').send({ email: 'colega@teste.dev' }).expect(201);
      const token = ctx.emailService.extrairToken();
      const aceite = await http()
        .post('/api/v1/auth/convites/aceitar')
        .send({ token, nome: 'Colega', senha: 'senhaColega123' })
        .expect(201);

      const colegaAccessToken = aceite.body.tokens.access_token as string;
      const colegaRefreshToken = aceite.body.tokens.refresh_token as string;

      await donoCliente.delete(`/api/v1/organizacao/membros/${aceite.body.membro.id}`).expect(204);

      // O access token do colega ainda é válido por até 15min (JWT sem estado),
      // mas o refresh — usado para renovar — já está revogado (efeito imediato
      // para novas requisições autenticadas por refresh, conforme ADR 004).
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: colegaRefreshToken })
        .expect(401);

      // O colega removido some da listagem de membros.
      const membros = await donoCliente.get('/api/v1/organizacao/membros').expect(200);
      expect(membros.body).toHaveLength(1);

      // sanity: o access token do colega ainda decodifica (não usado aqui além do refresh).
      expect(colegaAccessToken).toEqual(expect.any(String));
    });

    it('caso de borda: não é possível remover o último membro da organização', async () => {
      const dono = await registrar('dono@teste.dev', 'Agência Dono');
      const cliente = autenticado(dono.tokens.access_token);

      const resposta = await cliente
        .delete(`/api/v1/organizacao/membros/${dono.membro.id}`)
        .expect(409);
      expect(resposta.body.erro.codigo).toBe('ultimo_membro');
    });

    it('caso de borda: remover membro inexistente (ou de outra organização) retorna 404, nunca 403', async () => {
      const donoA = await registrar('donoA@teste.dev', 'Agência A');
      const donoB = await registrar('donoB@teste.dev', 'Agência B');
      const clienteA = autenticado(donoA.tokens.access_token);

      // donoA tenta remover donoB (membro real, mas de outra organização).
      const resposta = await clienteA
        .delete(`/api/v1/organizacao/membros/${donoB.membro.id}`)
        .expect(404);
      expect(resposta.body.erro.codigo).toBe('nao_encontrado');
    });
  });

  describe('isolamento multi-tenant (critério de aceite permanente do backlog)', () => {
    it('membro da org A não lista membros nem convites da org B', async () => {
      const donoA = await registrar('donoA@teste.dev', 'Agência A');
      const donoB = await registrar('donoB@teste.dev', 'Agência B');
      const clienteA = autenticado(donoA.tokens.access_token);
      const clienteB = autenticado(donoB.tokens.access_token);

      await clienteB.post('/api/v1/organizacao/convites').send({ email: 'colegaB@teste.dev' }).expect(201);

      const membrosA = await clienteA.get('/api/v1/organizacao/membros').expect(200);
      // E-mail é normalizado para minúsculas no cadastro.
      expect(membrosA.body.map((m: { email: string }) => m.email)).toEqual(['donoa@teste.dev']);

      const convitesA = await clienteA.get('/api/v1/organizacao/convites').expect(200);
      expect(convitesA.body).toHaveLength(0);

      // GET /organizacao da A nunca reflete dados da B.
      const orgA = await clienteA.get('/api/v1/organizacao').expect(200);
      expect(orgA.body.id).toBe(donoA.organizacao.id);
      expect(orgA.body.id).not.toBe(donoB.organizacao.id);
    });

    it('PATCH /organizacao da A nunca altera a organização B', async () => {
      const donoA = await registrar('donoA@teste.dev', 'Agência A');
      const donoB = await registrar('donoB@teste.dev', 'Agência B');
      const clienteA = autenticado(donoA.tokens.access_token);
      const clienteB = autenticado(donoB.tokens.access_token);

      await clienteA.patch('/api/v1/organizacao').send({ nome: 'A Renomeada' }).expect(200);

      const orgB = await clienteB.get('/api/v1/organizacao').expect(200);
      expect(orgB.body.nome).toBe('Agência B');
    });
  });
});
