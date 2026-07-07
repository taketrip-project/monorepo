import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PontosEmbarqueTab } from './PontosEmbarqueTab';
import type { PontoEmbarque } from '../../../lib/api/excursions';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

/** Casca de teste: mantém `pontos` local e repassa pro componente, igual ao pai faria. */
function Wrapper({ pontosIniciais }: { pontosIniciais: PontoEmbarque[] }) {
  const [pontos, setPontos] = useState(pontosIniciais);
  return <PontosEmbarqueTab excursaoId="e1" pontos={pontos} onPontosAtualizados={setPontos} />;
}

describe('PontosEmbarqueTab', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('mostra mensagem de vazio quando não há pontos', () => {
    render(<Wrapper pontosIniciais={[]} />);
    expect(screen.getByText('Nenhum ponto de embarque ainda. Adicione pelo menos um.')).toBeInTheDocument();
  });

  it('adiciona e depois remove um ponto de embarque', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<Wrapper pontosIniciais={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ponto de embarque' }));
    const dialogAdicionar = await screen.findByRole('dialog', { name: 'Adicionar ponto de embarque' });

    fireEvent.change(within(dialogAdicionar).getByLabelText('Local'), { target: { value: 'Praça Central' } });
    fireEvent.change(within(dialogAdicionar).getByLabelText('Horário'), {
      target: { value: '2026-06-15T05:00' },
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'p1', local: 'Praça Central', horario: '2026-06-15T05:00:00-03:00', ordem: 1 }, { status: 201 }),
    );
    fireEvent.click(within(dialogAdicionar).getByRole('button', { name: 'Adicionar ponto' }));

    expect(await screen.findByText('Praça Central')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    const dialogRemover = await screen.findByRole('dialog', { name: 'Remover ponto de embarque' });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    fireEvent.click(within(dialogRemover).getByRole('button', { name: 'Remover ponto' }));

    expect(
      await screen.findByText('Nenhum ponto de embarque ainda. Adicione pelo menos um.'),
    ).toBeInTheDocument();
  });

  it('mostra o erro do servidor (ex.: ultimo_ponto) ao tentar remover', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <Wrapper
        pontosIniciais={[{ id: 'p1', local: 'Praça Central', horario: '2026-06-15T05:00:00-03:00', ordem: 1 }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover ponto de embarque' });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { erro: { codigo: 'ultimo_ponto', mensagem: 'Excursão publicada não pode ficar sem pontos de embarque.' } },
        { status: 409 },
      ),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remover ponto' }));

    expect(
      await within(dialog).findByText('Excursão publicada não pode ficar sem pontos de embarque.'),
    ).toBeInTheDocument();
  });

  it('move um ponto para baixo via reorder', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <Wrapper
        pontosIniciais={[
          { id: 'p1', local: 'Praça Central', horario: '2026-06-15T05:00:00-03:00', ordem: 1 },
          { id: 'p2', local: 'Rodoviária', horario: '2026-06-15T05:20:00-03:00', ordem: 2 },
        ]}
      />,
    );

    expect(screen.getByLabelText('Mover Praça Central para cima')).toBeDisabled();

    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { id: 'p2', local: 'Rodoviária', horario: '2026-06-15T05:20:00-03:00', ordem: 1 },
        { id: 'p1', local: 'Praça Central', horario: '2026-06-15T05:00:00-03:00', ordem: 2 },
      ]),
    );
    fireEvent.click(screen.getByLabelText('Mover Praça Central para baixo'));

    expect(await screen.findByLabelText('Mover Rodoviária para cima')).toBeDisabled();
    const [fetchUrl, fetchInit] = fetchMock.mock.calls[0];
    expect(fetchUrl).toContain('/pontos-embarque');
    expect(fetchInit?.method).toBe('PUT');
  });
});
