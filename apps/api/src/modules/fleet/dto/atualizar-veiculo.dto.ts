import { ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { CriarVeiculoDto } from './criar-veiculo.dto';

/**
 * Corpo do PATCH `/veiculos/{veiculoId}` (`docs/api/fleet.yaml`): o contrato
 * define como `allOf VeiculoEntrada` + `poltronas_bloqueadas`/`confirmar` —
 * ou seja, os mesmos campos obrigatórios do cadastro (apelido, placa, tipo,
 * quantidade_poltronas) são reenviados a cada edição, não um PATCH parcial.
 */
export class AtualizarVeiculoDto extends CriarVeiculoDto {
  /** Substitui a lista de poltronas bloqueadas por inteiro, quando enviado. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  poltronas_bloqueadas?: number[];

  /** Obrigatório `true` quando há excursão publicada vinculada (senão 409). */
  @IsOptional()
  @IsBoolean()
  confirmar?: boolean;
}
