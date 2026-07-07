import type { TipoVeiculo } from '../../lib/api/fleet';

/** Rótulos pt-BR — nunca exibir o valor cru do enum na tela. */
export const TIPO_VEICULO_LABEL: Record<TipoVeiculo, string> = {
  van: 'Van',
  micro_onibus: 'Micro-ônibus',
  onibus: 'Ônibus',
};

export const TIPOS_VEICULO: TipoVeiculo[] = ['van', 'micro_onibus', 'onibus'];

/**
 * Faixas de poltronas por tipo (docs/api/fleet.yaml): van 15–16 ·
 * micro-ônibus 24–33 · ônibus 42–50. Validado aqui só como UX rápida — a
 * fonte de verdade é sempre o 422 do servidor.
 */
export const FAIXA_POLTRONAS: Record<TipoVeiculo, { min: number; max: number }> = {
  van: { min: 15, max: 16 },
  micro_onibus: { min: 24, max: 33 },
  onibus: { min: 42, max: 50 },
};
