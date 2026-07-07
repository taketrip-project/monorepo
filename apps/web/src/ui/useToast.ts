import { createContext, useContext } from 'react';

export interface ToastContextValue {
  mostrarToast: (mensagem: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

/** Hook de acesso ao toast global. Precisa estar dentro de um `<ToastProvider>`. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast precisa ser usado dentro de um <ToastProvider>.');
  }
  return ctx;
}
