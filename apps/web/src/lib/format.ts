/** Formatação pt-BR de data/hora — sempre 24h (frontend-guidelines §10). */
export function formatDataHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

const DIAS_SEMANA_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Data curta pt-BR no formato exigido pelo design system: "Dom · 15 jun". */
export function formatDataCurta(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  const dia = String(data.getDate()).padStart(2, '0');
  return `${DIAS_SEMANA_ABREV[data.getDay()]} · ${dia} ${MESES_ABREV[data.getMonth()]}`;
}

/** Horário em 24h, ex.: "05:30" — nunca AM/PM (frontend-guidelines §10). */
export function formatHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(data);
}

/** Centavos -> "R$ 1.250,00" (frontend-guidelines §10). Sempre em Trip Sans Mono na tela. */
export function formatMoeda(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);
}
