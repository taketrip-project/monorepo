import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';
import { DATABASE_CONNECTION, type Database } from '../../../db/db.provider';
import { DomainException, MuitasTentativasException } from '../../../common/domain-exception';
import { isUniqueViolation } from '../../../common/db-errors.util';
import { EmailService } from '../../notifications/email/email.service';
import { convite, membro, organizacao, sessao, tokenRedefinicaoSenha } from '../schema';
import { mapMembro, mapOrganizacao } from '../identity.mapper';
import { RegistroDto } from '../dto/registro.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { EsqueciSenhaDto } from '../dto/esqueci-senha.dto';
import { RedefinirSenhaDto } from '../dto/redefinir-senha.dto';
import { AceitarConviteDto } from '../dto/aceitar-convite.dto';
import { hashSenha, verificarSenha } from './senha.util';
import { gerarTokenAleatorio, hashToken } from './token.util';
import { calcularBloqueio, segundosRestantes } from './forca-bruta.util';
import { SessaoInvalidaException, TokenInvalidoException, ConviteInvalidoException } from './exceptions';
import { TenantContextStorage } from '../../../common/tenant-context';

const ACCESS_TOKEN_TTL_SEGUNDOS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const JANELA_TOLERANCIA_CORRIDA_MS = 30 * 1000;

/** Tipo mínimo comum entre `Database` e uma transação (`tx`) do Drizzle. */
type DbOuTx = Pick<Database, 'select' | 'insert' | 'update' | 'delete'>;

interface SessaoIniciadaResponse {
  tokens: { access_token: string; refresh_token: string; expira_em_segundos: number };
  membro: ReturnType<typeof mapMembro>;
  organizacao: ReturnType<typeof mapOrganizacao>;
}

interface SessaoCriada {
  sessaoId: string;
  tokens: SessaoIniciadaResponse['tokens'];
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  async registrar(dto: RegistroDto): Promise<SessaoIniciadaResponse> {
    const email = normalizarEmail(dto.email);

    return this.db.transaction(async (tx) => {
      const [existente] = await tx
        .select({ id: membro.id })
        .from(membro)
        .where(and(eq(membro.email, email), isNull(membro.removidoEm)))
        .limit(1);

      if (existente) {
        throw emailJaCadastradoException();
      }

      const senhaHash = await hashSenha(dto.senha);

      try {
        const [org] = await tx
          .insert(organizacao)
          .values({ nome: dto.nome_organizacao })
          .returning();

        const [novoMembro] = await tx
          .insert(membro)
          .values({ organizacaoId: org.id, nome: dto.nome, email, senhaHash })
          .returning();

        const { tokens } = await this.criarSessao(tx, novoMembro);
        return { tokens, membro: mapMembro(novoMembro), organizacao: mapOrganizacao(org) };
      } catch (erro) {
        if (isUniqueViolation(erro, 'membro_email_uq')) {
          throw emailJaCadastradoException();
        }
        throw erro;
      }
    });
  }

  async login(dto: LoginDto, userAgent?: string): Promise<SessaoIniciadaResponse> {
    const email = normalizarEmail(dto.email);
    const agora = new Date();

    const [membroRow] = await this.db
      .select()
      .from(membro)
      .where(and(eq(membro.email, email), isNull(membro.removidoEm)))
      .limit(1);

    if (!membroRow) {
      // Não revela se o e-mail existe: mesma resposta de senha incorreta.
      throw credenciaisInvalidasException();
    }

    if (membroRow.bloqueadoAte && membroRow.bloqueadoAte > agora) {
      throw new MuitasTentativasException(segundosRestantes(membroRow.bloqueadoAte, agora));
    }

    const senhaOk = await verificarSenha(membroRow.senhaHash, dto.senha);

    if (!senhaOk) {
      const novasFalhas = membroRow.tentativasLoginFalhas + 1;
      const bloqueadoAte = calcularBloqueio(novasFalhas, agora);

      await this.db
        .update(membro)
        .set({ tentativasLoginFalhas: novasFalhas, bloqueadoAte, atualizadoEm: agora })
        .where(and(eq(membro.id, membroRow.id), eq(membro.organizacaoId, membroRow.organizacaoId)));

      if (bloqueadoAte) {
        throw new MuitasTentativasException(segundosRestantes(bloqueadoAte, agora));
      }
      throw credenciaisInvalidasException();
    }

    await this.db
      .update(membro)
      .set({ tentativasLoginFalhas: 0, bloqueadoAte: null, atualizadoEm: agora })
      .where(and(eq(membro.id, membroRow.id), eq(membro.organizacaoId, membroRow.organizacaoId)));

    const [org] = await this.db
      .select()
      .from(organizacao)
      .where(eq(organizacao.id, membroRow.organizacaoId))
      .limit(1);

    const { tokens } = await this.criarSessao(this.db, membroRow, userAgent);
    return { tokens, membro: mapMembro(membroRow), organizacao: mapOrganizacao(org) };
  }

