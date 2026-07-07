import type { BadgeTone } from '../../ui';
import type { FormaPagamento, StatusPagamento, StatusReserva } from '../../lib/api/bookings';

/** Rótulos pt-BR — nunca exibir o valor cru do enum na tela (frontend-guidelines §10). */
export const STATUS_PAGAMENTO_LABEL: Record<StatusPagamento, string> = {
  pendente: 'Pendente',
  sinal_pago: 'Sinal pago',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

export const STATUS_PAGAMENTO_TONE: Record<StatusPagamento, BadgeTone> = {
  pendente: 'warning',
  sinal_pago: 'warning',
  pago: 'success',
  cancelado: 'danger',
};

export const STATUS_RESERVA_LABEL: Record<StatusReserva, string> = {
  ativa: 'Ativa',
  embarcada: 'Embarcada',
  expirada: 'Expirada',
  cancelada: 'Cancelada',
};

export const STATUS_RESERVA_TONE: Record<StatusReserva, BadgeTone> = {
  ativa: 'primary',
  embarcada: 'success',
  expirada: 'mute',
  cancelada: 'danger',
};

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  pix_manual: 'Pix (manual)',
  pix_plataforma: 'Pix (Taketrip)',
  outro: 'Outro',
};

export const FORMAS_PAGAMENTO: FormaPagamento[] = ['dinheiro', 'pix_manual', 'pix_plataforma', 'outro'];
