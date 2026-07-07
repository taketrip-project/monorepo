import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, inArray, notInArray } from 'drizzle-orm';
import { DATABASE_CONNECTION, type Database } from '../../db/db.provider';
import { TenantContextStorage } from '../../common/tenant-context';
import { pendenciaEstorno, reserva } from '../bookings/schema';

/**
 * Ponto de extensão para tudo que depende de RESERVA (tabela `reserva`, do
 * módulo `bookings`) dentro de `excursions` (H1.5–H1.7, `docs/api/excursions.yaml`).
 *
 * Lê `reserva`/`pendencia_estorno` diretamente via `DATABASE_CONNECTION` —
 * NUNCA através de um provider de `BookingsModule` — porque `bookings`
 * depende de `ExcursionsService` (para resolver excursão + veículo
 * escopados no tenant); se este service dependesse de volta de
 * `ReservasService`, fecharia um ciclo de módulos. O acoplamento aceitável
 * aqui é só com o SCHEMA (dado), nunca com o serviço do outro módulo.
 */
@Injectable()
export class ContadorReservasService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  /** Quantas reservas ocupam poltrona hoje (ativa + embarcada) nesta excursão. */
  async contarReservasAtivas(excursaoId: string): Promise<number> {
    const ctx = TenantContextStorage.get();
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(reserva)
      .where(
        and(
          eq(reserva.organizacaoId, ctx.organizacaoId),
          eq(reserva.excursaoId, excursaoId),
          inArray(reserva.status, ['ativa', 'embarcada']),
        ),
      );
    return Number(total);
  }

  /** Quantas reservas desta excursão estão com `status_pagamento = 'pago'`. */
  async contarPagos(excursaoId: string): Promise<number> {
    const ctx = TenantContextStorage.get();
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(reserva)
      .where(
        and(
          eq(reserva.organizacaoId, ctx.organizacaoId),
          eq(reserva.excursaoId, excursaoId),
          inArray(reserva.status, ['ativa', 'embarcada']),
          eq(reserva.statusPagamento, 'pago'),
        ),
      );
    return Number(total);
  }

  /** Quantas reservas desta excursão estão com pagamento pendente ou só o sinal pago. */
  async contarPendentes(excursaoId: string): Promise<number> {
    const ctx = TenantContextStorage.get();
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(reserva)
      .where(
        and(
          eq(reserva.organizacaoId, ctx.organizacaoId),
          eq(reserva.excursaoId, excursaoId),
          inArray(reserva.status, ['ativa', 'embarcada']),
          inArray(reserva.statusPagamento, ['pendente', 'sinal_pago']),
        ),
      );
    return Number(total);
  }

  /**
   * Dentre as reservas ativas da excursão, quais ocupam poltrona que NÃO
   * existe em `poltronasValidas` (layout do veículo candidato à troca)?
   * Retorna a sublista de números de poltrona que conflitam — vazio quando
   * nenhuma conflita (ou quando não há reserva nenhuma).
   */
  async poltronasReservadasForaDoLayout(
    excursaoId: string,
    poltronasValidas: number[],
  ): Promise<number[]> {
    const ctx = TenantContextStorage.get();
    const condicaoBase = and(
      eq(reserva.organizacaoId, ctx.organizacaoId),
      eq(reserva.excursaoId, excursaoId),
      inArray(reserva.status, ['ativa', 'embarcada']),
    );
    const linhas = await this.db
      .select({ poltrona: reserva.poltrona })
      .from(reserva)
      .where(
        poltronasValidas.length === 0
          ? condicaoBase
          : and(condicaoBase, notInArray(reserva.poltrona, poltronasValidas)),
      );
    return linhas.map((l) => l.poltrona);
  }

  /** Este ponto de embarque tem alguma reserva ativa vinculada (embarque previsto nele)? */
  async pontoTemReservaVinculada(pontoEmbarqueId: string): Promise<boolean> {
    const ctx = TenantContextStorage.get();
    const [linha] = await this.db
      .select({ id: reserva.id })
      .from(reserva)
      .where(
        and(
          eq(reserva.organizacaoId, ctx.organizacaoId),
          eq(reserva.pontoEmbarqueId, pontoEmbarqueId),
          inArray(reserva.status, ['ativa', 'embarcada']),
        ),
      )
      .limit(1);
    return !!linha;
  }

  /**
   * Ao cancelar a excursão, quais pendências de estorno nascem (reservas já
   * pagas, no todo ou no sinal)? Cria uma linha em `pendencia_estorno` por
   * reserva com `status_pagamento IN ('sinal_pago', 'pago')`, numa
   * transação própria (o chamador — `ExcursionsService.cancelar` — não
   * abre uma transação ao redor desta chamada; múltiplas pendências desta
   * mesma excursão são atômicas entre si, que é a garantia que importa aqui:
   * nunca criar metade das pendências).
   */
  async pendenciasEstornoAoCancelar(
    excursaoId: string,
  ): Promise<Array<{ id: string; reserva_id: string; valor_centavos: number }>> {
    const ctx = TenantContextStorage.get();
    return this.db.transaction(async (tx) => {
      const pagas = await tx
        .select()
        .from(reserva)
        .where(
          and(
            eq(reserva.organizacaoId, ctx.organizacaoId),
            eq(reserva.excursaoId, excursaoId),
            inArray(reserva.status, ['ativa', 'embarcada']),
            inArray(reserva.statusPagamento, ['sinal_pago', 'pago']),
          ),
        );

      const criadas: Array<{ id: string; reserva_id: string; valor_centavos: number }> = [];
      for (const r of pagas) {
        const [linha] = await tx
          .insert(pendenciaEstorno)
          .values({
            organizacaoId: ctx.organizacaoId,
            reservaId: r.id,
            valorCentavos: r.valorCentavos,
            motivo: 'Excursão cancelada com reserva já paga (integral ou sinal).',
          })
          .returning();
        criadas.push({ id: linha.id, reserva_id: linha.reservaId, valor_centavos: linha.valorCentavos });
      }
      return criadas;
    });
  }
}