  async refresh(dto: RefreshDto): Promise<SessaoIniciadaResponse['tokens']> {
    const tokenHash = hashToken(dto.refresh_token);
    const agora = new Date();

    const [sessaoRow] = await this.db
      .select()
      .from(sessao)
      .where(eq(sessao.refreshTokenHash, tokenHash))
      .limit(1);

    if (!sessaoRow || sessaoRow.expiraEm <= agora) {
      throw new SessaoInvalidaException();
    }

    if (sessaoRow.revogadaEm) {
      // A tolerância de 30s (corrida entre abas renovando ao mesmo tempo)
      // só vale quando esta sessão foi revogada por causa de uma rotação
      // legítima (substituidaPorId preenchido) — NUNCA quando foi revogada
      // por logout, redefinição de senha, remoção de membro ou pela própria
      // varredura de "roubo" abaixo. Sem essa distinção, reusar um token
      // momentos depois de um logout (por exemplo) seria tolerado como se
      // fosse uma corrida, o que reabriria a sessão que acabou de ser
      // encerrada de propósito.
      const decorridoMs = agora.getTime() - sessaoRow.revogadaEm.getTime();
      const foiRotacaoLegitima = sessaoRow.substituidaPorId !== null;

      if (!foiRotacaoLegitima || decorridoMs > JANELA_TOLERANCIA_CORRIDA_MS) {
        // Reuso de token já revogado por motivo que não é uma rotação
        // recente (ADR 004): tratado como roubo — revoga TODAS as sessões
        // do membro (não só esta, já revogada).
        await this.db
          .update(sessao)
          .set({ revogadaEm: agora })
          .where(
            and(
              eq(sessao.membroId, sessaoRow.membroId),
              eq(sessao.organizacaoId, sessaoRow.organizacaoId),
              isNull(sessao.revogadaEm),
            ),
          );
        throw new SessaoInvalidaException();
      }
      // Dentro da janela de 30s de uma rotação legítima: tolera e emite
      // mais uma rotação, sem tratar como roubo.
    }

    const [membroRow] = await this.db
      .select()
      .from(membro)
      .where(and(eq(membro.id, sessaoRow.membroId), isNull(membro.removidoEm)))
      .limit(1);

    if (!membroRow) {
      throw new SessaoInvalidaException();
    }

    const { sessaoId: novaSessaoId, tokens } = await this.criarSessao(
      this.db,
      membroRow,
      sessaoRow.userAgent ?? undefined,
    );

    if (!sessaoRow.revogadaEm) {
      // Rotação normal: revoga esta sessão e registra qual sessão nova a
      // substituiu (habilita a tolerância de corrida acima, se necessário).
      await this.db
        .update(sessao)
        .set({ revogadaEm: agora, substituidaPorId: novaSessaoId })
        .where(and(eq(sessao.id, sessaoRow.id), eq(sessao.organizacaoId, sessaoRow.organizacaoId)));
    }

    return tokens;
  }

  async logout(): Promise<void> {
    const ctx = TenantContextStorage.get();
    await this.db
      .update(sessao)
      .set({ revogadaEm: new Date() })
      .where(
        and(
          eq(sessao.id, ctx.sessaoId),
          eq(sessao.organizacaoId, ctx.organizacaoId),
          isNull(sessao.revogadaEm),
        ),
      );
  }

  async esqueciSenha(dto: EsqueciSenhaDto): Promise<void> {
    const email = normalizarEmail(dto.email);
    const [membroRow] = await this.db
      .select()
      .from(membro)
      .where(and(eq(membro.email, email), isNull(membro.removidoEm)))
      .limit(1);

    if (!membroRow) {
      // 202 sempre (contrato): não revela se o e-mail está cadastrado.
      return;
    }

    const token = gerarTokenAleatorio();
    const expiraEm = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.db.insert(tokenRedefinicaoSenha).values({
      organizacaoId: membroRow.organizacaoId,
      membroId: membroRow.id,
      tokenHash: hashToken(token),
      expiraEm,
    });

    const link = `${this.urlApp()}/redefinir-senha?token=${token}`;
    await this.emailService.enviar({
      para: membroRow.email,
      assunto: 'Redefinição de senha — Taketrip',
      corpoTexto:
        `Oi, ${membroRow.nome}! Recebemos um pedido para redefinir sua senha no Taketrip.\n\n` +
        `Clique no link abaixo (válido por 1 hora, funciona só uma vez):\n${link}\n\n` +
        `Se não foi você, pode ignorar este e-mail.`,
    });
  }

