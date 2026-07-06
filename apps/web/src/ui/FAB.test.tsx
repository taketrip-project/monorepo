import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FAB } from './FAB';

describe('FAB', () => {
  it('renderiza o rótulo', () => {
    render(<FAB label="Nova excursão" />);
    expect(screen.getByRole('button', { name: 'Nova excursão' })).toBeInTheDocument();
  });

  it('dispara onClick quando clicado', () => {
    const onClick = vi.fn();
    render(<FAB label="Nova excursão" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nova excursão' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renderiza o ícone quando informado', () => {
    render(<FAB label="Nova excursão" icon={<span>+</span>} />);
    expect(screen.getByText('+')).toBeInTheDocument();
  });
});
