import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, count, eq, inArray, or, type SQL } from 'drizzle-orm';
import { DATABASE_CONNECTION, type Database } from '../../db/db.provider';
import { DomainException, NaoEncontradoException } from '../../common/domain-exception';
import { isUniqueViolation } from '../../common/db-errors.util';
import { TenantContextStorage } from '../../common/tenant-context';
import { organizacao } from '../identity/schema';
import { veiculo } from '../fleet/schema';
import { excursao, pontoEmbarque } from '../excursions/schema';
import { ExcursionsService } from '../excursions/excursions.service';
import { passageiro, pendenciaEstorno, reserva, type statusPagamentoEnum } from './schema';
import { PassageirosService } from './passageiros.service';
import { ListaImpressaoService, type DadosListaImpressao } from './lista-impressao.service';
import { mapReserva } from './bookings.mapper';
import { montarPoltronaMapa, poltronasLivres, type OcupacaoPoltrona } from './poltronas.util';
import {
  validarExcursaoAceitaReserva,
  validarPoltronaDoVeiculo,
  type VeiculoPoltronas,
} from './reserva-validacao.util';
import { transicaoPagamentoAvanca } from './reserva-pagamento.util';
import { condicaoNomeTolerante, buscaEhNumerica } from './busca-passageiro.util';
import type { CriarReservaDto } from './dto/criar-reserva.dto';
import type { AtualizarReservaDto } from './dto/atualizar-reserva.dto';
import type { ListarReservasQueryDto } from './dto/listar-reservas-query.dto';

type ReservaRow = typeof reserva.$inferSelect;
type PassageiroRow = typeof passageiro.$inferSelect;
type StatusPagamentoAcao = Exclude<(typeof statusPagamentoEnum.enumValues)[number], 'pendente'>;

/**
 * Regras de negócio de `bookings` (H1.8–H1.13, `docs/api/bookings.yaml`):
 * mapa de poltronas, cadastro rápido com poltrona única garantida no banco,
 * pagamento manual sem regressão, cancelamento com liberação imediata da
 * poltrona (+ reversão `lotada → publicada` na mesma transação), busca
 * tolerante a acento, embarque de 1 toque e lista imprimível para a
 * fiscalização ANTT.
 */
