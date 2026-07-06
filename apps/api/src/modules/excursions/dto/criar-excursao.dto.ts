import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  Validate,
} from 'class-validator';
import { tipoExcursaoEnum, tipoSinalEnum } from '../schema';
import { SinalValorValidoConstraint } from './sinal-valor-valido.constraint';

export const TIPOS_EXCURSAO = tipoExcursaoEnum.enumValues;
export const TIPOS_SINAL = tipoSinalEnum.enumValues;

/** `ExcursaoEntrada` de `docs/api/excursions.yaml` (usado no POST e como base do PATCH). */
export class CriarExcursaoDto {
  @IsString()
  @MaxLength(160)
  destino!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  evento_ancora?: string | null;

  @IsDateString()
  data_saida!: string;

  @IsDateString()
  data_retorno!: string;

  @IsIn(TIPOS_EXCURSAO)
  tipo!: (typeof TIPOS_EXCURSAO)[number];

  @IsUUID()
  veiculo_id!: string;

  @IsInt()
  @Min(0)
  preco_centavos!: number;

  /** Default `percentual` quando omitido (aplicado no service). */
  @IsOptional()
  @IsIn(TIPOS_SINAL)
  sinal_tipo?: (typeof TIPOS_SINAL)[number];

  /**
   * Percentual (0–100) ou centavos, conforme `sinal_tipo`. Quando omitido:
   * herda `organizacao.sinal_default_percentual` se `sinal_tipo` for
   * percentual (ou omitido); é OBRIGATÓRIO quando `sinal_tipo` é `fixo`
   * (não há valor monetário default razoável) — validado no service.
   */
  @IsOptional()
  @Validate(SinalValorValidoConstraint)
  sinal_valor?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descricao?: string | null;
}
