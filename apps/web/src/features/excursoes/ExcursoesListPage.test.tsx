import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExcursoesListPage } from './ExcursoesListPage';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const EXCURSAO_PROXIMA = {
  id: 'e1',
  status: 'publicada',
  destino: 'Serra Fina',
  evento_ancora: null,
  data_saida: '2026-06-15T05:30:00-03:00',
  tipo: 'bate_volta',
  vagas: 12,
  capacidade: 46,
  pagos: 28,
  pendentes: 6,
  foto_capa_url: null,
};

const EXCURSAO_RASCUNHO = {
  id: 'e2',
  status: 'rascunho',
  destino: 'Praia do Rosa',
  evento_ancora: null,
  data_saida: '2026-07-01T05:00:00-03:00',
  tipo: 'pernoite',
  vagas: 46,
  capacidade: 46,
  pagos: 0,
  pendentes: 0,
  foto_capa_url: null,
};

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/excursoes']}>
      <Routes>
        <Route path="/excursoes" element={<ExcursoesListPage />} />
        <Route path="/excursoes/nova" element={<div>Tela de nova excursão</div>} />
        <Route path="/excursoes/:id" element={<div>Tela de detalhe</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ExcursoesListPage', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('lista as excursões do filtro padrão (Próximas)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ dados: [EXCURSAO_PROXIMA], paginacao: { pagina: 1, por_pagina: 20, total: 1 } }));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();

    expect(await screen.findByText('Serra Fina')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toContain('filtro=proximas');
  });

  it('troca de filtro e recarrega a lista', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ dados: [EXCURSAO_PROXIMA], paginacao: { pagina: 1, por_pagina: 20, total: 1 } }))
      .mockResolvedValueOnce(jsonResponse({ dados: [EXCURSAO_RASCUNHO], paginacao: { pagina: 1, por_pagina: 20, total: 1 } }));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText('Serra Fina');

    fireEvent.click(screen.getByRole('tab', { name: 'Rascunho' }));

    expect(await screen.findByText('Praia do Rosa')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toContain('filtro=rascunho');
  });

  it('mostra estado vazio contextual quando o filtro não tem excursões', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ dados: [], paginacao: { pagina: 1, por_pagina: 20, total: 0 } }));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();

    expect(await screen.findByText(/Nenhuma excursão por aí ainda/)).toBeInTheDocument();
  });

  it('vai para a criação ao tocar no FAB', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ dados: [EXCURSAO_PROXIMA], paginacao: { pagina: 1, por_pagina: 20, total: 1 } }));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText('Serra Fina');
    fireEvent.click(screen.getByRole('button', { name: 'Nova excursão' }));

    expect(await screen.findByText('Tela de nova excursão')).toBeInTheDocument();
  });

  it('vai para o detalhe ao tocar num card', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ dados: [EXCURSAO_PROXIMA], paginacao: { pagina: 1, por_pagina: 20, total: 1 } }));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    fireEvent.click(await screen.findByText('Serra Fina'));

    expect(await screen.findByText('Tela de detalhe')).toBeInTheDocument();
  });
});
