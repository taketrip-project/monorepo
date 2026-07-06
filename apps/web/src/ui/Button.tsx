import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /**
   * `primary` é a ação principal da tela — o design system permite apenas
   * UM botão `primary` por tela. Essa regra é responsabilidade de quem usa
   * o componente (a tela), não deste componente.
   */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Estado de submit em andamento: desabilita o botão e troca o rótulo. */
  loading?: boolean;
  loadingLabel?: string;
  leftIcon?: ReactNode;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel,
  leftIcon,
  fullWidth = false,
  disabled = false,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'tt-button',
    `tt-button--${variant}`,
    `tt-button--${size}`,
    fullWidth ? 'tt-button--full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (loadingLabel ?? children) : (
        <>
          {leftIcon}
          {children}
        </>
      )}
    </button>
  );
}
