import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { hasSession } from '../lib/session';

/**
 * Guarda de rota: sem sessão válida (sem refresh token guardado), redireciona
 * para /login. Não há verificação remota aqui de propósito — o cliente HTTP
 * (src/lib/api/client.ts) já cuida de renovar/derrubar a sessão a cada
 * chamada de API.
 */
export function ProtectedRoute() {
  const location = useLocation();

  if (!hasSession()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
