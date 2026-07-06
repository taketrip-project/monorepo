import {
  FAIXA_POLTRONAS,
  gerarLayout,
  validarFaixaPoltronas,
  validarPoltronasNoLayout,
} from './layout.util';

describe('fleet: gerarLayout', () => {
  it('van 15 lugares: 5 fileiras de 1+corredor+2, numeração sequencial 1..15', () => {
    const layout = gerarLayout('van', 15);
    expect(layout.fileiras).toEqual([
      [1, null, 2, 3],
      [4, null, 5, 6],
      [7, null, 8, 9],
      [10, null, 11, 12],
      [13, null, 14, 15],
    ]);
  });

  it('van 16 lugares: 5 fileiras completas + 1 fileira compacta com a poltrona 16', () => {
    const layout = gerarLayout('van', 16);
    expect(layout.fileiras).toHaveLength(6);
    expect(layout.fileiras[5]).toEqual([16]);
    // Nenhuma poltrona repetida ou faltando.
    const numeros = layout.fileiras.flat().filter((n): n is number => n !== null);
    expect(numeros.sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it('micro-ônibus 24 lugares (mínimo da faixa): 6 fileiras de 2+corredor+2', () => {
    const layout = gerarLayout('micro_onibus', 24);
    expect(layout.fileiras).toHaveLength(6);
    expect(layout.fileiras[0]).toEqual([1, 2, null, 3, 4]);
    expect(layout.fileiras[5]).toEqual([21, 22, null, 23, 24]);
  });

  it('micro-ônibus 33 lugares (máximo da faixa): fileira final compacta com 1 poltrona', () => {
    const layout = gerarLayout('micro_onibus', 33);
    expect(layout.fileiras).toHaveLength(9);
    expect(layout.fileiras[8]).toEqual([33]);
  });

  it('ônibus 42 lugares (mínimo da faixa): fileira final compacta com 2 poltronas', () => {
    const layout = gerarLayout('onibus', 42);
    expect(layout.fileiras).toHaveLength(11);
    expect(layout.fileiras[10]).toEqual([41, 42]);
  });

  it('ônibus 50 lugares (máximo da faixa): 12 fileiras completas + 1 compacta', () => {
    const layout = gerarLayout('onibus', 50);
    const numeros = layout.fileiras.flat().filter((n): n is number => n !== null);
    expect(numeros).toHaveLength(50);
    expect(new Set(numeros).size).toBe(50);
    expect(Math.max(...numeros)).toBe(50);
  });
});

describe('fleet: validarFaixaPoltronas', () => {
  it.each([
    ['van', 14],
    ['van', 17],
    ['micro_onibus', 23],
    ['micro_onibus', 34],
    ['onibus', 41],
    ['onibus', 51],
  ] as const)('rejeita %s com %i poltronas (fora da faixa)', (tipo, quantidade) => {
    expect(() => validarFaixaPoltronas(tipo, quantidade)).toThrow();
  });

  it.each([
    ['van', 15],
    ['van', 16],
    ['micro_onibus', 24],
    ['micro_onibus', 33],
    ['onibus', 42],
    ['onibus', 50],
  ] as const)('aceita %s com %i poltronas (dentro da faixa)', (tipo, quantidade) => {
    expect(() => validarFaixaPoltronas(tipo, quantidade)).not.toThrow();
  });

  it('a constante FAIXA_POLTRONAS documenta as 3 faixas do backlog (H1.4)', () => {
    expect(FAIXA_POLTRONAS).toEqual({
      van: { min: 15, max: 16 },
      micro_onibus: { min: 24, max: 33 },
      onibus: { min: 42, max: 50 },
    });
  });
});

describe('fleet: validarPoltronasNoLayout', () => {
  it('aceita poltronas dentro de 1..quantidade', () => {
    expect(() => validarPoltronasNoLayout([1, 15], 15)).not.toThrow();
  });

  it('rejeita poltrona 0 ou negativa', () => {
    expect(() => validarPoltronasNoLayout([0], 15)).toThrow();
  });

  it('rejeita poltrona acima da quantidade do veículo', () => {
    expect(() => validarPoltronasNoLayout([16], 15)).toThrow();
  });
});
