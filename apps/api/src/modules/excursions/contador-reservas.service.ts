import { Injectable } from '@nestjs/common';

/**
 * Ponto de extensão para tudo que depende de RESERVA (tabela `reserva`, do
 * módulo `bookings`) dentro de `excursions` (H1.5–H1.7, `docs/api/excursions.yaml`):
 * - `vagas` do card/detalhe = capacidade do veículo − reservas ATIVAS
 *   (status IN ('ativa','embarcada'));
 * - `pagos`/`pendentes` do card = contagem por `status_pagamento`;
 * - troca de veículo (PATCH) conflita se há reserva ativa em poltrona que
 *   não existe no novo veículo;
 * - remover ponto de embarque com passageiros vinculados é bloqueado;
 * - cancelar excursão com reservas PAGAS registra pendência de estorno.
 *
 * O módulo `bookings` ainda não tem service/controller nesta fase do backlog
 * (chega em H1.8–H1.13) — só o schema (`apps/api/src/modules/bookings/schema.ts`)
 * já existe, criado antecipadamente pelo backend-architect. Por isso esta
 * classe é um STUB que hoje sempre responde "zero reservas" / "sem
 * conflito" / "sem pendência", deixando publicar/cancelar/editar/reordenar
 * livres. `ExcursionsService` (e os services de pontos-embarque/fotos) só
 * dependem desta interface, nunca da tabela `reserva` diretamente — mesmo
 * padrão de `VinculoExcursaoService` em `fleet/vinculo-excursao.service.ts`.
 *
 * QUANDO `bookings` existir, troque só os corpos dos métodos abaixo (ou o
 * provider registrado em `excursions.module.ts`) para consultar de verdade:
 * - `contarReservasAtivas`: `SELECT count(*) FROM reserva WHERE excursao_id =
 *   $1 AND organizacao_id = $2 AND status IN ('ativa','embarcada')`;
 * - `contarPagos`: idem + `AND status_pagamento = 'pago'`;
 * - `contarPendentes`: idem + `AND status_pagamento IN ('pendente','sinal_pago')`;
 * - `poltronasReservadasForaDoLayout`: `SELECT poltrona FROM reserva WHERE
 *   excursao_id = $1 AND status IN ('ativa','embarcada') AND poltrona !=
 *   ALL($2::int[])` (onde `$2` é a lista de poltronas válidas do novo
 *   veículo — quantidade_poltronas menos poltronas_bloqueadas);
 * - `pontoTemReservaVinculada`: `SELECT EXISTS(SELECT 1 FROM reserva WHERE
 *   ponto_embarque_id = $1 AND status IN ('ativa','embarcada'))`;
 * - `pendenciasEstornoAoCancelar`: para cada reserva da excursão com
 *   `status_pagamento IN ('sinal_pago','pago')`, INSERT em
 *   `pendencia_estorno` (valor = o que foi efetivamente pago) na MESMA
 *   transação que cancela a excursão, e retornar as linhas criadas — hoje
 *   retorna `[]` porque não há reserva para varrer.
 *
 * IMPORTANTE: nenhuma tabela de `bookings` é lida ou escrita por este stub
 * — nada foi inventado além deste ponto de extensão, seguindo o mesmo
 * precedente de `fleet`.
 */
@Injectable()
export class ContadorReservasService {
  /** Quantas reservas ocupam poltrona hoje (ativa + embarcada) nesta excursão. */
  async contarReservasAtivas(_excursaoId: string): Promise<number> {
    return 0;
  }

  /** Quantas reservas desta excursão estão com `status_pagamento = 'pago'`. */
  async contarPagos(_excursaoId: string): Promise<number> {
    return 0;
  }

  /** Quantas reservas desta excursão estão com pagamento pendente ou só o sinal pago. */
  async contarPendentes(_excursaoId: string): Promise<number> {
    return 0;
  }

  /**
   * Dentre as reservas ativas da excursão, quais ocupam poltrona que NÃO
   * existe em `poltronasValidas` (layout do veículo candidato à troca)?
   * Retorna a sublista de números de poltrona que conflitam — vazio quando
   * nenhuma conflita (ou quando não há reserva nenhuma, como hoje).
   */
  async poltronasReservadasForaDoLayout(
    _excursaoId: string,
    _poltronasValidas: number[],
  ): Promise<number[]> {
    return [];
  }

  /** Este ponto de embarque tem alguma reserva ativa vinculada (embarque previsto nele)? */
  async pontoTemReservaVinculada(_pontoEmbarqueId: string): Promise<boolean> {
    return false;
  }

  /**
   * Ao cancelar a excursão, quais pendências de estorno nascem (reservas já
   * pagas, no todo ou no sinal)? Hoje sempre `[]` — quando `bookings`
   * existir, cria uma linha em `pendencia_estorno` por reserva paga, na
   * MESMA transação do cancelamento, e retorna as linhas criadas.
   */
  async pendenciasEstornoAoCancelar(
    _excursaoId: string,
  ): Promise<Array<{ id: string; reserva_id: string; valor_centavos: number }>> {
    return [];
  }
}
