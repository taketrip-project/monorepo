import type { ReactNode } from 'react';
import './publico.css';

export interface PublicoLayoutProps {
  children: ReactNode;
}

/**
 * Layout das páginas públicas do passageiro (H3.1/H3.2): página da excursão
 * e situação da reserva. Sem AppShell/BottomNav — o passageiro anônimo não
 * tem nada do organizador. Coluna única mobile-first sobre `--tt-bg`, com o
 * wordmark discreto no rodapé (o protagonista é a excursão, não o produto).
 * Não é componente canônico do design system — é composição de página,
 * reaproveitada só nas rotas públicas.
 */
export function PublicoLayout({ children }: PublicoLayoutProps) {
  return (
    <div className="tt-publico-layout">
      <main className="tt-publico-main">{children}</main>
      <footer className="tt-publico-footer">
        organizado com <span className="tt-wordmark tt-publico-wordmark">taketrip</span>
      </footer>
    </div>
  );
}
