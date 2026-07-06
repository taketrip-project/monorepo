export interface Viabilidade {
  custo_total_centavos: number;
  ponto_equilibrio_pagos: number;
  pagos_atuais: number;
}

/**
 * Indicador de viabilidade (H3.4) — SEMPRE informativo, nunca bloqueia
 * nenhuma ação. Só existe quando `custoTotalCentavos` foi informado.
 * `ponto_equilibrio_pagos = ceil(custo_total / preço)` — ex. do domínio:
 * micro-ônibus fretado R$ 2.800 + 30 ingressos a R$ 60 = R$ 4.600 custo
 * total; a R$ 180/pax, empata com 26 pax (ceil(460000/18000) = 26).
 */
export function calcularViabilidade(
  custoTotalCentavos: number | null | undefined,
  precoCentavos: number,
  pagosAtuais: number,
): Viabilidade | null {
  if (custoTotalCentavos == null) return null;

  // Preço zero não deveria acontecer em produção (min. 0 no contrato, mas
  // viabilidade não faz sentido dividindo por zero) — trata como "nunca
  // empata" em vez de lançar/NaN, já que este indicador nunca bloqueia nada.
  const pontoEquilibrioPagos =
    precoCentavos > 0 ? Math.ceil(custoTotalCentavos / precoCentavos) : 0;

  return {
    custo_total_centavos: custoTotalCentavos,
    ponto_equilibrio_pagos: pontoEquilibrioPagos,
    pagos_atuais: pagosAtuais,
  };
}
