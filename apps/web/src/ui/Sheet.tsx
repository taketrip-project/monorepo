import type { ReactNode } from 'react';
import './Sheet.css';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  if (!open) return null;

  return (
    <div
      className="tt-sheet-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="tt-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="tt-sheet-handle" aria-hidden="true" />
        {title && <div className="tt-sheet-title">{title}</div>}
        <div className="tt-sheet-body">{children}</div>
      </div>
    </div>
  );
}
