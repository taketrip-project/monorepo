import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CadastroRapidoSheet } from './CadastroRapidoSheet';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const RESERVA_CRIADA = {
  id: 'r1',
  excursao_id: 'e1',
  poltrona: 12,
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
};

describe('CadastroRapidoSheet', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('mostra a poltrona pré-selecionada como chip, não como campo', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <CadastroRapidoSheet
        open
        onClose={vi.fn()}
        excursaoId="e1"
        poltrona={12}
        precoDefaultCentavos={18000}
        onCriada={vi.fn()}
      />,
    );
    expect(screen.getByText('Poltrona 12')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    expect(screen.getByLabelText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByLabelText('Valor')).toHaveValue(180);
  });

  it('valida nome e whatsapp antes de enviar', async () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <CadastroRapidoSheet
        open
        onClose={vi.fn()}
        excursaoId="e1"
        poltrona={12}
        precoDefaultCentavos={18000}
        onCriada={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Salvar reserva' }));

    expect(await screen.findByText('Digite o nome do passageiro.')).toBeInTheDocument();
    expect(screen.getByText('Digite um WhatsApp válido, com DDD.')).toBeInTheDocument();
  });

  it('reaproveita passageiro já cadastrado ao sair do campo WhatsApp', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ id: 'p1', nome: 'Maria Silva', whatsapp: '+5511999998888', cpf: null }]),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CadastroRapidoSheet
        open
        onClose={vi.fn()}
        excursaoId="e1"
        poltrona={12}
        precoDefaultCentavos={18000}
        onCriada={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '11999998888' } });
    fireEvent.blur(screen.getByLabelText('WhatsApp'));

    expect(await screen.findByText('Passageiro já cadastrado: Maria Silva')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Maria Silva');
  });

  it('envia o cadastro com a poltrona pré-selecionada e chama onCriada', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(RESERVA_CRIADA, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const onCriada = vi.fn();

    render(
      <CadastroRapidoSheet
        open
        onClose={vi.fn()}
        excursaoId="e1"
        poltrona={12}
        precoDefaultCentavos={18000}
        onCriada={onCriada}
      />,
    );

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Maria Silva' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '11999998888' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar reserva' }));

    await waitFor(() => expect(onCriada).toHaveBeenCalledWith(RESERVA_CRIADA));

    const corpo = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(corpo).toMatchObject({ poltrona: 12, nome: 'Maria Silva', valor_centavos: 18000 });
  });

  it('trata 409 poltrona_ocupada mostrando as poltronas livres sugeridas', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          erro: {
            codigo: 'poltrona_ocupada',
            mensagem: 'Essa poltrona já foi reservada por outra pessoa.',
            detalhes: { poltronas_livres: [13, 14] },
          },
        },
        { status: 409 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CadastroRapidoSheet
        open
        onClose={vi.fn()}
        excursaoId="e1"
        poltrona={12}
        precoDefaultCentavos={18000}
        onCriada={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Maria Silva' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '11999998888' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar reserva' }));

    expect(await screen.findByText('Essa poltrona já foi reservada por outra pessoa.')).toBeInTheDocument();
    expect(screen.getByText(/Poltronas livres: 13, 14/)).toBeInTheDocument();
  });
});
