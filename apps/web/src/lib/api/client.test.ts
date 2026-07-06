import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, setSessionExpiredHandler } from './client';
import { clearSession, getAccessToken, setSessionTokens } from '../session';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('apiFetch — interceptor de refresh', () => {
  beforeEach(() => {
    localStorage.clear();
    setSessionTokens({ accessToken: 'access-velho', refreshToken: 'refresh-valido' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setSessionExpiredHandler(() => {
      window.location.assign('/login');
    });
  });

  it('em 401, renova via /auth/refresh e repete a requisição original com o novo access token', async () => {
    const fetchMock = vi.fn();
    // 1) requisição original -> 401 (access expirado)
    fetchMock.mockResolvedValueOnce(jsonResponse({ erro: { codigo: 'nao_autenticado', mensagem: 'Expirado' } }, { status: 401 }));
    // 2) /auth/refresh -> novos tokens
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'access-novo', refresh_token: 'refresh-novo', expira_em_segundos: 900 }),
    );
    // 3) requisição repetida -> sucesso
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ ok: boolean }>('/organizacao');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toEqual(expect.stringContaining('/auth/refresh'));
    expect(getAccessToken()).toBe('access-novo');

    // a requisição repetida deve usar o access token NOVO
    const retryHeaders = fetchMock.mock.calls[2][1]?.headers as Headers;
    expect(retryHeaders.get('Authorization')).toBe('Bearer access-novo');
  });

  it('quando o refresh também falha, limpa a sessão e aciona o handler de sessão expirada', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ erro: { codigo: 'nao_autenticado', mensagem: 'Expirado' } }, { status: 401 }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ erro: { codigo: 'sessao_invalida', mensagem: 'Sessão inválida' } }, { status: 401 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const onSessionExpired = vi.fn();
    setSessionExpiredHandler(onSessionExpired);

    await expect(apiFetch('/organizacao')).rejects.toMatchObject({ status: 401 });

    expect(onSessionExpired).toHaveBeenCalledOnce();
    expect(getAccessToken()).toBeNull();
  });

  it('não injeta Authorization quando auth: false (endpoints públicos)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    clearSession();

    await apiFetch('/auth/login', { method: 'POST', body: { email: 'a@b.com', senha: 'x' }, auth: false });

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.has('Authorization')).toBe(false);
  });
});
