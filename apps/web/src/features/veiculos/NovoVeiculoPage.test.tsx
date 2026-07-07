import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NovoVeiculoPage } from './NovoVeiculoPage';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const LAYOUT_VAN = { fileiras: [[1, 2, null, 3, 4]] };
const LAYOUT_ONIBUS = { fileiras: [[10, 11, null, 12, 13]] };

const VEICULO_CRIADO = {
  id: 'v1',
  apelido: 'Van 1',
  placa: 'ABC1D23',
  tipo: 'van',
  quantidade_poltronas: 15,
  capacidade: 15,
  layout: LAYOUT_VAN,
  poltronas_bloqueadas: [],
  criado_em: '2026-01-01T00:00:00Z',
};

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/veiculos/novo']}>
      <Routes>
        <Route path="/veiculos/novo" element={<NovoVeiculoPage />} />
        <Route path="/veiculos/:id" element={<div>Tela de detalhe</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NovoVeiculoPage', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('cadastra um veículo com sucesso e vai para o detalhe', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(LAYOUT_VAN)); // preview inicial (van, 15)
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fetchMock.mockResolvedValueOnce(jsonResponse(VEICULO_CRIADO, { status: 201 }));

    fireEvent.change(screen.getByLabelText('Apelido'), { target: { value: 'Van 1' } });
    fireEvent.change(screen.getByLabelText('Placa'), { target: { value: 'abc1d23' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar veículo' }));

    expect(await screen.findByText('Tela de detalhe')).toBeInTheDocument();
  });

  it('mostra erro inline quando a placa já está cadastrada (409)', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(LAYOUT_VAN));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { erro: { codigo: 'placa_ja_cadastrada', mensagem: 'Essa placa já está cadastrada na sua organização.' } },
        { status: 409 },
      ),
    );

    fireEvent.change(screen.getByLabelText('Apelido'), { target: { value: 'Van 1' } });
    fireEvent.change(screen.getByLabelText('Placa'), { target: { value: 'ABC1D23' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar veículo' }));

    expect(
      await screen.findByText('Essa placa já está cadastrada na sua organização.'),
    ).toBeInTheDocument();
  });

  it('atualiza a pré-visualização do layout ao trocar o tipo de veículo', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(LAYOUT_VAN));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByLabelText('Poltrona 1, livre')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(jsonResponse(LAYOUT_ONIBUS));
    fireEvent.click(screen.getByRole('button', { name: 'Ônibus' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByLabelText('Poltrona 10, livre')).toBeInTheDocument();
    expect(screen.queryByLabelText('Poltrona 1, livre')).not.toBeInTheDocument();

    const chamada = fetchMock.mock.calls[1][0] as string;
    expect(chamada).toContain('tipo=onibus');
    expect(chamada).toContain('quantidade_poltronas=42');
  });
});
