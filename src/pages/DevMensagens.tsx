import { useEffect, useState } from 'react';
import { Api } from '../lib/api';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { PageWrap } from '../components/PageWrap';

interface Row {
  period: string;
  total: number;
}
interface Resp {
  rows: Row[];
  meta?: { generatedAt: string };
}

export default function DevMensagens() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await Api.devDeliveryStats();
      setData(r);
    } catch (e: any) {
      setErr(e.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const hist = data?.rows.find((r) => r.period === 'Total histórico');
  const today = data?.rows.find((r) => r.period === 'Hoje');

  return (
    <PageWrap>
      <PageHeader
        breadcrumb="DEV"
        title="Escala do problema · envio de mensagens"
        subtitle="Mensagens outbound em conversa SEM inbound prévio · atualiza a cada 60s"
        actions={
          <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
            <Icon name="refresh" size={14} />
            {loading ? ' Carregando…' : ' Atualizar'}
          </button>
        }
      />

      {err && (
        <div className="card" style={{ borderColor: 'var(--red-300)', background: 'rgba(239,68,68,.08)', marginBottom: 16 }}>
          <p style={{ color: 'var(--red-600)', margin: 0, fontSize: 13 }}>{err}</p>
        </div>
      )}

      {hist && hist.total > 1000 && (
        <div
          className="card"
          style={{
            borderColor: 'var(--red-400)',
            background: 'rgba(239,68,68,.08)',
            marginBottom: 20,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <Icon name="warn" size={20} style={{ color: 'var(--red-600)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontWeight: 700, color: 'var(--red-700)', margin: 0, fontSize: 14 }}>
              {hist.total.toLocaleString('pt-BR')} mensagens nunca chegaram ao cliente
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}>
              Cada uma representa uma oportunidade perdida sem o operador saber.
              {today && today.total > 0 && (
                <>
                  <br />
                  <strong>Hoje:</strong> {today.total} novas frustradas.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 12, textTransform: 'uppercase', fontSize: 11, color: 'var(--text-secondary)' }}>
                Período
              </th>
              <th style={{ textAlign: 'left', padding: 12, textTransform: 'uppercase', fontSize: 11, color: 'var(--text-secondary)' }}>
                Tentativas frustradas
              </th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((row) => (
              <tr key={row.period} style={{ borderTop: '1px solid var(--border-light)' }}>
                <td style={{ padding: 12, fontWeight: 600 }}>{row.period}</td>
                <td style={{ padding: 12, fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {row.total.toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
            {!data && (
              <tr>
                <td colSpan={2} style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {loading ? 'Carregando…' : 'Sem dados'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageWrap>
  );
}
