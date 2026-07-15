/**
 * Janela em que uma sessão revogada por rotação LEGÍTIMA de refresh
 * (`substituidaPorId` preenchido) ainda é aceita — cobre a corrida entre
 * abas/requisições em voo no instante da rotação. Compartilhada pelo
 * `AuthService.refresh()` (tolera reuso do refresh antigo) e pelo
 * `JwtAuthGuard` (tolera access token da sessão recém-rotacionada).
 * Revogações intencionais (logout, redefinição de senha, remoção de
 * membro, varredura de roubo) nunca preenchem `substituidaPorId` e
 * ficam fora da tolerância.
 */
export const JANELA_TOLERANCIA_CORRIDA_MS = 30 * 1000;
