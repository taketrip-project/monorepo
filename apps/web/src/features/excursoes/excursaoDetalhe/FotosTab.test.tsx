import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FotosTab } from './FotosTab';
import type { Foto } from '../../../lib/api/excursions';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function Wrapper({ fotosIniciais }: { fotosIniciais: Foto[] }) {
  const [fotos, setFotos] = useState(fotosIniciais);
  return <FotosTab excursaoId="e1" destino="Serra Fina" fotos={fotos} onFotosAtualizadas={setFotos} />;
}

describe('FotosTab', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('mostra mensagem de vazio quando não há fotos', () => {
    render(<Wrapper fotosIniciais={[]} />);
    expect(screen.getByText('Nenhuma foto ainda.')).toBeInTheDocument();
  });

  it('marca só a foto de menor ordem como capa', () => {
    render(
      <Wrapper
        fotosIniciais={[
          { id: 'f2', url: 'https://x/2.jpg', ordem: 2 },
          { id: 'f1', url: 'https://x/1.jpg', ordem: 1 },
        ]}
      />,
    );
    expect(screen.getAllByText('Capa')).toHaveLength(1);
    expect(screen.getAllByAltText('Foto de Serra Fina')).toHaveLength(2);
  });

  it('envia uma foto com sucesso', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'f1', url: 'https://x/1.jpg', ordem: 1 }, { status: 201 }),
    );

    render(<Wrapper fotosIniciais={[]} />);

    const arquivo = new File(['conteudo'], 'foto.jpg', { type: 'image/jpeg' });
    const input = document.getElementById('upload-foto') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [arquivo] } });

    await waitFor(() => expect(screen.getByAltText('Foto de Serra Fina')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('mostra erro quando o envio falha', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ erro: { codigo: 'arquivo_invalido', mensagem: 'Formato de arquivo não suportado.' } }, { status: 422 }),
    );

    render(<Wrapper fotosIniciais={[]} />);

    const arquivo = new File(['conteudo'], 'foto.txt', { type: 'text/plain' });
    const input = document.getElementById('upload-foto') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [arquivo] } });

    expect(await screen.findByText('Formato de arquivo não suportado.')).toBeInTheDocument();
  });

  it('remove uma foto existente', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    render(<Wrapper fotosIniciais={[{ id: 'f1', url: 'https://x/1.jpg', ordem: 1 }]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));

    await waitFor(() => expect(screen.getByText('Nenhuma foto ainda.')).toBeInTheDocument());
  });
});
