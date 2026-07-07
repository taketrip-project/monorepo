import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RedefinirSenhaPage } from './RedefinirSenhaPage';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function renderComToken(token = 'token-valido') {
  return render(
    <MemoryRouter initialEntries={[`/redefinir-senha?token=${token}`]}>
      <Routes>
        <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
        <Route path="/esqueci-senha" element={<div>Tela de esqueci a senha</div>} />
        <Route path="/login" element={<div>Tela de login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RedefinirSenhaPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sem token na URL, trata como link inválido e direciona para esqueci a senha', () => {
    render(
      <MemoryRouter initialEntries={['/redefinir-senha']}>
        <Routes>
          <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
          <Route path="/esqueci-senha" element={<div>Tela de esqueci a senha</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pedir um novo link' }));
    expect(screen.getByText('Tela de esqueci a senha')).toBeInTheDocument();
  });

  it('token inválido/expirado (401) direciona para esqueci a senha', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ erro: { codigo: 'token_invalido', mensagem: 'Link expirado.' } }, { status: 401 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderComToken();
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'novasenha123' } });
    fireEvent.change(screen.getByLabelText('Confirme a nova senha'), { target: { value: 'novasenha123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(await screen.findByRole('heading', { name: 'Link inválido ou expirado' })).toBeInTheDocument();
  });

  it('valida que as senhas devem coincidir', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderComToken();
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'novasenha123' } });
    fireEvent.change(screen.getByLabelText('Confirme a nova senha'), { target: { value: 'outrasenha123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sucesso mostra confirmação e leva para o login', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    renderComToken();
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'novasenha123' } });
    fireEvent.change(screen.getByLabelText('Confirme a nova senha'), { target: { value: 'novasenha123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Senha redefinida' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Ir para o login' }));
    expect(screen.getByText('Tela de login')).toBeInTheDocument();
  });
});
