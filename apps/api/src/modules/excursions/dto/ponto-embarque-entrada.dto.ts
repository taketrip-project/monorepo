import { IsDateString, IsString, MaxLength } from 'class-validator';

/** `PontoEmbarqueEntrada` de `docs/api/excursions.yaml` (POST e PATCH de ponto). */
export class PontoEmbarqueEntradaDto {
  @IsString()
  @MaxLength(200)
  local!: string;

  @IsDateString()
  horario!: string;
}
