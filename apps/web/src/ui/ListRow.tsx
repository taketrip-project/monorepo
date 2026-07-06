import type { ReactNode } from 'react';
import './ListRow.css';

export interface ListRowProps {
  /** Avatar 40x40 — normalmente iniciais ou um <img>. */
  avatar?: ReactNode;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  onClick?: () => void;
  className?: string;
}

function ChevronIcon() {
  return (
    <svg
      className="tt-list-row-chevron"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ListRow({ avatar, title, subtitle, badge, onClick, className }: ListRowProps) {
  const classes = ['tt-list-row', className ?? ''].filter(Boolean).join(' ');
  const content = (
    <>
      {avatar && <span className="tt-list-row-avatar">{avatar}</span>}
      <span className="tt-list-row-body">
        <span className="tt-list-row-title">{title}</span>
        {subtitle && <span className="tt-list-row-subtitle">{subtitle}</span>}
      </span>
      {badge}
      {onClick && <ChevronIcon />}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}
