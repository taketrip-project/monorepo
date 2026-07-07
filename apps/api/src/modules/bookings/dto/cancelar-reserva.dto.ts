import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Corpo de `POST /reservas/{reservaId}/cancelar` — `motivo` é opcional (diferente do cancelamento de excursão). */
export class CancelarReservaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string | null;
}
