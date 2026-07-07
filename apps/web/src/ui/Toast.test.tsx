import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './Toast';
import { useToast } from './useToast';

function Disparador({ mensagem }: { mensagem: string }) {
  const { mostrarToast } = useToast();
  return (
    <button type="button" onClick={() => mostrarToast(mensagem)}>
      Disparar
    </button>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra a mensagem ao chamar mostrarToast e some depois de 3s', async () => {
    render(
      <ToastProvider>
        <Disparador mensagem="Excursão cancelada." />
      </ToastProvider>,
    );

    expect(screen.queryByText('Excursão cancelada.')).not.toBeInTheDocument();

    act(() => {
      screen.getByRole('button', { name: 'Disparar' }).click();
    });
    expect(screen.getByText('Excursão cancelada.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Excursão cancelada.');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // ainda em fade-out (tt-toast--saindo) por um instante antes de sair do DOM
    expect(screen.getByText('Excursão cancelada.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(180);
    });
    expect(screen.queryByText('Excursão cancelada.')).not.toBeInTheDocument();
  });

  it('lança erro se useToast for usado fora do provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    function ForaDoProvider() {
      useToast();
      return null;
    }
    expect(() => render(<ForaDoProvider />)).toThrow('useToast precisa ser usado dentro de um <ToastProvider>.');
    consoleError.mockRestore();
  });
});
