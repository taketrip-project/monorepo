import { gerarTokenAleatorio, hashToken } from './token.util';

describe('token.util (tokens de e-mail — ADR 004)', () => {
  it('gera tokens aleatórios diferentes a cada chamada', () => {
    const a = gerarTokenAleatorio();
    const b = gerarTokenAleatorio();
    expect(a).not.toEqual(b);
    // 32 bytes em base64url: sem padding, ~43 caracteres.
    expect(a.length).toBeGreaterThanOrEqual(40);
  });

  it('hashToken é determinístico (mesmo input -> mesmo hash sha256)', () => {
    const token = gerarTokenAleatorio();
    expect(hashToken(token)).toEqual(hashToken(token));
  });

  it('hashToken nunca é igual ao token em claro (não persistimos o valor original)', () => {
    const token = gerarTokenAleatorio();
    expect(hashToken(token)).not.toEqual(token);
  });
});
