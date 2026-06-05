import { Link } from 'react-router-dom';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';

// Sprint 5 M22 — Bloco de progresso de onboarding no Dashboard
export function OnboardingProgress() {
  const { data } = useApi<any>(() => Api.onboardingStatus().catch(() => null));
  if (!data) return null;
  if (data.percentual === 100) return null; // tudo OK, não mostra

  const proximoPasso = data.passos.find((p: any) => !p.feito);
  const linkProx: Record<string, string> = {
    integracao: '/bm',
    lead: '/leads',
    corretor: '/corretores',
    roleta: '/roletas',
    venda: '/vendas',
    app: '/perfil',
  };

  return (
    <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-card))' }}>
      <div className="flex-between" style={{ marginBottom: 8 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>🚀 Configuração inicial — {data.percentual}%</h3>
          <div className="text-xs text-secondary">{data.feitos} de {data.total} passos concluídos</div>
        </div>
        {proximoPasso && (
          <Link to={linkProx[proximoPasso.slug] || '/'} className="btn btn--primary btn--sm">
            Continuar: {proximoPasso.label} →
          </Link>
        )}
      </div>

      <div style={{ height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${data.percentual}%`,
          background: 'linear-gradient(90deg, var(--color-success), var(--color-info, #1258CA))',
          transition: 'width 0.5s',
        }} />
      </div>

      <div className="flex" style={{ gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        {(data.passos ?? []).map((p: any) => (
          <div key={p.slug} style={{
            fontSize: 11,
            color: p.feito ? 'var(--color-success)' : 'var(--text-secondary)',
            textDecoration: p.feito ? 'line-through' : 'none',
          }}>
            {p.feito ? '✓' : '○'} {p.label}
          </div>
        ))}
      </div>
    </div>
  );
}
