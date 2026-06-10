import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';

export default function MetaCustos() {
  const [dias, setDias] = useState(30);
  const { data, loading, error } = useApi<any>(() => Api.metaCustosResumo(dias), [dias]);
  const { data: serie } = useApi<any[]>(() => Api.metaCustosSerie(dias), [dias]);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <>
      <Topbar title="Custos Meta" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Administração · Tráfego"
          title="Custos Meta WhatsApp + ROI"
          subtitle={`Conversas iniciadas custam R$ 0,30 cada. Últimos ${dias} dias.`}
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="flex" style={{ gap: 8 }}>
            {[7, 30, 90].map((d) => (
              <button key={d} className={`btn btn--sm ${dias === d ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setDias(d)}>{d} dias</button>
            ))}
          </div>
        </div>

        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
              <Stat label="Custo total" value={fmt(data.custoTotal)} />
              <Stat label="Conversas iniciadas" value={data.conversasIniciadas} />
              <Stat label="VGV atribuível" value={fmt(data.vgvAtribuivel)} />
              <Stat label="Vendas fechadas" value={data.vendasFechadas} />
              <Stat label="ROI" value={data.roi ? `${data.roi}x` : '—'} highlight />
            </div>

            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Top corretores por custo</h3>
              <table className="table">
                <thead><tr><th>Corretor</th><th>Conversas</th><th>Custo</th></tr></thead>
                <tbody>
                  {(data.porCorretor ?? []).map((p: any) => (
                    <tr key={p.corretorId}>
                      <td>{p.nome}</td>
                      <td>{p.conversas}</td>
                      <td>{fmt(p.custo)}</td>
                    </tr>
                  ))}
                  {data.porCorretor.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Sem custos registrados</td></tr>}
                </tbody>
              </table>
            </div>

            {serie && serie.length > 0 && (
              <div className="card" style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Série diária</h3>
                <table className="table">
                  <thead><tr><th>Data</th><th>Conversas</th><th>Custo</th></tr></thead>
                  <tbody>
                    {serie.map((s: any) => (
                      <tr key={s.data}><td>{s.data}</td><td>{s.conversas}</td><td>{fmt(s.custo)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className="card" style={{ padding: 14, background: highlight ? 'var(--bg-elevated)' : undefined }}>
      <div className="text-xs text-secondary">{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
