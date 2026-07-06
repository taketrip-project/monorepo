export type TipoSinal = 'percentual' | 'fixo';

/**
 * Resolve o sinal em centavos (H1.5): se `fixo`, `sinalValor` JÁ é o valor em
 * centavos; se `percentual`, aplica o percentual (0–100) sobre o preço com
 * FLOOR — o restante fecha o total exato (ex.: 50% de R$ 179,90 = R$ 89,95;
 * restante R$ 89,95). Arredondar para cima quebraria essa igualdade.
 */
export function resolverSinalCentavos(
  precoCentavos: number,
  sinalTipo: TipoSinal,
  sinalValor: number,
): number {
  if (sinalTipo === 'fixo') return sinalValor;
  return Math.floor((precoCentavos * sinalValor) / 100);
}
