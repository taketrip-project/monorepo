import { IsEmail } from 'class-validator';

export class CriarConviteDto {
  @IsEmail()
  email!: string;
}
