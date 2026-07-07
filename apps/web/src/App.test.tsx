import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { setSessionTokens } from './lib/session';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('sem sessão, redireciona / para /login', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('com sessão válida, / mostra o shell autenticado (Início + BottomNav)', () => {
    setSessionTokens({ accessToken: 'access', refreshToken: 'refresh' });
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Início' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
  });

  it('sem sessão, uma rota protegida qualquer também redireciona para /login', () => {
    window.history.pushState({}, '', '/organizacao');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });
});
