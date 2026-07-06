import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { BottomNav, Button, type BottomNavKey } from '../ui';
import { clearSession } from '../lib/session';

/**
 * PLACEHOLDER — o dashboard real (KPI de próxima excursão, atalho de
 * embarque) chega com a implementação das telas de excursions. Isto só
 * comprova que a rota protegida e o BottomNav funcionam.
 */
export function HomePlaceholder() {
  const navigate = useNavigate();
  const [active, setActive] = useState<BottomNavKey>('inicio');

  const sair = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <main style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1>Taketrip</h1>
        <p>Fundação pronta. As telas reais (dashboard, excursões...) chegam nas próximas entregas.</p>
        <Button variant="secondary" onClick={sair}>
          Sair
        </Button>
      </main>
      <BottomNav active={active} onNavigate={setActive} />
    </div>
  );
}
