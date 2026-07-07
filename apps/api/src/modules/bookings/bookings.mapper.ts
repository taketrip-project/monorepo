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
