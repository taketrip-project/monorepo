import { calcularBloqueio, segundosRestantes } from './forca-bruta.util';

describe('forca-bruta.util (espera progressiva — ADR 004, H1.2)', () => {
  const agora = new Date('2026-07-06T12:00:00Z');

  it('não bloqueia antes da 5ª falha', () => {
    expect(calcularBloqueio(1, agora)).toBeNull();
    expect(calcularBloqueio(4, agora)).toBeNull();
  });

  it('bloqueia por 1 minuto na 5ª falha', () => {
    const bloqueadoAte = calcularBloqueio(5, agora);
    expect(bloqueadoAte).toEqual(new Date(agora.getTime() + 60_000));
  });

  it('dobra a cada falha subsequente (6ª = 2min, 7ª = 4min, 8ª = 8min)', () => {
    expect(calcularBloqueio(6, agora)).toEqual(new Date(agora.getTime() + 2 * 60_000));
    expect(calcularBloqueio(7, agora)).toEqual(new Date(agora.getTime() + 4 * 60_000));
    expect(calcularBloqueio(8, agora)).toEqual(new Date(agora.getTime() + 8 * 60_000));
  });

  it('tem teto de 15 minutos mesmo com muitas falhas', () => {
    expect(calcularBloqueio(9, agora)).toEqual(new Date(agora.getTime() + 15 * 60_000));
    expect(calcularBloqueio(20, agora)).toEqual(new Date(agora.getTime() + 15 * 60_000));
  });

  it('segundosRestantes arredonda para cima e nunca retorna menos de 1', () => {
    const bloqueadoAte = new Date(agora.getTime() + 30_500);
    expect(segundosRestantes(bloqueadoAte, agora)).toBe(31);
    expect(segundosRestantes(agora, agora)).toBe(1);
  });
});
