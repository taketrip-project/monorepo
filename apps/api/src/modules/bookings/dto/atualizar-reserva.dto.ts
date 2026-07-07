import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { FORMAS_PAGAMENTO } from './criar-reserva.dto';

/** Corpo de `PATCH /reservas/{reservaId}` — todos os campos opcionais (`docs/api/bookings.yaml`). */
export class AtualizarReservaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  poltrona?: number;

  @IsOptional()
  @IsUUID()
  ponto_embarque_id?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  valor_centavos?: number;

  @IsOptional()
  @IsIn(FORMAS_PAGAMENTO)
  forma_pagamento?: (typeof FORMAS_PAGAMENTO)[number] | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cpf?: string | null;
}
