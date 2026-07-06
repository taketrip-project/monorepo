import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExcursionCard } from './ExcursionCard';

describe('ExcursionCard', () => {
  it('renderiza destino, status, data/hora e contagem de vagas', () => {
    render(
      <ExcursionCard
        destino="Serra Fina"
        status="aberta"
        dataLabel="Dom · 15 jun"
        horaLabel="05:30"
        vagasOcupadas={34}
        vagasTotal={46}
        pagos={28}
        pendentes={6}
      />,
    );
    expect(screen.getByText('Serra Fina')).toBeInTheDocument();
    expect(screen.getByText('Aberta')).toBeInTheDocument();
    expect(screen.getByText('Dom · 15 jun')).toBeInTheDocument();
    expect(screen.getByText('05:30')).toBeInTheDocument();
    expect(screen.getByText('34/46')).toBeInTheDocument();
  });

  it('mostra a barra de progresso com a porcentagem correta', () => {
    render(
      <ExcursionCard
        destino="Serra Fina"
        status="aberta"
        dataLabel="Dom · 15 jun"
        horaLabel="05:30"
        vagasOcupadas={23}
        vagasTotal={46}
        pagos={20}
        pendentes={3}
      />,
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('usa tom warning na barra quando a excursão está lotada', () => {
    render(
      <ExcursionCard
        destino="Serra Fina"
        status="lotada"
        dataLabel="Dom · 15 jun"
        horaLabel="05:30"
        vagasOcupadas={46}
        vagasTotal={46}
        pagos={46}
        pendentes={0}
      />,
    );
    expect(screen.getByText('Lotada')).toBeInTheDocument();
    const track = screen.getByRole('progressbar');
    expect(track.firstElementChild).toHaveClass('tt-excursion-card-progress-fill--lotada');
  });

  it('dispara onClick quando clicável', () => {
    const onClick = vi.fn();
    render(
      <ExcursionCard
        destino="Serra Fina"
        status="aberta"
        dataLabel="Dom · 15 jun"
        horaLabel="05:30"
        vagasOcupadas={1}
        vagasTotal={46}
        pagos={1}
        pendentes={0}
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
