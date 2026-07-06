import { IsString, MaxLength, MinLength } from 'class-validator';

/** Corpo de `POST /excursoes/{excursaoId}/cancelar` — motivo sempre obrigatório (H1.7). */
export class CancelarExcursaoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivo!: string;
}
