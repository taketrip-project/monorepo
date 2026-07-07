import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { getAccessToken } from '../../lib/session';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Home autenticada</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('login com sucesso guarda a sessão e navega para a home', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        tokens: { access_token: 'acc', refresh_token: 'ref', expira_em_segundos: 900 },
        membro: { id: '1', nome: 'Ana', email: 'ana@ex.com', criado_em: '2026-01-01T00:00:00Z' },
        organizacao: {
          id: 'o1',
          nome: 'Viação Ana',
          prazo_expiracao_reserva_horas: 48,
          sinal_default_percentual: 30,
          criado_em: '2026-01-01T00:00:00Z',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderLogin();
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@ex.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.getByText('Home autenticada')).toBeInTheDocument());
    expect(getAccessToken()).toBe('acc');
  });

  it('login com credenciais erradas mostra erro inline e não navega', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        { erro: { codigo: 'credenciais_invalidas', mensagem: 'E-mail ou senha errados.' } },
        { status: 401 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderLogin();
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@ex.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'errada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('E-mail ou senha errados.')).toBeInTheDocument();
    expect(screen.queryByText('Home autenticada')).not.toBeInTheDocument();
  });

  it('valida os campos antes de chamar a API', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(screen.getByText('Digite um e-mail válido.')).toBeInTheDocument();
    expect(screen.getByText('Digite sua senha.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('em 429, mostra o tempo de espera do Retry-After e desabilita o botão', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        { erro: { codigo: 'muitas_tentativas', mensagem: 'Muitas tentativas seguidas.' } },
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderLogin();
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@ex.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/Tente de novo em 30s/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aguarde 30s/ })).toBeDisabled();
  });
});
