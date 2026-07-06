import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../../common/public.decorator';
import { AuthService } from './auth.service';
import { RegistroDto } from '../dto/registro.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { EsqueciSenhaDto } from '../dto/esqueci-senha.dto';
import { RedefinirSenhaDto } from '../dto/redefinir-senha.dto';
import { AceitarConviteDto } from '../dto/aceitar-convite.dto';

/** `docs/api/identity.yaml` — bloco `/auth/*` (H1.1, H1.2, H1.3). */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('registro')
  @HttpCode(HttpStatus.CREATED)
  registro(@Body() dto: RegistroDto) {
    return this.authService.registrar(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.headers['user-agent']);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(): Promise<void> {
    await this.authService.logout();
  }

  @Public()
  @Post('esqueci-senha')
  @HttpCode(HttpStatus.ACCEPTED)
  async esqueciSenha(@Body() dto: EsqueciSenhaDto): Promise<void> {
    await this.authService.esqueciSenha(dto);
  }

  @Public()
  @Post('redefinir-senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  async redefinirSenha(@Body() dto: RedefinirSenhaDto): Promise<void> {
    await this.authService.redefinirSenha(dto);
  }

  @Public()
  @Post('convites/aceitar')
  @HttpCode(HttpStatus.CREATED)
  aceitarConvite(@Body() dto: AceitarConviteDto) {
    return this.authService.aceitarConvite(dto);
  }
}
