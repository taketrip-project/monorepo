import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NovaExcursaoPage } from './NovaExcursaoPage';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const VEICULO = {
  id: 'v1',
  apelido: 'Van 1',
  placa: 'ABC1D23',
  tipo: 'van',
  quantidade_poltronas: 15,
  capacidade: 15,
  layout: { fileiras: [] },
  poltronas_bloqueadas: [],
  criado_em: '2026-01-01T00:00:00Z',
};

const ORGANIZACAO = {
  id: 'org1',
  nome: 'Excursões Sol Nascente',
  prazo_expiracao_reserva_horas: 48,
  sinal_default_percentual: 50,
  criado_em: '2026-01-01T00:00:00Z',
};

const EXCURSAO_CRIADA = {
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
};

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/excursoes/nova']}>
      <Routes>
        <Route path="/excursoes/nova" element={<NovaExcursaoPage />} />
        <Route path="/excursoes/:id" element={<div>Tela de detalhe</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NovaExcursaoPage', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('cria a excursão com sucesso e vai para o detalhe', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ dados: [VEICULO], paginacao: { pagina: 1, por_pagina: 100, total: 1 } }));
    fetchMock.mockResolvedValueOnce(jsonResponse(ORGANIZACAO));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();

    await screen.findByText(/Van 1/);

    fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'Serra Fina' } });
    fireEvent.change(screen.getByLabelText('Saída'), { target: { value: '2026-06-15T05:30' } });
    fireEvent.change(screen.getByLabelText('Retorno'), { target: { value: '2026-06-15T20:00' } });
    fireEvent.change(screen.getByLabelText('Preço por passageiro'), { target: { value: '180.00' } });

    fetchMock.mockResolvedValueOnce(jsonResponse(EXCURSAO_CRIADA, { status: 201 }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar excursão' }));

    expect(await screen.findByText('Tela de detalhe')).toBeInTheDocument();

    const chamadaPost = fetchMock.mock.calls[2];
    expect(chamadaPost[0]).toContain('/excursoes');
    const corpo = JSON.parse((chamadaPost[1] as RequestInit).body as string);
    expect(corpo).toMatchObject({
      destino: 'Serra Fina',
      veiculo_id: 'v1',
      preco_centavos: 18000,
      sinal_tipo: 'percentual',
      sinal_valor: 50,
    });
  });

  it('mostra erro de validação por campo vindo do servidor (422)', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ dados: [VEICULO], paginacao: { pagina: 1, por_pagina: 100, total: 1 } }));
    fetchMock.mockResolvedValueOnce(jsonResponse(ORGANIZACAO));
    vi.stubGlobal('fetch', fetchMock);

    renderPagina();
    await screen.findByText(/Van 1/);

    fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'Serra Fina' } });
    fireEvent.change(screen.getByLabelText('Saída'), { target: { value: '2026-06-15T05:30' } });
    fireEvent.change(screen.getByLabelText('Retorno'), { target: { value: '2026-06-15T20:00' } });
    fireEvent.change(screen.getByLabelText('Preço por passageiro'), { target: { value: '180.00' } });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          erro: {
            codigo: 'validacao',
            mensagem: 'Corpo inválido.',
            detalhes: { campos: { destino: 'Esse destino já existe numa excursão parecida.' } },
          },
        },
        { status: 422 },
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Criar excursão' }));

    expect(await screen.findByText('Esse destino já existe numa excursão parecida.')).toBeInTheDocument();
  });
});
