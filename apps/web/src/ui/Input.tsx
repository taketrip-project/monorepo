import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import './Input.css';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  label?: string;
  /** Erro inline exibido abaixo do campo — vence `hint` quando os dois existem. */
  error?: string;
  hint?: string;
  /** Prefixo (ex.: "R$") — renderizado em Trip Sans Mono. */
  prefix?: ReactNode;
  suffix?: ReactNode;
  size?: 'default' | 'big';
}

export function Input({
  label,
  error,
  hint,
  prefix,
  suffix,
  size = 'default',
  id,
  className,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  const wrapClasses = [
    'tt-input-wrap',
    size === 'big' ? 'tt-input-wrap--big' : '',
    error ? 'tt-input-wrap--error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="tt-input-group">
      {label && (
        <label className="tt-input-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className={wrapClasses}>
        {prefix && <span className="tt-input-affix">{prefix}</span>}
        <input
          id={inputId}
          className={['tt-input', className ?? ''].filter(Boolean).join(' ')}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          {...rest}
        />
        {suffix && <span className="tt-input-affix">{suffix}</span>}
      </div>
      {error ? (
        <span id={errorId} className="tt-input-error" role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span id={hintId} className="tt-input-hint">
            {hint}
          </span>
        )
      )}
    </div>
  );
}
