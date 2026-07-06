import type { ReactNode } from 'react';
import './Badge.css';

export type BadgeTone = 'mute' | 'success' | 'warning' | 'danger' | 'primary' | 'accent';

export interface BadgeProps {
  tone?: BadgeTone;
  /** Pill (999px, default) para status; chip (6px) para tags menores. */
  shape?: 'pill' | 'chip';
  /** Ícone opcional — status nunca deve depender só da cor. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'mute', shape = 'pill', icon, children, className }: BadgeProps) {
  const classes = ['tt-badge', `tt-badge--${tone}`, className ?? ''].filter(Boolean).join(' ');
  const style = shape === 'chip' ? { borderRadius: 'var(--tt-r-sm)' } : undefined;

  return (
    <span className={classes} style={style}>
      {icon}
      {children}
    </span>
  );
}
