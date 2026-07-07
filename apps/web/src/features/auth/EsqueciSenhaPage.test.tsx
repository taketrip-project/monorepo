import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EsqueciSenhaPage } from './EsqueciSenhaPage';

describe('EsqueciSenhaPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sempre mostra a mesma mensagem de sucesso após enviar (API sempre responde 202)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <EsqueciSenhaPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'qualquer@ex.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(await screen.findByText(/Se esse e-mail estiver cadastrado/)).toBeInTheDocument();
  });

  it('valida formato de e-mail antes de chamar a API', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <EsqueciSenhaPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'invalido' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(screen.getByText('Digite um e-mail válido.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
