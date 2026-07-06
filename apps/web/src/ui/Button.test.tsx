import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renderiza o texto e a variante primary por padrão', () => {
    render(<Button>Salvar</Button>);
    const button = screen.getByRole('button', { name: 'Salvar' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('tt-button--primary');
  });

  it('aplica a classe da variante informada', () => {
    render(<Button variant="danger">Cancelar excursão</Button>);
    expect(screen.getByRole('button', { name: 'Cancelar excursão' })).toHaveClass('tt-button--danger');
  });

  it('dispara onClick quando clicado', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Marcar embarcado</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Marcar embarcado' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('estado loading desabilita o botão, troca o rótulo e bloqueia o clique', () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Salvando..." onClick={onClick}>
        Salvar e enviar PIX
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Salvando...' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
