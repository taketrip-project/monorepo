import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListRow } from './ListRow';
import { Badge } from './Badge';

describe('ListRow', () => {
  it('renderiza título e subtítulo', () => {
    render(<ListRow title="Maria Silva" subtitle="(11) 99999-0000" />);
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('(11) 99999-0000')).toBeInTheDocument();
  });

  it('renderiza o badge quando informado', () => {
    render(<ListRow title="Maria Silva" badge={<Badge tone="success">Pago</Badge>} />);
    expect(screen.getByText('Pago')).toBeInTheDocument();
  });

  it('dispara onClick e vira um elemento clicável com chevron', () => {
    const onClick = vi.fn();
    render(<ListRow title="Excursão Serra Fina" onClick={onClick} />);
    const row = screen.getByRole('button', { name: /Excursão Serra Fina/ });
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('sem onClick, não renderiza como botão nem mostra chevron', () => {
    render(<ListRow title="Maria Silva" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
