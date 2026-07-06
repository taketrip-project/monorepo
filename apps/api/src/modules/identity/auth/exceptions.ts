import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../../common/domain-exception';

/** 401 — refresh token inválido, expirado ou revogado. */
export class SessaoInvalidaException extends DomainException {
  constructor() {
    super(
      HttpStatus.UNAUTHORIZED,
      'sessao_invalida',
      'Sessão inválida, expirada ou revogada. Entre novamente.',
    );
  }
}

/** 401 — token de redefinição de senha inválido, expirado ou já usado. */
export class TokenInvalidoException extends DomainException {
  constructor() {
    super(HttpStatus.UNAUTHORIZED, 'token_invalido', 'Link inválido, expirado ou já utilizado.');
  }
}

/** 401 — convite inválido, expirado ou já aceito. */
export class ConviteInvalidoException extends DomainException {
  constructor() {
    super(
      HttpStatus.UNAUTHORIZED,
      'convite_invalido',
      'Convite inválido, expirado ou já aceito.',
    );
  }
}
