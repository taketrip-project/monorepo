import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSessionTokens } from './lib/session';
import App from './App';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sem sessão, redireciona / para /login', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('com sessão válida, / mostra o shell autenticado (Início + BottomNav)', async () => {
    setSessionTokens({ accessToken: 'access', refreshToken: 'refresh' });
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ proxima_excursao: null }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    expect(screen.getByRole('heading', { name: 'Início' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
    await screen.findByText(/Nenhuma excursão por aí ainda/);
  });

  it('sem sessão, uma rota protegida qualquer também redireciona para /login', () => {
    window.history.pushState({}, '', '/organizacao');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });
});
