import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReservaFormSheet } from './ReservaFormSheet';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function renderSheet(props: Partial<Parameters<typeof ReservaFormSheet>[0]> = {}) {
  const onCriada = vi.fn();
  const onConflitoPoltrona = vi.fn();
  render(
    <ReservaFormSheet
      open
      onClose={vi.fn()}
      codigo="abc123"
      organizacaoNome="Ondas do Mar Excursões"
      poltrona={4}
      precoCentavos={18000}
      sinalCentavos={9000}
      onCriada={onCriada}
      onConflitoPoltrona={onConflitoPoltrona}
      {...props}
    />,
  );
  return { onCriada, onConflitoPoltrona };
}

describe('ReservaFormSheet', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mostra a poltrona pré-selecionada como chip (número em mono), nunca como campo', () => {
    renderSheet();
    const chip = screen.getByText(
      (_conteudo, elemento) => elemento?.classList.contains('tt-badge') === true && elemento.textContent === 'Poltrona 4',
    );
    expect(chip).toBeInTheDocument();
    expect(chip.querySelector('.tt-mono')).toHaveTextContent('4');
    expect(screen.queryByLabelText(/Poltrona/)).not.toBeInTheDocument();
  });

  it('mostra o aviso LGPD com o nome da organização e o link da política, sem checkbox (ADR 010)', () => {
    renderSheet();

    const aviso = screen.getByText(/vão direto para/);
    expect(aviso).toHaveTextContent(
      'Seus dados (nome, WhatsApp e CPF, se informar) vão direto para Ondas do Mar Excursões, que organiza esta excursão, e servem só para a sua reserva, o contato e o embarque.',
    );
    const link = screen.getByRole('link', { name: 'Política de Privacidade (abre em nova aba)' });
    expect(link).toHaveAttribute('href', '/privacidade');
    // Decisão deliberada do ADR: informar, não pedir consentimento.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('valida nome e WhatsApp inline, sem chamar a API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }));

    expect(await screen.findByText('Digite seu nome.')).toBeInTheDocument();
    expect(screen.getByText('Digite um WhatsApp válido, com DDD.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sinal é o padrão; trocar para valor cheio manda tipo_pagamento integral', async () => {
    const fetchMock = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        jsonResponse(
          {
            reserva_id: 'r1',
            poltrona: 4,
            status_pagamento: 'pendente',
            expira_em: null,
            cobranca: null,
            instrucoes: 'Sua poltrona tá guardada!',
          },
          { status: 201 },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { onCriada } = renderSheet();

    // Os dois valores aparecem para a escolha, em mono.
    expect(screen.getByLabelText(/Pagar o sinal agora/)).toBeChecked();
    expect(screen.getByText('R$ 90,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 180,00')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Pagar o valor cheio/));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '11 91234-5678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }));

    await waitFor(() => expect(onCriada).toHaveBeenCalled());
    const corpo = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(corpo.tipo_pagamento).toBe('integral');
  });

  it('sem sinal de verdade (sinal = preço cheio), a escolha some e vai integral direto', async () => {
    const fetchMock = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        jsonResponse(
          { reserva_id: 'r1', poltrona: 4, status_pagamento: 'pendente', expira_em: null, cobranca: null, instrucoes: 'ok' },
          { status: 201 },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderSheet({ sinalCentavos: 18000 });

    expect(screen.queryByText(/Como você quer garantir/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '11 91234-5678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const corpo = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(corpo.tipo_pagamento).toBe('integral');
  });

  it('429 mostra mensagem amigável com o prazo e não tenta de novo sozinho', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(
          { erro: { codigo: 'muitas_tentativas', mensagem: 'Muitas tentativas.' } },
          { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderSheet();

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '11 91234-5678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Espere 30s e tente de novo/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // O botão volta a ficar disponível — quem decide tentar de novo é a pessoa.
    expect(screen.getByRole('button', { name: 'Confirmar reserva' })).toBeEnabled();
  });

  it('422 do servidor pinta os erros nos campos certos', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(
          {
            erro: {
              codigo: 'validacao',
              mensagem: 'Corpo inválido.',
              detalhes: { campos: { whatsapp: 'WhatsApp inválido.' } },
            },
          },
          { status: 422 },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderSheet();

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '11 91234-5678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }));

    expect(await screen.findByText('WhatsApp inválido.')).toBeInTheDocument();
  });
});
