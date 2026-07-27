// "Minhas Comissões" — extrato consolidado do corretor: quanto já recebeu,
// quanto tem a receber, o que entra este mês e nos próximos, gráfico de
// evolução e a lista de TODAS as parcelas de comissão dele, com filtros.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlShort = (n: number) => 'R$ ' + (Math.abs(n) >= 1000 ? (n / 1000).toFixed(0) + 'k' : String(Math.round(n)));
const dataBr = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const STATUS_PARCELA: Record<string, [string, string]> = {
  PAGO: ['paid', 'Recebido'],
  ABERTO: ['neutral', 'Em aberto'],
  AGENDADO: ['neutral', 'Agendado'],
  ATRASADO: ['cancelled', 'Atrasado'],
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar title="Minhas Comissões" />
      <div className="main__content">
        <PageHeader breadcrumb="Financeiro · Minhas Comissões" title="Minhas Comissões" subtitle="Quanto você já recebeu, o que tem pra receber e quando cai cada parcela." />
        {children}
      </div>
    </>
  );
}

function Card({ label, valor, cor, icon }: { label: string; valor: number; cor: string; icon: string }) {
  return (
    <div className="card" style={{ padding: '16px 18px', borderLeft: `4px solid ${cor}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="flex-between" style={{ alignItems: 'flex-start' }}>
        <div className="text-xs text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{label}</div>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 9, background: cor + '1A', color: cor, flexShrink: 0 }}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <div style={{ fontSize: 'clamp(18px, 5.2vw, 24px)', fontWeight: 800, color: cor, whiteSpace: 'nowrap' }}>{brl(valor)}</div>
    </div>
  );
}

export default function MinhasComissoes() {
  const { data, loading, error } = useApi<any>(() => Api.minhasComissoes(), []);
  const [periodo, setPeriodo] = useState('tudo');
  const [empFiltro, setEmpFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInst = useRef<Chart | null>(null);

  const todas: any[] = data?.parcelas || [];
  const hoje = new Date();
  const statusEfetivo = (p: any) => {
    if (p.status === 'PAGO') return 'PAGO';
    return new Date(p.vencimento) < hoje ? 'ATRASADO' : (p.status || 'AGENDADO');
  };

  // opções de empreendimento (do conjunto completo)
  const empreendimentos = useMemo(
    () => Array.from(new Set(todas.map((p) => p.empreendimento).filter(Boolean))).sort(),
    [todas],
  );

  // corte de período
  const desde = useMemo(() => {
    const d = new Date();
    if (periodo === 'mes') return new Date(d.getFullYear(), d.getMonth(), 1);
    if (periodo === '6m') return new Date(d.getFullYear(), d.getMonth() - 5, 1);
    if (periodo === 'ano') return new Date(d.getFullYear(), 0, 1);
    return null;
  }, [periodo]);

  const parcelas = useMemo(() => todas.filter((p) => {
    if (desde && new Date(p.vencimento) < desde) return false;
    if (empFiltro && p.empreendimento !== empFiltro) return false;
    if (statusFiltro) {
      const ef = statusEfetivo(p);
      if (statusFiltro === 'PAGO' && ef !== 'PAGO') return false;
      if (statusFiltro === 'ATRASADO' && ef !== 'ATRASADO') return false;
      if (statusFiltro === 'PENDENTE' && (ef === 'PAGO' || ef === 'ATRASADO')) return false;
    }
    return true;
  }), [todas, desde, empFiltro, statusFiltro]);

  // resumo recalculado a partir do filtro
  const resumo = useMemo(() => {
    const r = { recebido: 0, aReceber: 0, esteMs: 0, proximos: 0, atrasado: 0 };
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
    for (const p of parcelas) {
      const v = p.valorCorretor || 0;
      const ef = statusEfetivo(p);
      const venc = new Date(p.vencimento);
      if (ef === 'PAGO') { r.recebido += v; continue; }
      r.aReceber += v;
      if (ef === 'ATRASADO') r.atrasado += v;
      if (venc >= inicioMes && venc <= fimMes) r.esteMs += v;
      else if (venc > fimMes) r.proximos += v;
    }
    return r;
  }, [parcelas]);

  // séries mensais pro gráfico (recebido / a receber / atrasado por mês de vencimento)
  const serie = useMemo(() => {
    const buckets = new Map<string, { label: string; recebido: number; aReceber: number; atrasado: number }>();
    for (const p of parcelas) {
      const d = new Date(p.vencimento);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets.has(key)) buckets.set(key, { label: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, recebido: 0, aReceber: 0, atrasado: 0 });
      const b = buckets.get(key)!;
      const ef = statusEfetivo(p);
      const v = p.valorCorretor || 0;
      if (ef === 'PAGO') b.recebido += v;
      else if (ef === 'ATRASADO') b.atrasado += v;
      else b.aReceber += v;
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [parcelas]);

  useEffect(() => {
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    if (!chartRef.current || serie.length === 0) return;
    Chart.defaults.font.family = 'Inter, sans-serif';
    chartInst.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels: serie.map((m) => m.label),
        datasets: [
          { label: 'Recebido', data: serie.map((m) => m.recebido), backgroundColor: '#16A34A', borderRadius: 5, stack: 's', maxBarThickness: 64 },
          { label: 'A receber', data: serie.map((m) => m.aReceber), backgroundColor: '#0E7C9B', borderRadius: 5, stack: 's', maxBarThickness: 64 },
          { label: 'Atrasado', data: serie.map((m) => m.atrasado), backgroundColor: '#DC2626', borderRadius: 5, stack: 's', maxBarThickness: 64 },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true, font: { size: 11 } } },
          tooltip: { callbacks: { label: (x: any) => `${x.dataset.label}: ${brl(x.raw)}` } },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { callback: (v: any) => brlShort(v) } },
        },
      },
    });
    return () => { chartInst.current?.destroy(); chartInst.current = null; };
  }, [serie]);

  if (loading && !data) return <Shell><LoadingBlock /></Shell>;
  if (error && !data) return <Shell><ErrorBlock error={error} label="Erro ao carregar comissões" /></Shell>;

  const temFiltro = periodo !== 'tudo' || empFiltro || statusFiltro;

  return (
    <Shell>
      {todas.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Icon name="wallet" size={32} />
          <div style={{ marginTop: 12, fontWeight: 600 }}>Nenhuma comissão registrada ainda.</div>
          <div className="text-xs text-secondary" style={{ marginTop: 4 }}>Assim que você tiver vendas, as parcelas de comissão aparecem aqui.</div>
        </div>
      ) : (
        <>
          {/* Filtros */}
          <div className="card" style={{ padding: '12px 14px', marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ margin: 0, minWidth: 150 }}>
              <label className="field__label">Período</label>
              <select className="field__select" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                <option value="tudo">Tudo</option>
                <option value="mes">Este mês</option>
                <option value="6m">Últimos 6 meses</option>
                <option value="ano">Este ano</option>
              </select>
            </div>
            <div className="field" style={{ margin: 0, minWidth: 170 }}>
              <label className="field__label">Empreendimento</label>
              <select className="field__select" value={empFiltro} onChange={(e) => setEmpFiltro(e.target.value)}>
                <option value="">Todos</option>
                {empreendimentos.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="field" style={{ margin: 0, minWidth: 150 }}>
              <label className="field__label">Status</label>
              <select className="field__select" value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
                <option value="">Todos</option>
                <option value="PAGO">Recebido</option>
                <option value="PENDENTE">A receber</option>
                <option value="ATRASADO">Atrasado</option>
              </select>
            </div>
            {temFiltro && (
              <button className="btn btn--secondary" onClick={() => { setPeriodo('tudo'); setEmpFiltro(''); setStatusFiltro(''); }}>Limpar</button>
            )}
          </div>

          <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
            <Card label="Já recebido" valor={resumo.recebido} cor="#16A34A" icon="check" />
            <Card label="A receber" valor={resumo.aReceber} cor="#0E7C9B" icon="clock" />
            <Card label="Entra este mês" valor={resumo.esteMs} cor="#B45309" icon="calendar" />
            <Card label="Próximos meses" valor={resumo.proximos} cor="#64748B" icon="wallet" />
          </div>

          {/* Progresso */}
          {(() => {
            const total = resumo.recebido + resumo.aReceber;
            const pct = total > 0 ? Math.round((resumo.recebido / total) * 100) : 0;
            return (
              <div className="card" style={{ padding: '14px 18px', marginBottom: 12 }}>
                <div className="flex-between" style={{ marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Progresso das comissões</span>
                  <span className="text-sm text-secondary">
                    <strong style={{ color: '#16A34A' }}>{brl(resumo.recebido)}</strong> de {brl(total)} recebidos · <strong>{pct}%</strong>
                  </span>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: 'var(--bg-card-hover, #eef2f7)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #16A34A, #22C55E)', transition: 'width .4s' }} />
                </div>
              </div>
            );
          })()}

          {/* Gráfico de evolução mensal */}
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <h3 className="card__title" style={{ margin: '0 0 4px' }}>Evolução das comissões</h3>
            <div className="text-xs text-secondary" style={{ marginBottom: 8 }}>Por mês de vencimento — recebido, a receber e atrasado</div>
            {serie.length === 0 ? (
              <div className="text-sm text-secondary" style={{ padding: 16 }}>Sem parcelas no filtro selecionado.</div>
            ) : (
              <div style={{ position: 'relative', height: 280 }}><canvas ref={chartRef} /></div>
            )}
          </div>

          {resumo.atrasado > 0 && (
            <div className="card" style={{ padding: '10px 16px', marginBottom: 12, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', color: '#B91C1C', fontSize: 13, fontWeight: 600 }}>
              {brl(resumo.atrasado)} em parcelas vencidas ainda não recebidas — fale com o financeiro se tiver dúvida.
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 700, fontSize: 14 }}>
              Extrato de parcelas <span className="text-xs text-secondary" style={{ fontWeight: 400 }}>· {parcelas.length} parcela{parcelas.length === 1 ? '' : 's'}, por vencimento</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table tabela-compacta" style={{ minWidth: 620 }}>
                <thead>
                  <tr>
                    <th>Vencimento</th>
                    <th>Venda</th>
                    <th>Empreendimento</th>
                    <th>Parcela</th>
                    <th className="numeric">Comissão</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelas.map((p) => {
                    const ef = statusEfetivo(p);
                    const [k, lbl] = STATUS_PARCELA[ef] || ['neutral', p.status];
                    const pago = ef === 'PAGO';
                    return (
                      <tr key={p.id} style={pago ? { background: 'rgba(22,163,74,0.05)' } : undefined}>
                        <td style={{ whiteSpace: 'nowrap', borderLeft: pago ? '3px solid #16A34A' : '3px solid transparent' }}>{dataBr(p.vencimento)}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{p.cliente}</div>
                          <div className="text-xs text-secondary">#{p.codigo}{p.salaGpi ? ` · Sala ${p.salaGpi}` : ''}</div>
                        </td>
                        <td>{p.empreendimento}{p.unidade ? ` · ${p.unidade}` : ''}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{p.numero}/{p.total}</td>
                        <td className="numeric money" style={{ fontWeight: 700, color: pago ? '#16A34A' : undefined }}>{brl(p.valorCorretor)}</td>
                        <td><span className={`badge badge--${k}`}>{lbl}</span></td>
                      </tr>
                    );
                  })}
                  {parcelas.length === 0 && (
                    <tr><td colSpan={6} className="text-secondary" style={{ padding: 14 }}>Nenhuma parcela no filtro selecionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
