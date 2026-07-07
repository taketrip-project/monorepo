import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbarqueView } from './EmbarqueView';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const LISTA = {
  excursao_id: 'e1',
  embarcados: 1,
  total: 2,
  grupos: [
    {
      ponto_embarque: { id: 'p1', local: 'Praça Central', horario: '2026-06-15T05:00:00-03:00', ordem: 1 },
      passageiros: [
        { reserva_id: 'r1', nome: 'Maria Silva', poltrona: 5, embarcada: false, embarcada_em: null },
        { reserva_id: 'r2', nome: 'João Souza', poltrona: 8, embarcada: true, embarcada_em: '2026-06-15T05:10:00-03:00' },
      ],
    },
  ],
};

describe('EmbarqueView', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('mostra o KPI embarcados/total e agrupa por ponto de embarque', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(LISTA)));
    render(<EmbarqueView excursaoId="e1" refreshKey={0} />);

    expect(await screen.findByText('1/2 embarcaram')).toBeInTheDocument();
    expect(screen.getByText('Praça Central')).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('João Souza')).toBeInTheDocument();
  });

  it('1 toque marca embarque e reflete na hora (otimista)', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(LISTA));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'r1',
        excursao_id: 'e1',
        poltrona: 5,
        status: 'embarcada',
        status_pagamento: 'pendente',
        origem: 'organizador',
        forma_pagamento: null,
        valor_centavos: 18000,
        ponto_embarque_id: 'p1',
        expira_em: null,
        embarcada_em: '2026-06-15T05:20:00-03:00',
        passageiro: { id: 'p1', nome: 'Maria Silva', whatsapp: '+5511999998888', cpf: null },
        criado_em: '2026-01-01T00:00:00Z',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<EmbarqueView excursaoId="e1" refreshKey={0} />);
    await screen.findByText('Maria Silva');

    fireEvent.click(screen.getByRole('button', { name: /Maria Silva/ }));

    // Otimista: já mostra embarcado antes da resposta do servidor.
    expect(screen.getByRole('button', { name: /Maria Silva/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('2/2 embarcaram')).toBeInTheDocument();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const chamada = fetchMock.mock.calls[1];
    expect(String(chamada[0])).toContain('/reservas/r1/embarque');
    expect((chamada[1] as RequestInit).method).toBe('POST');
  });

  it('1 toque de novo desfaz o embarque (chama DELETE)', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(LISTA));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'r2',
        excursao_id: 'e1',
        poltrona: 8,
        status: 'ativa',
        status_pagamento: 'pendente',
        origem: 'organizador',
        forma_pagamento: null,
        valor_centavos: 18000,
        ponto_embarque_id: 'p1',
        expira_em: null,
        embarcada_em: null,
        passageiro: { id: 'p2', nome: 'João Souza', whatsapp: '+5511999997777', cpf: null },
        criado_em: '2026-01-01T00:00:00Z',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<EmbarqueView excursaoId="e1" refreshKey={0} />);
    await screen.findByText('João Souza');

    fireEvent.click(screen.getByRole('button', { name: /João Souza/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const chamada = fetchMock.mock.calls[1];
    expect(String(chamada[0])).toContain('/reservas/r2/embarque');
    expect((chamada[1] as RequestInit).method).toBe('DELETE');
  });

  it('desfaz a atualização otimista se o servidor rejeitar', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(LISTA));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ erro: { codigo: 'transicao_invalida', mensagem: 'Essa reserva não está ativa.' } }, { status: 409 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<EmbarqueView excursaoId="e1" refreshKey={0} />);
    await screen.findByText('Maria Silva');

    fireEvent.click(screen.getByRole('button', { name: /Maria Silva/ }));

    expect(await screen.findByText('Essa reserva não está ativa.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Maria Silva/ })).toHaveAttribute('aria-pressed', 'false');
  });
});
