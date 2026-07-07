import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, inArray } from 'drizzle-orm';
import { DATABASE_CONNECTION, type Database } from '../../db/db.provider';
import { TenantContextStorage } from '../../common/tenant-context';
import { excursao } from '../excursions/schema';
import { reserva } from '../bookings/schema';

/**
 * Ponto de extensão para as checagens de vínculo entre veículo e
 * excursões/reservas exigidas por H1.4 (`docs/api/fleet.yaml`).
 *
 * Lê `excursao`/`reserva` diretamente via `DATABASE_CONNECTION` — não
 * através de providers de `ExcursionsModule`/`BookingsModule` — para não
 * criar dependência de módulo (`fleet` é a base da pirâmide: `excursions` e
 * `bookings` dependem dele, nunca o contrário).
 */
@Injectable()
export class VinculoExcursaoService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  /** Veículo tem alguma excursão publicada vinculada (passada ou futura)? */
  async possuiExcursaoPublicada(veiculoId: string): Promise<boolean> {
    const ctx = TenantContextStorage.get();
    const [linha] = await this.db
      .select({ id: excursao.id })
      .from(excursao)
      .where(
        and(
          eq(excursao.organizacaoId, ctx.organizacaoId),
          eq(excursao.veiculoId, veiculoId),
          eq(excursao.status, 'publicada'),
        ),
      )
      .limit(1);
    return !!linha;
  }

  /** Veículo tem excursão FUTURA (`data_saida` no futuro) publicada vinculada? */
  async possuiExcursaoFuturaPublicada(veiculoId: string): Promise<boolean> {
    const ctx = TenantContextStorage.get();
    const [linha] = await this.db
      .select({ id: excursao.id })
      .from(excursao)
      .where(
        and(
          eq(excursao.organizacaoId, ctx.organizacaoId),
          eq(excursao.veiculoId, veiculoId),
          eq(excursao.status, 'publicada'),
          gte(excursao.dataSaida, new Date()),
        ),
      )
      .limit(1);
    return !!linha;
  }

  /**
   * Dentre as poltronas informadas (recém-bloqueadas ou que deixariam de
   * existir por redução de capacidade), quais têm reserva ativa hoje?
   * Retorna a sublista que conflita — vazio quando nenhuma conflita.
   */
  async poltronasComReservaAtiva(veiculoId: string, poltronas: number[]): Promise<number[]> {
    if (poltronas.length === 0) return [];
    const ctx = TenantContextStorage.get();
    const linhas = await this.db
      .select({ poltrona: reserva.poltrona })
      .from(reserva)
      .innerJoin(excursao, eq(excursao.id, reserva.excursaoId))
      .where(
        and(
          eq(reserva.organizacaoId, ctx.organizacaoId),
          eq(excursao.veiculoId, veiculoId),
          inArray(reserva.status, ['ativa', 'embarcada']),
          inArray(reserva.poltrona, poltronas),
        ),
      );
    return [...new Set(linhas.map((l) => l.poltrona))];
  }
}
