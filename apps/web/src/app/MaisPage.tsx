import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ListRow } from '../ui';
import { clearSession } from '../lib/session';
import { logout as logoutRequest } from '../lib/api/identity';
import './MaisPage.css';

/**
 * Aba "Mais": configurações da organização e sair. Outras entradas
 * (exportar, suporte) ficam para entregas futuras — só o que o contrato de
 * identity já sustenta (organização/membros/convites) e logout.
 */
export function MaisPage() {
  const navigate = useNavigate();
  const [saindo, setSaindo] = useState(false);

  const sair = async () => {
    setSaindo(true);
    try {
      await logoutRequest();
    } catch {
      // Mesmo se a chamada falhar (rede fora, sessão já expirada...), o
      // organizador quer sair — limpamos local e mandamos para /login de
      // qualquer forma.
    } finally {
      clearSession();
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="tt-mais-page">
      <h1 className="tt-mais-title">Mais</h1>

      <div className="tt-mais-list">
        <ListRow title="Organização" subtitle="Equipe, convites e configurações" onClick={() => navigate('/organizacao')} />
      </div>

      <Button variant="secondary" fullWidth loading={saindo} loadingLabel="Saindo..." onClick={sair}>
        Sair
      </Button>
    </div>
  );
}
