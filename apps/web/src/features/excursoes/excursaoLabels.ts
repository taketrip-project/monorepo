import type { FiltroExcursoes, SinalTipo, TipoExcursao } from '../../lib/api/excursions';

/** Rótulos pt-BR — nunca exibir o valor cru do enum na tela. */
export const TIPO_EXCURSAO_LABEL: Record<TipoExcursao, string> = {
  bate_volta: 'Bate-volta',
  pernoite: 'Pernoite',
};

export const TIPOS_EXCURSAO: TipoExcursao[] = ['bate_volta', 'pernoite'];

export const SINAL_TIPO_LABEL: Record<SinalTipo, string> = {
  percentual: 'Percentual',
  fixo: 'Valor fixo',
};

export const SINAIS_TIPO: SinalTipo[] = ['percentual', 'fixo'];

export const FILTRO_LABEL: Record<FiltroExcursoes, string> = {
  proximas: 'Próximas',
  hoje: 'Hoje',
  concluidas: 'Concluídas',
  rascunho: 'Rascunho',
};

export const FILTROS_EXCURSOES: FiltroExcursoes[] = ['proximas', 'hoje', 'concluidas', 'rascunho'];
