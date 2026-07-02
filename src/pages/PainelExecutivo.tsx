import { useEffect, useRef, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

type Bloco = 'EMPRESA' | 'CORRETORES' | 'FILIAIS' | 'CIDADES';

// Gráfico de barras horizontal reutilizável (funil da empresa / VGV por filial).
function BarrasChart({ labels, valores, cor, formato }: { labels: string[]; valores: number[]; cor?: string; formato?: (v: number) => string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const inst = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (inst.current) inst.current.destroy();
    Chart.defaults.font.family = 'Inter, sans-serif';
    inst.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '',
          data: valores,
          backgroundColor: cor || '#0E7C9B',
          borderRadius: 6,
          maxBarThickness: 34,
        }],
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (x: any) => (formato ? formato(x.raw) : String(x.raw)) } },
        },
        scales: {
          x: { beginAtZero: true, ticks: formato ? { callback: (v: any) => formato(Number(v)) } : undefined },
          y: { grid: { display: false } },
        },
      },
    } as any);
    return () => { inst.current?.destroy(); };
  }, [JSON.stringify(labels), JSON.stringify(valores)]);
  return <canvas ref={ref} />;
}

export default function PainelExecutivo() {
  const [bloco, setBloco] = useState<Bloco>('EMPRESA');
  const { data, loading, error } = useApi<any>(
    () => {
      if (bloco === 'EMPRESA') return Api.execEmpresa();
      if (bloco === 'CORRETORES') return Api.execCorretores();
      if (bloco === 'FILIAIS') return Api.execFiliais();
      return Api.execCidades();
    },
    [bloco],
  );

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  return (
    <>
      <Topbar title="Painel Executivo" />
      <div className="main__content">
        <PageHeader breadcrumb="Sócios · Painel Executivo" title="Indicadores Comerciais" subtitle="Leads, conversão, vendas, VGV, ROI do tráfego — por corretor, filial, cidade" />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="flex" style={{ gap: 8 }}>
            {(['EMPRESA','CORRETORES','FILIAIS','CIDADES'] as Bloco[]).map((b) => (
              <button key={b} className={`btn btn--sm ${bloco === b ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setBloco(b)}>{b}</button>
            ))}
          </div>
        </div>

        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

        {data && bloco === 'EMPRESA' && (
          <>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Stat label="Leads recebidos"     value={data.leadsRecebidos} />
              <Stat label="Atendidos"           value={`${data.leadsAtendidos} (${data.taxaAtendimentoPct}%)`} />
              <Stat label="Fechados"            value={data.leadsFechados} />
              <Stat label="Conversão"           value={`${data.conversaoPct}%`} />
              <Stat label="Vendas"              value={data.vendas} />
              <Stat label="Contratos assinados" value={data.contratosAssinados} />
              <Stat label="VGV"                 value={fmt(data.vgv)} highlight />
              <Stat label="Custo tráfego"       value={fmt(data.custoTrafego)} />
              <Stat label="ROI"                 value={data.roi != null ? `${data.roi}x` : '—'} highlight />
            </div>
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Funil de conversão</h3>
              <div style={{ height: 180 }}>
                <BarrasChart
                  labels={['Leads recebidos', 'Atendidos', 'Fechados']}
                  valores={[data.leadsRecebidos || 0, data.leadsAtendidos || 0, data.leadsFechados || 0]}
                />
              </div>
            </div>
          </>
        )}

        {data && bloco === 'CORRETORES' && (
          <div className="card">
            <table className="table">
              <thead><tr><th>Corretor</th><th>Filial</th><th>Recebidos</th><th>Atend %</th><th>Vendas</th><th>VGV</th><th>ROI</th></tr></thead>
              <tbody>
                {(data.corretores ?? []).map((c: any) => (
                  <tr key={c.corretorId}>
                    <td><strong>{c.nome}</strong></td>
                    <td>{c.filial || '—'}</td>
                    <td>{c.leadsRecebidos}</td>
                    <td>{c.taxaAtendimentoPct}%</td>
                    <td>{c.vendas}</td>
                    <td>{fmt(c.vgv)}</td>
                    <td>{c.roi != null ? `${c.roi}x` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && bloco === 'FILIAIS' && (data.filiais ?? []).length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>VGV por filial</h3>
            <div style={{ height: Math.max(160, (data.filiais ?? []).length * 44) }}>
              <BarrasChart
                labels={(data.filiais ?? []).map((f: any) => f.nome)}
                valores={(data.filiais ?? []).map((f: any) => f.vgv || 0)}
                cor="#88C559"
                formato={(v) => 'R$ ' + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : (v / 1e3).toFixed(0) + 'K')}
              />
            </div>
          </div>
        )}
        {data && bloco === 'FILIAIS' && (
          <div className="card">
            <table className="table">
              <thead><tr><th>Filial</th><th>Cidade</th><th>Recebidos</th><th>Conversão</th><th>Vendas</th><th>VGV</th></tr></thead>
              <tbody>
                {(data.filiais ?? []).map((f: any) => (
                  <tr key={f.unidadeId}>
                    <td><strong>{f.nome}</strong></td>
                    <td>{f.cidade}</td>
                    <td>{f.leadsRecebidos}</td>
                    <td>{f.conversaoPct}%</td>
                    <td>{f.vendas}</td>
                    <td>{fmt(f.vgv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && bloco === 'CIDADES' && (
          <div className="card">
            <table className="table">
              <thead><tr><th>Cidade</th><th>Recebidos</th><th>Conversão</th><th>Vendas</th><th>VGV</th><th>ROI</th></tr></thead>
              <tbody>
                {(data.cidades ?? []).map((c: any) => (
                  <tr key={c.cidade}>
                    <td><strong>{c.cidade}</strong></td>
                    <td>{c.leadsRecebidos}</td>
                    <td>{c.conversaoPct}%</td>
                    <td>{c.vendas}</td>
                    <td>{fmt(c.vgv)}</td>
                    <td>{c.roi != null ? `${c.roi}x` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className="card" style={{ padding: 14, background: highlight ? 'var(--bg-elevated)' : undefined }}>
      <div className="text-xs text-secondary">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
