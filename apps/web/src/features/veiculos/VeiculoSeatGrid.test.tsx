import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VeiculoSeatGrid } from './VeiculoSeatGrid';
import type { Layout } from '../../lib/api/fleet';

const LAYOUT: Layout = {
  fileiras: [
    [1, 2, null, 3, 4],
    [5, 6, null, 7, 8],
  ],
};

describe('VeiculoSeatGrid', () => {
  it('renderiza poltronas livres e bloqueadas (só leitura, sem onTogglePoltrona)', () => {
    render(<VeiculoSeatGrid layout={LAYOUT} poltronasBloqueadas={[3]} />);

    expect(screen.getByLabelText('Poltrona 1, livre')).toBeInTheDocument();
    expect(screen.getByLabelText('Poltrona 3, bloqueada')).toBeInTheDocument();
    // Só leitura: não deve haver botões, e sim divs.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renderiza corredores (null) sem número visível', () => {
    render(<VeiculoSeatGrid layout={LAYOUT} poltronasBloqueadas={[]} />);
    // 8 poltronas, nenhuma delas com texto de corredor.
    expect(screen.getAllByText(/^[1-8]$/)).toHaveLength(8);
  });

  it('chama onTogglePoltrona ao tocar numa poltrona quando interativa', () => {
    const onToggle = vi.fn();
    render(<VeiculoSeatGrid layout={LAYOUT} poltronasBloqueadas={[]} onTogglePoltrona={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: /Poltrona 5, livre/ }));
    expect(onToggle).toHaveBeenCalledWith(5);
  });

  it('mostra poltrona bloqueada como aria-pressed quando interativa', () => {
    render(<VeiculoSeatGrid layout={LAYOUT} poltronasBloqueadas={[7]} onTogglePoltrona={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Poltrona 7, bloqueada/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
