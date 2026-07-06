/**
 * Claims do access token JWT (ADR 004: HS256, 15 min).
 *
 * `sid` (session id) é uma adição pragmática às duas claims descritas no
 * ADR (`sub`, `organizacaoId`): sem ela, `/auth/logout` — que não recebe
 * corpo no contrato (`docs/api/identity.yaml`) — não teria como saber qual
 * sessão revogar dentre as várias que um membro pode ter (múltiplos
 * dispositivos). Não conflita com o ADR (que não proíbe claims adicionais)
 * nem com o contrato (claims de JWT não fazem parte do schema OpenAPI).
 */
export interface AccessTokenPayload {
  /** membroId */
  sub: string;
  organizacaoId: string;
  /** sessaoId — usado só para logout revogar a sessão certa. */
  sid: string;
}
