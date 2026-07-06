import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('não renderiza nada quando fechado', () => {
    render(
      <Sheet open={false} onClose={vi.fn()} title="Passageiro">
        conteúdo
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renderiza título e conteúdo quando aberto', () => {
    render(
      <Sheet open onClose={vi.fn()} title="Passageiro">
        <p>conteúdo do sheet</p>
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Passageiro' })).toBeInTheDocument();
    expect(screen.getByText('conteúdo do sheet')).toBeInTheDocument();
  });

  it('chama onClose ao clicar no backdrop, mas não ao clicar dentro do sheet', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Passageiro">
        <p>conteúdo</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByText('conteúdo'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
