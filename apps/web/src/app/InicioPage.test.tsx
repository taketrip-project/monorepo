import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InicioPage } from './InicioPage';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const PROXIMA_EXCURSAO = {
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

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<InicioPage />} />
        <Route path="/excursoes/nova" element={<div>Tela de nova excursão</div>} />
        <Route path="/excursoes/:id" element={<div>Tela de detalhe</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InicioPage', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('mostra a próxima excursão quando existe', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ proxima_excursao: PROXIMA_EXCURSAO }));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();

    expect(await screen.findByText('Serra Fina')).toBeInTheDocument();
    expect(screen.getByText('Aberta')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Serra Fina'));
    expect(await screen.findByText('Tela de detalhe')).toBeInTheDocument();
  });

  it('mostra estado vazio acolhedor quando não há próxima excursão', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ proxima_excursao: null }));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();

    expect(await screen.findByText(/Nenhuma excursão por aí ainda/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Criar excursão' }));
    expect(await screen.findByText('Tela de nova excursão')).toBeInTheDocument();
  });
});
