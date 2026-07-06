/**
 * Sessão do organizador — guardada em localStorage para o MVP (ADR 004:
 * "o app web guarda o refresh em localStorage... mitigação de XSS é
 * responsabilidade do frontend"). Access token: JWT de 15 min. Refresh
 * token: opaco, rotativo, 30 dias.
 */

const ACCESS_TOKEN_KEY = 'tt_access_token';
const REFRESH_TOKEN_KEY = 'tt_refresh_token';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setSessionTokens({ accessToken, refreshToken }: SessionTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * "Sessão válida" para fins de rota protegida = existe refresh token
 * guardado. O access token pode estar expirado (dura só 15 min); o
 * cliente HTTP renova automaticamente na próxima chamada — não vale a
 * pena validar o JWT no cliente antes disso.
 */
export function hasSession(): boolean {
  return getRefreshToken() !== null;
}
