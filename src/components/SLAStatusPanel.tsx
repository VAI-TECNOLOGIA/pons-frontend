import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { Icon } from './Icon';

// Painel de visibilidade do SLA (Fase B2) — leads em risco + histórico
export function SLAStatusPanel() {
  const { data } = useApi<any>(() => Api.slaStatus().catch(() => null));

  if (!data) return null;

  const total = (data.alerta?.length || 0) + (data.fila?.length || 0) + (data.redistribuir?.length || 0);
  if (total === 0 && (data.historico?.length || 0) === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="clock" size={16} /> SLA · Leads em risco
      </h3>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        <Bucket label="Alerta (10-30 min)" dotColor="#EAB308" cor="var(--color-warning-bg)" itens={data.alerta} />
        <Bucket label="Em fila (30-60 min)" dotColor="#F97316" cor="var(--color-warning-bg)" itens={data.fila} />
        <Bucket label="Vai redistribuir (>60 min)" dotColor="#DC2626" cor="var(--color-danger-bg)" itens={data.redistribuir} />
      </div>

      {data.historico && data.historico.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Últimas redistribuições automáticas</h4>
          <div style={{ maxHeight: 150, overflow: 'auto', background: 'var(--bg-elevated)', padding: 8, borderRadius: 6 }}>
            {data.historico.slice(0, 10).map((h: any, i: number) => (
              <div key={i} className="text-xs" style={{ padding: '4px 0', borderBottom: '1px solid var(--border-light)' }}>
                <strong>Lead #{h.leadId}</strong> {h.texto} · {new Date(h.createdAt).toLocaleString('pt-BR')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Bucket({ label, cor, itens, dotColor }: { label: string; cor: string; itens: any[]; dotColor?: string }) {
  const count = itens?.length || 0;
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        background: cor,
        borderLeft: `3px solid ${dotColor || 'var(--border-medium)'}`,
        opacity: count === 0 ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12.5 }}>
          {dotColor && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />}
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, lineHeight: 1, color: count === 0 ? 'var(--text-secondary)' : 'inherit' }}>
          {count}
        </span>
      </div>
      {count > 0 && (
        <div style={{ maxHeight: 100, overflow: 'auto', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {itens.slice(0, 5).map((l: any) => (
            <div key={l.id} className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome}</strong>
              <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{l.corretorNome || '?'} · {l.minutosSemResposta}min</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
