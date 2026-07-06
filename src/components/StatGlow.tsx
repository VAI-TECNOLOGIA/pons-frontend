import { Icon } from './Icon';

// Card de indicador do DASH KIT (styles/dash.css) — brilho, hover e accent
// por card. Usado nos painéis executivo, inteligência de leads etc.
export function StatGlow({
  icon,
  label,
  value,
  sub,
  accent,
  hero,
  delta,
}: {
  icon?: string;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string; // cor do glow/ícone (default: azul do sistema)
  hero?: boolean; // fundo com gradiente do accent
  delta?: number | null; // variação % (verde/vermelho)
}) {
  return (
    <div
      className={'stat-glow' + (hero ? ' stat-glow--hero' : '')}
      style={accent ? ({ '--sg-accent': accent } as React.CSSProperties) : undefined}
    >
      {icon && (
        <div className="stat-glow__icon">
          <Icon name={icon} size={16} />
        </div>
      )}
      <div className="stat-glow__label">{label}</div>
      <div className="stat-glow__value">
        {value}
        {delta != null && (
          <span className={'stat-glow__delta ' + (delta >= 0 ? 'stat-glow__delta--up' : 'stat-glow__delta--down')}>
            <Icon name={delta >= 0 ? 'arrow_up' : 'arrow_down'} size={9} />
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {sub && <div className="stat-glow__sub">{sub}</div>}
    </div>
  );
}

// Linha de barra horizontal animada (rankings, origens, plataformas).
export function BarRow({ label, value, max, extra, cor }: { label: string; value: number; max: number; extra?: string; cor?: string }) {
  const pct = Math.max(2, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div className="bar-row">
      <div className="bar-row__head">
        <span className="bar-row__label" title={label}>{label}</span>
        <span className="bar-row__val">{value.toLocaleString('pt-BR')}{extra ? ` · ${extra}` : ''}</span>
      </div>
      <div className="bar-row__track">
        <div className="bar-row__fill" style={{ width: `${pct}%`, ...(cor ? ({ '--bar-cor': cor } as React.CSSProperties) : {}) }} />
      </div>
    </div>
  );
}
