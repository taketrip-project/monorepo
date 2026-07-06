import { IsInt, IsOptional, Min } from 'class-validator';
import { CriarExcursaoDto } from './criar-excursao.dto';

/**
 * Corpo do PATCH `/excursoes/{excursaoId}` (`docs/api/excursions.yaml`):
 * `allOf ExcursaoEntrada` + `custo_total_centavos` — mesmo padrão de
 * `AtualizarVeiculoDto` em `fleet`: os campos obrigatórios do cadastro são
 * reenviados a cada edição (substituição completa), não um PATCH parcial.
 * `custo_total_centavos` é a exceção: omitido = mantém o valor atual;
 * `null` explícito = limpa a viabilidade; número = define/atualiza.
 */
export class AtualizarExcursaoDto extends CriarExcursaoDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  custo_total_centavos?: number | null;
}
