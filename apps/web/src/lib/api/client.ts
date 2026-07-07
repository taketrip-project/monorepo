import { clearSession, getAccessToken, getRefreshToken, setSessionTokens } from '../session';
import type { ApiTokens } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export class ApiError extends Error {
  status: number;
  codigo: string;
  /** Mensagem pt-BR pronta para exibir (igual a `.message`, herdado de Error — exposta aqui de novo para ficar a par de `codigo`/`detalhes`, que também são pt-BR). */
  mensagem: string;
  detalhes?: unknown;
  /** Presente quando a resposta traz o header Retry-After (ex.: 429 em /auth/login). */
  retryAfterSeconds?: number;

  constructor(status: number, codigo: string, mensagem: string, detalhes?: unknown, retryAfterSeconds?: number) {
    super(mensagem);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo;
    this.mensagem = mensagem;
    this.detalhes = detalhes;
    this.retryAfterSeconds = retryAfterSeconds;
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

/** Extrai o Retry-After (segundos) quando presente — ex.: 429 de /auth/login. */
function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers.get('Retry-After');
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isNaN(seconds) ? undefined : seconds;
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
    const isFormData = body instanceof FormData;
    // FormData define seu próprio Content-Type (multipart + boundary) — o
    // navegador cuida disso sozinho; setar manualmente quebraria o boundary.
    if (hasBody && !isFormData && !finalHeaders.has('Content-Type')) {
      finalHeaders.set('Content-Type', 'application/json');
    }
    if (auth) {
      const token = getAccessToken();
      if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
    }
    return {
      ...rest,
      headers: finalHeaders,
      body: hasBody ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
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
      throw new ApiError(401, codigo, mensagem, detalhes, parseRetryAfter(response));
    }

    response = await fetch(`${API_URL}${path}`, buildRequest());
  }

  if (!response.ok) {
    const { codigo, mensagem, detalhes } = await parseErrorBody(response);
    throw new ApiError(response.status, codigo, mensagem, detalhes, parseRetryAfter(response));
  }

  // 204 e alguns 202 (ex. POST /auth/esqueci-senha) respondem sem corpo.
  // response.json() rejeitaria com corpo vazio, então lemos como texto e só
  // fazemos parse se houver conteúdo — cobre 204 sem precisar de um branch à parte.
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
