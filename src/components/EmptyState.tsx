import { Icon } from './Icon';

interface EmptyStateProps {
  icon?: string;
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  size?: 'sm' | 'md' | 'lg';
}

export function EmptyState({
  icon = 'search',
  title = 'Nada por aqui ainda',
  description,
  action,
  size = 'md',
}: EmptyStateProps) {
  const iconSize = size === 'sm' ? 32 : size === 'lg' ? 64 : 48;
  const padding = size === 'sm' ? 24 : size === 'lg' ? 64 : 40;
  return (
    <div
      className="fade-in"
      style={{
        padding,
        textAlign: 'center',
        color: 'var(--text-secondary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{
        width: iconSize + 24,
        height: iconSize + 24,
        borderRadius: '50%',
        background: 'var(--bg-elevated)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        opacity: 0.7,
      }}>
        <Icon name={icon} size={iconSize} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        {description && <div style={{ fontSize: 13, marginTop: 4, maxWidth: 380, lineHeight: 1.5 }}>{description}</div>}
      </div>
      {action && (
        <button className="btn btn--primary btn--sm u-mt-2" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
