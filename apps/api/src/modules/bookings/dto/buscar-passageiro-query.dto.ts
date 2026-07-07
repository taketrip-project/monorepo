import { IsString, MaxLength } from 'class-validator';

/** Query param `whatsapp` de `GET /passageiros` — pré-preencher o cadastro rápido (H1.9). */
export class BuscarPassageiroQueryDto {
  @IsString()
  @MaxLength(20)
  whatsapp!: string;
}
