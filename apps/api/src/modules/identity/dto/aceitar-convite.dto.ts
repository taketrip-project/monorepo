import { IsString, Length, MaxLength } from 'class-validator';

export class AceitarConviteDto {
  @IsString()
  token!: string;

  @IsString()
  @MaxLength(120)
  nome!: string;

  @IsString()
  @Length(8, 128)
  senha!: string;
}
