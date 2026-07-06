import { useNavigate } from 'react-router-dom';
import { Button } from '../ui';
import { setSessionTokens } from '../lib/session';

/**
 * PLACEHOLDER — a tela de login de verdade (com o formulário real contra
 * POST /auth/login, ver docs/api/identity.yaml) é a próxima entrega. Isto
 * existe só para o roteamento (App.tsx) ter algo para redirecionar e para
 * o guard de rota (ProtectedRoute) ser testável de ponta a ponta.
 */
export function LoginPlaceholder() {
  const navigate = useNavigate();

  // Ajuda só em desenvolvimento local: como a tela de login real ainda não
  // existe, não há como criar uma sessão manualmente para navegar pelo app.
  // Nunca aparece em build de produção (import.meta.env.DEV).
  const simularSessaoDev = () => {
    setSessionTokens({ accessToken: 'dev-access-token', refreshToken: 'dev-refresh-token' });
    navigate('/', { replace: true });
  };

  return (
    <main style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1>Entrar</h1>
      <p>A tela de login chega na próxima entrega. Esta é só a fundação do roteamento.</p>
      {import.meta.env.DEV && (
        <Button variant="secondary" onClick={simularSessaoDev}>
          Simular sessão (dev)
        </Button>
      )}
    </main>
  );
}
