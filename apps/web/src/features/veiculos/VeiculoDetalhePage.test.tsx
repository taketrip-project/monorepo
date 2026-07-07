import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VeiculoDetalhePage } from './VeiculoDetalhePage';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const VEICULO = {
  id: 'v1',
  apelido: 'Van 1',
  placa: 'ABC1D23',
  tipo: 'van',
  quantidade_poltronas: 15,
  capacidade: 15,
  layout: { fileiras: [[1, 2, null, 3, 4]] },
  poltronas_bloqueadas: [] as number[],
  criado_em: '2026-01-01T00:00:00Z',
};

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/veiculos/v1']}>
      <Routes>
        <Route path="/veiculos/:id" element={<VeiculoDetalhePage />} />
        <Route path="/veiculos" element={<div>Tela de lista</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('VeiculoDetalhePage', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('bloqueia uma poltrona na grade e salva', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(VEICULO));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText('Van 1');

    fireEvent.click(screen.getByLabelText('Poltrona 3, livre. Toque para bloquear.'));
    expect(screen.getByLabelText('Poltrona 3, bloqueada. Toque para desbloquear.')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(jsonResponse({ ...VEICULO, poltronas_bloqueadas: [3] }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();

    const chamadaPatch = fetchMock.mock.calls[1];
    const corpo = JSON.parse((chamadaPatch[1] as RequestInit).body as string);
    expect(corpo.poltronas_bloqueadas).toEqual([3]);
  });

  it('exclui após confirmar quando o servidor exige confirmação', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(VEICULO));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText('Van 1');

    fireEvent.click(screen.getByRole('button', { name: 'Excluir veículo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Excluir veículo' });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          erro: {
            codigo: 'veiculo_em_uso_requer_confirmacao',
            mensagem: 'Esse veículo está numa excursão publicada. Confirmar mesmo assim?',
          },
        },
        { status: 409 },
      ),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir veículo' }));

    expect(
      await screen.findByText('Esse veículo está numa excursão publicada. Confirmar mesmo assim?'),
    ).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar exclusão' }));

    expect(await screen.findByText('Tela de lista')).toBeInTheDocument();

    const chamadaDeleteConfirmada = fetchMock.mock.calls[2][0] as string;
    expect(chamadaDeleteConfirmada).toContain('confirmar=true');
  });

  it('bloqueia a exclusão quando há excursão futura vinculada', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(VEICULO));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText('Van 1');

    fireEvent.click(screen.getByRole('button', { name: 'Excluir veículo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Excluir veículo' });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          erro: {
            codigo: 'veiculo_com_excursao_futura',
            mensagem: 'Esse veículo está escalado numa excursão futura publicada e não pode ser excluído.',
          },
        },
        { status: 409 },
      ),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir veículo' }));

    expect(
      await screen.findByText('Esse veículo está escalado numa excursão futura publicada e não pode ser excluído.'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Confirmar exclusão' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Excluir veículo' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Entendi' })).toBeInTheDocument();
  });
});
