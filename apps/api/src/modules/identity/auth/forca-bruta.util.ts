/**
 * Espera progressiva após falhas de login seguidas (ADR 004, H1.2):
 * a partir da 5ª falha, bloqueia por 1 minuto, dobrando a cada falha
 * subsequente, até o teto de 15 minutos. Antes da 5ª falha, não bloqueia
 * (retorna `null`).
 *
 * Função pura — sem I/O — para poder testar a progressão sem banco.
 */
export function calcularBloqueio(tentativasFalhas: number, agora: Date = new Date()): Date | null {
  if (tentativasFalhas < 5) return null;
  const minutos = Math.min(15, 2 ** (tentativasFalhas - 5));
  return new Date(agora.getTime() + minutos * 60_000);
}

/** Segundos restantes até `bloqueadoAte`, arredondado para cima (para o header Retry-After). */
export function segundosRestantes(bloqueadoAte: Date, agora: Date = new Date()): number {
  return Math.max(1, Math.ceil((bloqueadoAte.getTime() - agora.getTime()) / 1000));
}
