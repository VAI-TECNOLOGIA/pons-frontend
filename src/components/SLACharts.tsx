import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';

Chart.register(ArcElement, Tooltip, Legend);

// Gráficos e KPIs do SLA — distribuição dos leads em risco por faixa.
export function SLACharts() {
  const { data } = useApi<any>(() => Api.slaStatus().catch(() => null));
  if (!data) return null;

  const alerta = data.alerta?.length || 0;
  const fila = data.fila?.length || 0;
  const redistribuir = data.redistribuir?.length || 0;
  const total = alerta + fila + redistribuir;
  const redistribuidos = data.historico?.length || 0;

  const doughnut = {
    labels: ['Alerta (10–30 min)', 'Em fila (30–60 min)', 'Vai redistribuir (> 60 min)'],
    datasets: [{
      data: [alerta, fila, redistribuir],
      backgroundColor: ['#EAB308', '#F97316', '#DC2626'],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  return (
    <div className="grid fade-in" style={{ gridTemplateColumns: '1fr 1.4fr', gap: 16, marginBottom: 16, alignItems: 'stretch' }}>
      {/* KPIs */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
        <Kpi label="Em risco agora" value={total} cor={total ? '#DC2626' : 'var(--text-primary)'} big />
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Kpi label="Alerta" value={alerta} cor="#EAB308" />
          <Kpi label="Em fila" value={fila} cor="#F97316" />
          <Kpi label="Vai redistribuir" value={redistribuir} cor="#DC2626" />
          <Kpi label="Redistribuídos" value={redistribuidos} cor="var(--color-success)" />
        </div>
      </div>

      {/* Doughnut */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>
          Distribuição do risco
        </div>
        <div style={{ flex: 1, minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {total === 0 ? (
            <span className="text-sm text-secondary">Nenhum lead em risco agora</span>
          ) : (
            <Doughnut
              data={doughnut}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, cor, big }: { label: string; value: number; cor?: string; big?: boolean }) {
  return (
    <div className="metric-pill" style={{ padding: big ? '14px 16px' : '10px 14px' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, lineHeight: 1, fontSize: big ? 38 : 24, color: cor || 'var(--text-primary)' }}>
        {value.toLocaleString('pt-BR')}
      </span>
      <span className="text-xs text-secondary">{label}</span>
    </div>
  );
}
