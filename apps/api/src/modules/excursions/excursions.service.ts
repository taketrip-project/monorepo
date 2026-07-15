import { HttpStatus, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, eq, gte, inArray, isNull, lt, ne } from 'drizzle-orm';
import { DATABASE_CONNECTION, type Database } from '../../db/db.provider';
import { DomainException, NaoEncontradoException } from '../../common/domain-exception';
import { isUniqueViolation } from '../../common/db-errors.util';
import { TenantContextStorage } from '../../common/tenant-context';
import { organizacao } from '../identity/schema';
import { veiculo } from '../fleet/schema';
import { excursao, fotoExcursao, pontoEmbarque } from './schema';
import { ContadorReservasService } from './contador-reservas.service';
import { ArquivoStorageService } from './storage/arquivo-storage.service';
import { gerarCodigoPublico } from './codigo-publico.util';
import { podeCancelar, podePublicar } from './estado-excursao.util';
import { calcularViabilidade } from './viabilidade.util';
import {
  type ContadoresExcursao,
  mapExcursao,
  mapExcursaoCard,
  mapFotoFactory,
  mapPontoEmbarque,
} from './excursions.mapper';
import type { CriarExcursaoDto } from './dto/criar-excursao.dto';
import type { AtualizarExcursaoDto } from './dto/atualizar-excursao.dto';
import type { FiltroExcursao } from './dto/listar-excursoes-query.dto';
import type { ChecklistLegalDto } from './dto/checklist-legal.dto';

type ExcursaoRow = typeof excursao.$inferSelect;
type VeiculoRow = typeof veiculo.$inferSelect;

/** Tentativas de gerar um `codigo_publico` sem colisão antes de desistir (evento raríssimo). */
const TENTATIVAS_CODIGO_PUBLICO = 5;

