import { IsBoolean, IsOptional } from 'class-validator';

/** Corpo do `PATCH /excursoes/{excursaoId}/checklist-legal` (H3.5) — PATCH parcial, nunca bloqueia. */
export class ChecklistLegalDto {
  @IsOptional()
  @IsBoolean()
  licenca_antt?: boolean;

  @IsOptional()
  @IsBoolean()
  seguro_passageiros?: boolean;

  @IsOptional()
  @IsBoolean()
  lista_impressa?: boolean;
}
