import type { passageiro, reserva } from './schema';

type ReservaRow = typeof reserva.$inferSelect;
type PassageiroRow = typeof passageiro.$inferSelect;

/** `Passageiro` de `docs/api/bookings.yaml`. */
export function mapPassageiro(row: PassageiroRow) {
  return {
    id: row.id,
    nome: row.nome,
    whatsapp: row.whatsapp,
    cpf: row.cpf,
  };
}

/**
 * `ReservaPublicaCriada` de `docs/api/publico.yaml` (H3.2): o MÍNIMO para a
 * tela de confirmação do passageiro — o `reserva_id` (UUID v7) é o token de
 * posse do link de acompanhamento. `cobranca` fica `null` enquanto o billing
 * não expõe serviço público (decisão 006 — pagamento combinado por WhatsApp).
 */
export function mapReservaPublicaCriada(row: ReservaRow, instrucoes: string) {
  return {
    reserva_id: row.id,
    poltrona: row.poltrona,
    status_pagamento: row.statusPagamento,
    expira_em: row.expiraEm ? row.expiraEm.toISOString() : null,
    cobranca: null,
    instrucoes,
  };
}

/**
 * `SituacaoReservaPublica` de `docs/api/publico.yaml`: status, poltrona,
 * prazo e instruções — NUNCA dados de outros passageiros nem da excursão além
 * de destino/data.
 */
export function mapSituacaoReservaPublica(
  row: ReservaRow,
  excursaoRow: { destino: string; dataSaida: Date },
  instrucoes: string | null,
) {
  return {
    reserva_id: row.id,
    poltrona: row.poltrona,
    status: row.status,
    status_pagamento: row.statusPagamento,
    destino: excursaoRow.destino,
    data_saida: excursaoRow.dataSaida.toISOString(),
    expira_em: row.expiraEm ? row.expiraEm.toISOString() : null,
    cobranca: null,
    instrucoes,
  };
}

/** `Reserva` de `docs/api/bookings.yaml` — sempre com o passageiro embutido. */
export function mapReserva(row: ReservaRow, passageiroRow: PassageiroRow) {
  return {
    id: row.id,
    excursao_id: row.excursaoId,
    poltrona: row.poltrona,
    status: row.status,
    status_pagamento: row.statusPagamento,
    origem: row.origem,
    forma_pagamento: row.formaPagamento,
    valor_centavos: row.valorCentavos,
    ponto_embarque_id: row.pontoEmbarqueId,
    expira_em: row.expiraEm ? row.expiraEm.toISOString() : null,
    embarcada_em: row.embarcadaEm ? row.embarcadaEm.toISOString() : null,
    passageiro: mapPassageiro(passageiroRow),
    criado_em: row.criadoEm.toISOString(),
  };
}
