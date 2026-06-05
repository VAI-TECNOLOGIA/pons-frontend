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
  return (
    <div style={{ padding: 10, borderRadius: 8, background: cor }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        {dotColor && <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />} {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900 }}>{itens?.length || 0}</div>
      <div style={{ maxHeight: 100, overflow: 'auto', marginTop: 4 }}>
        {(itens || []).slice(0, 5).map((l: any) => (
          <div key={l.id} className="text-xs" style={{ padding: '2px 0' }}>
            <strong>{l.nome}</strong> → {l.corretorNome || '?'} ({l.minutosSemResposta}min)
          </div>
        ))}
      </div>
    </div>
  );
}
