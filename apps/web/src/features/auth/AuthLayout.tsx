import type { ReactNode } from 'react';
import './AuthLayout.css';

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Layout compartilhado das telas públicas de autenticação (login, registro,
 * esqueci/redefinir senha, aceitar convite). Fundo `--tt-bg`, card
 * centralizado, largura mobile-first. Não é um componente canônico do
 * design system — é composição de página, reaproveitada só aqui.
 */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="tt-auth-layout">
      <div className="tt-auth-card">
        <span className="tt-wordmark">taketrip</span>
        <h1 className="tt-auth-title">{title}</h1>
        {subtitle && <p className="tt-auth-subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
