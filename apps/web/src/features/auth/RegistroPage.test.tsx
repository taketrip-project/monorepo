import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistroPage } from './RegistroPage';
import { getAccessToken } from '../../lib/session';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function renderRegistro() {
  return render(
    <MemoryRouter initialEntries={['/registro']}>
      <Routes>
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/" element={<div>Home autenticada</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function preencherFormulario() {
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Dona' } });
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@ex.com' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo123' } });
  fireEvent.change(screen.getByLabelText('Nome da empresa'), { target: { value: 'Viação Ana' } });
}

describe('RegistroPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registro com sucesso guarda a sessão e navega para a home', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        tokens: { access_token: 'acc', refresh_token: 'ref', expira_em_segundos: 900 },
        membro: { id: '1', nome: 'Ana Dona', email: 'ana@ex.com', criado_em: '2026-01-01T00:00:00Z' },
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

    renderRegistro();
    preencherFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(screen.getByText('Home autenticada')).toBeInTheDocument());
    expect(getAccessToken()).toBe('acc');
  });

  it('e-mail já cadastrado mostra erro no campo de e-mail, sem navegar', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        { erro: { codigo: 'email_ja_cadastrado', mensagem: 'Esse e-mail já tem uma conta.' } },
        { status: 409 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderRegistro();
    preencherFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Esse e-mail já tem uma conta.')).toBeInTheDocument();
    expect(screen.queryByText('Home autenticada')).not.toBeInTheDocument();
  });

  it('valida senha mínima de 8 caracteres antes de chamar a API', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderRegistro();
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@ex.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText('Nome da empresa'), { target: { value: 'Viação Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByText('A senha precisa ter pelo menos 8 caracteres.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
