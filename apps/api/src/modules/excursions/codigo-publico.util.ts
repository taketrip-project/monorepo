import { randomBytes } from 'node:crypto';

/**
 * Alfabeto Crockford-like sem caracteres ambíguos (sem I, L, O, 0, 1) — o
 * código aparece em link compartilhado no WhatsApp (H3.1), precisa ser fácil
 * de ler/digitar e não confundir letra com número.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Gera o `codigo_publico` da excursão: curto, aleatório, não sequencial —
 * não expõe o UUID interno nem a ordem de criação (comentário do schema,
 * `excursao.codigo_publico`). Colisão é tratada pelo chamador (retry na
 * violação da UNIQUE `excursao_codigo_publico_uq`), não aqui.
 */
export function gerarCodigoPublico(tamanho = 10): string {
  const bytes = randomBytes(tamanho);
  let codigo = '';
  for (let i = 0; i < tamanho; i++) {
    codigo += ALFABETO[bytes[i] % ALFABETO.length];
  }
  return codigo;
}
