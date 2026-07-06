import './BottomNav.css';

export type BottomNavKey = 'inicio' | 'excursoes' | 'pagto' | 'mais';

interface BottomNavItemConfig {
  key: BottomNavKey;
  label: string;
  icon: string;
}

// Abas fixas do app do organizador (frontend-guidelines.md §7/§9). Sem
// sidebar, sem hamburger. "Pagto" fica desabilitado até o módulo billing
// existir.
const ITEMS: BottomNavItemConfig[] = [
  { key: 'inicio', label: 'Início', icon: '🏠' },
  { key: 'excursoes', label: 'Excursões', icon: '🧭' },
  { key: 'pagto', label: 'Pagto', icon: '💳' },
  { key: 'mais', label: 'Mais', icon: '⋯' },
];

export interface BottomNavProps {
  active: BottomNavKey;
  onNavigate: (key: BottomNavKey) => void;
  /** Chaves adicionais a desabilitar além de "pagto" (já desabilitado por padrão). */
  disabledKeys?: BottomNavKey[];
}

export function BottomNav({ active, onNavigate, disabledKeys = [] }: BottomNavProps) {
  const disabled = new Set<BottomNavKey>(['pagto', ...disabledKeys]);

  return (
    <nav className="tt-bottom-nav" aria-label="Navegação principal">
      {ITEMS.map((item) => {
        const isDisabled = disabled.has(item.key);
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            className={[
              'tt-bottom-nav-item',
              isActive ? 'tt-bottom-nav-item--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            disabled={isDisabled}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => !isDisabled && onNavigate(item.key)}
          >
            <span className="tt-bottom-nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="tt-bottom-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
