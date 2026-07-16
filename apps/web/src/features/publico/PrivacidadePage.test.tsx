import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PrivacidadePage } from './PrivacidadePage';

describe('PrivacidadePage', () => {
  it('mostra o título e todas as seções do Anexo B do ADR 010', () => {
    render(<PrivacidadePage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Política de Privacidade — Taketrip' }),
    ).toBeInTheDocument();

    for (const secao of [
      'Quem é responsável pelos seus dados',
      'Quais dados coletamos',
      'Para que os dados são usados',
      'Com quem os dados são compartilhados',
      'Seus direitos e como pedir',
      'Por quanto tempo guardamos',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: secao })).toBeInTheDocument();
    }
  });

  it('fixa os papéis LGPD: organizador controlador, Taketrip operador', () => {
    render(<PrivacidadePage />);

    expect(screen.getByText('controlador')).toBeInTheDocument();
    expect(screen.getByText('operador')).toBeInTheDocument();
    expect(screen.getByText(/o Taketrip não vende nem cruza seus dados/i)).toBeInTheDocument();
  });

  it('aponta o WhatsApp do organizador como canal para ver, corrigir ou apagar dados', () => {
    render(<PrivacidadePage />);

    expect(screen.getByText('ver, corrigir ou apagar')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp do organizador da sua excursão')).toBeInTheDocument();
  });

  it('define o título do documento', () => {
    render(<PrivacidadePage />);
    expect(document.title).toBe('Política de Privacidade · taketrip');
  });
});
