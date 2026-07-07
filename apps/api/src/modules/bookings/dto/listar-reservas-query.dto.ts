import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { statusPagamentoEnum } from '../schema';

export const STATUS_PAGAMENTO_FILTRO = statusPagamentoEnum.enumValues;

/** Query params de `GET /excursoes/{excursaoId}/reservas` (H1.11, `docs/api/bookings.yaml`). */
export class ListarReservasQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  busca?: string;

  @IsOptional()
  @IsIn(STATUS_PAGAMENTO_FILTRO)
  status_pagamento?: (typeof STATUS_PAGAMENTO_FILTRO)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  por_pagina: number = 20;
}
