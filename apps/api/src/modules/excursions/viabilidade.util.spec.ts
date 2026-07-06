import { calcularViabilidade } from './viabilidade.util';

describe('excursions: calcularViabilidade', () => {
  it('retorna null quando custo_total_centavos não foi informado (undefined ou null)', () => {
    expect(calcularViabilidade(null, 18000, 0)).toBeNull();
    expect(calcularViabilidade(undefined, 18000, 0)).toBeNull();
  });

  it('exemplo do domínio: micro-ônibus R$ 2.800 + 30 ingressos a R$ 60, preço R$ 180/pax → empata com 26 pagos', () => {
    const custoTotalCentavos = 280000 + 30 * 6000; // 460000
    const precoCentavos = 18000;

    const viabilidade = calcularViabilidade(custoTotalCentavos, precoCentavos, 10);

    expect(viabilidade).toEqual({
      custo_total_centavos: 460000,
      ponto_equilibrio_pagos: 26,
      pagos_atuais: 10,
    });
  });

  it('arredonda para cima (ceil) quando a divisão não é exata', () => {
    // 100000 / 18000 = 5,55... -> ceil = 6.
    const viabilidade = calcularViabilidade(100000, 18000, 0);
    expect(viabilidade?.ponto_equilibrio_pagos).toBe(6);
  });

  it('divisão exata não soma um pagante a mais', () => {
    // 90000 / 18000 = 5,0 exato -> ceil = 5.
    const viabilidade = calcularViabilidade(90000, 18000, 0);
    expect(viabilidade?.ponto_equilibrio_pagos).toBe(5);
  });

  it('preço zero não lança erro (indicador nunca bloqueia) e não divide por zero', () => {
    expect(() => calcularViabilidade(100000, 0, 0)).not.toThrow();
    expect(calcularViabilidade(100000, 0, 0)?.ponto_equilibrio_pagos).toBe(0);
  });
});
