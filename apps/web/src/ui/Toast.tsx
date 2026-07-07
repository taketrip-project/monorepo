import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastContextValue } from './useToast';
import './Toast.css';

/**
 * Toast minúsculo para "sucesso surpreendente" (frontend-guidelines §8):
 * ações raras e irreversíveis (ex.: cancelar excursão) merecem uma
 * confirmação visível, diferente do sucesso silencioso de ações repetidas
 * (ex.: marcar embarque). Mostra UMA mensagem por vez, 3s, sem fila — não é
 * pensado para notificações simultâneas.
 */
const DURACAO_MS = 3000;
const DURACAO_FADE_MS = 180;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const fadeRef = useRef<number | null>(null);

  const mostrarToast = useCallback((texto: string) => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    if (fadeRef.current !== null) window.clearTimeout(fadeRef.current);

    setMensagem(texto);
    setSaindo(false);
    timeoutRef.current = window.setTimeout(() => {
      setSaindo(true);
      fadeRef.current = window.setTimeout(() => {
        setMensagem(null);
        setSaindo(false);
        fadeRef.current = null;
      }, DURACAO_FADE_MS);
      timeoutRef.current = null;
    }, DURACAO_MS);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ mostrarToast }), [mostrarToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mensagem && (
        <div
          className={`tt-toast${saindo ? ' tt-toast--saindo' : ''}`}
          role="status"
          aria-live="polite"
        >
          {mensagem}
        </div>
      )}
    </ToastContext.Provider>
  );
}
