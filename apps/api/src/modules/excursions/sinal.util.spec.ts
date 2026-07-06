import { resolverSinalCentavos } from './sinal.util';

describe('excursions: resolverSinalCentavos', () => {
  it('percentual: 50% de R$ 179,90 (17990) = R$ 89,95 (8995), com floor', () => {
    expect(resolverSinalCentavos(17990, 'percentual', 50)).toBe(8995);
  });

  it('percentual: floor arredonda para baixo quando a divisão não é exata', () => {
    // 33% de 10000 = 3300 exato; 33% de 10001 = 3300,33 -> floor 3300.
    expect(resolverSinalCentavos(10001, 'percentual', 33)).toBe(3300);
  });

  it('percentual: 0% resulta em sinal zero', () => {
    expect(resolverSinalCentavos(18000, 'percentual', 0)).toBe(0);
  });

  it('percentual: 100% resulta no preço integral', () => {
    expect(resolverSinalCentavos(18000, 'percentual', 100)).toBe(18000);
  });

  it('fixo: retorna o valor em centavos tal como informado, ignorando o preço', () => {
    expect(resolverSinalCentavos(18000, 'fixo', 5000)).toBe(5000);
  });

  it('fixo: aceita valor maior que o preço (o service não bloqueia isso aqui)', () => {
    expect(resolverSinalCentavos(10000, 'fixo', 15000)).toBe(15000);
  });
});
