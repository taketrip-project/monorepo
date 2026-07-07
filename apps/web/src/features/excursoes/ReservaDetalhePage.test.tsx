import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReservaDetalhePage } from './ReservaDetalhePage';

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

function excursao(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'e1',
    status: 'publicada',
    destino: 'Serra Fina',
    evento_ancora: null,
    data_saida: '2026-06-15T05:30:00-03:00',
    data_retorno: '2026-06-15T20:00:00-03:00',
    tipo: 'bate_volta',
    vagas: 10,
    capacidade: 15,
    pagos: 1,
    pendentes: 1,
    foto_capa_url: null,
    preco_centavos: 18000,
    sinal_tipo: 'percentual',
    sinal_valor: 50,
    sinal_centavos: 9000,
    descricao: null,
    veiculo_id: 'v1',
    motivo_cancelamento: null,
    codigo_publico: 'abc123',
    url_publica: 'https://taketrip.app/e/abc123',
    custo_total_centavos: null,
    viabilidade: null,
    checklist_legal: { licenca_antt: false, seguro_passageiros: false, lista_impressa: false },
    fotos: [],
    pontos_embarque: [{ id: 'pe1', local: 'Praça Central', horario: '2026-06-15T05:00:00-03:00', ordem: 1 }],
    criado_em: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/excursoes/e1/reservas/r1']}>
      <Routes>
        <Route path="/excursoes/:id/reservas/:reservaId" element={<ReservaDetalhePage />} />
        <Route path="/excursoes/:id" element={<div>Detalhe da excursão</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReservaDetalhePage', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('carrega e mostra nome, poltrona e badges de status', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(reserva()));
    fetchMock.mockResolvedValueOnce(jsonResponse(excursao()));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();

    expect(await screen.findByRole('heading', { name: 'Maria Silva' })).toBeInTheDocument();
    expect(screen.getByText(/Serra Fina/)).toBeInTheDocument();
    expect(screen.getByText('Ativa')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
  });

  it('marca sinal pago com 1 toque', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(reserva()));
    fetchMock.mockResolvedValueOnce(jsonResponse(excursao()));
    fetchMock.mockResolvedValueOnce(jsonResponse(reserva({ status_pagamento: 'sinal_pago' })));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByRole('heading', { name: 'Maria Silva' });

    fireEvent.click(screen.getByRole('button', { name: 'Marcar sinal pago' }));

    await waitFor(() => expect(screen.getByText('Sinal pago')).toBeInTheDocument());
    const chamada = fetchMock.mock.calls[2];
    expect(String(chamada[0])).toContain('/reservas/r1/status-pagamento');
    expect(JSON.parse((chamada[1] as RequestInit).body as string)).toEqual({ status: 'sinal_pago' });
  });

  it('mostra o erro do backend quando a transição de pagamento é inválida (nunca regride silenciosamente)', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(reserva({ status_pagamento: 'pago' })));
    fetchMock.mockResolvedValueOnce(jsonResponse(excursao()));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByRole('heading', { name: 'Maria Silva' });

    expect(screen.getByText('Nenhuma ação de pagamento disponível.')).toBeInTheDocument();
  });

  it('marca embarcado e depois desfaz, 1 toque cada', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(reserva()));
    fetchMock.mockResolvedValueOnce(jsonResponse(excursao()));
    fetchMock.mockResolvedValueOnce(jsonResponse(reserva({ status: 'embarcada', embarcada_em: '2026-06-15T05:10:00-03:00' })));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByRole('heading', { name: 'Maria Silva' });

    fireEvent.click(screen.getByRole('button', { name: 'Marcar embarcado' }));

    expect(await screen.findByRole('button', { name: 'Desfazer embarque' })).toBeInTheDocument();
    const chamadaEmbarque = fetchMock.mock.calls[2];
    expect(String(chamadaEmbarque[0])).toContain('/reservas/r1/embarque');
    expect((chamadaEmbarque[1] as RequestInit).method).toBe('POST');
  });

  it('salva edições da ficha (PATCH) e trata 409 de poltrona ocupada', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(reserva()));
    fetchMock.mockResolvedValueOnce(jsonResponse(excursao()));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          erro: {
            codigo: 'poltrona_ocupada',
            mensagem: 'Essa poltrona já foi reservada por outra pessoa.',
            detalhes: { poltronas_livres: [9, 10] },
          },
        },
        { status: 409 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByRole('heading', { name: 'Maria Silva' });

    fireEvent.change(screen.getByLabelText('Poltrona'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Essa poltrona já foi reservada por outra pessoa.')).toBeInTheDocument();
    expect(screen.getByText(/Poltronas livres: 9, 10/)).toBeInTheDocument();
  });

  it('cancela a reserva com sinal pago e mostra a pendência de estorno', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(reserva({ status_pagamento: 'sinal_pago' })));
    fetchMock.mockResolvedValueOnce(jsonResponse(excursao()));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(reserva({ status: 'cancelada', status_pagamento: 'sinal_pago' })),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByRole('heading', { name: 'Maria Silva' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancelar reserva' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar reserva' }));

    // Pendência de estorno = valor cheio da reserva (regra do backend: MVP não
    // rastreia o valor exato pago por cobrança, nem para sinal_pago).
    expect(await screen.findByText(/R\$\s*180,00/)).toBeInTheDocument();
  });

  it('cancela reserva pendente sem gerar pendência de estorno', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(reserva()));
    fetchMock.mockResolvedValueOnce(jsonResponse(excursao()));
    fetchMock.mockResolvedValueOnce(jsonResponse(reserva({ status: 'cancelada' })));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByRole('heading', { name: 'Maria Silva' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancelar reserva' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar reserva' }));

    expect(await screen.findByText('Sem pagamento recebido — nenhuma pendência de estorno.')).toBeInTheDocument();
  });
});
