import { useEffect, useRef, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { formatCurrency, formatCurrencyShort } from '../lib/format';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { RankingMensalPanel } from './relatorios/RankingMensalPanel';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

import './relatorios.css';

const PALETTE = ['#0E7C9B', '#88C559', '#F2B544', '#3FB6D4', '#263654', '#C70A1A', '#8493B4'];

function computePeriodo(p: string) {
 const now = new Date();
 const y = now.getFullYear();
 const m = now.getMonth();
 const MES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
 if (p === 'mes') return { from: null, to: null, label: `${MES_NOME[m]} ${y}` };
 if (p === 'mespassado') {
 const f = new Date(y, m - 1, 1);
 const t = new Date(y, m, 0, 23, 59, 59);
 return { from: f.toISOString(), to: t.toISOString(), label: `${MES_NOME[(m + 11) % 12]} ${m === 0 ? y - 1 : y}` };
 }
 if (p === 'tri') {
 const f = new Date(y, m - 2, 1);
 return { from: f.toISOString(), to: now.toISOString(), label: 'Último trimestre' };
 }
 if (p === 'ano') {
 const f = new Date(y, 0, 1);
 return { from: f.toISOString(), to: now.toISOString(), label: `${y}` };
 }
 return { from: null, to: null, label: '' };
}

export default function Relatorios() {
 const [periodo, setPeriodo] = useState<'mes' | 'mespassado' | 'tri' | 'ano'>('mes');
 const p = computePeriodo(periodo);
 const params = { from: p.from, to: p.to };

 const { data: kpis, loading: l1, error: e1 } = useApi<any>(() => Api.relKpis(params), [periodo]);
 const { data: serie } = useApi<any>(() => Api.relSeries(6), [periodo]);
 const { data: origem } = useApi<any[]>(() => Api.relOrigem(params), [periodo]);
 const { data: funil } = useApi<any>(() => Api.relFunil(params), [periodo]);
 const { data: ranking } = useApi<any[]>(() => Api.relRanking(params), [periodo]);
 const { data: emps } = useApi<any[]>(() => Api.relEmpreendimentos());

 const chVgvRef = useRef<HTMLCanvasElement>(null);
 const chOrigemRef = useRef<HTMLCanvasElement>(null);
 const chFunilRef = useRef<HTMLCanvasElement>(null);
 const chRankRef = useRef<HTMLCanvasElement>(null);
 const instances = useRef<Chart[]>([]);

 useEffect(() => {
 instances.current.forEach((c) => c.destroy());
 instances.current = [];
 Chart.defaults.font.family = 'Inter, sans-serif';

 if (chVgvRef.current && serie?.meses) {
 instances.current.push(
 new Chart(chVgvRef.current, {
 data: {
 labels: serie.meses.map((m: any) => m.label),
 datasets: [
 { type: 'bar', label: 'VGV realizado', data: serie.meses.map((m: any) => m.vgv), backgroundColor: '#0E7C9B', borderRadius: 6, maxBarThickness: 46, order: 2 },
 { type: 'line', label: 'Meta da casa', data: serie.meses.map(() => serie.metaCasa), borderColor: '#88C559', borderWidth: 2, borderDash: [6, 4], pointRadius: 0, order: 1 } as any,
 ],
 },
 options: {
 maintainAspectRatio: false,
 plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (x: any) => `${x.dataset.label}: ${formatCurrency(x.raw)}` } } },
 scales: { y: { beginAtZero: true, ticks: { callback: (v: any) => 'R$ ' + (v >= 1e6 ? (v / 1e6).toFixed(0) + 'M' : (v / 1e3).toFixed(0) + 'K') } }, x: { grid: { display: false } } },
 },
 }),
 );
 }

 if (chOrigemRef.current && origem && origem.length > 0) {
 instances.current.push(
 new Chart(chOrigemRef.current, {
 type: 'doughnut',
 data: { labels: origem.map((x: any) => x.origem), datasets: [{ data: origem.map((x: any) => x.leads), backgroundColor: PALETTE, borderWidth: 2, borderColor: '#fff' }] },
 options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right' } } },
 }),
 );
 }

 if (chFunilRef.current && funil?.etapas) {
 const etapas = funil.etapas;
 instances.current.push(
 new Chart(chFunilRef.current, {
 type: 'bar',
 data: { labels: etapas.map((e: any) => e.etapa), datasets: [{ label: 'Leads', data: etapas.map((e: any) => e.count), backgroundColor: etapas.map((_: any, i: number) => PALETTE[i % PALETTE.length]), borderRadius: 6 }] },
 options: { indexAxis: 'y' as const, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { display: false } }, y: { grid: { display: false } } } },
 }),
 );
 }

 if (chRankRef.current && ranking && ranking.length > 0) {
 const top = ranking.slice(0, 8);
 instances.current.push(
 new Chart(chRankRef.current, {
 type: 'bar',
 data: { labels: top.map((c: any) => c.nome.split(' ')[0]), datasets: [{ label: 'VGV', data: top.map((c: any) => c.volume), backgroundColor: '#263654', borderRadius: 6, maxBarThickness: 38 }] },
 options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: (v: any) => 'R$ ' + (v >= 1e6 ? (v / 1e6).toFixed(0) + 'M' : (v / 1e3).toFixed(0) + 'K') } }, x: { grid: { display: false } } } },
 }),
 );
 }

 return () => {
 instances.current.forEach((c) => c.destroy());
 };
 }, [periodo, serie, origem, funil, ranking]);

 if (l1) return <Shell periodo={periodo} setPeriodo={setPeriodo}><LoadingBlock /></Shell>;
 if (e1) return <Shell periodo={periodo} setPeriodo={setPeriodo}><ErrorBlock error={e1} /></Shell>;

 const c = kpis?.comercial || {};
 const periodLabel = p.label;

 return (
 <>
 <Topbar
 title="Relatórios & Indicadores"
 right={
 <div className="period">
 {(['mes', 'mespassado', 'tri', 'ano'] as const).map((p) => (
 <button key={p} className={periodo === p ? 'is-active' : ''} onClick={() => setPeriodo(p)}>
 {p === 'mes' ? 'Este mês' : p === 'mespassado' ? 'Mês passado' : p === 'tri' ? 'Trimestre' : 'Ano'}
 </button>
 ))}
 </div>
 }
 />

 <div className="main__content">
 <PageHeader
 breadcrumb={`Inteligência · ${periodLabel}`}
 title="Painel de Performance "
 subtitle="Indicadores comerciais e financeiros com tendência, evolução e drill-down — comparados ao período anterior."
 />

 <div className="kpi-grid">
 <KpiCard label="VGV vendido" value={formatCurrencyShort(c.vgv?.valor)} delta={c.vgv?.variacao} tone="green" />
 <KpiCard label="Vendas" value={String(c.numVendas?.valor ?? 0)} delta={c.numVendas?.variacao} tone="blue" />
 <KpiCard label="Ticket médio" value={formatCurrencyShort(c.ticket?.valor)} delta={c.ticket?.variacao} tone="navy" />
 <KpiCard label="Taxa de conversão" value={`${((c.conversao?.valor || 0) * 100).toFixed(1)}%`} delta={c.conversao?.variacao} tone="amber" />
 <KpiCard label="Ciclo médio" value={<>{Math.round(c.ciclo?.valor || 0)}<small> dias</small></>} delta={c.ciclo?.variacao} tone="blue" />
 <KpiCard label="VSO (absorção)" value={`${((c.vso?.valor || 0) * 100).toFixed(1)}%`} tone="green" />
 <KpiCard label="Leads captados" value={String(c.leads?.valor ?? 0)} delta={c.leads?.variacao} tone="navy" />
 <KpiCard label="Taxa de distrato" value={`${((c.distrato?.valor || 0) * 100).toFixed(1)}%`} delta={c.distrato?.variacao} tone="red" />
 </div>

 <div className="sec-title">Evolução & conversão</div>
 <div className="grid-2-1" style={{ marginBottom: 24 }}>
 <div className="chart-card">
 <div className="chart-card__head">
 <span className="chart-card__title">Evolução de Vendas (VGV) × Meta</span>
 <span className="text-xs text-secondary">últimos 6 meses</span>
 </div>
 <div className="chart-box"><canvas ref={chVgvRef} /></div>
 </div>
 <div className="chart-card">
 <div className="chart-card__head"><span className="chart-card__title">Origem dos leads</span></div>
 <div className="chart-box"><canvas ref={chOrigemRef} /></div>
 </div>
 </div>

 <div className="grid-2" style={{ marginBottom: 24 }}>
 <div className="chart-card">
 <div className="chart-card__head"><span className="chart-card__title">Funil de conversão</span></div>
 <div className="chart-box chart-box--sm"><canvas ref={chFunilRef} /></div>
 </div>
 <div className="chart-card">
 <div className="chart-card__head"><span className="chart-card__title">Ranking de corretores (VGV)</span><span className="text-xs text-secondary">top 8</span></div>
 <div className="chart-box chart-box--sm"><canvas ref={chRankRef} /></div>
 </div>
 </div>

 <div className="sec-title">Estoque & velocidade de vendas (VSO)</div>
 <div className="card" style={{ padding: 0, marginBottom: 24 }}>
 <table className="table">
 <thead>
 <tr>
 <th>Empreendimento</th>
 <th>Construtora</th>
 <th className="numeric">Estoque</th>
 <th className="numeric">VSO</th>
 <th className="numeric">VGV vendido</th>
 </tr>
 </thead>
 <tbody>
 {(emps || []).map((e: any) => {
 const vso = e.vso ?? (e.unidadesTotal ? e.unidadesVendidas / e.unidadesTotal : 0);
 const estoque = e.estoque ?? (e.unidadesTotal - e.unidadesVendidas);
 const construtoraNome = typeof e.construtora === 'string' ? e.construtora : e.construtora?.nome || '—';
 return (
 <tr key={e.id}>
 <td>
 <div className="font-semibold">{e.nome}</div>
 <div className="text-xs text-secondary">{e.cidade}</div>
 </td>
 <td className="text-sm">{construtoraNome}</td>
 <td className="numeric">{estoque}<span className="text-xs text-secondary">/{e.unidadesTotal}</span></td>
 <td className="numeric">{Math.round(vso * 100)}%</td>
 <td className="numeric money font-semibold">{formatCurrencyShort(e.vgvVendido ?? (e.vgvTotal * vso))}</td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>

 <RankingMensalPanel />
 </>
 );
}

function Shell({ periodo, setPeriodo, children }: { periodo: string; setPeriodo: (p: any) => void; children: React.ReactNode }) {
 return (
 <>
 <Topbar
 title="Relatórios & Indicadores"
 right={
 <div className="period">
 {(['mes', 'mespassado', 'tri', 'ano'] as const).map((p) => (
 <button key={p} className={periodo === p ? 'is-active' : ''} onClick={() => setPeriodo(p)}>
 {p === 'mes' ? 'Este mês' : p === 'mespassado' ? 'Mês passado' : p === 'tri' ? 'Trimestre' : 'Ano'}
 </button>
 ))}
 </div>
 }
 />
 <div className="main__content">
 <PageHeader breadcrumb="Inteligência" title="Painel de Performance" />
 {children}
 </div>
 </>
 );
}

function KpiCard({ label, value, delta, tone }: { label: string; value: React.ReactNode; delta?: number; tone: string }) {
 return (
 <div className="kpi">
 <div className={`kpi__icon kpi__icon--${tone}`}>
 <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
 <circle cx="12" cy="12" r="10" />
 </svg>
 </div>
 <div className="kpi__label">{label}</div>
 <div className="kpi__value">{value}</div>
 {delta != null && isFinite(delta) && (
 <div className={'kpi__delta ' + (delta > 0 ? 'kpi__delta--up' : delta < 0 ? 'kpi__delta--down' : '')}>
 {delta > 0 ? '▲' : delta < 0 ? '▼' : '→'} {Math.abs(delta).toFixed(0)}% <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>vs ant.</span>
 </div>
 )}
 </div>
 );
}
