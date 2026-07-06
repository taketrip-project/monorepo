import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AtualizarOrganizacaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nome?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  prazo_expiracao_reserva_horas?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  sinal_default_percentual?: number;
}
