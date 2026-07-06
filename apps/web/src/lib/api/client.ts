import { clearSession, getAccessToken, getRefreshToken, setSessionTokens } from '../session';
import type { ApiTokens } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export class ApiError extends Error {
  status: number;
  codigo: string;
  detalhes?: unknown;

  constructor(status: number, codigo: string, mensagem: string, detalhes?: unknown) {
    super(mensagem);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

/**
 * Chamado quando o refresh falha (token revogado/expirado) — desloga e
 * manda para /login. Sobrescrito pelo app shell (ex.: para usar o router
 * em vez de um reload de página); por padrão faz um redirect "cru".
 */
let sessionExpiredHandler: () => void = () => {
  window.location.assign('/login');
};

export function setSessionExpiredHandler(handler: () => void): void {
  sessionExpiredHandler = handler;
}

// Compartilhada entre chamadas concorrentes: evita disparar múltiplos
// /auth/refresh em paralelo quando várias requisições tomam 401 ao mesmo tempo.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return false;

    const tokens = (await response.json()) as ApiTokens;
    setSessionTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
    return true;
  } catch {
    return false;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** false para endpoints públicos (login, registro, refresh...) — pula o Bearer e o retry de 401. */
  auth?: boolean;
  body?: unknown;
}

async function parseErrorBody(response: Response): Promise<{ codigo: string; mensagem: string; detalhes?: unknown }> {
  try {
    const data = await response.json();
    return {
      codigo: data?.erro?.codigo ?? 'erro_desconhecido',
      mensagem: data?.erro?.mensagem ?? 'Algo deu errado. Tente novamente.',
      detalhes: data?.erro?.detalhes,
    };
  } catch {
    return { codigo: 'erro_desconhecido', mensagem: 'Algo deu errado. Tente novamente.' };
  }
}

/**
 * Cliente HTTP do Taketrip: injeta o access token automaticamente e, em
 * caso de 401, tenta renovar a sessão via /auth/refresh UMA vez e repete a
 * requisição original. Se o refresh também falhar, limpa a sessão e
 * notifica o app (que redireciona para /login).
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { auth = true, headers, body, ...rest } = options;

  const buildRequest = (): RequestInit => {
    const finalHeaders = new Headers(headers);
    const hasBody = body !== undefined;
    if (hasBody && !finalHeaders.has('Content-Type')) {
      finalHeaders.set('Content-Type', 'application/json');
    }
    if (auth) {
      const token = getAccessToken();
      if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
    }
    return {
      ...rest,
      headers: finalHeaders,
      body: hasBody ? JSON.stringify(body) : undefined,
    };
  };

  let response = await fetch(`${API_URL}${path}`, buildRequest());

  if (response.status === 401 && auth) {
    if (!refreshInFlight) {
      refreshInFlight = refreshSession().finally(() => {
        refreshInFlight = null;
      });
    }
    const refreshed = await refreshInFlight;

    if (!refreshed) {
      clearSession();
      sessionExpiredHandler();
      const { codigo, mensagem, detalhes } = await parseErrorBody(response);
      throw new ApiError(401, codigo, mensagem, detalhes);
    }

    response = await fetch(`${API_URL}${path}`, buildRequest());
  }

  if (!response.ok) {
    const { codigo, mensagem, detalhes } = await parseErrorBody(response);
    throw new ApiError(response.status, codigo, mensagem, detalhes);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
