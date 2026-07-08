import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Auth } from '../lib/auth';
import { formatCurrency, formatCurrencyShort, timeAgo } from '../lib/format';
import { Icon } from '../components/Icon';
import { Topbar, getGreeting } from '../components/PageHeader';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { DashboardKpisExtra } from '../components/DashboardKpisExtra';
import { OnboardingProgress } from '../components/OnboardingProgress';
import { PageSkeleton } from '../components/Skeleton';
import { PageWrap } from '../components/PageWrap';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const STATUS_MAP: Record<string, [string, string]> = {
 PRE_ANALISE: ['analysis', 'EM ANÁLISE'],
 ANALISE_JURIDICA: ['analysis', 'ANÁLISE JURÍDICA'],
 EM_ASSINATURA: ['signature', 'EM ASSINATURA'],
 ASSINADO: ['signed', 'ASSINADO'],
 CANCELADO: ['cancelled', 'CANCELADO'],
};

// CSS vars semânticas — respeitam tema claro/escuro automaticamente
const ALERT_COLOR: Record<string, [string, string, string]> = {
 danger:  ['var(--color-danger-bg)',  'var(--color-danger-fg)',  'var(--color-danger-border)'],
 warning: ['var(--color-warning-bg)', 'var(--color-warning-fg)', 'var(--color-warning-border)'],
 info:    ['var(--color-info-bg)',    'var(--color-info-fg)',    'var(--color-info-border)'],
 success: ['var(--color-success-bg)', 'var(--color-success-fg)', 'var(--color-success-border)'],
};

