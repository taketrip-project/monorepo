import { IsIn, IsOptional } from 'class-validator';

export const FORMATOS_IMPRESSAO = ['pdf', 'html'] as const;

/** Query param `formato` de `GET /excursoes/{excursaoId}/lista-passageiros/impressao` (H1.13). */
export class ImpressaoQueryDto {
  @IsOptional()
  @IsIn(FORMATOS_IMPRESSAO)
  formato: (typeof FORMATOS_IMPRESSAO)[number] = 'pdf';
}
