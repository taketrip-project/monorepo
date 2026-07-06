import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, count, eq, isNull } from 'drizzle-orm';
import { DATABASE_CONNECTION, type Database } from '../../db/db.provider';
import { DomainException, NaoEncontradoException } from '../../common/domain-exception';
import { isUniqueViolation } from '../../common/db-errors.util';
import { TenantContextStorage } from '../../common/tenant-context';
import { veiculo } from './schema';
import { mapVeiculo } from './fleet.mapper';
import { gerarLayout, validarFaixaPoltronas, validarPoltronasNoLayout } from './layout.util';
import type { CriarVeiculoDto } from './dto/criar-veiculo.dto';
import type { AtualizarVeiculoDto } from './dto/atualizar-veiculo.dto';
import { VinculoExcursaoService } from './vinculo-excursao.service';

@Injectable()
export class FleetService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly vinculoExcursao: VinculoExcursaoService,
  ) {}

  async listar(pagina: number, porPagina: number) {
    const ctx = TenantContextStorage.get();
    const condicao = and(eq(veiculo.organizacaoId, ctx.organizacaoId), isNull(veiculo.excluidoEm));

    const [linhas, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(veiculo)
        .where(condicao)
        .orderBy(veiculo.criadoEm)
        .limit(porPagina)
        .offset((pagina - 1) * porPagina),
      this.db.select({ total: count() }).from(veiculo).where(condicao),
    ]);

    return {
      dados: linhas.map(mapVeiculo),
      paginacao: { pagina, por_pagina: porPagina, total: Number(total) },
    };
  }

  async obter(veiculoId: string) {
    const ctx = TenantContextStorage.get();
    const [row] = await this.db
      .select()
      .from(veiculo)
      .where(
        and(
          eq(veiculo.id, veiculoId),
          eq(veiculo.organizacaoId, ctx.organizacaoId),
          isNull(veiculo.excluidoEm),
        ),
      )
      .limit(1);
    if (!row) throw new NaoEncontradoException();
    return mapVeiculo(row);
  }

  async criar(dto: CriarVeiculoDto) {
    const ctx = TenantContextStorage.get();
    validarFaixaPoltronas(dto.tipo, dto.quantidade_poltronas);
    const layout = gerarLayout(dto.tipo, dto.quantidade_poltronas);

    try {
      const [row] = await this.db
        .insert(veiculo)
        .values({
          organizacaoId: ctx.organizacaoId,
          apelido: dto.apelido,
          placa: dto.placa,
          tipo: dto.tipo,
          quantidadePoltronas: dto.quantidade_poltronas,
          layout,
          poltronasBloqueadas: [],
        })
        .returning();
      return mapVeiculo(row);
    } catch (erro) {
      throw this.mapearErroDePlaca(erro);
    }
  }

  async atualizar(veiculoId: string, dto: AtualizarVeiculoDto) {
    const ctx = TenantContextStorage.get();

    const [atual] = await this.db
      .select()
      .from(veiculo)
      .where(
        and(
          eq(veiculo.id, veiculoId),
          eq(veiculo.organizacaoId, ctx.organizacaoId),
          isNull(veiculo.excluidoEm),
        ),
      )
      .limit(1);
    if (!atual) throw new NaoEncontradoException();

    validarFaixaPoltronas(dto.tipo, dto.quantidade_poltronas);

    const novasBloqueadas = dto.poltronas_bloqueadas ?? atual.poltronasBloqueadas;
    validarPoltronasNoLayout(novasBloqueadas, dto.quantidade_poltronas);

    if ((await this.vinculoExcursao.possuiExcursaoPublicada(veiculoId)) && !dto.confirmar) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'veiculo_em_uso_requer_confirmacao',
        'Este veículo está vinculado a uma excursão publicada. Confirme para continuar.',
      );
    }

    // Poltronas afetadas pela edição: as recém-bloqueadas + as que deixam
    // de existir por redução de quantidade_poltronas. Nenhuma delas pode
    // ter reserva ativa (H1.4: edição nunca corrompe reserva existente).
    const bloqueadasNovas = novasBloqueadas.filter(
      (p) => !atual.poltronasBloqueadas.includes(p),
    );
    const removidasPorReducao: number[] = [];
    for (let p = dto.quantidade_poltronas + 1; p <= atual.quantidadePoltronas; p++) {
      removidasPorReducao.push(p);
    }
    const poltronasAfetadas = [...new Set([...bloqueadasNovas, ...removidasPorReducao])];

    if (poltronasAfetadas.length > 0) {
      const comReserva = await this.vinculoExcursao.poltronasComReservaAtiva(
        veiculoId,
        poltronasAfetadas,
      );
      if (comReserva.length > 0) {
        throw new DomainException(
          HttpStatus.CONFLICT,
          'poltrona_com_reserva',
          'Não é possível bloquear ou remover poltronas com reserva ativa.',
          { poltronas: comReserva },
        );
      }
    }

    const layoutMudou =
      dto.tipo !== atual.tipo || dto.quantidade_poltronas !== atual.quantidadePoltronas;
    const layout = layoutMudou ? gerarLayout(dto.tipo, dto.quantidade_poltronas) : atual.layout;

    try {
      const [row] = await this.db
        .update(veiculo)
        .set({
          apelido: dto.apelido,
          placa: dto.placa,
          tipo: dto.tipo,
          quantidadePoltronas: dto.quantidade_poltronas,
          layout,
          poltronasBloqueadas: novasBloqueadas,
          atualizadoEm: new Date(),
        })
        .where(and(eq(veiculo.id, veiculoId), eq(veiculo.organizacaoId, ctx.organizacaoId)))
        .returning();
      if (!row) throw new NaoEncontradoException();
      return mapVeiculo(row);
    } catch (erro) {
      if (erro instanceof NaoEncontradoException) throw erro;
      throw this.mapearErroDePlaca(erro);
    }
  }

  async excluir(veiculoId: string, confirmar: boolean): Promise<void> {
    const ctx = TenantContextStorage.get();

    const [atual] = await this.db
      .select({ id: veiculo.id })
      .from(veiculo)
      .where(
        and(
          eq(veiculo.id, veiculoId),
          eq(veiculo.organizacaoId, ctx.organizacaoId),
          isNull(veiculo.excluidoEm),
        ),
      )
      .limit(1);
    if (!atual) throw new NaoEncontradoException();

    if (await this.vinculoExcursao.possuiExcursaoFuturaPublicada(veiculoId)) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'veiculo_com_excursao_futura',
        'Veículo vinculado a excursão futura publicada não pode ser excluído.',
      );
    }

    if ((await this.vinculoExcursao.possuiExcursaoPublicada(veiculoId)) && !confirmar) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'veiculo_em_uso_requer_confirmacao',
        'Este veículo está vinculado a uma excursão publicada. Confirme para continuar.',
      );
    }

    await this.db
      .update(veiculo)
      .set({ excluidoEm: new Date() })
      .where(and(eq(veiculo.id, veiculoId), eq(veiculo.organizacaoId, ctx.organizacaoId)));
  }

  /** Preview: gera o layout SEM salvar nada (usado pelo formulário de cadastro). */
  layoutPadrao(tipo: CriarVeiculoDto['tipo'], quantidade: number) {
    validarFaixaPoltronas(tipo, quantidade);
    return gerarLayout(tipo, quantidade);
  }

  private mapearErroDePlaca(erro: unknown): unknown {
    if (isUniqueViolation(erro, 'veiculo_org_placa_uq')) {
      return new DomainException(
        HttpStatus.CONFLICT,
        'placa_ja_cadastrada',
        'Já existe um veículo com esta placa nesta organização.',
      );
    }
    return erro;
  }
}
