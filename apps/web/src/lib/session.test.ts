import { beforeEach, describe, expect, it } from 'vitest';
import { clearSession, getAccessToken, getRefreshToken, hasSession, setSessionTokens } from './session';

describe('session', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('não há sessão quando localStorage está vazio', () => {
    expect(hasSession()).toBe(false);
  });

  it('guarda e recupera os tokens', () => {
    setSessionTokens({ accessToken: 'a', refreshToken: 'r' });
    expect(getAccessToken()).toBe('a');
    expect(getRefreshToken()).toBe('r');
    expect(hasSession()).toBe(true);
  });

  it('limpa a sessão', () => {
    setSessionTokens({ accessToken: 'a', refreshToken: 'r' });
    clearSession();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(hasSession()).toBe(false);
  });
});
