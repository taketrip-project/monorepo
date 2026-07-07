import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DetalhesTab } from './DetalhesTab';
import type { Excursao } from '../../../lib/api/excursions';
import type { Veiculo } from '../../../lib/api/fleet';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const VEICULO: Veiculo = {
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

function excursaoBase(overrides: Partial<Excursao> = {}): Excursao {
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

describe('DetalhesTab', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('pré-preenche os campos com os dados da excursão', () => {
    render(<DetalhesTab excursao={excursaoBase()} veiculos={[VEICULO]} onSalvo={vi.fn()} />);
    expect(screen.getByLabelText('Destino')).toHaveValue('Serra Fina');
    expect(screen.getByLabelText('Preço por passageiro')).toHaveValue(180);
  });

  it('valida destino obrigatório antes de salvar', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<DetalhesTab excursao={excursaoBase()} veiculos={[VEICULO]} onSalvo={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Destino'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Digite o destino da excursão.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('salva com sucesso e notifica o pai via onSalvo', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const atualizada = excursaoBase({ destino: 'Serra Nova' });
    fetchMock.mockResolvedValueOnce(jsonResponse(atualizada));

    const onSalvo = vi.fn();
    render(<DetalhesTab excursao={excursaoBase()} veiculos={[VEICULO]} onSalvo={onSalvo} />);

    fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'Serra Nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(onSalvo).toHaveBeenCalledWith(atualizada));
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
  });

  it('mapeia erros de validação de campo vindos do servidor', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          erro: {
            codigo: 'validacao',
            mensagem: 'Dados inválidos.',
            detalhes: { campos: [{ campo: 'destino', mensagem: 'Destino inválido.' }] },
          },
        },
        { status: 422 },
      ),
    );

    render(<DetalhesTab excursao={excursaoBase()} veiculos={[VEICULO]} onSalvo={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Destino inválido.')).toBeInTheDocument();
  });

  it('mostra a mensagem pronta do servidor em conflito (troca de veículo)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          erro: {
            codigo: 'troca_veiculo_conflita_reservas',
            mensagem: 'Esse veículo tem menos poltronas que reservas já feitas.',
          },
        },
        { status: 409 },
      ),
    );

    render(<DetalhesTab excursao={excursaoBase()} veiculos={[VEICULO]} onSalvo={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(
      await screen.findByText('Esse veículo tem menos poltronas que reservas já feitas.'),
    ).toBeInTheDocument();
  });
});
