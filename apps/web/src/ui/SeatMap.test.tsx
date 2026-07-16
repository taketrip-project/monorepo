import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SeatMap, type SeatMapPoltrona } from './SeatMap';

const FILEIRAS: (number | null)[][] = [
  [1, 2, null, 3, 4],
  [5, 6, null, 7, 8],
];

const POLTRONAS: SeatMapPoltrona[] = [
  { numero: 1, estado: 'livre' },
  { numero: 2, estado: 'pendente' },
  { numero: 3, estado: 'sinal_pago' },
  { numero: 4, estado: 'pago', passageiroNome: 'Maria' },
  { numero: 5, estado: 'embarcada', passageiroNome: 'João' },
  { numero: 6, estado: 'bloqueada' },
  { numero: 7, estado: 'livre' },
  { numero: 8, estado: 'livre' },
];

describe('SeatMap', () => {
  it('estado empty: poltrona livre sem ícone extra', () => {
    render(<SeatMap fileiras={FILEIRAS} poltronas={POLTRONAS} />);
    const poltrona1 = screen.getByLabelText('Poltrona 1, livre');
    expect(poltrona1).toHaveClass('tt-seatmap-poltrona--empty');
  });

  it('estado pending: pendente e sinal_pago caem no mesmo bucket visual', () => {
    render(<SeatMap fileiras={FILEIRAS} poltronas={POLTRONAS} />);
    expect(screen.getByLabelText('Poltrona 2, pendente')).toHaveClass('tt-seatmap-poltrona--pending');
    expect(screen.getByLabelText('Poltrona 3, sinal pago')).toHaveClass('tt-seatmap-poltrona--pending');
  });

  it('estado paid: pago e embarcada caem no mesmo bucket visual, com nome do passageiro no rótulo', () => {
    render(<SeatMap fileiras={FILEIRAS} poltronas={POLTRONAS} />);
    expect(screen.getByLabelText('Poltrona 4, pago, Maria')).toHaveClass('tt-seatmap-poltrona--paid');
    expect(screen.getByLabelText('Poltrona 5, embarcada, João')).toHaveClass('tt-seatmap-poltrona--paid');
  });

  it('estado blocked: poltrona bloqueada não é clicável mesmo com onSeatClick', () => {
    const onSeatClick = vi.fn();
    render(<SeatMap fileiras={FILEIRAS} poltronas={POLTRONAS} onSeatClick={onSeatClick} />);
    const bloqueada = screen.getByLabelText('Poltrona 6, bloqueada');
    expect(bloqueada.tagName).toBe('DIV');
    expect(bloqueada).toHaveClass('tt-seatmap-poltrona--blocked');
  });

  it('estado selected: sobrepõe o estado real e vence no rótulo', () => {
    render(<SeatMap fileiras={FILEIRAS} poltronas={POLTRONAS} selecionada={7} onSeatClick={vi.fn()} />);
    const selecionada = screen.getByLabelText('Poltrona 7, selecionada');
    expect(selecionada).toHaveClass('tt-seatmap-poltrona--selected');
    expect(selecionada).toHaveAttribute('aria-pressed', 'true');
  });

  it('dispara onSeatClick ao tocar numa poltrona livre', () => {
    const onSeatClick = vi.fn();
    render(<SeatMap fileiras={FILEIRAS} poltronas={POLTRONAS} onSeatClick={onSeatClick} />);
    fireEvent.click(screen.getByLabelText('Poltrona 1, livre'));
    expect(onSeatClick).toHaveBeenCalledWith(POLTRONAS[0]);
  });

  it('sem onSeatClick, a grade é só leitura (sem botões)', () => {
    render(<SeatMap fileiras={FILEIRAS} poltronas={POLTRONAS} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('estado ocupada (mapa público): bucket visual paid e não clicável mesmo com onSeatClick', () => {
    const onSeatClick = vi.fn();
    const poltronas: SeatMapPoltrona[] = [
      { numero: 1, estado: 'livre' },
      { numero: 2, estado: 'ocupada' },
    ];
    render(<SeatMap fileiras={[[1, 2]]} poltronas={poltronas} onSeatClick={onSeatClick} />);

    const ocupada = screen.getByLabelText('Poltrona 2, ocupada');
    expect(ocupada.tagName).toBe('DIV');
    expect(ocupada).toHaveClass('tt-seatmap-poltrona--paid');

    fireEvent.click(screen.getByLabelText('Poltrona 1, livre'));
    expect(onSeatClick).toHaveBeenCalledTimes(1);
  });

  it('legendaItens customizada substitui a legenda padrão (estados reduzidos do mapa público)', () => {
    render(
      <SeatMap
        fileiras={FILEIRAS}
        poltronas={POLTRONAS}
        legendaItens={[
          { bucket: 'empty', label: 'Livre' },
          { bucket: 'paid', label: 'Ocupada' },
          { bucket: 'blocked', label: 'Bloqueada' },
        ]}
      />,
    );
    expect(screen.getByText('Ocupada')).toBeInTheDocument();
    expect(screen.queryByText('Pago')).not.toBeInTheDocument();
    expect(screen.queryByText('Pendente')).not.toBeInTheDocument();
  });

  it('mostra a legenda por padrão e permite escondê-la', () => {
    const { rerender } = render(<SeatMap fileiras={FILEIRAS} poltronas={POLTRONAS} />);
    expect(screen.getByText('Pago')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText('Livre')).toBeInTheDocument();
    expect(screen.getByText('Bloqueada')).toBeInTheDocument();

    rerender(<SeatMap fileiras={FILEIRAS} poltronas={POLTRONAS} legenda={false} />);
    expect(screen.queryByText('Pago')).not.toBeInTheDocument();
  });
});
