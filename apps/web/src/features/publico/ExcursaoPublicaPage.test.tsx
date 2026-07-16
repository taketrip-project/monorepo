import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExcursaoPublicaPage } from './ExcursaoPublicaPage';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function excursaoPublica(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    codigo: 'abc123',
    destino: 'Serra Fina',
    evento_ancora: 'Festival de Inverno',
    data_saida: '2026-06-15T05:30:00-03:00',
    data_retorno: '2026-06-15T20:00:00-03:00',
    tipo: 'bate_volta',
    preco_centavos: 18000,
    sinal_centavos: 9000,
    descricao: 'Van com ar condicionado.',
    fotos: [],
    vagas: 8,
    capacidade: 15,
    aceita_reserva: true,
    organizacao_nome: 'Excursões da Ana',
    pontos_embarque: [
      { local: 'Praça Central', horario: '2026-06-15T05:00:00-03:00', ordem: 1 },
      { local: 'Posto BR da rodovia', horario: '2026-06-15T05:20:00-03:00', ordem: 2 },
    ],
    ...overrides,
  };
}

function mapaPublico(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    layout: { fileiras: [[1, 2, null, 3, 4]] },
    poltronas: [
      { numero: 1, estado: 'livre' },
      { numero: 2, estado: 'ocupada' },
      { numero: 3, estado: 'bloqueada' },
      { numero: 4, estado: 'livre' },
    ],
    ...overrides,
  };
}

