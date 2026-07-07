import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav, type BottomNavKey } from '../ui';
import './AppShell.css';

const PATH_BY_KEY: Record<BottomNavKey, string> = {
  inicio: '/',
  excursoes: '/excursoes',
  pagto: '/pagto',
  mais: '/mais',
};

function keyForPath(pathname: string): BottomNavKey {
  if (pathname.startsWith('/excursoes')) return 'excursoes';
  if (pathname.startsWith('/pagto')) return 'pagto';
  if (pathname.startsWith('/mais') || pathname.startsWith('/organizacao')) return 'mais';
  return 'inicio';
}

/**
 * Layout real de todas as rotas autenticadas: conteúdo da rota + BottomNav
 * fixo (Início · Excursões · Pagto · Mais). Substitui o HomePlaceholder da
 * fundação — a navegação agora é por rota de verdade, não por estado local.
 */
export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = keyForPath(location.pathname);

  return (
    <div className="tt-app-shell">
      <main className="tt-app-shell-main">
        <Outlet />
      </main>
      <BottomNav active={active} onNavigate={(key) => navigate(PATH_BY_KEY[key])} />
    </div>
  );
}
