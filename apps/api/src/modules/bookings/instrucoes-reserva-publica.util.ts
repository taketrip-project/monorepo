/**
 * Instruções em pt-BR informal para o passageiro da página pública (H3.2,
 * `docs/api/publico.yaml`, campo `instrucoes`). Enquanto a organização não
 * tem PIX na plataforma (decisão 006, `cobranca: null`), o combinado é
 * sempre fechar o pagamento com o organizador pelo WhatsApp.
 *
 * DECISÃO DO backend-engineer (ADR omisso no formato exato do prazo): o
 * exemplo do contrato é "até sábado às 18h"; como o prazo de expiração é
 * configurável por organização (pode passar de 7 dias), o dia do mês entra
 * junto do dia da semana — "sábado, 12/12, às 18h" — para nunca ficar
 * ambíguo. Fuso fixo America/Sao_Paulo: produto Brasil-only no MVP (mesma
 * premissa de `whatsapp.util.ts`).
 */
const FUSO_BRASIL = 'America/Sao_Paulo';

export function formatarPrazoHumano(data: Date, timeZone = FUSO_BRASIL): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(data);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? '';

  const minuto = parte('minute');
  const hora = String(Number(parte('hour')));
  const horaTexto = minuto === '00' ? `${hora}h` : `${hora}h${minuto}`;
  return `${parte('weekday')}, ${parte('day')}/${parte('month')}, às ${horaTexto}`;
}

export function montarInstrucoesReservaPublica(
  expiraEm: Date | null,
  tipoPagamento: 'sinal' | 'integral' | null,
): string {
  const oQuePagar = tipoPagamento === 'sinal' ? 'o sinal' : 'o pagamento';
  if (!expiraEm) {
    return `Sua poltrona tá guardada! Combine ${oQuePagar} com o organizador pelo WhatsApp pra confirmar.`;
  }
  return `Sua poltrona tá guardada até ${formatarPrazoHumano(expiraEm)} — combine ${oQuePagar} com o organizador pelo WhatsApp pra confirmar.`;
}
