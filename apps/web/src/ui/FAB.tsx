import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './FAB.css';

export interface FABProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  icon?: ReactNode;
}

/** Pill fixo, sempre `--tt-primary`, posicionado acima do BottomNav (right:16, bottom:92). */
export function FAB({ label, icon, className, type = 'button', ...rest }: FABProps) {
  return (
    <button type={type} className={['tt-fab', className ?? ''].filter(Boolean).join(' ')} {...rest}>
      {icon && (
        <span className="tt-fab-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {label}
    </button>
  );
}
