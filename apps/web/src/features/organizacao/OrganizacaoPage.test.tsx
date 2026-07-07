import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizacaoPage } from './OrganizacaoPage';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const ORGANIZACAO = {
  id: 'org-1',
  nome: 'Viação Ana',
  prazo_expiracao_reserva_horas: 48,
  sinal_default_percentual: 30,
  criado_em: '2026-01-01T00:00:00Z',
};

const MEMBROS = [
  { id: 'm1', nome: 'Ana Dona', email: 'ana@ex.com', criado_em: '2026-01-01T00:00:00Z' },
  { id: 'm2', nome: 'Bruno Colega', email: 'bruno@ex.com', criado_em: '2026-01-02T00:00:00Z' },
];

const CONVITES = [
  { id: 'c1', email: 'convidado@ex.com', expira_em: '2026-02-01T00:00:00Z', criado_em: '2026-01-01T00:00:00Z' },
];

function mockCargaInicial(fetchMock: ReturnType<typeof vi.fn>) {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(ORGANIZACAO))
    .mockResolvedValueOnce(jsonResponse(MEMBROS))
    .mockResolvedValueOnce(jsonResponse(CONVITES));
}

function renderPagina() {
  return render(
    <MemoryRouter>
      <OrganizacaoPage />
    </MemoryRouter>,
  );
}

describe('OrganizacaoPage', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('carrega e mostra organização, membros e convites', async () => {
    const fetchMock = vi.fn();
    mockCargaInicial(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();

    expect(await screen.findByText('Ana Dona')).toBeInTheDocument();
    expect(screen.getByText('Bruno Colega')).toBeInTheDocument();
    expect(screen.getByText('convidado@ex.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Viação Ana')).toBeInTheDocument();
  });

  it('remove um membro com sucesso', async () => {
    const fetchMock = vi.fn();
    mockCargaInicial(fetchMock);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText('Bruno Colega');
    fireEvent.click(screen.getByRole('button', { name: 'Remover Bruno Colega' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remover membro' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remover membro' }));

    await waitFor(() => expect(screen.queryByText('Bruno Colega')).not.toBeInTheDocument());
  });

  it('mostra o erro do backend ao tentar remover o último membro', async () => {
    const fetchMock = vi.fn();
    mockCargaInicial(fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { erro: { codigo: 'ultimo_membro', mensagem: 'Não dá para remover o último membro da equipe.' } },
        { status: 409 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText('Bruno Colega');
    fireEvent.click(screen.getByRole('button', { name: 'Remover Bruno Colega' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remover membro' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remover membro' }));

    expect(await screen.findByText('Não dá para remover o último membro da equipe.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover Bruno Colega' })).toBeInTheDocument();
  });

  it('bloqueia convite quando o limite de membros foi atingido', async () => {
    const fetchMock = vi.fn();
    mockCargaInicial(fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { erro: { codigo: 'limite_membros', mensagem: 'Sua equipe já está no limite de 3 pessoas.' } },
        { status: 409 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText('Ana Dona');
    fireEvent.click(screen.getByRole('button', { name: 'Convidar' }));

    const dialog = await screen.findByRole('dialog', { name: 'Convidar colega' });
    fireEvent.change(within(dialog).getByLabelText('E-mail'), { target: { value: 'novo@ex.com' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar convite' }));

    expect(await screen.findByText('Sua equipe já está no limite de 3 pessoas.')).toBeInTheDocument();
  });
});
