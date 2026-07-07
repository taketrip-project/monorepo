import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PassageirosTab } from './PassageirosTab';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function vazio() {
  return jsonResponse({ dados: [], paginacao: { pagina: 1, por_pagina: 20, total: 0 } });
}

const MAPA_VAZIO = {
  excursao_id: 'e1',
  layout: { fileiras: [[1]] },
  poltronas: [{ numero: 1, estado: 'livre', reserva_id: null, passageiro_nome: null }],
  vagas: 1,
  capacidade: 1,
};

const RESERVA_CRIADA = {
  id: 'r1',
  excursao_id: 'e1',
  poltrona: 1,
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

const EXCURSAO_BASE = {
  id: 'e1',
  status: 'publicada',
  destino: 'Serra Fina',
  evento_ancora: null,
  data_saida: '2026-06-15T05:30:00-03:00',
  data_retorno: '2026-06-15T20:00:00-03:00',
  tipo: 'bate_volta',
  vagas: 0,
  capacidade: 1,
  pagos: 0,
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
  pontos_embarque: [],
  criado_em: '2026-01-01T00:00:00Z',
};

function renderTab(onExcursaoAtualizada = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/excursoes/e1']}>
      <Routes>
        <Route
          path="/excursoes/:id"
          element={
            <PassageirosTab excursaoId="e1" precoDefaultCentavos={18000} onExcursaoAtualizada={onExcursaoAtualizada} />
          }
        />
        <Route path="/excursoes/:id/reservas/:reservaId" element={<div>Ficha da reserva</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PassageirosTab', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('abre na view Lista por padrão', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(vazio()));
    renderTab();

    expect(await screen.findByText(/Toque numa poltrona livre no Mapa/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Lista' })).toHaveAttribute('aria-selected', 'true');
  });

  it('navega pra ficha da reserva ao tocar numa linha da Lista', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          dados: [RESERVA_CRIADA],
          paginacao: { pagina: 1, por_pagina: 20, total: 1 },
        }),
      ),
    );
    renderTab();

    fireEvent.click(await screen.findByText('Maria Silva'));
    expect(await screen.findByText('Ficha da reserva')).toBeInTheDocument();
  });

  it('cadastro rápido a partir do Mapa: seleciona vaga livre, salva e atualiza o resumo da excursão', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(vazio()); // lista inicial
    fetchMock.mockResolvedValueOnce(jsonResponse(MAPA_VAZIO)); // mapa ao trocar de view
    fetchMock.mockResolvedValueOnce(jsonResponse(RESERVA_CRIADA, { status: 201 })); // POST reserva
    fetchMock.mockResolvedValueOnce(jsonResponse(EXCURSAO_BASE)); // GET excursão pós-criação
    vi.stubGlobal('fetch', fetchMock);
    const onExcursaoAtualizada = vi.fn();

    renderTab(onExcursaoAtualizada);
    await screen.findByText(/Toque numa poltrona livre no Mapa/);

    fireEvent.click(screen.getByRole('tab', { name: 'Mapa' }));
    const poltrona1 = await screen.findByLabelText('Poltrona 1, livre');
    fireEvent.click(poltrona1);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('Poltrona 1')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Maria Silva' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '11999998888' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar reserva' }));

    await waitFor(() => expect(onExcursaoAtualizada).toHaveBeenCalledWith(EXCURSAO_BASE));
    // Sucesso silencioso: a sheet fecha sem toast.
    expect(screen.queryByRole('dialog', { name: 'Cadastro rápido' })).not.toBeInTheDocument();
  });

  it('imprimir lista abre o resultado numa nova aba', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(vazio());
    fetchMock.mockResolvedValueOnce(new Response(new Blob(['pdf-bytes']), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const fakeWindow = { location: { href: '' }, close: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWindow as unknown as Window);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');

    renderTab();
    await screen.findByText(/Toque numa poltrona livre no Mapa/);

    fireEvent.click(screen.getByRole('button', { name: 'Imprimir lista' }));

    await waitFor(() => expect(fakeWindow.location.href).toBe('blob:fake-url'));
    expect(openSpy).toHaveBeenCalledWith('', '_blank');
  });
});
