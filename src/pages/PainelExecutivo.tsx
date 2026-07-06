import { useEffect, useRef, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { StatGlow } from '../components/StatGlow';
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
            <div className="dash-grid dash-grid--cols3">
              <StatGlow icon="trophy" label="VGV" value={fmt(data.vgv)} hero accent="#88C559" sub={`${data.vendas} vendas no período`} />
              <StatGlow icon="gauge" label="ROI" value={data.roi != null ? `${data.roi}x` : '—'} hero accent="#F2B544" sub="Sobre o custo de tráfego" />
              <StatGlow icon="users" label="Leads recebidos" value={data.leadsRecebidos} />
              <StatGlow icon="chat" label="Atendidos" value={data.leadsAtendidos} sub={`${data.taxaAtendimentoPct}% da base`} accent="#3FB6D4" />
              <StatGlow icon="check" label="Fechados" value={data.leadsFechados} accent="#88C559" />
              <StatGlow icon="target" label="Conversão" value={`${data.conversaoPct}%`} accent="#88C559" />
              <StatGlow icon="sales" label="Vendas" value={data.vendas} />
              <StatGlow icon="doc" label="Contratos assinados" value={data.contratosAssinados} />
              <StatGlow icon="wallet" label="Custo tráfego" value={fmt(data.custoTrafego)} accent="#C70A1A" />
            </div>
            <div className="chart-card" style={{ marginTop: 16 }}>
              <h3 className="chart-card__title"><span className="icon-badge"><Icon name="pipeline" size={14} /></span> Funil de conversão</h3>
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
          <div className="chart-card" style={{ padding: 0 }}>
            <h3 className="chart-card__title" style={{ padding: '16px 18px 0' }}><span className="icon-badge"><Icon name="ranking" size={14} /></span> Desempenho por corretor</h3>
            <table className="table row-hover">
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
          <div className="chart-card" style={{ marginBottom: 16, ['--sg-accent' as any]: '#88C559' }}>
            <h3 className="chart-card__title"><span className="icon-badge"><Icon name="building" size={14} /></span> VGV por filial</h3>
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
          <div className="chart-card" style={{ padding: 0 }}>
            <table className="table row-hover">
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
          <div className="chart-card" style={{ padding: 0 }}>
            <h3 className="chart-card__title" style={{ padding: '16px 18px 0' }}><span className="icon-badge"><Icon name="pin" size={14} /></span> Desempenho por cidade</h3>
            <table className="table row-hover">
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

