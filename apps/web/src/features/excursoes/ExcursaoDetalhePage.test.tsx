import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExcursaoDetalhePage } from './ExcursaoDetalhePage';
import { ToastProvider } from '../../ui';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const VEICULOS_RESPOSTA = {
  dados: [
    {
      id: 'v1',
      apelido: 'Van 1',
      placa: 'ABC1D23',
      tipo: 'van',
      quantidade_poltronas: 15,
      capacidade: 15,
      layout: { fileiras: [] },
      poltronas_bloqueadas: [],
      criado_em: '2026-01-01T00:00:00Z',
    },
  ],
  paginacao: { pagina: 1, por_pagina: 100, total: 1 },
};

function excursaoBase(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'e1',
    status: 'rascunho',
    destino: 'Serra Fina',
    evento_ancora: null,
    data_saida: '2026-06-15T05:30:00-03:00',
    data_retorno: '2026-06-15T20:00:00-03:00',
    tipo: 'bate_volta',
    vagas: 15,
    capacidade: 15,
    pagos: 0,
    pendentes: 0,
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
    pontos_embarque: [],
    criado_em: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderPagina() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/excursoes/e1']}>
        <Routes>
          <Route path="/excursoes/:id" element={<ExcursaoDetalhePage />} />
          <Route path="/excursoes" element={<div>Tela de lista</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('ExcursaoDetalhePage', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('bloqueia a publicação sem ponto de embarque e leva para a aba de pontos', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(excursaoBase()));
    fetchMock.mockResolvedValueOnce(jsonResponse(VEICULOS_RESPOSTA));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText('Serra Fina');

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { erro: { codigo: 'sem_ponto_embarque', mensagem: 'Adicione ao menos um ponto de embarque antes de publicar.' } },
        { status: 409 },
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publicar excursão' }));

    expect(
      await screen.findByText('Adicione ao menos um ponto de embarque antes de publicar.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pontos de embarque' })).toHaveAttribute('aria-selected', 'true');
  });

  it('publica com sucesso quando já existe ponto de embarque', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        excursaoBase({
          pontos_embarque: [{ id: 'p1', local: 'Praça Central', horario: '2026-06-15T05:00:00-03:00', ordem: 1 }],
        }),
      ),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse(VEICULOS_RESPOSTA));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText('Serra Fina');

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        excursaoBase({
          status: 'publicada',
          pontos_embarque: [{ id: 'p1', local: 'Praça Central', horario: '2026-06-15T05:00:00-03:00', ordem: 1 }],
        }),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publicar excursão' }));

    expect(await screen.findByText('Aberta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publicar excursão' })).not.toBeInTheDocument();
  });

  it('cancela a excursão com motivo obrigatório e mostra toast de confirmação', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(excursaoBase({ status: 'publicada' })));
    fetchMock.mockResolvedValueOnce(jsonResponse(VEICULOS_RESPOSTA));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText('Serra Fina');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar excursão' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancelar excursão' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar excursão' }));
    expect(
      await within(dialog).findByText('O motivo precisa ter entre 3 e 500 caracteres.'),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Motivo do cancelamento'), {
      target: { value: 'Ônibus quebrou e não temos substituto disponível.' },
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        excursao: excursaoBase({
          status: 'cancelada',
          motivo_cancelamento: 'Ônibus quebrou e não temos substituto disponível.',
        }),
        pendencias_estorno: [],
      }),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar excursão' }));

    // Sem pendências de estorno: a sheet fecha sozinha (frontend-guidelines
    // §8) e o card já reflete o novo status. Cancelar é raro e irreversível,
    // então além do card, um toast confirma visivelmente ("sucesso
    // surpreendente" — diferente do silencioso de marcar embarque).
    expect(await screen.findByText('Cancelada')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Cancelar excursão' })).not.toBeInTheDocument();
    expect(await screen.findByText('Excursão cancelada.')).toBeInTheDocument();
  });

  it('cancela a excursão e mostra as pendências de estorno quando existem, com toast também', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(excursaoBase({ status: 'publicada' })));
    fetchMock.mockResolvedValueOnce(jsonResponse(VEICULOS_RESPOSTA));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText('Serra Fina');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar excursão' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancelar excursão' });

    fireEvent.change(within(dialog).getByLabelText('Motivo do cancelamento'), {
      target: { value: 'Ônibus quebrou e não temos substituto disponível.' },
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        excursao: excursaoBase({
          status: 'cancelada',
          motivo_cancelamento: 'Ônibus quebrou e não temos substituto disponível.',
        }),
        pendencias_estorno: [{ id: 'pe1', reserva_id: 'r1', valor_centavos: 9000 }],
      }),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar excursão' }));

    // Com pendência, a sheet continua aberta mostrando a lista — o toast
    // complementa, não substitui essa exibição.
    expect(await within(dialog).findByText('Excursão cancelada.')).toBeInTheDocument();
    expect(within(dialog).getByText(/Pendências de estorno/)).toBeInTheDocument();
    expect(within(dialog).getByText('R$ 90,00')).toBeInTheDocument();
    expect(await screen.findByText('Excursão cancelada.', { selector: '.tt-toast' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('dialog', { name: 'Cancelar excursão' })).not.toBeInTheDocument();
  });

  it('exclui o rascunho e volta para a lista', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(excursaoBase()));
    fetchMock.mockResolvedValueOnce(jsonResponse(VEICULOS_RESPOSTA));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText('Serra Fina');

    fireEvent.click(screen.getByRole('button', { name: 'Excluir rascunho' }));
    const dialog = await screen.findByRole('dialog', { name: 'Excluir rascunho' });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir rascunho' }));

    expect(await screen.findByText('Tela de lista')).toBeInTheDocument();
  });

  it('abre a aba Passageiros e carrega a view Lista da aba', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(excursaoBase({ status: 'publicada' })));
    fetchMock.mockResolvedValueOnce(jsonResponse(VEICULOS_RESPOSTA));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText('Serra Fina');

    fetchMock.mockResolvedValueOnce(jsonResponse({ dados: [], paginacao: { pagina: 1, por_pagina: 20, total: 0 } }));
    fireEvent.click(screen.getByRole('tab', { name: 'Passageiros' }));

    expect(screen.getByRole('tab', { name: 'Passageiros' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText(/Toque numa poltrona livre no Mapa/)).toBeInTheDocument();
  });
});
