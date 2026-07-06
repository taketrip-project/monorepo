import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renderiza o texto', () => {
    render(<Badge tone="success">Pago</Badge>);
    expect(screen.getByText('Pago')).toBeInTheDocument();
  });

  it('aplica a classe da tonalidade informada', () => {
    render(<Badge tone="warning">Pendente</Badge>);
    expect(screen.getByText('Pendente')).toHaveClass('tt-badge--warning');
  });

  it('usa mute como tonalidade padrão', () => {
    render(<Badge>Rascunho</Badge>);
    expect(screen.getByText('Rascunho')).toHaveClass('tt-badge--mute');
  });
});
