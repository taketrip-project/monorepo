import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export const TIPOS_PAGAMENTO_PUBLICO = ['sinal', 'integral'] as const;
export type TipoPagamentoPublico = (typeof TIPOS_PAGAMENTO_PUBLICO)[number];

/**
 * Corpo de `POST /publico/excursoes/{codigo}/reservas` (H3.2,
 * `docs/api/publico.yaml`). Mesmos limites do cadastro rápido do organizador
 * (`CriarReservaDto`: nome ≤120, cpf opcional, WhatsApp normalizado no
 * servidor via `whatsapp.util.ts`).
 *
 * DECISÃO DE SEGURANÇA (ADR 008): NÃO existe `valor_centavos` nem
 * `forma_pagamento` aqui — o passageiro só escolhe `tipo_pagamento`
 * (sinal | integral) e o SERVIDOR calcula o valor a partir do preço/sinal da
 * excursão. Campos extras no corpo são descartados pelo `whitelist: true`
 * do ValidationPipe global — um passageiro nunca informa o próprio valor.
 */
export class CriarReservaPublicaDto {
  @IsInt()
  @Min(1)
  poltrona!: number;

  @IsString()
  @MaxLength(120)
  nome!: string;

  /** Normalizado para E.164 no servidor — ver `whatsapp.util.ts`. */
  @IsString()
  whatsapp!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cpf?: string | null;

  @IsIn(TIPOS_PAGAMENTO_PUBLICO)
  tipo_pagamento!: TipoPagamentoPublico;

  @IsOptional()
  @IsUUID()
  ponto_embarque_id?: string | null;
}
