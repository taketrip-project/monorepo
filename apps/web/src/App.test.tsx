import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { setSessionTokens } from './lib/session';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('sem sessão, redireciona / para /login (placeholder)', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('com sessão válida, / mostra a home protegida (placeholder)', () => {
    setSessionTokens({ accessToken: 'access', refreshToken: 'refresh' });
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Taketrip' })).toBeInTheDocument();
  });
});
