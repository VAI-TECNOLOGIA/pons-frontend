import { Link } from 'react-router-dom';
import { useUser } from '../lib/userContext';
import { useTheme } from '../lib/theme';
import { Icon } from './Icon';
import { NotificationsBell } from './NotificationsBell';

interface Props {
  breadcrumb: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ breadcrumb, title, subtitle, actions }: Props) {
  return (
    <div className="page-header">
      <div>
        <div className="page-header__breadcrumb">{breadcrumb}</div>
        <h2 className="page-header__title">{title}</h2>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}

interface TopbarProps {
  title: string;
  right?: React.ReactNode;
  extra?: React.ReactNode;
}

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function Topbar({ title, right, extra }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <h1 className="topbar__title">{title}</h1>
        {extra}
      </div>
      <div className="topbar__right">
        {right}
        <UserChip />
      </div>
    </header>
  );
}

function UserChip() {
  const { user } = useUser();
  const { theme, toggle } = useTheme();
  if (!user) return null;
  return (
    <div className="user-chip">
      <NotificationsBell />
      <button
        onClick={toggle}
        className="user-chip__theme"
        title={theme === 'dark' ? 'Mudar para claro' : 'Mudar para escuro'}
        aria-label="Alternar tema"
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
      </button>
      <Link to="/perfil" className="user-chip__link" title="Meu perfil">
        <span className="user-chip__greeting">
          <span className="user-chip__hi">{getGreeting()},</span>
          <span className="user-chip__name">{user.name.split(' ')[0]}</span>
        </span>
        <span className="user-chip__avatar">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} />
          ) : (
            <span>{user.initials || '?'}</span>
          )}
        </span>
      </Link>
    </div>
  );
}
