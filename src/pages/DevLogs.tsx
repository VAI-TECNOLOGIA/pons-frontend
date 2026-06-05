import { useEffect, useState } from 'react';
import { Api } from '../lib/api';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { PageWrap } from '../components/PageWrap';

interface AuditLog {
  id: number;
  action?: string;
  entity?: string | null;
  actor?: string | null;
  actorRole?: string | null;
  ipAddress?: string | null;
  metadata?: unknown;
  createdAt?: string;
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso.slice(0, 19);
  }
}

export default function DevLogs() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [limit, setLimit] = useState(200);

  async function load() {
    setLoading(true);
    try {
      const r = await Api.devAudit({
        action: actionFilter.trim() || undefined,
        limit,
      });
      setItems((r.data as AuditLog[]) ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageWrap>
      <PageHeader
        breadcrumb="DEV"
        title="Audit Logs"
        subtitle="Eventos do backend · append-only"
        actions={
          <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
            <Icon name="refresh" size={14} /> {loading ? ' Carregando…' : ' Atualizar'}
          </button>
        }
      />

      <div
        className="card"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16, padding: 12 }}
      >
        <input
          type="text"
          className="field__input"
          style={{ flex: 1, minWidth: 200, fontSize: 14 }}
          placeholder="Filtrar por ação (ex: FEEDBACK_SUBMITTED, VENDA_CREATED)…"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void load();
          }}
        />
        <select className="field__select" style={{ fontSize: 14 }} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          <option value={100}>Últimos 100</option>
          <option value={200}>Últimos 200</option>
          <option value={500}>Últimos 500</option>
          <option value={1000}>Últimos 1000</option>
        </select>
        <button className="btn btn--primary btn--sm" onClick={load} disabled={loading}>
          Aplicar
        </button>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <th style={thStyle}>Quando</th>
              <th style={thStyle}>Ator</th>
              <th style={thStyle}>Ação</th>
              <th style={thStyle}>Entidade</th>
              <th style={thStyle}>IP</th>
              <th style={thStyle}>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                <td style={tdStyle}>
                  <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(l.createdAt)}</span>
                </td>
                <td style={tdStyle}>
                  <div style={{ fontSize: 12, lineHeight: 1.3 }}>
                    <div>{l.actor ?? '—'}</div>
                    {l.actorRole && <div style={{ color: 'var(--text-secondary)' }}>{l.actorRole}</div>}
                  </div>
                </td>
                <td style={tdStyle}>
                  <code style={{ fontSize: 12, color: '#B45309', fontWeight: 600 }}>{l.action ?? '—'}</code>
                </td>
                <td style={tdStyle}>
                  <code style={{ fontSize: 12 }}>{l.entity ?? '—'}</code>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.ipAddress ?? '—'}</span>
                </td>
                <td style={tdStyle}>
                  {l.metadata ? (
                    <details>
                      <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>ver</summary>
                      <pre
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          background: 'var(--bg-elevated)',
                          padding: 8,
                          borderRadius: 6,
                          maxWidth: 360,
                          overflowX: 'auto',
                        }}
                      >
                        {JSON.stringify(l.metadata, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <span style={{ fontSize: 12, opacity: 0.4 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {loading ? 'Carregando…' : 'Nenhum log com os filtros atuais.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageWrap>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: 10,
  fontSize: 11,
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--text-secondary)',
};

const tdStyle: React.CSSProperties = {
  padding: 10,
  verticalAlign: 'top',
};
