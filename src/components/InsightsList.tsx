import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { Icon } from './Icon';

// Mostra os insights gerados pela IA do corretor (Fase G1).
// Design: cabeçalho com selo IA + cada insight com cor/ícone por severidade,
// borda lateral e ação de dispensar. Dedup por título (rede de segurança).
const SEVERIDADE: Record<string, { cor: string; icon: string; label: string }> = {
  ELOGIO: { cor: '#16A34A', icon: 'checkCircle', label: 'Elogio' },
  ALERTA: { cor: '#B45309', icon: 'warn', label: 'Atenção' },
  INFO: { cor: '#0E7C9B', icon: 'lightbulb', label: 'Dica' },
};

export function InsightsList() {
  const { data: insights, reload } = useApi<any[]>(() => Api.insightsMe());

  const Header = (
    <div className="flex" style={{ alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#0E7C9B,#3FB6D4)', color: '#fff', flexShrink: 0 }}>
        <Icon name="lightbulb" size={17} />
      </span>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Insights da IA</h3>
        <div className="text-xs text-secondary">Análise do seu histórico, atualizada diariamente</div>
      </div>
    </div>
  );

  if (!insights || insights.length === 0) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        {Header}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 12px', borderRadius: 10, border: '1px dashed var(--border-light)', color: 'var(--text-secondary)', fontSize: 13 }}>
          <Icon name="clock" size={16} />
          Sem insights ainda — assim que houver histórico suficiente, a IA gera recomendações aqui.
        </div>
      </div>
    );
  }

  // Dedup por título (mantém o 1º, que é o mais recente) e prioriza não-vistos.
  const vistos = new Set<string>();
  const lista = insights
    .filter((i) => (vistos.has(i.titulo) ? false : (vistos.add(i.titulo), true)))
    .sort((a, b) => Number(!!a.visualizadoEm) - Number(!!b.visualizadoEm));

  const marcarVisto = async (id: number) => {
    try { await Api.insightVisualizado(id); reload(); } catch { /* silencioso */ }
  };

  const naoVistos = lista.filter((i) => !i.visualizadoEm).length;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="flex-between" style={{ marginBottom: 12 }}>
        {Header}
        {naoVistos > 0 && (
          <span className="badge badge--paid" style={{ height: 'fit-content' }}>{naoVistos} novo{naoVistos > 1 ? 's' : ''}</span>
        )}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {lista.map((i) => {
          const s = SEVERIDADE[i.severidade] || SEVERIDADE.INFO;
          const visto = !!i.visualizadoEm;
          return (
            <div key={i.id} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '12px 14px', borderRadius: 12,
              borderLeft: `4px solid ${s.cor}`,
              background: visto ? 'var(--bg-card-hover, #f6f8fb)' : s.cor + '12',
              opacity: visto ? 0.65 : 1,
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: s.cor + '22', color: s.cor, flexShrink: 0, marginTop: 1 }}>
                <Icon name={s.icon} size={16} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex-between" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25 }}>{i.titulo}</div>
                  {!visto && (
                    <button
                      onClick={() => marcarVisto(i.id)}
                      title="Dispensar"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2, flexShrink: 0, lineHeight: 0 }}
                    >
                      <Icon name="x" size={15} />
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>{i.texto}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
