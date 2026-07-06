import { hashSenha, verificarSenha } from './senha.util';

describe('senha.util (argon2id — ADR 004)', () => {
  it('gera hashes diferentes para a mesma senha (salt aleatório) e ambos validam', async () => {
    const hash1 = await hashSenha('minhaSenhaForte123');
    const hash2 = await hashSenha('minhaSenhaForte123');

    expect(hash1).not.toEqual(hash2);
    expect(await verificarSenha(hash1, 'minhaSenhaForte123')).toBe(true);
    expect(await verificarSenha(hash2, 'minhaSenhaForte123')).toBe(true);
  });

  it('rejeita senha incorreta', async () => {
    const hash = await hashSenha('senhaCorreta1');
    expect(await verificarSenha(hash, 'senhaErrada1')).toBe(false);
  });

  it('não lança erro para hash em formato inválido — trata como senha incorreta', async () => {
    await expect(verificarSenha('hash-corrompido-nao-argon2', 'qualquer')).resolves.toBe(false);
  });
});