@Injectable()
export class ReservasService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly excursionsService: ExcursionsService,
    private readonly passageirosService: PassageirosService,
    private readonly listaImpressao: ListaImpressaoService,
  ) {}

  // -- H1.8: mapa de poltronas ------------------------------------------------

  async mapaPoltronas(excursaoId: string) {
    const ctx = TenantContextStorage.get();
    const { veiculoRow } = await this.excursionsService.buscarExcursaoOuFalhar(excursaoId);

    const ocupacoes = await this.db
      .select({
        poltrona: reserva.poltrona,
        reservaId: reserva.id,
        status: reserva.status,
        statusPagamento: reserva.statusPagamento,
        nome: passageiro.nome,
      })
      .from(reserva)
      .innerJoin(passageiro, eq(passageiro.id, reserva.passageiroId))
      .where(
        and(
          eq(reserva.organizacaoId, ctx.organizacaoId),
          eq(reserva.excursaoId, excursaoId),
          inArray(reserva.status, ['ativa', 'embarcada']),
        ),
      );

    const porPoltrona = new Map(ocupacoes.map((o) => [o.poltrona, o]));
    const bloqueadas = new Set(veiculoRow.poltronasBloqueadas);

    const poltronas = [];
    for (let numero = 1; numero <= veiculoRow.quantidadePoltronas; numero++) {
      const encontrada = porPoltrona.get(numero);
      // INVARIANTE: reserva ativa/embarcada nunca tem status_pagamento
      // "cancelado" — marcar pagamento como cancelado cancela a reserva
      // inteira (ver `marcarStatusPagamento`), então ela sai desta query.
      const ocupacao: OcupacaoPoltrona | undefined = encontrada && {
        reservaId: encontrada.reservaId,
        status: encontrada.status as 'ativa' | 'embarcada',
        statusPagamento: encontrada.statusPagamento as 'pendente' | 'sinal_pago' | 'pago',
        passageiroNome: encontrada.nome,
      };
      poltronas.push(montarPoltronaMapa(numero, bloqueadas.has(numero), ocupacao));
    }

    const capacidade = veiculoRow.quantidadePoltronas - veiculoRow.poltronasBloqueadas.length;
    const vagas = Math.max(capacidade - ocupacoes.length, 0);

    return { excursao_id: excursaoId, layout: veiculoRow.layout, poltronas, vagas, capacidade };
  }

  // -- H1.11: listar/buscar reservas ------------------------------------------

  async listarReservas(excursaoId: string, query: ListarReservasQueryDto) {
    const ctx = TenantContextStorage.get();
    await this.excursionsService.buscarExcursaoOuFalhar(excursaoId);

    const condicoes: (SQL | undefined)[] = [
      eq(reserva.organizacaoId, ctx.organizacaoId),
      eq(reserva.excursaoId, excursaoId),
    ];
    if (query.status_pagamento) {
      condicoes.push(eq(reserva.statusPagamento, query.status_pagamento));
    }
    if (query.busca) {
      const nomeCondicao = condicaoNomeTolerante(query.busca);
      condicoes.push(
        buscaEhNumerica(query.busca)
          ? or(eq(reserva.poltrona, Number(query.busca)), nomeCondicao)
          : nomeCondicao,
      );
    }
    const condicao = and(...condicoes);

    const [linhas, [{ total }]] = await Promise.all([
      this.db
        .select({ reserva, passageiro })
        .from(reserva)
        .innerJoin(passageiro, eq(passageiro.id, reserva.passageiroId))
        .where(condicao)
        .orderBy(reserva.poltrona)
        .limit(query.por_pagina)
        .offset((query.pagina - 1) * query.por_pagina),
      query.busca
        ? this.db
            .select({ total: count() })
            .from(reserva)
            .innerJoin(passageiro, eq(passageiro.id, reserva.passageiroId))
            .where(condicao)
        : this.db.select({ total: count() }).from(reserva).where(condicao),
    ]);

    return {
      dados: linhas.map((l) => mapReserva(l.reserva, l.passageiro)),
      paginacao: { pagina: query.pagina, por_pagina: query.por_pagina, total: Number(total) },
    };
  }

  // -- H1.9: cadastro rápido ---------------------------------------------------

  async criarReserva(excursaoId: string, dto: CriarReservaDto) {
    const ctx = TenantContextStorage.get();
    const { row: excursaoRow, veiculoRow } =
      await this.excursionsService.buscarExcursaoOuFalhar(excursaoId);

    validarExcursaoAceitaReserva(excursaoRow.status);
    validarPoltronaDoVeiculo(dto.poltrona, veiculoRow);
    if (dto.ponto_embarque_id) {
      await this.validarPontoEmbarque(excursaoId, dto.ponto_embarque_id);
    }

    const passageiroRow = await this.passageirosService.obterOuCriar(dto.nome, dto.whatsapp, dto.cpf);
    const valorCentavos = dto.valor_centavos ?? excursaoRow.precoCentavos;
    const expiraEm = await this.calcularExpiracao();
    const capacidade = veiculoRow.quantidadePoltronas - veiculoRow.poltronasBloqueadas.length;

    try {
      const novaReserva = await this.db.transaction(async (tx) => {
        const [criada] = await tx
          .insert(reserva)
          .values({
            organizacaoId: ctx.organizacaoId,
            excursaoId,
            passageiroId: passageiroRow.id,
            pontoEmbarqueId: dto.ponto_embarque_id ?? null,
            poltrona: dto.poltrona,
            formaPagamento: dto.forma_pagamento ?? null,
            valorCentavos,
            expiraEm,
          })
          .returning();

        // Vagas SEMPRE calculadas: se esta reserva zerou a vaga, projeta
        // `publicada → lotada` na MESMA transação (schema de excursions).
        if (excursaoRow.status === 'publicada') {
          const [{ ativas }] = await tx
            .select({ ativas: count() })
            .from(reserva)
            .where(
              and(
                eq(reserva.organizacaoId, ctx.organizacaoId),
                eq(reserva.excursaoId, excursaoId),
                inArray(reserva.status, ['ativa', 'embarcada']),
              ),
            );
          if (Number(ativas) >= capacidade) {
            await tx
              .update(excursao)
              .set({ status: 'lotada', atualizadoEm: new Date() })
              .where(and(eq(excursao.id, excursaoId), eq(excursao.organizacaoId, ctx.organizacaoId)));
          }
        }

        return criada;
      });
      return mapReserva(novaReserva, passageiroRow);
    } catch (erro) {
      if (isUniqueViolation(erro, 'reserva_excursao_poltrona_ativa_uq')) {
        const livres = await this.calcularPoltronasLivres(excursaoId, veiculoRow);
        throw new DomainException(
          HttpStatus.CONFLICT,
          'poltrona_ocupada',
          'Esta poltrona já está reservada. Escolha outra.',
          { poltronas_livres: livres },
        );
      }
      throw erro;
    }
  }

  // -- ficha da reserva ---------------------------------------------------------

  async obterReserva(reservaId: string) {
    const { reservaRow, passageiroRow } = await this.buscarReservaOuFalhar(reservaId);
    return mapReserva(reservaRow, passageiroRow);
  }

  async atualizarReserva(reservaId: string, dto: AtualizarReservaDto) {
    const ctx = TenantContextStorage.get();
    const { reservaRow: atual } = await this.buscarReservaOuFalhar(reservaId);

    let veiculoParaSugestao: VeiculoPoltronas | null = null;
    if (dto.poltrona !== undefined && dto.poltrona !== atual.poltrona) {
      const { veiculoRow } = await this.excursionsService.buscarExcursaoOuFalhar(atual.excursaoId);
      veiculoParaSugestao = veiculoRow;
      validarPoltronaDoVeiculo(dto.poltrona, veiculoRow);
    }

    if (dto.ponto_embarque_id !== undefined && dto.ponto_embarque_id !== null) {
      await this.validarPontoEmbarque(atual.excursaoId, dto.ponto_embarque_id);
    }

    const patch: Partial<typeof reserva.$inferInsert> = { atualizadoEm: new Date() };
    if (dto.poltrona !== undefined) patch.poltrona = dto.poltrona;
    if (dto.ponto_embarque_id !== undefined) patch.pontoEmbarqueId = dto.ponto_embarque_id;
    if (dto.valor_centavos !== undefined) patch.valorCentavos = dto.valor_centavos;
    if (dto.forma_pagamento !== undefined) patch.formaPagamento = dto.forma_pagamento;

    try {
      const [atualizada] = await this.db
        .update(reserva)
        .set(patch)
        .where(and(eq(reserva.id, reservaId), eq(reserva.organizacaoId, ctx.organizacaoId)))
        .returning();
      if (!atualizada) throw new NaoEncontradoException();

      // Só toca o cadastro do passageiro DEPOIS que a poltrona foi
      // confirmada — evita persistir nome/cpf quando o PATCH termina em
      // 409 por poltrona ocupada.
      if (dto.nome !== undefined || dto.cpf !== undefined) {
        const passageiroAtual = await this.buscarPassageiro(atual.passageiroId);
        await this.passageirosService.obterOuCriar(
          dto.nome ?? passageiroAtual.nome,
          passageiroAtual.whatsapp,
          dto.cpf,
        );
      }
      const passageiroFinal = await this.buscarPassageiro(atualizada.passageiroId);
      return mapReserva(atualizada, passageiroFinal);
    } catch (erro) {
      if (erro instanceof NaoEncontradoException) throw erro;
      if (isUniqueViolation(erro, 'reserva_excursao_poltrona_ativa_uq')) {
        const livres = veiculoParaSugestao
          ? await this.calcularPoltronasLivres(atual.excursaoId, veiculoParaSugestao)
          : [];
        throw new DomainException(
          HttpStatus.CONFLICT,
          'poltrona_ocupada',
          'Esta poltrona já está reservada. Escolha outra.',
          { poltronas_livres: livres },
        );
      }
      throw erro;
    }
  }

  // -- H1.10: pagamento manual ---------------------------------------------------

  async marcarStatusPagamento(reservaId: string, alvo: StatusPagamentoAcao) {
    // O mapa de poltronas (H1.8) não tem um estado "ativa + pagamento
    // cancelado" — por isso marcar pagamento como `cancelado` por este
    // endpoint tem o MESMO efeito completo de `POST /reservas/{id}/cancelar`
    // (libera poltrona, reverte lotada→publicada, registra pendência de
    // estorno se já havia pagamento). Decisão documentada no PR.
    if (alvo === 'cancelado') {
      return this.cancelarInterno(reservaId, null);
    }

    const { reservaRow: atual, passageiroRow } = await this.buscarReservaOuFalhar(reservaId);
    if (!transicaoPagamentoAvanca(atual.statusPagamento, alvo)) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'transicao_pagamento_invalida',
        `Não é possível marcar "${alvo}" a partir de "${atual.statusPagamento}".`,
      );
    }

    const ctx = TenantContextStorage.get();
    const [atualizada] = await this.db
      .update(reserva)
      // Uma vez com sinal (ou total) pago, a reserva não é mais candidata à
      // expiração automática (H2.4) — o schema documenta que o service zera
      // `expira_em` neste ponto.
      .set({ statusPagamento: alvo, expiraEm: null, atualizadoEm: new Date() })
      .where(and(eq(reserva.id, reservaId), eq(reserva.organizacaoId, ctx.organizacaoId)))
      .returning();
    if (!atualizada) throw new NaoEncontradoException();
    return mapReserva(atualizada, passageiroRow);
  }

  async cancelar(reservaId: string, motivo: string | null) {
    return this.cancelarInterno(reservaId, motivo);
  }

  private async cancelarInterno(reservaId: string, motivo: string | null) {
    const ctx = TenantContextStorage.get();
    const { reservaRow: atual, passageiroRow } = await this.buscarReservaOuFalhar(reservaId);

    if (atual.status !== 'ativa' && atual.status !== 'embarcada') {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'transicao_invalida',
        `Reserva já está "${atual.status}".`,
      );
    }

    const statusPagamentoAnterior = atual.statusPagamento;

    const atualizada = await this.db.transaction(async (tx) => {
      const [linha] = await tx
        .update(reserva)
        .set({
          status: 'cancelada',
          statusPagamento: 'cancelado',
          canceladaEm: new Date(),
          motivoCancelamento: motivo,
          atualizadoEm: new Date(),
        })
        .where(and(eq(reserva.id, reservaId), eq(reserva.organizacaoId, ctx.organizacaoId)))
        .returning();

      if (statusPagamentoAnterior === 'sinal_pago' || statusPagamentoAnterior === 'pago') {
        // Valor da pendência = `valor_centavos` da reserva, como aproximação
        // razoável do que foi efetivamente pago (documentado no PR: o MVP
        // não rastreia o valor exato pago por cobrança — isso é do módulo
        // billing, fase 2).
        await tx.insert(pendenciaEstorno).values({
          organizacaoId: ctx.organizacaoId,
          reservaId,
          valorCentavos: atual.valorCentavos,
          motivo: 'Reserva cancelada com pagamento já efetuado (sinal ou integral).',
        });
      }

      // Vagas SEMPRE calculadas: libera a poltrona na hora e reverte
      // `lotada → publicada` na MESMA transação (schema de excursions: essa
      // transição é aplicada pelo módulo bookings).
      const [{ ativas }] = await tx
        .select({ ativas: count() })
        .from(reserva)
        .where(
          and(
            eq(reserva.organizacaoId, ctx.organizacaoId),
            eq(reserva.excursaoId, atual.excursaoId),
            inArray(reserva.status, ['ativa', 'embarcada']),
          ),
        );

      const [excursaoRow] = await tx
        .select()
        .from(excursao)
        .where(and(eq(excursao.id, atual.excursaoId), eq(excursao.organizacaoId, ctx.organizacaoId)))
        .limit(1);

      if (excursaoRow && excursaoRow.status === 'lotada') {
        const [veiculoRow] = await tx
          .select()
          .from(veiculo)
          .where(eq(veiculo.id, excursaoRow.veiculoId))
          .limit(1);
        const capacidade = veiculoRow
          ? veiculoRow.quantidadePoltronas - veiculoRow.poltronasBloqueadas.length
          : 0;
        if (Number(ativas) < capacidade) {
          await tx
            .update(excursao)
            .set({ status: 'publicada', atualizadoEm: new Date() })
            .where(
              and(eq(excursao.id, atual.excursaoId), eq(excursao.organizacaoId, ctx.organizacaoId)),
            );
        }
      }

      return linha;
    });

    return mapReserva(atualizada, passageiroRow);
  }

  // -- H1.12: embarque -----------------------------------------------------------

  async marcarEmbarque(reservaId: string) {
    const ctx = TenantContextStorage.get();
    const { reservaRow: atual, passageiroRow } = await this.buscarReservaOuFalhar(reservaId);
    if (atual.status !== 'ativa') {
      throw new DomainException(HttpStatus.CONFLICT, 'transicao_invalida', 'Reserva não está ativa.');
    }
    const [atualizada] = await this.db
      .update(reserva)
      .set({ status: 'embarcada', embarcadaEm: new Date(), atualizadoEm: new Date() })
      .where(and(eq(reserva.id, reservaId), eq(reserva.organizacaoId, ctx.organizacaoId)))
      .returning();
    if (!atualizada) throw new NaoEncontradoException();
    return mapReserva(atualizada, passageiroRow);
  }

  async desfazerEmbarque(reservaId: string) {
    const ctx = TenantContextStorage.get();
    const { reservaRow: atual, passageiroRow } = await this.buscarReservaOuFalhar(reservaId);
    if (atual.status !== 'embarcada') {
      // Idempotente: contrato não documenta 409 para o DELETE, e "1 toque no
      // mesmo lugar desfaz" não deve travar numa corrida de duplo toque.
      return mapReserva(atual, passageiroRow);
    }
    const [atualizada] = await this.db
      .update(reserva)
      .set({ status: 'ativa', embarcadaEm: null, atualizadoEm: new Date() })
      .where(and(eq(reserva.id, reservaId), eq(reserva.organizacaoId, ctx.organizacaoId)))
      .returning();
    if (!atualizada) throw new NaoEncontradoException();
    return mapReserva(atualizada, passageiroRow);
  }

  async listaEmbarque(excursaoId: string) {
    const ctx = TenantContextStorage.get();
    await this.excursionsService.buscarExcursaoOuFalhar(excursaoId);

    const [pontos, linhas] = await Promise.all([
      this.db
        .select()
        .from(pontoEmbarque)
        .where(
          and(eq(pontoEmbarque.organizacaoId, ctx.organizacaoId), eq(pontoEmbarque.excursaoId, excursaoId)),
        )
        .orderBy(pontoEmbarque.ordem),
      this.db
        .select({ reserva, passageiro })
        .from(reserva)
        .innerJoin(passageiro, eq(passageiro.id, reserva.passageiroId))
        .where(
          and(
            eq(reserva.organizacaoId, ctx.organizacaoId),
            eq(reserva.excursaoId, excursaoId),
            inArray(reserva.status, ['ativa', 'embarcada']),
          ),
        )
        .orderBy(reserva.poltrona),
    ]);

    const total = linhas.length;
    const embarcados = linhas.filter((l) => l.reserva.status === 'embarcada').length;

    // Reserva sem ponto de embarque (campo opcional no cadastro rápido) não
    // entra em nenhum grupo abaixo, mas já conta no KPI acima — decisão
    // documentada no PR (o contrato não define um grupo "sem ponto").
    const grupos = pontos.map((ponto) => ({
      ponto_embarque: {
        id: ponto.id,
        local: ponto.local,
        horario: ponto.horario.toISOString(),
        ordem: ponto.ordem,
      },
      passageiros: linhas
        .filter((l) => l.reserva.pontoEmbarqueId === ponto.id)
        .map((l) => ({
          reserva_id: l.reserva.id,
          nome: l.passageiro.nome,
          poltrona: l.reserva.poltrona,
          embarcada: l.reserva.status === 'embarcada',
          embarcada_em: l.reserva.embarcadaEm ? l.reserva.embarcadaEm.toISOString() : null,
        })),
    }));

    return { excursao_id: excursaoId, embarcados, total, grupos };
  }

  // -- H1.13: lista imprimível -----------------------------------------------------

  async listaPassageirosImpressao(
    excursaoId: string,
    formato: 'pdf' | 'html',
  ): Promise<{ contentType: string; conteudo: string | Buffer }> {
    const ctx = TenantContextStorage.get();
    const { row: excursaoRow, veiculoRow } =
      await this.excursionsService.buscarExcursaoOuFalhar(excursaoId);

    const linhas = await this.db
      .select({ reserva, passageiro })
      .from(reserva)
      .innerJoin(passageiro, eq(passageiro.id, reserva.passageiroId))
      .where(
        and(
          eq(reserva.organizacaoId, ctx.organizacaoId),
          eq(reserva.excursaoId, excursaoId),
          inArray(reserva.status, ['ativa', 'embarcada']),
        ),
      )
      .orderBy(reserva.poltrona);

    const dados: DadosListaImpressao = {
      destino: excursaoRow.destino,
      dataSaida: excursaoRow.dataSaida,
      veiculoApelido: veiculoRow.apelido,
      veiculoPlaca: veiculoRow.placa,
      // CPF nunca bloqueia: passageiro sem CPF sai só com o nome (H1.13).
      passageiros: linhas.map((l) => ({
        poltrona: l.reserva.poltrona,
        nome: l.passageiro.nome,
        cpf: l.passageiro.cpf,
      })),
    };

    if (formato === 'html') {
      return { contentType: 'text/html; charset=utf-8', conteudo: this.listaImpressao.gerarHtml(dados) };
    }
    return { contentType: 'application/pdf', conteudo: await this.listaImpressao.gerarPdf(dados) };
  }

  // -- privados -----------------------------------------------------------------

  private async buscarReservaOuFalhar(
    reservaId: string,
  ): Promise<{ reservaRow: ReservaRow; passageiroRow: PassageiroRow }> {
    const ctx = TenantContextStorage.get();
    const [linha] = await this.db
      .select({ reserva, passageiro })
      .from(reserva)
      .innerJoin(passageiro, eq(passageiro.id, reserva.passageiroId))
      .where(and(eq(reserva.id, reservaId), eq(reserva.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!linha) throw new NaoEncontradoException();
    return { reservaRow: linha.reserva, passageiroRow: linha.passageiro };
  }

  private async buscarPassageiro(passageiroId: string): Promise<PassageiroRow> {
    const ctx = TenantContextStorage.get();
    const [row] = await this.db
      .select()
      .from(passageiro)
      .where(and(eq(passageiro.id, passageiroId), eq(passageiro.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!row) throw new NaoEncontradoException();
    return row;
  }

  private async validarPontoEmbarque(excursaoId: string, pontoEmbarqueId: string): Promise<void> {
    const ctx = TenantContextStorage.get();
    const [row] = await this.db
      .select({ id: pontoEmbarque.id })
      .from(pontoEmbarque)
      .where(
        and(
          eq(pontoEmbarque.id, pontoEmbarqueId),
          eq(pontoEmbarque.excursaoId, excursaoId),
          eq(pontoEmbarque.organizacaoId, ctx.organizacaoId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new DomainException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validacao',
        'Ponto de embarque inválido para esta excursão.',
        {
          campos: [
            {
              campo: 'ponto_embarque_id',
              mensagens: ['Ponto de embarque não encontrado nesta excursão.'],
            },
          ],
        },
      );
    }
  }

  private async calcularExpiracao(): Promise<Date> {
    const ctx = TenantContextStorage.get();
    const [org] = await this.db
      .select({ prazoHoras: organizacao.prazoExpiracaoReservaHoras })
      .from(organizacao)
      .where(eq(organizacao.id, ctx.organizacaoId))
      .limit(1);
    const prazoHoras = org?.prazoHoras ?? 48;
    return new Date(Date.now() + prazoHoras * 60 * 60 * 1000);
  }

  private async calcularPoltronasLivres(
    excursaoId: string,
    veiculoRow: VeiculoPoltronas,
  ): Promise<number[]> {
    const ctx = TenantContextStorage.get();
    const ocupadas = await this.db
      .select({ poltrona: reserva.poltrona })
      .from(reserva)
      .where(
        and(
          eq(reserva.organizacaoId, ctx.organizacaoId),
          eq(reserva.excursaoId, excursaoId),
          inArray(reserva.status, ['ativa', 'embarcada']),
        ),
      );
    return poltronasLivres(
      veiculoRow.quantidadePoltronas,
      veiculoRow.poltronasBloqueadas,
      ocupadas.map((o) => o.poltrona),
    );
  }
}
