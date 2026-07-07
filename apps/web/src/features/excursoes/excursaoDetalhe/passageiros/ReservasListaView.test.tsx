import { render, screen, fireEvent, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReservasListaView } from './ReservasListaView';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function reserva(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'r1',
    excursao_id: 'e1',
    poltrona: 5,
    status: 'ativa',
    status_pagamento: 'pendente',
    origem: 'organizador',
    forma_pagamento: null,
    valor_centavos: 18000,
    ponto_embarque_id: null,
    expira_em: null,
    embarcada_em: null,
    passageiro: { id: 'p1', nome: 'Maria Silva', whatsapp: '+5511999998888', cpf: null },
    criado_em: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ReservasListaView', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('lista as reservas com nome, poltrona, valor e status de pagamento', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse({ dados: [reserva()], paginacao: { pagina: 1, por_pagina: 20, total: 1 } })),
    );

    render(<ReservasListaView excursaoId="e1" onAbrirFicha={vi.fn()} onImprimir={vi.fn()} imprimindo={false} refreshKey={0} />);

    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText(/Poltrona 5/)).toBeInTheDocument();
    const linha = screen.getByRole('button', { name: /Maria Silva/ });
    expect(within(linha).getByText('Pendente')).toBeInTheDocument();
  });

  it('mostra estado vazio apontando pro Mapa quando não há reservas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse({ dados: [], paginacao: { pagina: 1, por_pagina: 20, total: 0 } })),
    );

    render(<ReservasListaView excursaoId="e1" onAbrirFicha={vi.fn()} onImprimir={vi.fn()} imprimindo={false} refreshKey={0} />);

    expect(await screen.findByText(/Toque numa poltrona livre no Mapa/)).toBeInTheDocument();
  });

  it('abre a ficha ao tocar numa reserva da lista', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse({ dados: [reserva()], paginacao: { pagina: 1, por_pagina: 20, total: 1 } })),
    );
    const onAbrirFicha = vi.fn();

    render(<ReservasListaView excursaoId="e1" onAbrirFicha={onAbrirFicha} onImprimir={vi.fn()} imprimindo={false} refreshKey={0} />);

    fireEvent.click(await screen.findByText('Maria Silva'));
    expect(onAbrirFicha).toHaveBeenCalledWith('r1');
  });

  it('busca por nome ou poltrona após o debounce', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ dados: [reserva()], paginacao: { pagina: 1, por_pagina: 20, total: 1 } }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ dados: [], paginacao: { pagina: 1, por_pagina: 20, total: 0 } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<ReservasListaView excursaoId="e1" onAbrirFicha={vi.fn()} onImprimir={vi.fn()} imprimindo={false} refreshKey={0} />);
    await screen.findByText('Maria Silva');

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'joão' } });

    await screen.findByText(/Toque numa poltrona livre no Mapa/, {}, { timeout: 1000 });
    const chamadaBusca = fetchMock.mock.calls[1][0] as string;
    expect(chamadaBusca).toContain('busca=jo');
  });

  it('filtra por status de pagamento ao tocar num chip', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ dados: [reserva()], paginacao: { pagina: 1, por_pagina: 20, total: 1 } }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ dados: [reserva({ status_pagamento: 'pago' })], paginacao: { pagina: 1, por_pagina: 20, total: 1 } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<ReservasListaView excursaoId="e1" onAbrirFicha={vi.fn()} onImprimir={vi.fn()} imprimindo={false} refreshKey={0} />);
    await screen.findByText('Maria Silva');

    fireEvent.click(screen.getByRole('button', { name: 'Pago' }));

    const linha = await screen.findByRole('button', { name: /Maria Silva/ });
    expect(within(linha).getByText('Pago')).toBeInTheDocument();
    const chamadaFiltro = fetchMock.mock.calls[1][0] as string;
    expect(chamadaFiltro).toContain('status_pagamento=pago');
  });

  it('chama onImprimir ao tocar em "Imprimir lista"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse({ dados: [reserva()], paginacao: { pagina: 1, por_pagina: 20, total: 1 } })),
    );
    const onImprimir = vi.fn();

    render(<ReservasListaView excursaoId="e1" onAbrirFicha={vi.fn()} onImprimir={onImprimir} imprimindo={false} refreshKey={0} />);
    await screen.findByText('Maria Silva');

    fireEvent.click(screen.getByRole('button', { name: 'Imprimir lista' }));
    expect(onImprimir).toHaveBeenCalled();
  });
});
