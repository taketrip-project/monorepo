import * as argon2 from 'argon2';

/** Parâmetros OWASP (ADR 004): memória 19 MiB, 2 iterações, paralelismo 1. */
const OPCOES_ARGON2 = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
};

export async function hashSenha(senha: string): Promise<string> {
  return argon2.hash(senha, OPCOES_ARGON2);
}

export async function verificarSenha(hash: string, senha: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, senha);
  } catch {
    // Hash em formato inesperado/corrompido: trata como senha incorreta, não como 500.
    return false;
  }
}
