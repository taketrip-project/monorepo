import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MaisPage } from './MaisPage';
import { getAccessToken, setSessionTokens } from '../lib/session';

function renderMais() {
  return render(
    <MemoryRouter initialEntries={['/mais']}>
      <Routes>
        <Route path="/mais" element={<MaisPage />} />
        <Route path="/login" element={<div>Tela de login</div>} />
        <Route path="/organizacao" element={<div>Tela da organização</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MaisPage', () => {
  beforeEach(() => {
    localStorage.clear();
    setSessionTokens({ accessToken: 'acc', refreshToken: 'ref' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sair limpa a sessão local e volta para /login mesmo se a API falhar', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('rede fora'));
    vi.stubGlobal('fetch', fetchMock);

    renderMais();
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(screen.getByText('Tela de login')).toBeInTheDocument());
    expect(getAccessToken()).toBeNull();
  });

  it('leva para a tela de organização ao clicar na linha', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderMais();
    fireEvent.click(screen.getByRole('button', { name: /Organização/ }));

    expect(screen.getByText('Tela da organização')).toBeInTheDocument();
  });
});