@Injectable()
export class ExcursionsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly contadorReservas: ContadorReservasService,
    private readonly storage: ArquivoStorageService,
    private readonly config: ConfigService,
  ) {}

  async listar(filtro: FiltroExcursao, pagina: number, porPagina: number) {
    const ctx = TenantContextStorage.get();
    const condicao = this.condicaoDoFiltro(filtro, ctx.organizacaoId);

    const [linhas, [{ total }]] = await Promise.all([
      this.db
        .select({ excursao, veiculo })
        .from(excursao)
        .innerJoin(veiculo, eq(veiculo.id, excursao.veiculoId))
        .where(condicao)
        .orderBy(excursao.dataSaida)
        .limit(porPagina)
        .offset((pagina - 1) * porPagina),
      this.db.select({ total: count() }).from(excursao).where(condicao),
    ]);

    const capaPorExcursao = await this.buscarFotosCapa(linhas.map((l) => l.excursao.id));

    const dados = await Promise.all(
      linhas.map(async (linha) => {
        const calc = await this.calcularContadores(
          linha.excursao.id,
          this.calcularCapacidade(linha.veiculo),
        );
        const foto = capaPorExcursao.get(linha.excursao.id) ?? null;
        return mapExcursaoCard(linha.excursao, calc, foto ? this.storage.urlPublica(foto) : null);
      }),
    );

    return { dados, paginacao: { pagina, por_pagina: porPagina, total: Number(total) } };
  }

  async obter(excursaoId: string) {
    const { row, veiculoRow } = await this.buscarExcursaoOuFalhar(excursaoId);
    return this.montarExcursaoCompleta(row, veiculoRow);
  }

  async criar(dto: CriarExcursaoDto) {
    const ctx = TenantContextStorage.get();
    this.validarCoerenciaDatas(dto.data_saida, dto.data_retorno);
    const veiculoRow = await this.buscarVeiculoOuFalhar(dto.veiculo_id);
    const { sinalTipo, sinalValor } = await this.resolverSinalEntrada(
      dto.sinal_tipo,
      dto.sinal_valor,
    );

    for (let tentativa = 0; tentativa < TENTATIVAS_CODIGO_PUBLICO; tentativa++) {
      try {
        const [row] = await this.db
          .insert(excursao)
          .values({
            organizacaoId: ctx.organizacaoId,
            veiculoId: dto.veiculo_id,
            destino: dto.destino,
            eventoAncora: dto.evento_ancora ?? null,
            dataSaida: new Date(dto.data_saida),
            dataRetorno: new Date(dto.data_retorno),
            tipo: dto.tipo,
            precoCentavos: dto.preco_centavos,
            sinalTipo,
            sinalValor,
            descricao: dto.descricao ?? null,
            codigoPublico: gerarCodigoPublico(),
          })
          .returning();
        return this.montarExcursaoCompleta(row, veiculoRow);
      } catch (erro) {
        const ultimaTentativa = tentativa === TENTATIVAS_CODIGO_PUBLICO - 1;
        if (isUniqueViolation(erro, 'excursao_codigo_publico_uq') && !ultimaTentativa) continue;
        throw erro;
      }
    }
    /* istanbul ignore next -- inatingível: o loop acima sempre retorna ou lança. */
    throw new Error('Não foi possível gerar um código público único.');
  }

  async atualizar(excursaoId: string, dto: AtualizarExcursaoDto) {
    const ctx = TenantContextStorage.get();
    this.validarCoerenciaDatas(dto.data_saida, dto.data_retorno);
    const { row: atual } = await this.buscarExcursaoOuFalhar(excursaoId);
    const novoVeiculo = await this.buscarVeiculoOuFalhar(dto.veiculo_id);

    if (dto.veiculo_id !== atual.veiculoId) {
      const poltronasValidas = this.poltronasValidas(novoVeiculo);
      const conflitantes = await this.contadorReservas.poltronasReservadasForaDoLayout(
        excursaoId,
        poltronasValidas,
      );
      if (conflitantes.length > 0) {
        throw new DomainException(
          HttpStatus.CONFLICT,
          'troca_veiculo_conflita_reservas',
          'Não é possível trocar de veículo: há reservas ativas em poltronas que não existem no novo veículo.',
          { poltronas: conflitantes },
        );
      }
    }

    const { sinalTipo, sinalValor } = await this.resolverSinalEntrada(
      dto.sinal_tipo,
      dto.sinal_valor,
    );
    const custoTotalCentavos =
      dto.custo_total_centavos === undefined ? atual.custoTotalCentavos : dto.custo_total_centavos;

    const [row] = await this.db
      .update(excursao)
      .set({
        veiculoId: dto.veiculo_id,
        destino: dto.destino,
        eventoAncora: dto.evento_ancora ?? null,
        dataSaida: new Date(dto.data_saida),
        dataRetorno: new Date(dto.data_retorno),
        tipo: dto.tipo,
        precoCentavos: dto.preco_centavos,
        sinalTipo,
        sinalValor,
        descricao: dto.descricao ?? null,
        custoTotalCentavos,
        atualizadoEm: new Date(),
      })
      .where(and(eq(excursao.id, excursaoId), eq(excursao.organizacaoId, ctx.organizacaoId)))
      .returning();
    if (!row) throw new NaoEncontradoException();

    return this.montarExcursaoCompleta(row, novoVeiculo);
  }

  async excluir(excursaoId: string): Promise<void> {
    const ctx = TenantContextStorage.get();
    const { row } = await this.buscarExcursaoOuFalhar(excursaoId);

    if (row.status !== 'rascunho') {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'apenas_rascunho_exclui',
        'Somente excursões em rascunho podem ser excluídas — excursão publicada se cancela.',
      );
    }

    const fotos = await this.db
      .select()
      .from(fotoExcursao)
      .where(
        and(eq(fotoExcursao.organizacaoId, ctx.organizacaoId), eq(fotoExcursao.excursaoId, excursaoId)),
      );

    await this.db.transaction(async (tx) => {
      await tx
        .delete(fotoExcursao)
        .where(
          and(
            eq(fotoExcursao.organizacaoId, ctx.organizacaoId),
            eq(fotoExcursao.excursaoId, excursaoId),
          ),
        );
      await tx
        .delete(pontoEmbarque)
        .where(
          and(
            eq(pontoEmbarque.organizacaoId, ctx.organizacaoId),
            eq(pontoEmbarque.excursaoId, excursaoId),
          ),
        );
      const excluida = await tx
        .delete(excursao)
        .where(and(eq(excursao.id, excursaoId), eq(excursao.organizacaoId, ctx.organizacaoId)))
        .returning({ id: excursao.id });
      if (excluida.length === 0) throw new NaoEncontradoException();
    });

    // Best-effort: a excursão já foi excluída no banco; falha ao limpar o
    // storage não deve reverter nem falhar a operação do usuário.
    await Promise.all(fotos.map((f) => this.storage.remover(f.s3Key).catch(() => undefined)));
  }

  async publicar(excursaoId: string) {
    const ctx = TenantContextStorage.get();
    const { row } = await this.buscarExcursaoOuFalhar(excursaoId);

    if (!podePublicar(row.status)) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'transicao_invalida',
        `Não é possível publicar uma excursão no estado "${row.status}".`,
      );
    }

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(pontoEmbarque)
      .where(
        and(
          eq(pontoEmbarque.organizacaoId, ctx.organizacaoId),
          eq(pontoEmbarque.excursaoId, excursaoId),
        ),
      );
    if (Number(total) === 0) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'sem_ponto_embarque',
        'Cadastre ao menos um ponto de embarque antes de publicar a excursão.',
      );
    }

    const [atualizado] = await this.db
      .update(excursao)
      .set({ status: 'publicada', publicadaEm: new Date(), atualizadoEm: new Date() })
      .where(and(eq(excursao.id, excursaoId), eq(excursao.organizacaoId, ctx.organizacaoId)))
      .returning();
    if (!atualizado) throw new NaoEncontradoException();

    const veiculoRow = await this.buscarVeiculoOuFalhar(atualizado.veiculoId);
    return this.montarExcursaoCompleta(atualizado, veiculoRow);
  }

  async cancelar(excursaoId: string, motivo: string) {
    const ctx = TenantContextStorage.get();
    const { row } = await this.buscarExcursaoOuFalhar(excursaoId);

    if (!podeCancelar(row.status)) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'transicao_invalida',
        `Não é possível cancelar uma excursão no estado "${row.status}".`,
      );
    }

    const [atualizado] = await this.db
      .update(excursao)
      .set({
        status: 'cancelada',
        motivoCancelamento: motivo,
        canceladaEm: new Date(),
        atualizadoEm: new Date(),
      })
      .where(and(eq(excursao.id, excursaoId), eq(excursao.organizacaoId, ctx.organizacaoId)))
      .returning();
    if (!atualizado) throw new NaoEncontradoException();

    // Stub hoje: sempre []. Quando bookings existir, registra pendência de
    // estorno por reserva já paga (ver `contador-reservas.service.ts`).
    const pendenciasEstorno = await this.contadorReservas.pendenciasEstornoAoCancelar(excursaoId);

    const veiculoRow = await this.buscarVeiculoOuFalhar(atualizado.veiculoId);
    const excursaoCompleta = await this.montarExcursaoCompleta(atualizado, veiculoRow);

    return { excursao: excursaoCompleta, pendencias_estorno: pendenciasEstorno };
  }

  async atualizarChecklist(excursaoId: string, dto: ChecklistLegalDto) {
    const ctx = TenantContextStorage.get();
    const patch: Partial<typeof excursao.$inferInsert> = { atualizadoEm: new Date() };
    if (dto.licenca_antt !== undefined) patch.checklistLicencaAntt = dto.licenca_antt;
    if (dto.seguro_passageiros !== undefined) patch.checklistSeguroPassageiros = dto.seguro_passageiros;
    if (dto.lista_impressa !== undefined) patch.checklistListaImpressa = dto.lista_impressa;

    const [row] = await this.db
      .update(excursao)
      .set(patch)
      .where(and(eq(excursao.id, excursaoId), eq(excursao.organizacaoId, ctx.organizacaoId)))
      .returning();
    if (!row) throw new NaoEncontradoException();

    return {
      licenca_antt: row.checklistLicencaAntt,
      seguro_passageiros: row.checklistSeguroPassageiros,
      lista_impressa: row.checklistListaImpressa,
    };
  }

  /**
   * `/inicio` (H1.14): próxima excursão futura, cronologicamente mais
   * próxima, que não é rascunho (H1.5: rascunho não aparece em NENHUMA
   * listagem operacional — `/inicio` é uma) nem cancelada.
   */
  async obterProximaExcursao() {
    const ctx = TenantContextStorage.get();
    const agora = new Date();

    const [linha] = await this.db
      .select({ excursao, veiculo })
      .from(excursao)
      .innerJoin(veiculo, eq(veiculo.id, excursao.veiculoId))
      .where(
        and(
          eq(excursao.organizacaoId, ctx.organizacaoId),
          ne(excursao.status, 'rascunho'),
          ne(excursao.status, 'cancelada'),
          gte(excursao.dataSaida, agora),
        ),
      )
      .orderBy(excursao.dataSaida)
      .limit(1);

    if (!linha) return null;

    const calc = await this.calcularContadores(
      linha.excursao.id,
      this.calcularCapacidade(linha.veiculo),
    );
    const capaPorExcursao = await this.buscarFotosCapa([linha.excursao.id]);
    const chaveCapa = capaPorExcursao.get(linha.excursao.id) ?? null;
    return mapExcursaoCard(linha.excursao, calc, chaveCapa ? this.storage.urlPublica(chaveCapa) : null);
  }

  // -- Helpers compartilhados com pontos-embarque/fotos ----------------------

  /** Usado por `PontosEmbarqueService`/`FotosService` só para o 404 (excursão de outro tenant). */
  async buscarExcursaoOuFalhar(excursaoId: string): Promise<{ row: ExcursaoRow; veiculoRow: VeiculoRow }> {
    const ctx = TenantContextStorage.get();
    const [linha] = await this.db
      .select({ excursao, veiculo })
      .from(excursao)
      .innerJoin(veiculo, eq(veiculo.id, excursao.veiculoId))
      .where(and(eq(excursao.id, excursaoId), eq(excursao.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!linha) throw new NaoEncontradoException();
    return { row: linha.excursao, veiculoRow: linha.veiculo };
  }

  // -- Privados ---------------------------------------------------------------

  private condicaoDoFiltro(filtro: FiltroExcursao, organizacaoId: string) {
    const escopo = eq(excursao.organizacaoId, organizacaoId);

    switch (filtro) {
      case 'rascunho':
        return and(escopo, eq(excursao.status, 'rascunho'));
      case 'concluidas':
        return and(escopo, eq(excursao.status, 'concluida'));
      case 'hoje': {
        const { inicio, fim } = this.limitesDoDiaDeHoje();
        return and(
          escopo,
          ne(excursao.status, 'rascunho'),
          ne(excursao.status, 'cancelada'),
          gte(excursao.dataSaida, inicio),
          lt(excursao.dataSaida, fim),
        );
      }
      case 'proximas':
      default: {
        const { inicio } = this.limitesDoDiaDeHoje();
        return and(
          escopo,
          ne(excursao.status, 'rascunho'),
          ne(excursao.status, 'cancelada'),
          ne(excursao.status, 'concluida'),
          gte(excursao.dataSaida, inicio),
        );
      }
    }
  }

  private limitesDoDiaDeHoje(): { inicio: Date; fim: Date } {
    const agora = new Date();
    const inicio = new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 0, 0, 0, 0),
    );
    const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
    return { inicio, fim };
  }

  private async buscarFotosCapa(excursaoIds: string[]): Promise<Map<string, string>> {
    if (excursaoIds.length === 0) return new Map();
    const ctx = TenantContextStorage.get();
    const fotos = await this.db
      .select()
      .from(fotoExcursao)
      .where(
        and(
          eq(fotoExcursao.organizacaoId, ctx.organizacaoId),
          inArray(fotoExcursao.excursaoId, excursaoIds),
          eq(fotoExcursao.ordem, 1),
        ),
      );
    return new Map(fotos.map((f) => [f.excursaoId, f.s3Key]));
  }

  private async calcularContadores(
    excursaoId: string,
    capacidade: number,
  ): Promise<ContadoresExcursao> {
    const [reservasAtivas, pagos, pendentes] = await Promise.all([
      this.contadorReservas.contarReservasAtivas(excursaoId),
      this.contadorReservas.contarPagos(excursaoId),
      this.contadorReservas.contarPendentes(excursaoId),
    ]);
    return { capacidade, vagas: Math.max(capacidade - reservasAtivas, 0), pagos, pendentes };
  }

  /** Mesma fórmula de `fleet.mapper.ts` (`mapVeiculo`): capacidade é sempre derivada. */
  private calcularCapacidade(v: VeiculoRow): number {
    return v.quantidadePoltronas - v.poltronasBloqueadas.length;
  }

  private poltronasValidas(v: VeiculoRow): number[] {
    const bloqueadas = new Set(v.poltronasBloqueadas);
    const validas: number[] = [];
    for (let p = 1; p <= v.quantidadePoltronas; p++) {
      if (!bloqueadas.has(p)) validas.push(p);
    }
    return validas;
  }

  private async buscarVeiculoOuFalhar(veiculoId: string): Promise<VeiculoRow> {
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
    if (!row) throw new NaoEncontradoException('Veículo não encontrado nesta organização.');
    return row;
  }

  /**
   * Default de sinal (H1.5): `sinal_tipo` default `percentual`; `sinal_valor`
   * omitido herda `organizacao.sinal_default_percentual` quando percentual —
   * quando `fixo`, não há default monetário razoável, então é obrigatório.
   */
  private async resolverSinalEntrada(
    sinalTipoInput: 'percentual' | 'fixo' | undefined,
    sinalValorInput: number | undefined,
  ): Promise<{ sinalTipo: 'percentual' | 'fixo'; sinalValor: number }> {
    const sinalTipo = sinalTipoInput ?? 'percentual';

    if (sinalValorInput !== undefined) {
      return { sinalTipo, sinalValor: sinalValorInput };
    }

    if (sinalTipo === 'fixo') {
      throw new UnprocessableEntityException({
        erro: {
          codigo: 'validacao',
          mensagem: 'sinal_valor é obrigatório quando sinal_tipo é "fixo".',
          detalhes: {
            campos: [
              {
                campo: 'sinal_valor',
                mensagens: ['sinal_valor é obrigatório quando sinal_tipo é "fixo".'],
              },
            ],
          },
        },
      });
    }

    const ctx = TenantContextStorage.get();
    const [org] = await this.db
      .select({ sinalDefaultPercentual: organizacao.sinalDefaultPercentual })
      .from(organizacao)
      .where(eq(organizacao.id, ctx.organizacaoId))
      .limit(1);

    return { sinalTipo, sinalValor: org?.sinalDefaultPercentual ?? 50 };
  }

  /**
   * Coerência entre as datas (H1.5, NB-4 do QA): retorno anterior à saída é
   * dado inválido → 422 no envelope padrão de validação. Igualdade é aceita
   * (bate-volta relâmpago com horários no mesmo instante não é incoerência
   * de ordem). Regra cross-field vive no service, como as demais regras de
   * negócio (mesmo padrão de `resolverSinalEntrada`).
   */
  private validarCoerenciaDatas(dataSaida: string, dataRetorno: string): void {
    if (new Date(dataRetorno).getTime() < new Date(dataSaida).getTime()) {
      const mensagem = 'A data de retorno não pode ser anterior à data de saída.';
      throw new UnprocessableEntityException({
        erro: {
          codigo: 'validacao',
          mensagem,
          detalhes: { campos: [{ campo: 'data_retorno', mensagens: [mensagem] }] },
        },
      });
    }
  }

  private urlPublicaBase(): string {
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    // Convenção do link compartilhável da página pública (H3.1): `/e/{codigo}`
    // no app web. A rota em si é do frontend, ainda não implementada nesta
    // fase — fixada aqui como o contrato entre backend e frontend.
    return `${appUrl.replace(/\/$/, '')}/e`;
  }

  private async montarExcursaoCompleta(row: ExcursaoRow, veiculoRow: VeiculoRow) {
    const capacidade = this.calcularCapacidade(veiculoRow);
    const calc = await this.calcularContadores(row.id, capacidade);

    const [fotos, pontos] = await Promise.all([
      this.db
        .select()
        .from(fotoExcursao)
        .where(
          and(eq(fotoExcursao.organizacaoId, row.organizacaoId), eq(fotoExcursao.excursaoId, row.id)),
        )
        .orderBy(fotoExcursao.ordem),
      this.db
        .select()
        .from(pontoEmbarque)
        .where(
          and(
            eq(pontoEmbarque.organizacaoId, row.organizacaoId),
            eq(pontoEmbarque.excursaoId, row.id),
          ),
        )
        .orderBy(pontoEmbarque.ordem),
    ]);

    const fotoCapa = fotos.find((f) => f.ordem === 1) ?? null;
    const fotoCapaUrl = fotoCapa ? this.storage.urlPublica(fotoCapa.s3Key) : null;
    const viabilidade = calcularViabilidade(row.custoTotalCentavos, row.precoCentavos, calc.pagos);

    return mapExcursao(row, calc, fotoCapaUrl, {
      urlPublicaBase: this.urlPublicaBase(),
      fotos: fotos.map(mapFotoFactory(this.storage)),
      pontosEmbarque: pontos.map(mapPontoEmbarque),
      viabilidade,
    });
  }
}
