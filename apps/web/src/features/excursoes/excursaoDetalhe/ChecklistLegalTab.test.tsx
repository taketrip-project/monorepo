import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChecklistLegalTab } from './ChecklistLegalTab';
import type { ChecklistLegal } from '../../../lib/api/excursions';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function Wrapper({ checklistInicial }: { checklistInicial: ChecklistLegal }) {
  const [checklist, setChecklist] = useState(checklistInicial);
  return <ChecklistLegalTab excursaoId="e1" checklist={checklist} onChecklistAtualizado={setChecklist} />;
}

const CHECKLIST_VAZIO: ChecklistLegal = {
  licenca_antt: false,
  seguro_passageiros: false,
  lista_impressa: false,
};

describe('ChecklistLegalTab', () => {
  beforeEach(() => {
    localStorage.setItem('tt_access_token', 'acc');
    localStorage.setItem('tt_refresh_token', 'ref');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('marca um item com sucesso (otimista, confirmado pelo servidor)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...CHECKLIST_VAZIO, licenca_antt: true }));

    render(<Wrapper checklistInicial={CHECKLIST_VAZIO} />);

    const checkbox = screen.getByLabelText('Licença ANTT de viagem') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true); // otimista, antes da resposta do servidor

    await waitFor(() => expect(checkbox.checked).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reverte o toggle e mostra erro quando o servidor falha', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ erro: { codigo: 'erro_desconhecido', mensagem: 'Não deu pra salvar agora.' } }, { status: 500 }),
    );

    render(<Wrapper checklistInicial={CHECKLIST_VAZIO} />);

    const checkbox = screen.getByLabelText('Seguro de passageiros') as HTMLInputElement;
    fireEvent.click(checkbox);

    expect(await screen.findByText('Não deu pra salvar agora.')).toBeInTheDocument();
    await waitFor(() => expect(checkbox.checked).toBe(false));
  });
});
