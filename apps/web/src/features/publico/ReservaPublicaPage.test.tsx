import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReservaPublicaPage } from './ReservaPublicaPage';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function situacao(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    reserva_id: 'af0e8c1e-0000-7000-8000-000000000001',
    poltrona: 12,
    status: 'ativa',
    status_pagamento: 'pendente',
    destino: 'Serra Fina',
    data_saida: '2026-06-15T05:30:00-03:00',
    expira_em: '2026-06-13T18:00:00-03:00',
    cobranca: null,
    instrucoes: 'Sua poltrona tá guardada até sábado, 13/06, às 18h — combine o sinal com o organizador.',
    ...overrides,
  };
}

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/r/af0e8c1e-0000-7000-8000-000000000001']}>
      <Routes>
        <Route path="/r/:reservaId" element={<ReservaPublicaPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReservaPublicaPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('mostra destino, poltrona, badges de status e as instruções de pagamento', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(situacao())));
    vi.stubGlobal('fetch', fetchMock);
    renderPagina();

    expect(await screen.findByRole('heading', { name: 'Serra Fina' })).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('sua poltrona')).toBeInTheDocument();
    expect(screen.getByText('Ativa')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText(/Sua poltrona tá guardada até sábado/)).toBeInTheDocument();
    expect(screen.getByText(/Guarde este link/)).toBeInTheDocument();
  });

  it('polling: pendente vira Pago sem refresh e o polling para', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(situacao()))
      .mockResolvedValueOnce(jsonResponse(situacao({ status_pagamento: 'pago', instrucoes: null })));
    vi.stubGlobal('fetch', fetchMock);
    renderPagina();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText('Pendente')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(screen.getByText('Pago')).toBeInTheDocument();
    expect(screen.getByText(/Pagamento confirmado/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Pago é estado final — nenhuma consulta a mais.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reserva expirada mostra o aviso e não faz polling', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(situacao({ status: 'expirada', instrucoes: null }))));
    vi.stubGlobal('fetch', fetchMock);
    renderPagina();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/Sua reserva expirou/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reserva cancelada mostra o aviso com cor + ícone + texto', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(situacao({ status: 'cancelada', status_pagamento: 'cancelado', instrucoes: null }))),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderPagina();

    expect(await screen.findByText(/Esta reserva foi cancelada/)).toBeInTheDocument();
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
  });

  it('cobrança PIX: QR, copia e cola e botão de copiar', async () => {
    const escreverMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: escreverMock } });
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(
          situacao({
            cobranca: {
              valor_centavos: 9000,
              tipo: 'sinal',
              copia_e_cola: '00020126580014BR.GOV.BCB.PIX',
              qr_code_base64: 'aGVsbG8=',
              expira_em: '2026-06-13T18:00:00-03:00',
            },
          }),
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderPagina();

    expect(await screen.findByText(/Pague com PIX/)).toBeInTheDocument();
    expect(screen.getByText('R$ 90,00')).toBeInTheDocument();
    expect(screen.getByAltText('QR code do PIX')).toHaveAttribute('src', 'data:image/png;base64,aGVsbG8=');
    expect(screen.getByText('00020126580014BR.GOV.BCB.PIX')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copiar código PIX' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copiado ✓' })).toBeInTheDocument());
    expect(escreverMock).toHaveBeenCalledWith('00020126580014BR.GOV.BCB.PIX');
  });

  it('404 mostra reserva não encontrada, sem retry', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse({ erro: { codigo: 'nao_encontrado', mensagem: 'Reserva não encontrada.' } }, { status: 404 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderPagina();

    expect(await screen.findByRole('heading', { name: 'Reserva não encontrada' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('erro de rede sem dados mostra tela de sem conexão e o botão refaz a consulta', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    vi.stubGlobal('fetch', fetchMock);
    renderPagina();

    expect(await screen.findByRole('heading', { name: 'Sem conexão' })).toBeInTheDocument();

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(situacao()))));
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Serra Fina' })).toBeInTheDocument();
  });
});
