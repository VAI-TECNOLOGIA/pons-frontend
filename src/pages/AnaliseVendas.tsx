// Análise de Vendas — painel dedicado (CEO + Financeiro). NÃO é o dashboard
// inicial: seção própria com KPIs comparativos, gráfico de VGV por mês (com o
// período anterior sobreposto), quebras (status/empreendimento/construtora/
// corretor), financeiro (recebido/a receber/atrasado/repasse) e filtros.
import { useEffect, useRef, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brlFull = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—');
const PALETTE = ['#0E7C9B', '#88C559', '#F2B544', '#3FB6D4', '#C084FC', '#F87171', '#8493B4', '#34D399'];

// Presets de período — retorna de/ate ISO (ou vazio p/ padrão do backend = 6 meses)
function preset(p: string) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const iso = (d: Date) => d.toISOString();
  if (p === 'mes') return { de: iso(new Date(y, m, 1)), ate: iso(now) };
  if (p === 'tri') return { de: iso(new Date(y, m - 2, 1)), ate: iso(now) };
  if (p === '6m') return { de: iso(new Date(y, m - 5, 1)), ate: iso(now) };
  if (p === 'ano') return { de: iso(new Date(y, 0, 1)), ate: iso(now) };
  return { de: '', ate: '' };
}

const STATUS_BADGE: Record<string, string> = {
  PAGO: 'paid', ASSINADO: 'signed', ASSINADO_AGUARDANDO_PAGAMENTO: 'analysis',
  EM_ASSINATURA: 'signature', CONTRATO_EM_CONFERENCIA: 'signature',
  AGUARDANDO_CONSTRUTORA: 'analysis', ANALISE_JURIDICA: 'analysis', PRE_ANALISE: 'analysis', CONTRATO_EM_CONFECCAO: 'analysis',
};

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <>
      <Topbar title="Análise de Vendas" right={right} />
      <div className="main__content">
        <PageHeader breadcrumb="Comercial · Análise de Vendas" title="Análise de Vendas" subtitle="Desempenho, financeiro e comparativos — filtre por período, empreendimento, equipe e mais." />
        {children}
      </div>
    </>
  );
}

function Delta({ v }: { v: number }) {
  const up = v >= 0;
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: up ? 'var(--color-success, #16A34A)' : 'var(--color-danger, #DC2626)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {up ? '▲' : '▼'} {Math.abs(v).toLocaleString('pt-BR')}%
    </span>
  );
}

function Kpi({ label, valor, delta, spark, cor }: { label: string; valor: string; delta?: number; spark?: number[]; cor: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current || !spark?.length) return;
    const ch = new Chart(ref.current, {
      type: 'line',
      data: { labels: spark.map((_, i) => i), datasets: [{ data: spark, borderColor: cor, borderWidth: 2, pointRadius: 0, fill: true, backgroundColor: cor + '22', tension: 0.4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, elements: { line: { borderJoinStyle: 'round' } } },
    });
    return () => ch.destroy();
  }, [spark, cor]);
  return (
    <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="flex-between" style={{ alignItems: 'flex-start' }}>
        <div className="text-xs text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{label}</div>
        {delta !== undefined && <Delta v={delta} />}
      </div>
      <div style={{ fontSize: 'clamp(19px, 4.5vw, 26px)', fontWeight: 800, color: cor, whiteSpace: 'nowrap' }}>{valor}</div>
      {spark && spark.length > 1 && <div style={{ height: 34, marginTop: -4 }}><canvas ref={ref} /></div>}
    </div>
  );
}

function FinCard({ label, valor, cor, hint }: { label: string; valor: number; cor: string; hint?: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px', borderLeft: `4px solid ${cor}` }}>
      <div className="text-xs text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 'clamp(18px, 4vw, 22px)', fontWeight: 800, color: cor, whiteSpace: 'nowrap' }}>{brlFull(valor)}</div>
      {hint && <div className="text-xs text-secondary">{hint}</div>}
    </div>
  );
}

