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
    const ctx = TenantContextStorage.get();
    const whatsapp = normalizarWhatsapp(whatsappBruto);
    return this.buscarPorWhatsappNormalizado(ctx.organizacaoId, whatsapp);
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
    return this.obterOuCriarPorOrganizacao(ctx.organizacaoId, nome, whatsappBruto, cpf);
  }

  /**
   * Núcleo de `obterOuCriar` com o tenant POR PARÂMETRO (ADR 008): a reserva
   * pública (H3.2) aciona a MESMA regra de "WhatsApp já cadastrado reaproveita
   * o passageiro" — o `organizacaoId` vem da excursão resolvida pelo
   * `codigo_publico`, nunca do corpo da requisição.
   *
   * `atorConfiavel` (ADR 008, segurança item 6): só o organizador autenticado
   * pode SOBRESCREVER nome/cpf de um passageiro existente. No fluxo público
   * (ator anônimo), o registro é reaproveitado sem sobrescrita — `cpf` só é
   * gravado quando o campo estava vazio e `nome` existente nunca muda; sem
   * isso, qualquer pessoa com o link que soubesse o WhatsApp de um passageiro
   * corromperia o cadastro e a lista de embarque (documento ANTT).
   */
  async obterOuCriarPorOrganizacao(
    organizacaoId: string,
    nome: string,
    whatsappBruto: string,
    cpf: string | null | undefined,
    atorConfiavel = true,
  ): Promise<PassageiroRow> {
    const whatsapp = normalizarWhatsapp(whatsappBruto);

    const existente = await this.buscarPorWhatsappNormalizado(organizacaoId, whatsapp);
    if (existente) {
      return this.atualizarSeNecessario(organizacaoId, existente, nome, cpf, atorConfiavel);
    }

    try {
      const [criado] = await this.db
        .insert(passageiro)
        .values({ organizacaoId, nome, whatsapp, cpf: cpf ?? null })
        .returning();
      return criado;
    } catch (erro) {
      // Corrida rara: duas reservas simultâneas para o mesmo WhatsApp novo
      // (a garantia de não-duplicação é do banco, não do SELECT acima).
      if (isUniqueViolation(erro, 'passageiro_org_whatsapp_uq')) {
        const reencontrado = await this.buscarPorWhatsappNormalizado(organizacaoId, whatsapp);
        if (reencontrado) {
          return this.atualizarSeNecessario(organizacaoId, reencontrado, nome, cpf, atorConfiavel);
        }
      }
      throw erro;
    }
  }

  private async atualizarSeNecessario(
    organizacaoId: string,
    atual: PassageiroRow,
    nome: string,
    cpf: string | null | undefined,
    atorConfiavel: boolean,
  ): Promise<PassageiroRow> {
    // Ator anônimo (fluxo público): nunca sobrescreve — no máximo preenche
    // `cpf` que estava vazio; divergência de nome é ignorada em silêncio.
    if (!atorConfiavel) {
      const cpfPreenchivel = atual.cpf === null && cpf != null ? cpf : null;
      if (!cpfPreenchivel) return atual;

      const [preenchido] = await this.db
        .update(passageiro)
        .set({ cpf: cpfPreenchivel, atualizadoEm: new Date() })
        .where(and(eq(passageiro.id, atual.id), eq(passageiro.organizacaoId, organizacaoId)))
        .returning();
      return preenchido;
    }

    const novoCpf = cpf === undefined ? atual.cpf : cpf;
    if (atual.nome === nome && atual.cpf === novoCpf) return atual;

    const [atualizado] = await this.db
      .update(passageiro)
      .set({ nome, cpf: novoCpf, atualizadoEm: new Date() })
      .where(and(eq(passageiro.id, atual.id), eq(passageiro.organizacaoId, organizacaoId)))
      .returning();
    return atualizado;
  }

  private async buscarPorWhatsappNormalizado(
    organizacaoId: string,
    whatsapp: string,
  ): Promise<PassageiroRow | null> {
    const [row] = await this.db
      .select()
      .from(passageiro)
      .where(and(eq(passageiro.organizacaoId, organizacaoId), eq(passageiro.whatsapp, whatsapp)))
      .limit(1);
    return row ?? null;
  }
}
