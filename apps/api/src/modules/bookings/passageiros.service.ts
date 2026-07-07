import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DATABASE_CONNECTION, type Database } from '../../db/db.provider';
import { isUniqueViolation } from '../../common/db-errors.util';
import { TenantContextStorage } from '../../common/tenant-context';
import { passageiro } from './schema';
import { normalizarWhatsapp } from './whatsapp.util';

type PassageiroRow = typeof passageiro.$inferSelect;

/**
 * Passageiro é identificado por WhatsApp dentro da organização (H1.9,
 * `passageiro_org_whatsapp_uq`). Cadastrar de novo o mesmo WhatsApp
 * REAPROVEITA o registro em vez de duplicar.
 */
@Injectable()
export class PassageirosService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async buscarPorWhatsapp(whatsappBruto: string): Promise<PassageiroRow | null> {
    const whatsapp = normalizarWhatsapp(whatsappBruto);
    return this.buscarPorWhatsappNormalizado(whatsapp);
  }

  /**
   * Cadastro rápido (H1.9): se o WhatsApp já existe nesta organização,
   * reaproveita o passageiro. DECISÃO DO backend-engineer (não há tela de
   * "editar passageiro" separada da ficha da reserva nesta fase): quando
   * nome/cpf vêm diferentes do que já está salvo, atualiza para o valor mais
   * recente informado pelo organizador — evita ficar preso a um nome digitado
   * errado da primeira vez. `cpf` só é sobrescrito quando o chamador passa um
   * valor explícito (`undefined` preserva o que já existia).
   */
  async obterOuCriar(
    nome: string,
    whatsappBruto: string,
    cpf: string | null | undefined,
  ): Promise<PassageiroRow> {
    const ctx = TenantContextStorage.get();
    const whatsapp = normalizarWhatsapp(whatsappBruto);

    const existente = await this.buscarPorWhatsappNormalizado(whatsapp);
    if (existente) {
      return this.atualizarSeNecessario(existente, nome, cpf);
    }

    try {
      const [criado] = await this.db
        .insert(passageiro)
        .values({ organizacaoId: ctx.organizacaoId, nome, whatsapp, cpf: cpf ?? null })
        .returning();
      return criado;
    } catch (erro) {
      // Corrida rara: duas reservas simultâneas para o mesmo WhatsApp novo
      // (a garantia de não-duplicação é do banco, não do SELECT acima).
      if (isUniqueViolation(erro, 'passageiro_org_whatsapp_uq')) {
        const reencontrado = await this.buscarPorWhatsappNormalizado(whatsapp);
        if (reencontrado) return this.atualizarSeNecessario(reencontrado, nome, cpf);
      }
      throw erro;
    }
  }

  private async atualizarSeNecessario(
    atual: PassageiroRow,
    nome: string,
    cpf: string | null | undefined,
  ): Promise<PassageiroRow> {
    const novoCpf = cpf === undefined ? atual.cpf : cpf;
    if (atual.nome === nome && atual.cpf === novoCpf) return atual;

    const ctx = TenantContextStorage.get();
    const [atualizado] = await this.db
      .update(passageiro)
      .set({ nome, cpf: novoCpf, atualizadoEm: new Date() })
      .where(and(eq(passageiro.id, atual.id), eq(passageiro.organizacaoId, ctx.organizacaoId)))
      .returning();
    return atualizado;
  }

  private async buscarPorWhatsappNormalizado(whatsapp: string): Promise<PassageiroRow | null> {
    const ctx = TenantContextStorage.get();
    const [row] = await this.db
      .select()
      .from(passageiro)
      .where(and(eq(passageiro.organizacaoId, ctx.organizacaoId), eq(passageiro.whatsapp, whatsapp)))
      .limit(1);
    return row ?? null;
  }
}
