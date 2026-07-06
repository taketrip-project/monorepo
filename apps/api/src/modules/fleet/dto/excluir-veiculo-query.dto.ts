import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/** Query param `confirmar` de `DELETE /veiculos/{veiculoId}` (`docs/api/fleet.yaml`). */
export class ExcluirVeiculoQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  confirmar: boolean = false;
}
