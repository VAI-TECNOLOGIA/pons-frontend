import { useTheme } from '../lib/theme';
import { Icon } from './Icon';

// Toggle de tema (sol/lua) — usado na Topbar
export function ThemeToggle({ size = 18 }: { size?: number }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      aria-label="Alternar tema"
      className="btn btn--ghost btn--sm u-cursor-pointer"
      style={{
        padding: 6,
        width: 36,
        height: 36,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: '1px solid var(--border-light)',
        transition: 'all 200ms var(--ease-out)',
      }}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={size} />
    </button>
  );
}
