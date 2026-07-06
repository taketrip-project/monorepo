import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const FILTROS_EXCURSAO = ['proximas', 'hoje', 'concluidas', 'rascunho'] as const;
export type FiltroExcursao = (typeof FILTROS_EXCURSAO)[number];

/** Query params de `GET /excursoes` (`docs/api/excursions.yaml`, H1.7). */
export class ListarExcursoesQueryDto {
  @IsOptional()
  @IsIn(FILTROS_EXCURSAO)
  filtro: FiltroExcursao = 'proximas';

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
