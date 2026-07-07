import type { statusPagamentoEnum } from './schema';

export type StatusPagamento = (typeof statusPagamentoEnum.enumValues)[number];

/**
 * Ordem da máquina de pagamento (H1.10): `pendente → sinal_pago → pago`.
 * `cancelado` não entra nesta ordem — é tratado à parte por
 * `ReservasService.marcarStatusPagamento` (delega para o cancelamento
 * completo da reserva, ver comentário lá: o mapa de poltronas não tem um
 * estado "ativa + pagamento cancelado", então marcar pagamento como
 * `cancelado` cancela a reserva inteira, mesmo efeito de
 * `POST /reservas/{id}/cancelar`).
 */
const ORDEM_STATUS_PAGAMENTO: Record<'pendente' | 'sinal_pago' | 'pago', number> = {
  pendente: 0,
  sinal_pago: 1,
  pago: 2,
};

/**
 * Uma transição para `sinal_pago`/`pago` é válida apenas se avança na ordem
 * (nunca regride, nunca fica parada) — ex.: `pago → sinal_pago` é inválida,
 * assim como `sinal_pago → sinal_pago` (o organizador não repete a mesma
 * marcação). `pendente → pago` (pulando o sinal) é válido: pagamento
 * integral direto é um caminho legítimo.
 */
export function transicaoPagamentoAvanca(
  atual: StatusPagamento,
  alvo: 'sinal_pago' | 'pago',
): boolean {
  if (atual === 'cancelado') return false;
  return ORDEM_STATUS_PAGAMENTO[alvo] > ORDEM_STATUS_PAGAMENTO[atual];
}
