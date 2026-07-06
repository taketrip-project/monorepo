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

  it('requisição autenticada sem 401 não tenta renovar nem repetir', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ ok: boolean }>('/organizacao');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer access-velho');
  });

  it('duas requisições concorrentes que tomam 401 disparam só um /auth/refresh (dedupe)', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ erro: { codigo: 'nao_autenticado', mensagem: 'Expirado' } }, { status: 401 }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ erro: { codigo: 'nao_autenticado', mensagem: 'Expirado' } }, { status: 401 }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'access-novo', refresh_token: 'refresh-novo', expira_em_segundos: 900 }),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, de: 'a' }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, de: 'b' }));
    vi.stubGlobal('fetch', fetchMock);

    const [resultA, resultB] = await Promise.all([
      apiFetch<{ ok: boolean; de: string }>('/organizacao'),
      apiFetch<{ ok: boolean; de: string }>('/organizacao/membros'),
    ]);

    expect(resultA).toEqual({ ok: true, de: 'a' });
    expect(resultB).toEqual({ ok: true, de: 'b' });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const chamadasRefresh = fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/refresh'));
    expect(chamadasRefresh).toHaveLength(1);
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
