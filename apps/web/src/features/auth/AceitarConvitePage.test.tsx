import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AceitarConvitePage } from './AceitarConvitePage';
import { getAccessToken } from '../../lib/session';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function renderComToken(token = 'token-convite') {
  return render(
    <MemoryRouter initialEntries={[`/convite/aceitar?token=${token}`]}>
      <Routes>
        <Route path="/convite/aceitar" element={<AceitarConvitePage />} />
        <Route path="/login" element={<div>Tela de login</div>} />
        <Route path="/" element={<div>Home autenticada</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AceitarConvitePage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sem token na URL, trata como convite inválido', () => {
    render(
      <MemoryRouter initialEntries={['/convite/aceitar']}>
        <Routes>
          <Route path="/convite/aceitar" element={<AceitarConvitePage />} />
          <Route path="/login" element={<div>Tela de login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Convite inválido ou expirado' })).toBeInTheDocument();
  });

  it('aceita o convite com sucesso, guarda a sessão e navega para a home', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        tokens: { access_token: 'acc', refresh_token: 'ref', expira_em_segundos: 900 },
        membro: { id: '2', nome: 'Bruno Colega', email: 'bruno@ex.com', criado_em: '2026-01-01T00:00:00Z' },
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

    renderComToken();
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Bruno Colega' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar convite e entrar' }));

    await waitFor(() => expect(screen.getByText('Home autenticada')).toBeInTheDocument());
    expect(getAccessToken()).toBe('acc');
  });

  it('convite expirado/já aceito (401) mostra tela de convite inválido', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ erro: { codigo: 'convite_invalido', mensagem: 'Convite expirado.' } }, { status: 401 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderComToken();
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Bruno Colega' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar convite e entrar' }));

    expect(await screen.findByRole('heading', { name: 'Convite inválido ou expirado' })).toBeInTheDocument();
  });

  it('e-mail do convite já tem conta (409) mostra mensagem clara', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ erro: { codigo: 'email_ja_cadastrado', mensagem: 'Esse e-mail já tem uma conta.' } }, { status: 409 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderComToken();
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Bruno Colega' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar convite e entrar' }));

    expect(await screen.findByRole('heading', { name: 'Você já tem uma conta' })).toBeInTheDocument();
    expect(screen.getByText('Esse e-mail já tem uma conta.')).toBeInTheDocument();
  });
});
