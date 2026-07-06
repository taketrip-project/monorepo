import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import type { TipoVeiculo } from '../layout.util';
import { TIPOS_VEICULO } from './criar-veiculo.dto';

/** Query params de `GET /veiculos/layout-padrao` (preview, não persiste nada). */
export class LayoutPadraoQueryDto {
  @IsIn(TIPOS_VEICULO)
  tipo!: TipoVeiculo;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(50)
  quantidade_poltronas!: number;
}