/** Mock de fetch roteado por URL — a página busca excursão e mapa em paralelo. */
function mockFetchPublico({
  excursao = excursaoPublica(),
  mapa = mapaPublico(),
}: { excursao?: unknown; mapa?: unknown } = {}) {
  const fetchMock = vi.fn((url: RequestInfo | URL) => {
    const texto = String(url);
    if (texto.includes('/mapa-poltronas')) return Promise.resolve(jsonResponse(mapa));
    return Promise.resolve(jsonResponse(excursao));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/e/abc123']}>
      <Routes>
        <Route path="/e/:codigo" element={<ExcursaoPublicaPage />} />
        <Route path="/r/:reservaId" element={<div>Página da reserva</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ExcursaoPublicaPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mostra destino, organizador, datas, valores, vagas e pontos de embarque', async () => {
    mockFetchPublico();
    renderPagina();

    expect(await screen.findByRole('heading', { name: 'Serra Fina' })).toBeInTheDocument();
    expect(screen.getByText('Festival de Inverno')).toBeInTheDocument();
    expect(screen.getByText('por Excursões da Ana')).toBeInTheDocument();
    expect(screen.getByText('8 vagas')).toBeInTheDocument();
    expect(screen.getByText('Bate-volta')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 180,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s*90,00/).length).toBeGreaterThan(0);
    expect(screen.getByText('Praça Central')).toBeInTheDocument();
    expect(screen.getByText('Posto BR da rodovia')).toBeInTheDocument();
    expect(screen.getByText('Van com ar condicionado.')).toBeInTheDocument();
  });

  it('não chama endpoint autenticado nenhum — só /publico, sem Authorization', async () => {
    const fetchMock = mockFetchPublico();
    renderPagina();
    await screen.findByRole('heading', { name: 'Serra Fina' });

    for (const [url, init] of fetchMock.mock.calls as [RequestInfo | URL, RequestInit?][]) {
      expect(String(url)).toContain('/publico/');
      const headers = new Headers(init?.headers);
      expect(headers.has('Authorization')).toBe(false);
    }
  });

  it('CTA começa desabilitado e habilita ao tocar numa poltrona livre', async () => {
    mockFetchPublico();
    renderPagina();
    await screen.findByRole('heading', { name: 'Serra Fina' });

    const cta = screen.getByRole('button', { name: 'Escolha uma poltrona' });
    expect(cta).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Poltrona 4, livre'));
    expect(screen.getByRole('button', { name: 'Reservar poltrona 4' })).toBeEnabled();
  });

  it('poltrona ocupada não é selecionável (nem vira botão)', async () => {
    mockFetchPublico();
    renderPagina();
    await screen.findByRole('heading', { name: 'Serra Fina' });

    const ocupada = screen.getByLabelText('Poltrona 2, ocupada');
    expect(ocupada.tagName).toBe('DIV');
    expect(screen.getByRole('button', { name: 'Escolha uma poltrona' })).toBeDisabled();
  });

  it('mapa público usa a legenda reduzida: Livre · Ocupada · Bloqueada, sem Pago/Pendente', async () => {
    mockFetchPublico();
    renderPagina();
    await screen.findByRole('heading', { name: 'Serra Fina' });

    expect(screen.getByText('Livre')).toBeInTheDocument();
    expect(screen.getByText('Ocupada')).toBeInTheDocument();
    expect(screen.getByText('Bloqueada')).toBeInTheDocument();
    expect(screen.queryByText('Pago')).not.toBeInTheDocument();
    expect(screen.queryByText('Pendente')).not.toBeInTheDocument();
  });

  it('excursão lotada: sem CTA, mapa só leitura e aviso de lotada', async () => {
    mockFetchPublico({
      excursao: excursaoPublica({ vagas: 0, aceita_reserva: false }),
      mapa: mapaPublico({
        poltronas: [
          { numero: 1, estado: 'ocupada' },
          { numero: 2, estado: 'ocupada' },
          { numero: 3, estado: 'bloqueada' },
          { numero: 4, estado: 'ocupada' },
        ],
      }),
    });
    renderPagina();
    await screen.findByRole('heading', { name: 'Serra Fina' });

    expect(screen.getByText('Lotada')).toBeInTheDocument();
    expect(screen.getByText(/Essa excursão lotou/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Escolha uma poltrona|Reservar poltrona/ })).not.toBeInTheDocument();
  });

  it('404 mostra a tela de excursão indisponível', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(
          { erro: { codigo: 'excursao_indisponivel', mensagem: 'Excursão indisponível.' } },
          { status: 404 },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderPagina();

    expect(await screen.findByRole('heading', { name: 'Excursão indisponível' })).toBeInTheDocument();
  });

  it('429 mostra mensagem amigável com o Retry-After, sem retry automático', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(
          { erro: { codigo: 'muitas_tentativas', mensagem: 'Muitas tentativas.' } },
          { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '42' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderPagina();

    expect(await screen.findByRole('heading', { name: 'Muita gente acessando' })).toBeInTheDocument();
    expect(screen.getByText(/42s/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    // 2 chamadas iniciais (excursão + mapa) e mais nada — nenhum retry sozinho.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('erro de rede mostra tela de sem conexão com botão de tentar de novo', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    vi.stubGlobal('fetch', fetchMock);
    renderPagina();

    expect(await screen.findByRole('heading', { name: 'Sem conexão' })).toBeInTheDocument();

    // O "Tentar de novo" refaz o carregamento e recupera a tela.
    mockFetchPublico();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Serra Fina' })).toBeInTheDocument();
  });

  it('fluxo completo: seleciona poltrona, preenche o formulário, POST sem valor e navega para /r/{id}', async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const texto = String(url);
      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(
            {
              reserva_id: 'af0e8c1e-0000-7000-8000-000000000001',
              poltrona: 4,
              status_pagamento: 'pendente',
              expira_em: '2026-06-13T18:00:00-03:00',
              cobranca: null,
              instrucoes: 'Sua poltrona tá guardada até sábado, 13/06, às 18h.',
            },
            { status: 201 },
          ),
        );
      }
      if (texto.includes('/mapa-poltronas')) return Promise.resolve(jsonResponse(mapaPublico()));
      return Promise.resolve(jsonResponse(excursaoPublica()));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPagina();
    await screen.findByRole('heading', { name: 'Serra Fina' });

    fireEvent.click(screen.getByLabelText('Poltrona 4, livre'));
    fireEvent.click(screen.getByRole('button', { name: 'Reservar poltrona 4' }));

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'João Passageiro' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '11 91234-5678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }));

    expect(await screen.findByText('Página da reserva')).toBeInTheDocument();

    const chamadaPost = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(chamadaPost).toBeDefined();
    expect(String(chamadaPost![0])).toContain('/publico/excursoes/abc123/reservas');
    const corpo = JSON.parse(chamadaPost![1]!.body as string);
    expect(corpo).toEqual({
      poltrona: 4,
      nome: 'João Passageiro',
      whatsapp: '11 91234-5678',
      cpf: null,
      tipo_pagamento: 'sinal',
    });
    // Segurança (ADR 008): o corpo público NUNCA leva valor nem forma de pagamento.
    expect(corpo).not.toHaveProperty('valor_centavos');
    expect(corpo).not.toHaveProperty('forma_pagamento');
  });

  it('409 poltrona_ocupada: mostra sugestões, atualiza o mapa e limpa a seleção', async () => {
    let mapaAtualizado = false;
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const texto = String(url);
      if (init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(
            {
              erro: {
                codigo: 'poltrona_ocupada',
                mensagem: 'Poltrona 4 já reservada.',
                detalhes: { poltronas_livres: [1] },
              },
            },
            { status: 409 },
          ),
        );
      }
      if (texto.includes('/mapa-poltronas')) {
        const mapa = mapaAtualizado
          ? mapaPublico({
              poltronas: [
                { numero: 1, estado: 'livre' },
                { numero: 2, estado: 'ocupada' },
                { numero: 3, estado: 'bloqueada' },
                { numero: 4, estado: 'ocupada' },
              ],
            })
          : mapaPublico();
        mapaAtualizado = true;
        return Promise.resolve(jsonResponse(mapa));
      }
      return Promise.resolve(jsonResponse(excursaoPublica()));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPagina();
    await screen.findByRole('heading', { name: 'Serra Fina' });

    fireEvent.click(screen.getByLabelText('Poltrona 4, livre'));
    fireEvent.click(screen.getByRole('button', { name: 'Reservar poltrona 4' }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'João' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '11 91234-5678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Alguém acabou de reservar a poltrona 4/);
    expect(screen.getByText(/Poltronas livres: 1/)).toBeInTheDocument();

    // A seleção foi limpa e o mapa re-buscado: a poltrona 4 agora aparece ocupada.
    await waitFor(() => expect(screen.getByLabelText('Poltrona 4, ocupada')).toBeInTheDocument());
  });
});
