import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import './Toast.css';

/**
 * Toast minúsculo para "sucesso surpreendente" (frontend-guidelines §8):
 * ações raras e irreversíveis (ex.: cancelar excursão) merecem uma
 * confirmação visível, diferente do sucesso silencioso de ações repetidas
 * (ex.: marcar embarque). Mostra UMA mensagem por vez, 3s, sem fila — não é
 * pensado para notificações simultâneas.
 */
const DURACAO_MS = 3000;

interface ToastContextValue {
  mostrarToast: (mensagem: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [mensagem, setMensagem] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const mostrarToast = useCallback((texto: string) => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    setMensagem(texto);
    timeoutRef.current = window.setTimeout(() => {
      setMensagem(null);
      timeoutRef.current = null;
    }, DURACAO_MS);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ mostrarToast }), [mostrarToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mensagem && (
        <div className="tt-toast" role="status" aria-live="polite">
          {mensagem}
        </div>
      )}
    </ToastContext.Provider>
  );
}

/** Hook de acesso ao toast global. Precisa estar dentro de um `<ToastProvider>`. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast precisa ser usado dentro de um <ToastProvider>.');
  }
  return ctx;
}
