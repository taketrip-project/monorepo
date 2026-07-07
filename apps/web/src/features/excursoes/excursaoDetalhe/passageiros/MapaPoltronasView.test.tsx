import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapaPoltronasView } from './MapaPoltronasView';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const MAPA = {
  excursao_id: 'e1',
  layout: { fileiras: [[1, 2, null, 3, 4]] },
  poltronas: [
    { numero: 1, estado: 'livre', reserva_id: null, passageiro_nome: null },
    { numero: 2, estado: 'pago', reserva_id: 'r2', passageiro_nome: 'Maria' },
    { numero: 3, estado: 'bloqueada', reserva_id: null, passageiro_nome: null },
    { numero: 4, estado: 'livre', reserva_id: null, passageiro_nome: null },
  ],
  vagas: 2,
  capacidade: 4,
};

describe('MapaPoltronasView', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('toque numa poltrona livre seleciona e mostra a sticky bar com "Adicionar"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(MAPA)));
    const onAbrirCadastro = vi.fn();

    render(
      <MapaPoltronasView excursaoId="e1" onAbrirCadastro={onAbrirCadastro} onAbrirFicha={vi.fn()} refreshKey={0} />,
    );

    const poltrona1 = await screen.findByLabelText('Poltrona 1, livre');
    fireEvent.click(poltrona1);

    expect(await screen.findByText(/selecionada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(onAbrirCadastro).toHaveBeenCalledWith(1);
  });

  it('toque de novo na mesma poltrona livre desfaz a seleção', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(MAPA)));
    render(<MapaPoltronasView excursaoId="e1" onAbrirCadastro={vi.fn()} onAbrirFicha={vi.fn()} refreshKey={0} />);

    const poltrona1 = await screen.findByLabelText('Poltrona 1, livre');
    fireEvent.click(poltrona1);
    expect(await screen.findByText(/selecionada/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Poltrona 1, selecionada'));
    expect(screen.queryByText(/selecionada/)).not.toBeInTheDocument();
  });

  it('toque numa poltrona ocupada abre a ficha da reserva', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(MAPA)));
    const onAbrirFicha = vi.fn();

    render(<MapaPoltronasView excursaoId="e1" onAbrirCadastro={vi.fn()} onAbrirFicha={onAbrirFicha} refreshKey={0} />);

    const poltrona2 = await screen.findByLabelText('Poltrona 2, pago, Maria');
    fireEvent.click(poltrona2);
    expect(onAbrirFicha).toHaveBeenCalledWith('r2');
  });

  it('poltrona bloqueada não é clicável', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(MAPA)));
    render(<MapaPoltronasView excursaoId="e1" onAbrirCadastro={vi.fn()} onAbrirFicha={vi.fn()} refreshKey={0} />);

    const poltrona3 = await screen.findByLabelText('Poltrona 3, bloqueada');
    expect(poltrona3.tagName).toBe('DIV');
  });

  it('mostra as vagas livres calculadas pelo servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(MAPA)));
    render(<MapaPoltronasView excursaoId="e1" onAbrirCadastro={vi.fn()} onAbrirFicha={vi.fn()} refreshKey={0} />);

    expect(await screen.findByText('vagas livres de', { exact: false })).toBeInTheDocument();
  });
});
