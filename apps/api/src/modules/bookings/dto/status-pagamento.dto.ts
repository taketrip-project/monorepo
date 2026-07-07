import { IsIn } from 'class-validator';

/** `pendente` não é uma ação — é só o estado inicial; a API nunca aceita regressão explícita para ele. */
export const STATUS_PAGAMENTO_ACAO = ['sinal_pago', 'pago', 'cancelado'] as const;

/** Corpo de `POST /reservas/{reservaId}/status-pagamento` (H1.10). */
export class StatusPagamentoDto {
  @IsIn(STATUS_PAGAMENTO_ACAO)
  status!: (typeof STATUS_PAGAMENTO_ACAO)[number];
}