export default function Dashboard() {
 const user = Auth.user!;
 const isExec = ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO'].includes(user.role);
 const isCorretor = user.role === 'CORRETOR';

 const { data, loading, error } = useApi<any>(() => Api.dashboard());
 const { data: serie } = useApi<any>(() => (isExec ? Api.relSeries(6) : Promise.resolve(null)), [isExec]);

 const chartRef = useRef<HTMLCanvasElement>(null);
 const chartInstance = useRef<Chart | null>(null);

 useEffect(() => {
 if (!isExec || !chartRef.current || !serie?.meses) return;
 if (chartInstance.current) chartInstance.current.destroy();
 Chart.defaults.font.family = 'Inter, sans-serif';
 const config: any = {
 type: 'bar',
 data: {
 labels: serie.meses.map((m: any) => m.label),
 datasets: [
 {
 type: 'bar',
 label: 'VGV vendido',
 data: serie.meses.map((m: any) => m.vgv),
 backgroundColor: '#0E7C9B',
 borderRadius: 6,
 maxBarThickness: 48,
 order: 2,
 },
 {
 type: 'line',
 label: 'Meta da casa',
 data: serie.meses.map(() => serie.metaCasa),
 borderColor: '#88C559',
 borderWidth: 2,
 borderDash: [6, 4],
 pointRadius: 0,
 order: 1,
 } as any,
 ],
 },
 options: {
 maintainAspectRatio: false,
 plugins: {
 legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 12 } },
 tooltip: { callbacks: { label: (x: any) => `${x.dataset.label}: ${formatCurrency(x.raw)}` } },
 },
 scales: {
 y: {
 beginAtZero: true,
 ticks: {
 callback: (v: any) =>
 'R$ ' + (v >= 1e6 ? (v / 1e6).toFixed(0) + 'M' : (v / 1e3).toFixed(0) + 'K'),
 },
 },
 x: { grid: { display: false } },
 },
 },
 };
 chartInstance.current = new Chart(chartRef.current, config);
 return () => {
 chartInstance.current?.destroy();
 };
 }, [isExec, serie]);

 if (loading) return <DashboardShell user={user}><PageSkeleton /></DashboardShell>;
 if (error) return <DashboardShell user={user}><ErrorBlock error={error} label="Erro ao carregar dashboard" /></DashboardShell>;
 if (!data) return null;

 const a = data.avanco;
 const ritmoCor = a?.noRitmo ? '#88C559' : '#F2B544';
 // Só mostra "avanço da meta" quando há meta cadastrada (evita meta-fantasma com a casa zerada)
 const temMeta = a?.temMeta ?? ((a?.metaCasa ?? 0) > 0);

 return (
 <>
 <Topbar title="Dashboard" />

 <div className="main__content">
 <div className="page-header">
 <div>
 <div className="page-header__breadcrumb">Visão geral</div>
 <h2 className="page-header__title">{getGreeting()}, {user.name.split(' ')[0]}.</h2> </div>
 </div>

 {/* Avanço */}
 {a && (
 <div
 className="card mb-6"
 style={{
 background: 'linear-gradient(135deg,#15171C,#0B0C10)',
 color: 'white',
 border: 'none',
 overflow: 'hidden',
 position: 'relative',
 }}
 >
 <div className="speed-line" style={{ position: 'absolute' }} />
 <div style={{ display: 'grid', gridTemplateColumns: temMeta ? 'repeat(auto-fit, minmax(220px, 1fr))' : '1fr', gap: 32 }}>
 {temMeta && (
 <div>
 <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
 Avanço da meta · mês
 </div>
 <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0' }}>
 <span style={{ fontSize: 34, fontWeight: 900, fontStyle: 'italic', color: ritmoCor }}>{a.progressoMeta}%</span>
 <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
 {formatCurrencyShort(a.realizadoMes)} de {formatCurrencyShort(a.metaCasa)}
 </span>
 <span
 className={'badge ' + (a.noRitmo ? 'badge--signed' : 'badge--analysis')}
 style={{ marginLeft: 'auto' }}
 >
 {a.noRitmo ? 'no ritmo' : 'abaixo do ritmo'}
 </span>
 </div>
 <div className="progress progress--speed" style={{ height: 10, background: 'rgba(255,255,255,0.1)' }}>
 <div
 className="progress__fill"
 style={{ width: `${a.progressoMeta}%`, background: `linear-gradient(90deg,${ritmoCor},#3FB6D4)` }}
 />
 </div>
 </div>
 )}
 <div>
 <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
 Avanço do mês · tempo
 </div>
 <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0' }}>
 <span style={{ fontSize: 34, fontWeight: 900, fontStyle: 'italic' }}>{a.progressoTemporal}%</span>
 <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
 dia {a.diaAtual} de {a.diasNoMes}
 </span>
 </div>
 <div className="progress" style={{ height: 10, background: 'rgba(255,255,255,0.1)' }}>
 <div
 className="progress__fill"
 style={{ width: `${a.progressoTemporal}%`, background: 'rgba(255,255,255,0.4)' }}
 />
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Alertas (não-corretor) */}
 {!isCorretor && (data.alertas?.length ?? 0) > 0 && (
 <div className="mb-6">
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
 {(data.alertas || []).map((al: any, i: number) => {
 const [bg, fg, br] = ALERT_COLOR[al.tipo] || ALERT_COLOR.info;
 // Fallback: deriva href pelo label se backend antigo ainda não tiver `href`
 const href: string | null = al.href || ({
 'Ver contratos':   '/vendas?status=PRE_ANALISE',
 'Ver atendimento': '/chat',
 'Ver roleta':      '/distribuicao',
 'Cobrar cliente':  '/vendas?status=EM_ASSINATURA',
 } as Record<string, string>)[al.acao] || null;
 const baseStyle: React.CSSProperties = {
 background: bg, borderLeft: `4px solid ${br}`, borderRadius: 8,
 padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
 textDecoration: 'none',
 };
 const inner = (
 <>
 <div style={{ flex: 1 }}>
 <div style={{ fontSize: 13, fontWeight: 700, color: fg }}>{al.titulo}</div>
 </div>
 {al.acao && (
 <span style={{ fontSize: 12, fontWeight: 600, color: br, whiteSpace: 'nowrap' }}>{al.acao} →</span>
 )}
 </>
 );
 return href ? (
 <Link key={i} to={href} style={{ ...baseStyle, cursor: 'pointer', transition: 'transform 0.12s ease, box-shadow 0.12s ease' }}
 onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
 onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
 >
 {inner}
 </Link>
 ) : (
 <div key={i} style={baseStyle}>{inner}</div>
 );
 })}
 </div>
 </div>
 )}

 {/* Resumo financeiro (não-corretor) */}
 {!isCorretor && data.financeiro && (
 <div className="mb-6">
 <div className="card" style={{ background: 'linear-gradient(135deg,#0F2A1A,#14331F)', color: 'white', border: 'none' }}>
 <div className="flex-between" style={{ marginBottom: 12 }}>
 <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
 Resumo Financeiro · Empresa
 </div>
 <Link to="/financeiro" style={{ fontSize: 12, fontWeight: 600, color: '#88C559', textDecoration: 'none' }}>
 Ver financeiro completo →
 </Link>
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20 }}>
 <div>
 <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)' }}>Saldo realizado</div>
 <div style={{ fontSize: 26, fontWeight: 900, fontStyle: 'italic', color: data.financeiro.saldo >= 0 ? '#88C559' : '#FF6B6B' }}>
 {formatCurrencyShort(data.financeiro.saldo)}
 </div>
 </div>
 <div>
 <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)' }}>Entradas pagas</div>
 <div style={{ fontSize: 26, fontWeight: 900, fontStyle: 'italic' }}>{formatCurrencyShort(data.financeiro.entradas)}</div>
 </div>
 <div>
 <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)' }}>A pagar</div>
 <div style={{ fontSize: 26, fontWeight: 900, fontStyle: 'italic', color: '#FFCE70' }}>
 {formatCurrencyShort(data.financeiro.aPagar)}
 </div>
 </div>
 <div>
 <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)' }}>Aguardando aprovação</div>
 <div style={{ fontSize: 26, fontWeight: 900, fontStyle: 'italic' }}>{data.financeiro.aguardandoAprovacao}</div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* KPIs */}
 {data.kpis && (
 <div className="kpi-grid">
 <KpiCard label="Vendas no mês" value={formatCurrencyShort(data.kpis.vendasMes?.valor)} sub={`${data.kpis.vendasMes?.quantidade ?? 0} contratos`} color="blue" iconName="dollar" />
 <KpiCard label="Pipeline ativo" value={String(data.kpis.pipelineAtivo ?? 0)} sub={`${data.kpis.leadsNovosHoje ?? 0} novos hoje`} color="green" iconName="users" />
 <KpiCard label="A pagar (próx. 7d)" value={formatCurrencyShort(data.kpis.aPagar?.valor)} sub={`${data.kpis.aPagar?.operacoes ?? 0} operações`} color="amber" iconName="clock" />
 <KpiCard label="Em assinatura" value={String(data.kpis.contratosEmAssinatura ?? 0)} sub="aguardando cliente" color="navy" iconName="doc" />
 </div>
 )}

 <OnboardingProgress />
 <DashboardKpisExtra />

 {/* Evolução */}
 {isExec && (
 <div className="mb-6">
 <div className="card chart-card">
 <div className="card__header">
 <h3 className="card__title">Evolução de Vendas × Meta · 6 meses</h3>
 <Link to="/relatorios" style={{ fontSize: 12, fontWeight: 600, color: 'var(--pons-blue)', textDecoration: 'none' }}>
 Ver relatórios completos →
 </Link>
 </div>
 <div style={{ position: 'relative', height: 260 }}>
 <canvas ref={chartRef} />
 </div>
 </div>
 </div>
 )}

 {/* Top Corretores + Empreendimentos */}
 <div className="grid-2-1 mb-6">
 <div className="card chart-card">
 <div className="card__header">
 <h3 className="card__title">Top Corretores — Mês</h3>
 <span className="uppercase-tag">Ranking</span>
 </div>
 <div className="list">
 {(data.ranking || []).map((c: any, i: number) => (
 <div className="list__item" key={i}>
 <div
 className="avatar avatar--lg"
 style={{
 background: i === 0 ? 'var(--src-instagram-bg)' : 'var(--blue-100)',
 color: i === 0 ? 'var(--src-instagram-fg)' : 'var(--blue-700)',
 }}
 >
 {c.initials}
 </div>
 <div className="list__main">
 <div className="list__title">{c.nome}</div>
 <div className="list__meta">
 {c.equipe} · {c.vendas} vendas · {formatCurrencyShort(c.volume)}
 </div>
 </div>
 <span className={'badge ' + (i === 0 ? 'badge--launch' : 'badge--neutral')}>{i + 1}º</span>
 </div>
 ))}
 </div>
 </div>
 <div className="card chart-card">
 <div className="card__header">
 <h3 className="card__title">Empreendimentos Ativos</h3>
 </div>
 <div className="list">
 {(data.empreendimentos || []).map((e: any, i: number) => {
 const pct = e.unidadesTotal > 0 ? Math.round((e.unidadesVendidas / e.unidadesTotal) * 100) : 0;
 return (
 <div className="list__item" key={i}>
 <div className="list__main">
 <div className="list__title">{e.nome}</div>
 <div className="list__meta">
 {e.cidade}/{e.estado} · {typeof e.construtora === 'string' ? e.construtora : e.construtora?.nome} · {e.unidadesVendidas}/{e.unidadesTotal} unidades
 </div>
 <div className="progress" style={{ marginTop: 6 }}>
 <div className="progress__fill" style={{ width: `${pct}%` }} />
 </div>
 </div>
 <span className="badge badge--launch">{pct}%</span>
 </div>
 );
 })}
 </div>
 </div>
 </div>

 {/* Atividade Recente */}
 <div className="card chart-card">
 <div className="card__header">
 <h3 className="card__title">Atividade Recente</h3>
 </div>
 <div className="list">
 {(data.atividade || []).map((v: any, i: number) => {
 const [klass, label] = STATUS_MAP[v.status] || ['neutral', v.status];
 return (
 <div className="list__item" key={i}>
 <div className="avatar" style={{ background: 'var(--blue-50)', color: 'var(--pons-blue)' }}>
 <Icon name="doc" className="icon icon-sm" />
 </div>
 <div className="list__main">
 <div className="list__title">{v.titulo}</div>
 <div className="list__meta">
 {v.corretor} · {timeAgo(v.updatedAt)} · {formatCurrencyShort(v.valor)}
 </div>
 </div>
 <span className={`badge badge--${klass}`}>{label}</span>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 </>
 );
}

function DashboardShell({ user, children }: { user: { name: string; role: string }; children: React.ReactNode }) {
 return (
 <>
 <Topbar title="Dashboard" />
 <div className="main__content">
 <div className="page-header">
 <div>
 <div className="page-header__breadcrumb">Visão geral</div>
 <h2 className="page-header__title">{getGreeting()}, {user.name.split(' ')[0]}.</h2> </div>
 </div>
 {children}
 </div>
 </>
 );
}

function KpiCard({
 label,
 value,
 sub,
 color,
 iconName,
}: {
 label: string;
 value: string;
 sub?: string;
 color: 'blue' | 'green' | 'amber' | 'navy';
 iconName: string;
}) {
 const ICON_SVG: Record<string, string> = {
 dollar:
 '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
 users:
 '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
 clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
 doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
 };
 return (
 <div className="kpi">
 <div className={`kpi__icon kpi__icon--${color}`}>
 <svg
 className="icon"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth={2}
 dangerouslySetInnerHTML={{ __html: ICON_SVG[iconName] || '' }}
 />
 </div>
 <div className="kpi__label">{label}</div>
 <div className="kpi__value">{value}</div>
 {sub && (
 <div className="kpi__delta">
 <span className="text-secondary">{sub}</span>
 </div>
 )}
 </div>
 );
}
