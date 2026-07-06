import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BottomNav } from './BottomNav';

describe('BottomNav', () => {
  it('renderiza as 4 abas: Início · Excursões · Pagto · Mais', () => {
    render(<BottomNav active="inicio" onNavigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Início/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Excursões/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pagto/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mais/ })).toBeInTheDocument();
  });

  it('marca a aba ativa com aria-current', () => {
    render(<BottomNav active="excursoes" onNavigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Excursões/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Início/ })).not.toHaveAttribute('aria-current');
  });

  it('Pagto vem desabilitado por padrão (billing ainda não existe)', () => {
    const onNavigate = vi.fn();
    render(<BottomNav active="inicio" onNavigate={onNavigate} />);
    const pagto = screen.getByRole('button', { name: /Pagto/ });
    expect(pagto).toBeDisabled();
    fireEvent.click(pagto);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('dispara onNavigate ao clicar numa aba habilitada', () => {
    const onNavigate = vi.fn();
    render(<BottomNav active="inicio" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /Mais/ }));
    expect(onNavigate).toHaveBeenCalledWith('mais');
  });
});