  async redefinirSenha(dto: RedefinirSenhaDto): Promise<void> {
    const tokenHash = hashToken(dto.token);
    const agora = new Date();

    const [tokenRow] = await this.db
      .select()
      .from(tokenRedefinicaoSenha)
      .where(and(eq(tokenRedefinicaoSenha.tokenHash, tokenHash), isNull(tokenRedefinicaoSenha.usadoEm)))
      .limit(1);

    if (!tokenRow || tokenRow.expiraEm <= agora) {
      throw new TokenInvalidoException();
    }

    const senhaHash = await hashSenha(dto.nova_senha);

    await this.db.transaction(async (tx) => {
      const [linhasAtualizadas] = await tx
        .update(tokenRedefinicaoSenha)
        .set({ usadoEm: agora })
        .where(
          and(
            eq(tokenRedefinicaoSenha.id, tokenRow.id),
            eq(tokenRedefinicaoSenha.organizacaoId, tokenRow.organizacaoId),
            isNull(tokenRedefinicaoSenha.usadoEm),
          ),
        )
        .returning({ id: tokenRedefinicaoSenha.id });

      if (!linhasAtualizadas) {
        // Token já foi usado em outra requisição concorrente entre a leitura
        // acima e esta transação — trata como token inválido (uso único).
        throw new TokenInvalidoException();
      }

      await tx
        .update(membro)
        .set({ senhaHash, tentativasLoginFalhas: 0, bloqueadoAte: null, atualizadoEm: agora })
        .where(and(eq(membro.id, tokenRow.membroId), eq(membro.organizacaoId, tokenRow.organizacaoId)));

      // Todas as sessões anteriores são revogadas (contrato: 204 description).
      await tx
        .update(sessao)
        .set({ revogadaEm: agora })
        .where(
          and(
            eq(sessao.membroId, tokenRow.membroId),
            eq(sessao.organizacaoId, tokenRow.organizacaoId),
            isNull(sessao.revogadaEm),
          ),
        );
    });
  }

  async aceitarConvite(dto: AceitarConviteDto): Promise<SessaoIniciadaResponse> {
    const tokenHash = hashToken(dto.token);
    const agora = new Date();

    const [conviteRow] = await this.db
      .select()
      .from(convite)
      .where(and(eq(convite.tokenHash, tokenHash), isNull(convite.aceitoEm)))
      .limit(1);

    if (!conviteRow || conviteRow.expiraEm <= agora) {
      throw new ConviteInvalidoException();
    }

    const email = normalizarEmail(conviteRow.email);
    const [existente] = await this.db
      .select({ id: membro.id })
      .from(membro)
      .where(and(eq(membro.email, email), isNull(membro.removidoEm)))
      .limit(1);

    if (existente) {
      throw emailJaCadastradoException();
    }

    return this.db.transaction(async (tx) => {
      const senhaHash = await hashSenha(dto.senha);

      try {
        const [novoMembro] = await tx
          .insert(membro)
          .values({ organizacaoId: conviteRow.organizacaoId, nome: dto.nome, email, senhaHash })
          .returning();

        const [linhasAtualizadas] = await tx
          .update(convite)
          .set({ aceitoEm: agora })
          .where(
            and(
              eq(convite.id, conviteRow.id),
              eq(convite.organizacaoId, conviteRow.organizacaoId),
              isNull(convite.aceitoEm),
            ),
          )
          .returning({ id: convite.id });

        if (!linhasAtualizadas) {
          // Convite foi aceito em outra requisição concorrente entre a
          // leitura acima e esta transação — trata como convite inválido.
          throw new ConviteInvalidoException();
        }

        const [org] = await tx
          .select()
          .from(organizacao)
          .where(eq(organizacao.id, conviteRow.organizacaoId))
          .limit(1);

        const { tokens } = await this.criarSessao(tx, novoMembro);
        return { tokens, membro: mapMembro(novoMembro), organizacao: mapOrganizacao(org) };
      } catch (erro) {
        if (isUniqueViolation(erro, 'membro_email_uq')) {
          throw emailJaCadastradoException();
        }
        throw erro;
      }
    });
  }

  private async criarSessao(
    db: DbOuTx,
    membroRow: { id: string; organizacaoId: string },
    userAgent?: string,
  ): Promise<SessaoCriada> {
    const refreshToken = gerarTokenAleatorio();
    const expiraEm = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    const [sessaoRow] = await db
      .insert(sessao)
      .values({
        organizacaoId: membroRow.organizacaoId,
        membroId: membroRow.id,
        refreshTokenHash: hashToken(refreshToken),
        expiraEm,
        userAgent,
      })
      .returning();

    const accessToken = await this.jwtService.signAsync({
      sub: membroRow.id,
      organizacaoId: membroRow.organizacaoId,
      sid: sessaoRow.id,
    });

    return {
      sessaoId: sessaoRow.id,
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expira_em_segundos: ACCESS_TOKEN_TTL_SEGUNDOS,
      },
    };
  }

  private urlApp(): string {
    return this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
  }
}

function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emailJaCadastradoException(): DomainException {
  return new DomainException(
    HttpStatus.CONFLICT,
    'email_ja_cadastrado',
    'Já existe uma conta com este e-mail.',
  );
}

function credenciaisInvalidasException(): DomainException {
  return new DomainException(
    HttpStatus.UNAUTHORIZED,
    'credenciais_invalidas',
    'E-mail ou senha incorretos.',
  );
}
