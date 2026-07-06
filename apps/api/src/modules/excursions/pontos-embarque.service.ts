import { HttpStatus, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import { DATABASE_CONNECTION, type Database } from '../../db/db.provider';
import { DomainException, NaoEncontradoException } from '../../common/domain-exception';
import { TenantContextStorage } from '../../common/tenant-context';
import { pontoEmbarque } from './schema';
import { mapPontoEmbarque } from './excursions.mapper';
import { ContadorReservasService } from './contador-reservas.service';
import { ExcursionsService } from './excursions.service';
import type { PontoEmbarqueEntradaDto } from './dto/ponto-embarque-entrada.dto';

/**
 * Pontos de embarque de uma excursão (H1.6, `docs/api/excursions.yaml`).
 * `ordem` é 1..N mantida pela aplicação (comentário do schema): toda
 * inserção vai para o fim; reordenação (PUT) reescreve a partir da lista
 * completa de ids; remoção fecha o buraco renumerando os remanescentes —
 * tudo em transação.
 */
@Injectable()
export class PontosEmbarqueService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly contadorReservas: ContadorReservasService,
    private readonly excursionsService: ExcursionsService,
  ) {}

  async listar(excursaoId: string) {
    const ctx = TenantContextStorage.get();
    await this.excursionsService.buscarExcursaoOuFalhar(excursaoId);

    const linhas = await this.db
      .select()
      .from(pontoEmbarque)
      .where(
        and(eq(pontoEmbarque.organizacaoId, ctx.organizacaoId), eq(pontoEmbarque.excursaoId, excursaoId)),
      )
      .orderBy(pontoEmbarque.ordem);
    return linhas.map(mapPontoEmbarque);
  }

  async adicionar(excursaoId: string, dto: PontoEmbarqueEntradaDto) {
    const ctx = TenantContextStorage.get();
    await this.excursionsService.buscarExcursaoOuFalhar(excursaoId);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(pontoEmbarque)
      .where(
        and(eq(pontoEmbarque.organizacaoId, ctx.organizacaoId), eq(pontoEmbarque.excursaoId, excursaoId)),
      );

    const [row] = await this.db
      .insert(pontoEmbarque)
      .values({
        organizacaoId: ctx.organizacaoId,
        excursaoId,
        local: dto.local,
        horario: new Date(dto.horario),
        ordem: Number(total) + 1,
      })
      .returning();

    return mapPontoEmbarque(row);
  }

  async editar(excursaoId: string, pontoId: string, dto: PontoEmbarqueEntradaDto) {
    const ctx = TenantContextStorage.get();
    await this.excursionsService.buscarExcursaoOuFalhar(excursaoId);

    const [row] = await this.db
      .update(pontoEmbarque)
      .set({ local: dto.local, horario: new Date(dto.horario), atualizadoEm: new Date() })
      .where(
        and(
          eq(pontoEmbarque.id, pontoId),
          eq(pontoEmbarque.excursaoId, excursaoId),
          eq(pontoEmbarque.organizacaoId, ctx.organizacaoId),
        ),
      )
      .returning();
    if (!row) throw new NaoEncontradoException();
    return mapPontoEmbarque(row);
  }

  async reordenar(excursaoId: string, ordem: string[]) {
    const ctx = TenantContextStorage.get();
    await this.excursionsService.buscarExcursaoOuFalhar(excursaoId);

    const atuais = await this.db
      .select({ id: pontoEmbarque.id })
      .from(pontoEmbarque)
      .where(
        and(eq(pontoEmbarque.organizacaoId, ctx.organizacaoId), eq(pontoEmbarque.excursaoId, excursaoId)),
      );
    const idsAtuais = new Set(atuais.map((p) => p.id));
    const idsEnviados = new Set(ordem);

    const mesmoConjunto =
      idsAtuais.size === ordem.length &&
      idsEnviados.size === ordem.length &&
      [...idsAtuais].every((id) => idsEnviados.has(id));
    if (!mesmoConjunto) {
      throw new UnprocessableEntityException({
        erro: {
          codigo: 'validacao',
          mensagem:
            'A lista `ordem` deve conter exatamente todos os pontos de embarque da excursão, sem repetição.',
        },
      });
    }

    await this.db.transaction(async (tx) => {
      for (let i = 0; i < ordem.length; i++) {
        await tx
          .update(pontoEmbarque)
          .set({ ordem: i + 1, atualizadoEm: new Date() })
          .where(
            and(
              eq(pontoEmbarque.id, ordem[i]),
              eq(pontoEmbarque.organizacaoId, ctx.organizacaoId),
              eq(pontoEmbarque.excursaoId, excursaoId),
            ),
          );
      }
    });

    const linhas = await this.db
      .select()
      .from(pontoEmbarque)
      .where(
        and(eq(pontoEmbarque.organizacaoId, ctx.organizacaoId), eq(pontoEmbarque.excursaoId, excursaoId)),
      )
      .orderBy(pontoEmbarque.ordem);
    return linhas.map(mapPontoEmbarque);
  }

  async remover(excursaoId: string, pontoId: string): Promise<void> {
    const ctx = TenantContextStorage.get();
    const { row: excursaoRow } = await this.excursionsService.buscarExcursaoOuFalhar(excursaoId);

    const [ponto] = await this.db
      .select()
      .from(pontoEmbarque)
      .where(
        and(
          eq(pontoEmbarque.id, pontoId),
          eq(pontoEmbarque.excursaoId, excursaoId),
          eq(pontoEmbarque.organizacaoId, ctx.organizacaoId),
        ),
      )
      .limit(1);
    if (!ponto) throw new NaoEncontradoException();

    // Stub hoje: sempre false (ver contador-reservas.service.ts).
    if (await this.contadorReservas.pontoTemReservaVinculada(pontoId)) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'ponto_com_passageiros',
        'Realoque os passageiros deste ponto de embarque antes de removê-lo.',
      );
    }

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(pontoEmbarque)
      .where(
        and(eq(pontoEmbarque.organizacaoId, ctx.organizacaoId), eq(pontoEmbarque.excursaoId, excursaoId)),
      );

    // Checagem REAL (não depende de bookings): excursão fora de rascunho
    // nunca pode ficar com zero pontos de embarque.
    if (excursaoRow.status !== 'rascunho' && Number(total) <= 1) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'ultimo_ponto',
        'Uma excursão publicada não pode ficar sem nenhum ponto de embarque.',
      );
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(pontoEmbarque)
        .where(and(eq(pontoEmbarque.id, pontoId), eq(pontoEmbarque.organizacaoId, ctx.organizacaoId)));

      const restantes = await tx
        .select()
        .from(pontoEmbarque)
        .where(
          and(
            eq(pontoEmbarque.organizacaoId, ctx.organizacaoId),
            eq(pontoEmbarque.excursaoId, excursaoId),
          ),
        )
        .orderBy(pontoEmbarque.ordem);

      for (let i = 0; i < restantes.length; i++) {
        if (restantes[i].ordem !== i + 1) {
          await tx
            .update(pontoEmbarque)
            .set({ ordem: i + 1 })
            .where(
              and(
                eq(pontoEmbarque.id, restantes[i].id),
                eq(pontoEmbarque.organizacaoId, ctx.organizacaoId),
              ),
            );
        }
      }
    });
  }
}
