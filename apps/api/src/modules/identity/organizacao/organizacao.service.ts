import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, eq, isNull } from 'drizzle-orm';
import { DATABASE_CONNECTION, type Database } from '../../../db/db.provider';
import { DomainException, NaoEncontradoException } from '../../../common/domain-exception';
import { isUniqueViolation } from '../../../common/db-errors.util';
import { TenantContextStorage } from '../../../common/tenant-context';
import { EmailService } from '../../notifications/email/email.service';
import { convite, membro, organizacao, sessao } from '../schema';
import { mapConvite, mapMembro, mapOrganizacao } from '../identity.mapper';
import { AtualizarOrganizacaoDto } from '../dto/atualizar-organizacao.dto';
import { CriarConviteDto } from '../dto/criar-convite.dto';
import { gerarTokenAleatorio, hashToken } from '../auth/token.util';

/** Máx. de membros por organização no MVP: dono + até 2 convidados (H1.3). */
const LIMITE_MEMBROS = 3;
const CONVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class OrganizacaoService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  async obter() {
    const ctx = TenantContextStorage.get();
    const [org] = await this.db
      .select()
      .from(organizacao)
      .where(eq(organizacao.id, ctx.organizacaoId))
      .limit(1);
    if (!org) throw new NaoEncontradoException();
    return mapOrganizacao(org);
  }

  async atualizar(dto: AtualizarOrganizacaoDto) {
    const ctx = TenantContextStorage.get();
    const patch: Partial<typeof organizacao.$inferInsert> = { atualizadoEm: new Date() };
    if (dto.nome !== undefined) patch.nome = dto.nome;
    if (dto.prazo_expiracao_reserva_horas !== undefined) {
      patch.prazoExpiracaoReservaHoras = dto.prazo_expiracao_reserva_horas;
    }
    if (dto.sinal_default_percentual !== undefined) {
      patch.sinalDefaultPercentual = dto.sinal_default_percentual;
    }

    const [org] = await this.db
      .update(organizacao)
      .set(patch)
      .where(eq(organizacao.id, ctx.organizacaoId))
      .returning();
    if (!org) throw new NaoEncontradoException();
    return mapOrganizacao(org);
  }

  async listarMembros() {
    const ctx = TenantContextStorage.get();
    const linhas = await this.db
      .select()
      .from(membro)
      .where(and(eq(membro.organizacaoId, ctx.organizacaoId), isNull(membro.removidoEm)))
      .orderBy(membro.criadoEm);
    return linhas.map(mapMembro);
  }

  async removerMembro(membroId: string): Promise<void> {
    const ctx = TenantContextStorage.get();
    const agora = new Date();

    await this.db.transaction(async (tx) => {
      const [alvo] = await tx
        .select({ id: membro.id })
        .from(membro)
        .where(
          and(
            eq(membro.id, membroId),
            eq(membro.organizacaoId, ctx.organizacaoId),
            isNull(membro.removidoEm),
          ),
        )
        .limit(1);
      if (!alvo) throw new NaoEncontradoException();

      const [{ total }] = await tx
        .select({ total: count() })
        .from(membro)
        .where(and(eq(membro.organizacaoId, ctx.organizacaoId), isNull(membro.removidoEm)));

      if (Number(total) <= 1) {
        throw new DomainException(
          HttpStatus.CONFLICT,
          'ultimo_membro',
          'Não é possível remover o último membro da organização.',
        );
      }

      await tx
        .update(membro)
        .set({ removidoEm: agora, atualizadoEm: agora })
        .where(and(eq(membro.id, membroId), eq(membro.organizacaoId, ctx.organizacaoId)));

      // Revoga TODAS as sessões do membro removido, imediatamente (H1.3).
      await tx
        .update(sessao)
        .set({ revogadaEm: agora })
        .where(
          and(
            eq(sessao.membroId, membroId),
            eq(sessao.organizacaoId, ctx.organizacaoId),
            isNull(sessao.revogadaEm),
          ),
        );
    });
  }

  async listarConvites() {
    const ctx = TenantContextStorage.get();
    const linhas = await this.db
      .select()
      .from(convite)
      .where(and(eq(convite.organizacaoId, ctx.organizacaoId), isNull(convite.aceitoEm)))
      .orderBy(convite.criadoEm);
    return linhas.map(mapConvite);
  }

  async criarConvite(dto: CriarConviteDto) {
    const ctx = TenantContextStorage.get();
    const email = dto.email.trim().toLowerCase();

    const [{ totalMembros }] = await this.db
      .select({ totalMembros: count() })
      .from(membro)
      .where(and(eq(membro.organizacaoId, ctx.organizacaoId), isNull(membro.removidoEm)));

    const [{ totalConvites }] = await this.db
      .select({ totalConvites: count() })
      .from(convite)
      .where(and(eq(convite.organizacaoId, ctx.organizacaoId), isNull(convite.aceitoEm)));

    if (Number(totalMembros) + Number(totalConvites) >= LIMITE_MEMBROS) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'limite_membros',
        'Limite de membros da organização atingido (máx. 3, incluindo o dono).',
      );
    }

    const token = gerarTokenAleatorio();
    const expiraEm = new Date(Date.now() + CONVITE_TTL_MS);

    let novoConvite;
    try {
      [novoConvite] = await this.db
        .insert(convite)
        .values({
          organizacaoId: ctx.organizacaoId,
          email,
          tokenHash: hashToken(token),
          criadoPorMembroId: ctx.membroId,
          expiraEm,
        })
        .returning();
    } catch (erro) {
      if (isUniqueViolation(erro, 'convite_org_email_pendente_uq')) {
        throw new DomainException(
          HttpStatus.CONFLICT,
          'convite_ja_existe',
          'Já existe um convite pendente para este e-mail.',
        );
      }
      throw erro;
    }

    const [org] = await this.db
      .select()
      .from(organizacao)
      .where(eq(organizacao.id, ctx.organizacaoId))
      .limit(1);

    const link = `${this.urlApp()}/aceitar-convite?token=${token}`;
    await this.emailService.enviar({
      para: email,
      assunto: `Convite para ${org?.nome ?? 'uma organização'} no Taketrip`,
      corpoTexto:
        `Você foi convidado para fazer parte de ${org?.nome ?? 'uma organização'} no Taketrip.\n\n` +
        `Crie sua senha e comece: ${link}\n\nO convite expira em 7 dias.`,
    });

    return mapConvite(novoConvite);
  }

  async cancelarConvite(conviteId: string): Promise<void> {
    const ctx = TenantContextStorage.get();
    const resultado = await this.db
      .delete(convite)
      .where(and(eq(convite.id, conviteId), eq(convite.organizacaoId, ctx.organizacaoId)))
      .returning({ id: convite.id });

    if (resultado.length === 0) throw new NaoEncontradoException();
  }

  private urlApp(): string {
    return this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
  }
}
