import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

/** Corpo do `PUT /excursoes/{excursaoId}/pontos-embarque` — lista completa de ids na nova ordem. */
export class ReordenarPontosDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ordem!: string[];
}
