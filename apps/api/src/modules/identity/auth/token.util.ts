import { randomBytes, createHash } from 'node:crypto';

/**
 * Token de e-mail (ADR 004): aleatório de 32 bytes, codificado base64url
 * (seguro para URL/e-mail). Usado em redefinição de senha e convite.
 */
export function gerarTokenAleatorio(): string {
  return randomBytes(32).toString('base64url');
}

/** sha256 do token em claro — só o hash é persistido (ADR 004). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
