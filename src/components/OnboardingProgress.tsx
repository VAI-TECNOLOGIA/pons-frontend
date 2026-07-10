import { Link } from 'react-router-dom';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { Icon } from './Icon';
import { isNativeApp } from '../lib/platform';

// Sprint 5 M22 — Bloco de progresso de onboarding no Dashboard
export function OnboardingProgress() {
  const { data } = useApi<any>(() => Api.onboardingStatus().catch(() => null));
  if (!data) return null;

  // Dentro do app nativo o passo "Baixar o App Mobile" já está cumprido — o
  // usuário está justamente usando o app. Marca como feito e recalcula.
  const nativo = isNativeApp();
  const passos = (data.passos ?? []).map((p: any) =>
    nativo && p.slug === 'app' ? { ...p, feito: true } : p);
  const total = passos.length;
  const feitos = passos.filter((p: any) => p.feito).length;
  const percentual = total ? Math.round((feitos / total) * 100) : (data.percentual ?? 0);
  if (percentual === 100) return null; // tudo OK, não mostra

  const proximoPasso = passos.find((p: any) => !p.feito);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="zap" size={16} /> Configuração inicial — {percentual}%
          </h3>
          <div className="text-xs text-secondary">{feitos} de {total} passos concluídos</div>
        </div>
        {proximoPasso && (
          <Link to={linkProx[proximoPasso.slug] || '/'} className="btn btn--primary btn--sm" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
            Continuar: {proximoPasso.label} →
          </Link>
        )}
      </div>

      <div style={{ height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${percentual}%`,
          background: 'linear-gradient(90deg, var(--color-success), var(--color-info, #0E7C9B))',
          transition: 'width 0.5s',
        }} />
      </div>

      <div className="flex" style={{ gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        {passos.map((p: any) => (
          <div key={p.slug} style={{
            fontSize: 11,
            color: p.feito ? 'var(--color-success)' : 'var(--text-secondary)',
            textDecoration: p.feito ? 'line-through' : 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <Icon name={p.feito ? 'check' : 'circleOutline'} size={11} /> {p.label}
          </div>
        ))}
      </div>
    </div>
  );
}
