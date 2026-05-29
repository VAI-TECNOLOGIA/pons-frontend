import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { Icon } from './Icon';

// Mostra os insights gerados pela IA do corretor (Fase G1)
export function InsightsList() {
  const { data: insights, reload } = useApi<any[]>(() => Api.insightsMe());

  if (!insights || insights.length === 0) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="flex" style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="lightbulb" size={18} />
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Insights da IA</h3>
        </div>
        <div className="text-sm text-secondary">Sem insights gerados ainda — eles aparecem após o sistema analisar seu histórico (diariamente).</div>
      </div>
    );
  }

  const marcarVisto = async (id: number) => {
    try { await Api.insightVisualizado(id); reload(); } catch {}
  };

  const corPorSeveridade: Record<string, string> = {
    ELOGIO:  'var(--color-success-bg)',
    ALERTA:  'var(--color-warning-bg)',
    INFO:    'var(--bg-elevated)',
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="flex" style={{ alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon name="lightbulb" size={18} />
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>Insights da IA</h3>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {insights.map((i) => (
          <div key={i.id} style={{
            padding: 12, borderRadius: 8,
            background: corPorSeveridade[i.severidade] || corPorSeveridade.INFO,
            opacity: i.visualizadoEm ? 0.6 : 1,
          }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{i.titulo}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-700)', marginTop: 4 }}>{i.texto}</div>
            {!i.visualizadoEm && (
              <button className="btn btn--ghost btn--sm" style={{ marginTop: 8 }} onClick={() => marcarVisto(i.id)}>
                Marcar como visto
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
