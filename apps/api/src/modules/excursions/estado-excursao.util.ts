import type { statusExcursaoEnum } from './schema';

export type StatusExcursao = (typeof statusExcursaoEnum.enumValues)[number];

/**
 * Máquina de estados da excursão (H1.7, domínio em
 * `.claude/skills/dominio-excursoes/SKILL.md`):
 *
 *   rascunho → publicada → lotada ⇄ publicada → em_andamento → concluida
 *   cancelada a partir de qualquer estado ANTES de em_andamento.
 *
 * `docs/api/excursions.yaml` só expõe DUAS transições via API:
 * `/publicar` (rascunho → publicada) e `/cancelar` (qualquer estado antes de
 * em_andamento → cancelada). As demais (publicada ⇄ lotada, em_andamento,
 * concluida) não são acionadas por endpoint nesta fase — lotada ⇄ publicada
 * é uma PROJEÇÃO aplicada pelo módulo bookings junto da reserva (ver
 * comentário do schema); em_andamento/concluida ainda não têm gatilho
 * definido no backlog (provavelmente cron por data, fora do escopo de
 * H1.5–H1.7).
 */
export const ESTADOS_ANTES_DE_EM_ANDAMENTO: readonly StatusExcursao[] = [
  'rascunho',
  'publicada',
  'lotada',
];

/** Único estado de origem válido para publicar. */
export function podePublicar(status: StatusExcursao): boolean {
  return status === 'rascunho';
}

/** Cancelamento é permitido de qualquer estado anterior a `em_andamento`. */
export function podeCancelar(status: StatusExcursao): boolean {
  return ESTADOS_ANTES_DE_EM_ANDAMENTO.includes(status);
}