export default function AnaliseVendas() {
  const [periodo, setPeriodo] = useState('6m');
  const [customDe, setCustomDe] = useState('');
  const [customAte, setCustomAte] = useState('');
  const [empreendimentoId, setEmp] = useState('');
  const [construtora, setConstr] = useState('');
  const [equipeId, setEquipe] = useState('');
  const [status, setStatus] = useState('');
  const [aplicado, setAplicado] = useState(0);

  const janela = periodo === 'custom'
    ? { de: customDe ? new Date(customDe + 'T00:00:00').toISOString() : '', ate: customAte ? new Date(customAte + 'T23:59:59').toISOString() : '' }
    : preset(periodo);
  const filtros = { ...janela, empreendimentoId, construtora, equipeId, status };
  const { data, loading, error } = useApi<any>(() => Api.vendasAnalytics(filtros), [aplicado]);

  const chVgvRef = useRef<HTMLCanvasElement>(null);
  const chStatusRef = useRef<HTMLCanvasElement>(null);
  const insts = useRef<Chart[]>([]);

  useEffect(() => {
    insts.current.forEach((c) => c.destroy());
    insts.current = [];
    if (!data) return;
    Chart.defaults.font.family = 'Inter, sans-serif';

    if (chVgvRef.current && data.serie?.length) {
      insts.current.push(new Chart(chVgvRef.current, {
        data: {
          labels: data.serie.map((m: any) => m.label),
          datasets: [
            { type: 'bar', label: 'VGV', data: data.serie.map((m: any) => m.vgv), backgroundColor: '#0E7C9B', borderRadius: 6, maxBarThickness: 44, order: 2 },
            { type: 'line', label: 'Período anterior', data: data.serie.map((m: any) => m.vgvAnterior), borderColor: '#F2B544', borderWidth: 2, borderDash: [5, 4], pointRadius: 2, tension: 0.35, order: 1 } as any,
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } }, tooltip: { callbacks: { label: (x: any) => `${x.dataset.label}: ${brlFull(x.raw)}` } } },
          scales: { y: { beginAtZero: true, ticks: { callback: (v: any) => 'R$ ' + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : (v / 1e3).toFixed(0) + 'K') } }, x: { grid: { display: false } } },
        },
      }));
    }
    if (chStatusRef.current && data.porStatus?.length) {
      insts.current.push(new Chart(chStatusRef.current, {
        type: 'doughnut',
        data: { labels: data.porStatus.map((s: any) => s.label), datasets: [{ data: data.porStatus.map((s: any) => s.vgv), backgroundColor: PALETTE, borderWidth: 2, borderColor: 'var(--bg-card, #fff)' }] },
        options: { maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true, font: { size: 11 } } }, tooltip: { callbacks: { label: (x: any) => `${x.label}: ${brl(x.raw)}` } } } },
      }));
    }
    return () => { insts.current.forEach((c) => c.destroy()); insts.current = []; };
  }, [data]);

  const barraFiltros = (
    <div className="card" style={{ padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div className="field" style={{ margin: 0, minWidth: 150 }}>
        <label className="field__label">Período</label>
        <select className="field__select" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          <option value="mes">Este mês</option>
          <option value="tri">Último trimestre</option>
          <option value="6m">Últimos 6 meses</option>
          <option value="ano">Este ano</option>
          <option value="custom">Data personalizada</option>
        </select>
      </div>
      {periodo === 'custom' && (
        <>
          <div className="field" style={{ margin: 0, minWidth: 130 }}>
            <label className="field__label">De</label>
            <input type="date" className="field__input" value={customDe} max={customAte || undefined} onChange={(e) => setCustomDe(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0, minWidth: 130 }}>
            <label className="field__label">Até</label>
            <input type="date" className="field__input" value={customAte} min={customDe || undefined} onChange={(e) => setCustomAte(e.target.value)} />
          </div>
        </>
      )}
      <div className="field" style={{ margin: 0, minWidth: 160 }}>
        <label className="field__label">Empreendimento</label>
        <select className="field__select" value={empreendimentoId} onChange={(e) => setEmp(e.target.value)}>
          <option value="">Todos</option>
          {(data?.filtros?.empreendimentos || []).map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>
      <div className="field" style={{ margin: 0, minWidth: 150 }}>
        <label className="field__label">Construtora</label>
        <select className="field__select" value={construtora} onChange={(e) => setConstr(e.target.value)}>
          <option value="">Todas</option>
          {(data?.filtros?.construtoras || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="field" style={{ margin: 0, minWidth: 150 }}>
        <label className="field__label">Equipe</label>
        <select className="field__select" value={equipeId} onChange={(e) => setEquipe(e.target.value)}>
          <option value="">Todas</option>
          {(data?.filtros?.equipes || []).map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>
      <div className="field" style={{ margin: 0, minWidth: 150 }}>
        <label className="field__label">Status</label>
        <select className="field__select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          {(data?.filtros?.status || []).map((s: any) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <button className="btn btn--primary" onClick={() => setAplicado((n) => n + 1)}>Aplicar filtros</button>
      {(empreendimentoId || construtora || equipeId || status) && (
        <button className="btn btn--secondary" onClick={() => { setEmp(''); setConstr(''); setEquipe(''); setStatus(''); setAplicado((n) => n + 1); }}>Limpar</button>
      )}
    </div>
  );

  if (loading && !data) return <Shell>{barraFiltros}<LoadingBlock /></Shell>;
  if (error && !data) return <Shell>{barraFiltros}<ErrorBlock error={error} label="Erro ao carregar a análise" /></Shell>;
  if (!data) return null;

  const r = data.resumo;
  const sVgv = data.serie.map((m: any) => m.vgv);
  const sVendas = data.serie.map((m: any) => m.vendas);
  const sCom = data.serie.map((m: any) => m.comissao);
  const totalVgvQuebra = (data.porStatus || []).reduce((s: number, x: any) => s + x.vgv, 0) || 1;

  return (
    <Shell>
      {barraFiltros}

      {/* KPIs comparativos com sparkline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Kpi label="VGV no período" valor={brl(r.vgv.atual)} delta={r.vgv.variacao} spark={sVgv} cor="#0E7C9B" />
        <Kpi label="Vendas" valor={String(r.vendas.atual)} delta={r.vendas.variacao} spark={sVendas} cor="#88C559" />
        <Kpi label="Comissão bruta" valor={brl(r.comissao.atual)} delta={r.comissao.variacao} spark={sCom} cor="#C084FC" />
        <Kpi label="Ticket médio" valor={brl(r.ticketMedio.atual)} delta={r.ticketMedio.variacao} cor="#F2B544" />
      </div>

      {/* Financeiro */}
      <div className="uppercase-tag" style={{ margin: '6px 0 8px' }}>Financeiro do período</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>
        <FinCard label="Recebido" valor={data.financeiro.recebido} cor="var(--color-success, #16A34A)" hint="Comissão paga" />
        <FinCard label="A receber" valor={data.financeiro.aReceber} cor="var(--pons-blue, #0E7C9B)" hint="Parcelas futuras" />
        <FinCard label="Atrasado" valor={data.financeiro.atrasado} cor="#DC2626" hint="Vencido não pago" />
        <FinCard label="Repasse corretores" valor={data.financeiro.comissaoCorretor} cor="#8493B4" hint="Comissão dos corretores" />
      </div>

      {/* Gráfico principal: VGV por mês x período anterior */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 className="card__title" style={{ margin: '0 0 8px' }}>Evolução de VGV</h3>
        <div style={{ position: 'relative', height: 300 }}><canvas ref={chVgvRef} /></div>
      </div>

      {/* Quebras: status (rosca) + top empreendimentos. Sem align-items:start
          aqui: o card do gráfico estica junto com a lista ao lado, e a rosca
          fica centrada na altura do card vizinho (margin auto), sem espaço
          vazio embaixo e sem ficar gigante. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column' }}>
          <h3 className="card__title" style={{ marginTop: 0 }}>VGV por status</h3>
          <div style={{ position: 'relative', height: 280, margin: 'auto 0' }}><canvas ref={chStatusRef} /></div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <h3 className="card__title" style={{ marginTop: 0 }}>Top empreendimentos</h3>
          <div className="list">
            {(data.topEmpreendimentos || []).map((e: any, i: number) => {
              const pct = Math.round((e.vgv / totalVgvQuebra) * 100);
              return (
                <div className="list__item" key={i}>
                  <div className="list__main">
                    <div className="flex-between"><span className="list__title">{e.label}</span><strong style={{ fontSize: 13 }}>{brl(e.vgv)}</strong></div>
                    <div className="list__meta">{e.vendas} venda{e.vendas > 1 ? 's' : ''} · {pct}%</div>
                    <div className="progress" style={{ marginTop: 5 }}><div className="progress__fill" style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top corretores (ranking) + Top construtoras */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: 16 }}>
          <h3 className="card__title" style={{ marginTop: 0 }}>Top corretores</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(data.topCorretores || []).slice(0, 8).map((c: any, i: number) => {
              const maxVgv = data.topCorretores[0]?.vgv || 1;
              const pct = Math.round((c.vgv / maxVgv) * 100);
              const medalha = ['#F2B544', '#B8C2CC', '#CD7F52'][i];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 10, background: i < 3 ? 'var(--bg-card-hover)' : 'transparent' }}>
                  <div style={{ width: 22, textAlign: 'center', fontWeight: 800, fontSize: 13, color: medalha || 'var(--text-secondary)' }}>{i + 1}º</div>
                  <div className="avatar avatar--sm" style={{ background: medalha ? medalha + '22' : 'var(--blue-100, #e0f2fe)', color: medalha || 'var(--pons-blue)', fontWeight: 700, flexShrink: 0 }}>{c.initials || (c.label || '').slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex-between" style={{ gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                      <strong style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{brl(c.vgv)}</strong>
                    </div>
                    <div className="text-xs text-secondary" style={{ marginBottom: 3 }}>{c.equipe || '—'} · {c.vendas} venda{c.vendas > 1 ? 's' : ''}</div>
                    <div className="progress"><div className="progress__fill" style={{ width: `${pct}%`, background: medalha || 'var(--pons-blue)' }} /></div>
                  </div>
                </div>
              );
            })}
            {(data.topCorretores || []).length === 0 && <div className="text-xs text-secondary" style={{ padding: 12 }}>Sem vendas no período.</div>}
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <h3 className="card__title" style={{ marginTop: 0 }}>Por construtora</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table tabela-compacta">
              <thead><tr><th>Construtora</th><th className="numeric">Vendas</th><th className="numeric">VGV</th><th className="numeric">Comissão</th></tr></thead>
              <tbody>
                {(data.topConstrutoras || []).map((c: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{c.label}</td>
                    <td className="numeric">{c.vendas}</td>
                    <td className="numeric money">{brl(c.vgv)}</td>
                    <td className="numeric">{brl(c.comissao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Vendas recentes */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 700 }}>Vendas recentes no período</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table tabela-compacta" style={{ minWidth: 640 }}>
            <thead><tr><th>Data</th><th>Código</th><th>Cliente</th><th>Empreendimento</th><th>Corretor</th><th className="numeric">VGV</th><th>Status</th></tr></thead>
            <tbody>
              {(data.recentes || []).map((v: any) => (
                <tr key={v.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dataBr(v.data)}</td>
                  <td className="font-semibold" style={{ whiteSpace: 'nowrap' }}>#{v.codigo}</td>
                  <td>{v.cliente}</td>
                  <td>{v.empreendimento}{v.unidade ? ` · ${v.unidade}` : ''}</td>
                  <td>{(v.corretor || '').split(' ')[0]}</td>
                  <td className="numeric money">{brl(v.vgv)}</td>
                  <td><span className={`badge badge--${STATUS_BADGE[v.status] || 'neutral'}`}>{v.status?.replace(/_/g, ' ').toLowerCase()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
