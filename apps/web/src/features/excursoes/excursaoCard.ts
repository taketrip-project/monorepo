import { formatDataCurta, formatHora } from '../../lib/format';
import type { ExcursaoCard } from '../../lib/api/excursions';
import type { ExcursionCardProps } from '../../ui';

/** Converte um ExcursaoCard da API nas props prontas do ExcursionCard canônico. */
export function excursaoParaCardProps(excursao: ExcursaoCard): Omit<ExcursionCardProps, 'onClick'> {
  return {
    destino: excursao.destino,
    status: excursao.status,
    dataLabel: formatDataCurta(excursao.data_saida),
    horaLabel: formatHora(excursao.data_saida),
    vagasOcupadas: excursao.capacidade - excursao.vagas,
    vagasTotal: excursao.capacidade,
    pagos: excursao.pagos,
    pendentes: excursao.pendentes,
  };
}
