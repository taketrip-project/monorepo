import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class RegistroDto {
  @IsString()
  @MaxLength(120)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 128)
  senha!: string;

  @IsString()
  @MaxLength(120)
  nome_organizacao!: string;
}
