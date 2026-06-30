import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { Icon } from './Icon';
import { initials } from '../lib/format';

// Painel de visibilidade do SLA — leads em risco + histórico de redistribuição
const BUCKETS = [
  { key: 'alerta',       label: 'Alerta',          faixa: '10–30 min', cor: '#EAB308' },
  { key: 'fila',         label: 'Em fila',         faixa: '30–60 min', cor: '#F97316' },
  { key: 'redistribuir', label: 'Vai redistribuir', faixa: '> 60 min',  cor: '#DC2626' },
] as const;

export function SLAStatusPanel() {
  const { data } = useApi<any>(() => Api.slaStatus().catch(() => null));
  if (!data) return null;

  const total = (data.alerta?.length || 0) + (data.fila?.length || 0) + (data.redistribuir?.length || 0);
  if (total === 0 && (data.historico?.length || 0) === 0) return null;

  return (
    <div className="card fade-in" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Icon name="clock" size={16} />
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>SLA · Leads em risco</h3>
        <span style={{
          marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
          background: total > 0 ? 'color-mix(in srgb, #DC2626 16%, transparent)' : 'var(--bg-elevated)',
          color: total > 0 ? '#ef4444' : 'var(--text-secondary)',
        }}>
          {total} {total === 1 ? 'lead em risco' : 'leads em risco'}
        </span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
        {BUCKETS.map((b) => {
          const itens: any[] = data[b.key] || [];
          return (
            <div key={b.key} className="sla-bucket" style={{ borderTop: `3px solid ${b.cor}`, opacity: itens.length === 0 ? 0.75 : 1 }}>
              <div className="sla-bucket__head">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: b.cor, flexShrink: 0 }} />
                    {b.label}
                  </div>
                  <div className="text-xs text-secondary" style={{ marginTop: 2 }}>{b.faixa}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, lineHeight: 1, color: itens.length ? b.cor : 'var(--text-tertiary)' }}>
                  {itens.length}
                </span>
              </div>

              {itens.length === 0 ? (
                <div className="text-xs text-secondary" style={{ padding: '4px 14px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="check" size={13} /> Tudo certo aqui
                </div>
              ) : (
                <div style={{ paddingBottom: 8 }}>
                  {itens.slice(0, 5).map((l: any) => (
                    <div key={l.id} className="sla-row">
                      <span className="sla-avatar" style={{ background: b.cor }}>{initials(l.nome || 'L')}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="font-semibold" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome || 'Lead'}</div>
                        <div className="text-xs text-secondary" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.corretorNome || 'Sem corretor'}</div>
                      </div>
                      <span className="sla-time-pill" style={{ background: `color-mix(in srgb, ${b.cor} 16%, transparent)`, color: b.cor }}>
                        {l.minutosSemResposta}min
                      </span>
                    </div>
                  ))}
                  {itens.length > 5 && (
                    <div className="text-xs text-secondary" style={{ padding: '6px 14px 0' }}>+{itens.length - 5} mais</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.historico && data.historico.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="history" size={13} /> Redistribuições automáticas
          </div>
          <div style={{ maxHeight: 180, overflow: 'auto' }}>
            {data.historico.slice(0, 12).map((h: any, i: number) => (
              <div key={i} className="sla-histrow">
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F97316', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="font-semibold" style={{ fontSize: 12.5 }}>{h.leadNome || `Lead #${h.leadId}`}</span>
                  <span className="text-xs text-secondary"> {h.texto}</span>
                </div>
                <span className="text-xs text-secondary" style={{ flexShrink: 0 }}>{new Date(h.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
