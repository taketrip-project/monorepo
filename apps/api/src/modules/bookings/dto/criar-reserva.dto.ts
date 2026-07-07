import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { formaPagamentoEnum } from '../schema';

export const FORMAS_PAGAMENTO = formaPagamentoEnum.enumValues;

/** Corpo de `POST /excursoes/{excursaoId}/reservas` — cadastro rápido (H1.9, ≤4 campos + poltrona). */
export class CriarReservaDto {
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

  @IsOptional()
  @IsIn(FORMAS_PAGAMENTO)
  forma_pagamento?: (typeof FORMAS_PAGAMENTO)[number] | null;

  /** Default = preço da excursão, resolvido no service quando omitido. */
  @IsOptional()
  @IsInt()
  @Min(0)
  valor_centavos?: number | null;

  @IsOptional()
  @IsUUID()
  ponto_embarque_id?: string | null;
}
