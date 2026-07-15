import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { criarAppDeTeste, type TestAppContext } from './support/test-app';
import { hashToken } from '../../src/modules/identity/auth/token.util';
import { sessao } from '../../src/modules/identity/schema';

/**
 * Testes de integração do bloco `/auth/*` (`docs/api/identity.yaml`,
 * H1.1–H1.3), contra Postgres real. Cobre: registro cria org+membro+sessão,
 * força bruta de login (5 falhas -> 429), rotação de refresh token (revoga
 * o anterior, detecta reuso fora da janela de corrida como roubo e revoga
 * todas as sessões do membro), logout, esqueci/redefinir senha e aceitar
 * convite.
 */
describe('identity: /auth/* (banco real)', () => {
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

  async function registrar(overrides: Partial<Record<string, string>> = {}) {
    const body = {
      nome: 'Fulano de Tal',
      email: 'fulano@teste.dev',
      senha: 'senhaForte123',
      nome_organizacao: 'Agência Fulano',
      ...overrides,
    };
    const resposta = await http().post('/api/v1/auth/registro').send(body).expect(201);
    return { body, resposta };
  }

  describe('POST /auth/registro', () => {
    it('caminho feliz: cria organização, membro e sessão, e devolve tokens', async () => {
      const { resposta } = await registrar();

      expect(resposta.body.tokens.access_token).toEqual(expect.any(String));
      expect(resposta.body.tokens.refresh_token).toEqual(expect.any(String));
      expect(resposta.body.tokens.expira_em_segundos).toBe(15 * 60);
      expect(resposta.body.membro.email).toBe('fulano@teste.dev');
      expect(resposta.body.organizacao.nome).toBe('Agência Fulano');
      expect(resposta.body.organizacao.sinal_default_percentual).toBe(50);
      expect(resposta.body.organizacao.prazo_expiracao_reserva_horas).toBe(48);

      const linhas = await ctx.db.execute(
        sql`SELECT count(*)::int AS total FROM sessao WHERE organizacao_id = ${resposta.body.organizacao.id}`,
      );
      expect((linhas.rows[0] as { total: number }).total).toBe(1);
    });

    it('caso de borda: e-mail já cadastrado retorna 409 sem revelar mais nada', async () => {
      await registrar();

      const resposta = await http()
        .post('/api/v1/auth/registro')
        .send({
          nome: 'Outro',
          email: 'fulano@teste.dev',
          senha: 'outraSenha123',
          nome_organizacao: 'Outra Agência',
        })
        .expect(409);

      expect(resposta.body.erro.codigo).toBe('email_ja_cadastrado');
    });
  });

  describe('POST /auth/login', () => {
    it('caminho feliz: autentica com e-mail e senha corretos', async () => {
      await registrar();

      const resposta = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'fulano@teste.dev', senha: 'senhaForte123' })
        .expect(200);

      expect(resposta.body.tokens.access_token).toEqual(expect.any(String));
    });

    it('caso de borda: 5 tentativas erradas seguidas acionam 429 com Retry-After', async () => {
      await registrar();

      for (let i = 0; i < 4; i++) {
        await http()
          .post('/api/v1/auth/login')
          .send({ email: 'fulano@teste.dev', senha: 'senhaErrada' })
          .expect(401);
      }

      const quinta = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'fulano@teste.dev', senha: 'senhaErrada' })
        .expect(429);

      expect(quinta.body.erro.codigo).toBe('muitas_tentativas');
      expect(Number(quinta.headers['retry-after'])).toBeGreaterThanOrEqual(59);

      // Mesmo com a senha CORRETA agora, continua bloqueado (não é só "5 erradas seguidas resetam").
      const comSenhaCorreta = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'fulano@teste.dev', senha: 'senhaForte123' })
        .expect(429);
      expect(comSenhaCorreta.body.erro.codigo).toBe('muitas_tentativas');
    });

    it('e-mail inexistente responde igual a senha incorreta (não revela cadastro)', async () => {
      const resposta = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'ninguem@teste.dev', senha: 'qualquer123' })
        .expect(401);
      expect(resposta.body.erro.codigo).toBe('credenciais_invalidas');
    });
  });

  describe('POST /auth/refresh', () => {
    it('caminho feliz: rotação revoga o refresh anterior e emite um novo', async () => {
      const { resposta } = await registrar();
      const refreshAntigo = resposta.body.tokens.refresh_token as string;

      const renovado = await http()
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: refreshAntigo })
        .expect(200);

      expect(renovado.body.refresh_token).not.toBe(refreshAntigo);

      // O token antigo, já usado, não pode ser reaproveitado passada a janela de corrida.
      const [sessaoAntiga] = await ctx.db
        .select()
        .from(sessao)
        .where(sql`refresh_token_hash = ${hashToken(refreshAntigo)}`);
      expect(sessaoAntiga.revogadaEm).not.toBeNull();

      // O novo refresh funciona normalmente.
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: renovado.body.refresh_token })
        .expect(200);
    });

    it('caso de borda: reuso do refresh já revogado fora da janela de corrida é tratado como roubo e revoga TODAS as sessões do membro', async () => {
      const { resposta } = await registrar();
      const refreshOriginal = resposta.body.tokens.refresh_token as string;

      const renovado = await http()
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: refreshOriginal })
        .expect(200);
      const refreshNovo = renovado.body.refresh_token as string;

      // Simula que a revogação aconteceu há mais de 30s (fora da janela de
      // tolerância de corrida entre abas do ADR 004).
      await ctx.db.execute(
        sql`UPDATE sessao SET revogada_em = now() - interval '60 seconds' WHERE refresh_token_hash = ${hashToken(refreshOriginal)}`,
      );

      const reuso = await http()
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: refreshOriginal })
        .expect(401);
      expect(reuso.body.erro.codigo).toBe('sessao_invalida');

      // A sessão nova (fruto da primeira rotação legítima) também foi revogada:
      // "rouba a família" -> todas as sessões do membro caem.
      const comSessaoNova = await http()
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: refreshNovo })
        .expect(401);
      expect(comSessaoNova.body.erro.codigo).toBe('sessao_invalida');
    });

    it('caso de borda: reuso dentro da janela de 30s (corrida entre abas) é tolerado', async () => {
      const { resposta } = await registrar();
      const refreshOriginal = resposta.body.tokens.refresh_token as string;

      const [primeira, segunda] = await Promise.all([
        http().post('/api/v1/auth/refresh').send({ refresh_token: refreshOriginal }),
        http().post('/api/v1/auth/refresh').send({ refresh_token: refreshOriginal }),
      ]);

      expect([primeira.status, segunda.status]).toEqual([200, 200]);
      expect(primeira.body.refresh_token).not.toBe(segunda.body.refresh_token);
    });

    it('access token da sessão recém-rotacionada continua aceito na janela de corrida (requisição em voo)', async () => {
      const { resposta } = await registrar();
      const accessAntigo = resposta.body.tokens.access_token as string;
      const refreshOriginal = resposta.body.tokens.refresh_token as string;

      await http()
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: refreshOriginal })
        .expect(200);

      // O guard tolera o access token da sessão rotacionada há segundos —
      // sem isso, toda rotação derrubaria requisições em voo com 401.
      await http()
        .get('/api/v1/organizacao')
        .set('Authorization', `Bearer ${accessAntigo}`)
        .expect(200);

      // Fora da janela de 30s a tolerância acaba, mesmo com JWT ainda válido.
      await ctx.db.execute(
        sql`UPDATE sessao SET revogada_em = now() - interval '60 seconds' WHERE refresh_token_hash = ${hashToken(refreshOriginal)}`,
      );
      const foraDaJanela = await http()
        .get('/api/v1/organizacao')
        .set('Authorization', `Bearer ${accessAntigo}`)
        .expect(401);
      expect(foraDaJanela.body.erro.codigo).toBe('nao_autenticado');
    });

    it('refresh token desconhecido retorna 401 sessao_invalida', async () => {
      const resposta = await http()
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: 'token-que-nunca-existiu' })
        .expect(401);
      expect(resposta.body.erro.codigo).toBe('sessao_invalida');
    });
  });

  describe('POST /auth/logout', () => {
    it('caminho feliz: revoga a sessão atual — o refresh dela deixa de funcionar', async () => {
      const { resposta } = await registrar();
      const { access_token, refresh_token } = resposta.body.tokens;

      await http()
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(204);

      const depoisDoLogout = await http()
        .post('/api/v1/auth/refresh')
        .send({ refresh_token })
        .expect(401);
      expect(depoisDoLogout.body.erro.codigo).toBe('sessao_invalida');

      // O access token também cai NA HORA — logout revoga sem rotação
      // (`substituidaPorId` vazio), então não há janela de tolerância.
      const comAccessAntigo = await http()
        .get('/api/v1/organizacao')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(401);
      expect(comAccessAntigo.body.erro.codigo).toBe('nao_autenticado');
    });

    it('caso de borda: sem token de autenticação retorna 401', async () => {
      const resposta = await http().post('/api/v1/auth/logout').expect(401);
      expect(resposta.body.erro.codigo).toBe('nao_autenticado');
    });
  });

  describe('POST /auth/esqueci-senha e /auth/redefinir-senha', () => {
    it('esqueci-senha responde 202 tanto para e-mail existente quanto inexistente', async () => {
      await registrar();

      await http().post('/api/v1/auth/esqueci-senha').send({ email: 'fulano@teste.dev' }).expect(202);
      await http()
        .post('/api/v1/auth/esqueci-senha')
        .send({ email: 'ninguem@teste.dev' })
        .expect(202);

      // Só o e-mail existente efetivamente disparou envio.
      expect(ctx.emailService.mensagens).toHaveLength(1);
      expect(ctx.emailService.mensagens[0].para).toBe('fulano@teste.dev');
    });

    it('caminho feliz: redefine a senha com o token do e-mail, revoga sessões, e o token não serve de novo', async () => {
      const { resposta } = await registrar();
      const refreshAntigo = resposta.body.tokens.refresh_token as string;

      await http().post('/api/v1/auth/esqueci-senha').send({ email: 'fulano@teste.dev' }).expect(202);
      const token = ctx.emailService.extrairToken();

      await http()
        .post('/api/v1/auth/redefinir-senha')
        .send({ token, nova_senha: 'senhaNovaForte456' })
        .expect(204);

      // Sessões anteriores foram revogadas.
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: refreshAntigo })
        .expect(401);

      // Login com a senha antiga falha; com a nova, funciona.
      await http()
        .post('/api/v1/auth/login')
        .send({ email: 'fulano@teste.dev', senha: 'senhaForte123' })
        .expect(401);
      await http()
        .post('/api/v1/auth/login')
        .send({ email: 'fulano@teste.dev', senha: 'senhaNovaForte456' })
        .expect(200);

      // Uso único: o mesmo token não serve de novo.
      const segundaTentativa = await http()
        .post('/api/v1/auth/redefinir-senha')
        .send({ token, nova_senha: 'outraSenha789' })
        .expect(401);
      expect(segundaTentativa.body.erro.codigo).toBe('token_invalido');
    });

    it('caso de borda: token inválido/inexistente retorna 401', async () => {
      const resposta = await http()
        .post('/api/v1/auth/redefinir-senha')
        .send({ token: 'token-invalido', nova_senha: 'senhaNovaForte456' })
        .expect(401);
      expect(resposta.body.erro.codigo).toBe('token_invalido');
    });

    it('caso de borda: duas requisições concorrentes com o MESMO token — só uma prevalece (uso único atômico)', async () => {
      await registrar();

      await http().post('/api/v1/auth/esqueci-senha').send({ email: 'fulano@teste.dev' }).expect(202);
      const token = ctx.emailService.extrairToken();

      const candidatas = [
        { senha: 'senhaConcorrenteA111' },
        { senha: 'senhaConcorrenteB222' },
      ];

      const respostas = await Promise.all(
        candidatas.map(({ senha }) =>
          http().post('/api/v1/auth/redefinir-senha').send({ token, nova_senha: senha }),
        ),
      );

      // Exatamente uma das duas prevalece (204) e a outra é rejeitada como
      // token já usado (401) — nunca as duas com 204.
      const statusOrdenados = respostas.map((r) => r.status).sort((a, b) => a - b);
      expect(statusOrdenados).toEqual([204, 401]);

      const indiceVencedora = respostas.findIndex((r) => r.status === 204);
      const indicePerdedora = indiceVencedora === 0 ? 1 : 0;

      expect(respostas[indicePerdedora].body.erro.codigo).toBe('token_invalido');

      // Só a senha da requisição vencedora efetivamente valeu — a da
      // perdedora nunca foi aplicada, mesmo tendo corrido em paralelo.
      await http()
        .post('/api/v1/auth/login')
        .send({ email: 'fulano@teste.dev', senha: candidatas[indiceVencedora].senha })
        .expect(200);
      await http()
        .post('/api/v1/auth/login')
        .send({ email: 'fulano@teste.dev', senha: candidatas[indicePerdedora].senha })
        .expect(401);

      // Uso único: o token não serve mais para nenhuma tentativa futura.
      const terceiraTentativa = await http()
        .post('/api/v1/auth/redefinir-senha')
        .send({ token, nova_senha: 'senhaTerceiraTentativa789' })
        .expect(401);
      expect(terceiraTentativa.body.erro.codigo).toBe('token_invalido');
    });
  });

  describe('POST /auth/convites/aceitar', () => {
    it('caminho feliz: aceita o convite, cria membro na mesma organização e autentica', async () => {
      const { resposta } = await registrar();
      const { access_token } = resposta.body.tokens;

      await http()
        .post('/api/v1/organizacao/convites')
        .set('Authorization', `Bearer ${access_token}`)
        .send({ email: 'colega@teste.dev' })
        .expect(201);

      const token = ctx.emailService.extrairToken();

      const aceite = await http()
        .post('/api/v1/auth/convites/aceitar')
        .send({ token, nome: 'Colega', senha: 'senhaColega123' })
        .expect(201);

      expect(aceite.body.membro.email).toBe('colega@teste.dev');
      expect(aceite.body.organizacao.id).toBe(resposta.body.organizacao.id);
    });

    it('caso de borda: token de convite inválido retorna 401', async () => {
      const resposta = await http()
        .post('/api/v1/auth/convites/aceitar')
        .send({ token: 'token-invalido', nome: 'Colega', senha: 'senhaColega123' })
        .expect(401);
      expect(resposta.body.erro.codigo).toBe('convite_invalido');
    });
  });
});
