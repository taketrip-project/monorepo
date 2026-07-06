import { IsString, Length } from 'class-validator';

export class RedefinirSenhaDto {
  @IsString()
  token!: string;

  @IsString()
  @Length(8, 128)
  nova_senha!: string;
}
