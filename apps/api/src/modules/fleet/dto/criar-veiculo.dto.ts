import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { tipoVeiculoEnum } from '../schema';
import type { TipoVeiculo } from '../layout.util';

/** Valores aceitos para `tipo` — mesmo enum do Postgres (`tipo_veiculo`). */
export const TIPOS_VEICULO = tipoVeiculoEnum.enumValues;

/** `VeiculoEntrada` de `docs/api/fleet.yaml` (usado no POST e como base do PATCH). */
export class CriarVeiculoDto {
  @IsString()
  @MaxLength(60)
  apelido!: string;

  @IsString()
  @MaxLength(10)
  placa!: string;

  @IsIn(TIPOS_VEICULO)
  tipo!: TipoVeiculo;

  /**
   * Range genérico do contrato (15–50); a faixa específica por tipo
   * (van 15–16 · micro-ônibus 24–33 · ônibus 42–50) é validada no service
   * (`validarFaixaPoltronas`), não aqui — o DTO não conhece `tipo` ainda
   * quando o class-validator roda campo a campo.
   */
  @IsInt()
  @Min(15)
  @Max(50)
  quantidade_poltronas!: number;
}
