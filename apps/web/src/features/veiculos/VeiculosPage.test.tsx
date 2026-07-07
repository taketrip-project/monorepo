import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VeiculosPage } from './VeiculosPage';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const VEICULOS = [
  {
    id: 'v1',
    apelido: 'Van 1',
    placa: 'ABC1D23',
    tipo: 'van',
    quantidade_poltronas: 16,
    capacidade: 15,
    layout: { fileiras: [] },
    poltronas_bloqueadas: [8],
    criado_em: '2026-01-01T00:00:00Z',
  },
  {
    id: 'v2',
    apelido: 'Ônibus 1',
    placa: 'XYZ9K87',
    tipo: 'onibus',
    quantidade_poltronas: 46,
    capacidade: 46,
    layout: { fileiras: [] },
    poltronas_bloqueadas: [],
    criado_em: '2026-01-02T00:00:00Z',
  },
];

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/veiculos']}>
      <Routes>
        <Route path="/veiculos" element={<VeiculosPage />} />
        <Route path="/veiculos/novo" element={<div>Tela de cadastro</div>} />
        <Route path="/veiculos/:id" element={<div>Tela de detalhe</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('VeiculosPage', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('lista os veículos da organização', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ dados: VEICULOS, paginacao: { pagina: 1, por_pagina: 20, total: 2 } }));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();

    expect(await screen.findByText('Van 1')).toBeInTheDocument();
    expect(screen.getByText('ABC1D23 · Van · 15 vagas')).toBeInTheDocument();
    expect(screen.getByText('Ônibus 1')).toBeInTheDocument();
    expect(screen.getByText('XYZ9K87 · Ônibus · 46 vagas')).toBeInTheDocument();
  });

  it('mostra estado vazio quando não há veículos', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ dados: [], paginacao: { pagina: 1, por_pagina: 20, total: 0 } }));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();

    expect(await screen.findByText(/Nenhum veículo cadastrado/)).toBeInTheDocument();
  });

  it('vai para o cadastro ao tocar no FAB', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ dados: VEICULOS, paginacao: { pagina: 1, por_pagina: 20, total: 2 } }));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText('Van 1');
    fireEvent.click(screen.getByRole('button', { name: 'Novo veículo' }));

    expect(await screen.findByText('Tela de cadastro')).toBeInTheDocument();
  });

  it('vai para o detalhe ao tocar num veículo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ dados: VEICULOS, paginacao: { pagina: 1, por_pagina: 20, total: 2 } }));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    fireEvent.click(await screen.findByText('Van 1'));

    expect(await screen.findByText('Tela de detalhe')).toBeInTheDocument();
  });
});
