import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('renderiza o label associado ao campo', () => {
    render(<Input label="Nome" placeholder="Nome do passageiro" />);
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
  });

  it('renderiza o prefixo (ex.: R$)', () => {
    render(<Input label="Valor" prefix="R$" />);
    expect(screen.getByText('R$')).toBeInTheDocument();
  });

  it('mostra erro inline e marca o campo como inválido', () => {
    render(<Input label="WhatsApp" error="Informe um número válido" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um número válido');
    expect(screen.getByLabelText('WhatsApp')).toHaveAttribute('aria-invalid', 'true');
  });

  it('dispara onChange ao digitar', () => {
    const onChange = vi.fn();
    render(<Input label="Nome" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Maria' } });
    expect(onChange).toHaveBeenCalled();
  });
});
