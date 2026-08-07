// "Minhas Comissões" — extrato consolidado do corretor: quanto já recebeu,
// quanto tem a receber, o que entra este mês e nos próximos, gráfico de
// evolução e a lista de TODAS as parcelas de comissão dele, com filtros.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
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

function Card({ label, valor, cor, icon, onClick }: { label: string; valor: number; cor: string; icon: string; onClick?: () => void }) {
  return (
    <div className="card" style={{ padding: '16px 18px', borderLeft: `4px solid ${cor}`, display: 'flex', flexDirection: 'column', gap: 4, cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
      <div className="flex-between" style={{ alignItems: 'flex-start' }}>
        <div className="text-xs text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{label}</div>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 9, background: cor + '1A', color: cor, flexShrink: 0 }}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <div style={{ fontSize: 'clamp(18px, 5.2vw, 24px)', fontWeight: 800, color: cor, whiteSpace: 'nowrap' }}>{brl(valor)}</div>
      {onClick && <div className="text-xs" style={{ color: cor, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>Ver detalhes <Icon name="chevron-right" size={13} /></div>}
    </div>
  );
}

// meta de cada card pro modal de detalhe
const CARD_META: Record<string, { label: string; cor: string; def: string }> = {
  recebido: { label: 'Já recebido', cor: '#16A34A', def: 'Parcelas de comissão que já caíram na sua conta (status pago).' },
  aReceber: { label: 'A receber', cor: '#0E7C9B', def: 'Parcelas de comissão ainda não pagas — o que ainda vai entrar.' },
  esteMs: { label: 'Entra este mês', cor: '#B45309', def: 'Parcelas a receber com vencimento dentro do mês atual.' },
  proximos: { label: 'Próximos meses', cor: '#64748B', def: 'Parcelas a receber com vencimento a partir do mês que vem.' },
};

export default function MinhasComissoes() {
  const { data, loading, error } = useApi<any>(() => Api.minhasComissoes(), []);
  const [periodo, setPeriodo] = useState('tudo');
  const [empFiltro, setEmpFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [cardSel, setCardSel] = useState<string | null>(null);
  const nav = useNavigate();
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInst = useRef<Chart | null>(null);
  const vendasRef = useRef<HTMLCanvasElement>(null);
  const vendasInst = useRef<Chart | null>(null);

  const todas: any[] = data?.parcelas || [];
  const vendas: any[] = data?.vendas || [];
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

  // séries mensais contínuas (preenche meses vazios entre o 1º e o último) —
  // evita o gráfico com 2 barrões colados. Comissões e vendas usam a mesma grade.
  const serie = useMemo(() => {
    const datas: Date[] = [];
    for (const p of parcelas) datas.push(new Date(p.vencimento));
    for (const v of vendas) if (v.data) datas.push(new Date(v.data));
    if (datas.length === 0) return [] as any[];
    const min = new Date(Math.min(...datas.map((d) => d.getTime())));
    const max = new Date(Math.max(...datas.map((d) => d.getTime())));
    const meses: { key: string; label: string; recebido: number; aReceber: number; atrasado: number; vgv: number; vendas: number }[] = [];
    const idx = new Map<string, number>();
    const cur = new Date(min.getFullYear(), min.getMonth(), 1);
    const fim = new Date(max.getFullYear(), max.getMonth(), 1);
    // limita a 18 meses pra não estourar
    let guard = 0;
    while (cur <= fim && guard < 18) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      idx.set(key, meses.length);
      meses.push({ key, label: `${MESES[cur.getMonth()]}/${String(cur.getFullYear()).slice(2)}`, recebido: 0, aReceber: 0, atrasado: 0, vgv: 0, vendas: 0 });
      cur.setMonth(cur.getMonth() + 1); guard++;
    }
    const put = (d: Date, fn: (b: typeof meses[0]) => void) => {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const i = idx.get(key); if (i !== undefined) fn(meses[i]);
    };
    for (const p of parcelas) {
      const ef = statusEfetivo(p); const v = p.valorCorretor || 0;
      put(new Date(p.vencimento), (b) => { if (ef === 'PAGO') b.recebido += v; else if (ef === 'ATRASADO') b.atrasado += v; else b.aReceber += v; });
    }
    for (const v of vendas) if (v.data) put(new Date(v.data), (b) => { b.vgv += v.valorVenda || 0; b.vendas += 1; });
    return meses;
  }, [parcelas, vendas]);

  useEffect(() => {
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    if (!chartRef.current || serie.length === 0) return;
    Chart.defaults.font.family = 'Inter, sans-serif';
    chartInst.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels: serie.map((m) => m.label),
        datasets: [
          { label: 'Recebido', data: serie.map((m) => m.recebido), backgroundColor: '#16A34A', borderRadius: 4, stack: 's', maxBarThickness: 38 },
          { label: 'A receber', data: serie.map((m) => m.aReceber), backgroundColor: '#0E7C9B', borderRadius: 4, stack: 's', maxBarThickness: 38 },
          { label: 'Atrasado', data: serie.map((m) => m.atrasado), backgroundColor: '#DC2626', borderRadius: 4, stack: 's', maxBarThickness: 38 },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, font: { size: 11 } } },
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

  // gráfico de vendas (VGV por mês) — mesma grade de meses
  useEffect(() => {
    if (vendasInst.current) { vendasInst.current.destroy(); vendasInst.current = null; }
    if (!vendasRef.current || serie.length === 0) return;
    Chart.defaults.font.family = 'Inter, sans-serif';
    vendasInst.current = new Chart(vendasRef.current, {
      type: 'bar',
      data: {
        labels: serie.map((m) => m.label),
        datasets: [{ label: 'VGV vendido', data: serie.map((m) => m.vgv), backgroundColor: '#7C3AED', borderRadius: 4, maxBarThickness: 38 }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (x: any) => `${brl(x.raw)} · ${serie[x.dataIndex].vendas} venda(s)` } },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { callback: (v: any) => brlShort(v) } },
        },
      },
    });
    return () => { vendasInst.current?.destroy(); vendasInst.current = null; };
  }, [serie]);

  if (loading && !data) return <Shell><LoadingBlock /></Shell>;
  if (error && !data) return <Shell><ErrorBlock error={error} label="Erro ao carregar comissões" /></Shell>;

  const temFiltro = periodo !== 'tudo' || empFiltro || statusFiltro;

  // parcelas que compõem cada card (pro modal de detalhe)
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
  const bucketParcelas = (key: string) => parcelas.filter((p) => {
    const ef = statusEfetivo(p);
    const venc = new Date(p.vencimento);
    if (key === 'recebido') return ef === 'PAGO';
    if (key === 'aReceber') return ef !== 'PAGO';
    if (key === 'esteMs') return ef !== 'PAGO' && venc >= inicioMes && venc <= fimMes;
    if (key === 'proximos') return ef !== 'PAGO' && venc > fimMes;
    return false;
  }).sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime());

  return (
    <Shell>
      {todas.length === 0 && vendas.length === 0 ? (
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
            <Card label="Já recebido" valor={resumo.recebido} cor="#16A34A" icon="check" onClick={() => setCardSel('recebido')} />
            <Card label="A receber" valor={resumo.aReceber} cor="#0E7C9B" icon="clock" onClick={() => setCardSel('aReceber')} />
            <Card label="Entra este mês" valor={resumo.esteMs} cor="#B45309" icon="calendar" onClick={() => setCardSel('esteMs')} />
            <Card label="Próximos meses" valor={resumo.proximos} cor="#64748B" icon="wallet" onClick={() => setCardSel('proximos')} />
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

          {/* Gráficos: comissões + vendas, lado a lado */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div className="card" style={{ padding: 16 }}>
              <h3 className="card__title" style={{ margin: '0 0 4px' }}>Evolução das comissões</h3>
              <div className="text-xs text-secondary" style={{ marginBottom: 8 }}>Por mês de vencimento — recebido, a receber e atrasado</div>
              {serie.length === 0 ? (
                <div className="text-sm text-secondary" style={{ padding: 16 }}>Sem parcelas no filtro selecionado.</div>
              ) : (
                <div style={{ position: 'relative', height: 260 }}><canvas ref={chartRef} /></div>
              )}
            </div>
            <div className="card" style={{ padding: 16 }}>
              <h3 className="card__title" style={{ margin: '0 0 4px' }}>Minhas vendas (VGV)</h3>
              <div className="text-xs text-secondary" style={{ marginBottom: 8 }}>Volume geral de vendas por mês de fechamento</div>
              {serie.length === 0 || vendas.length === 0 ? (
                <div className="text-sm text-secondary" style={{ padding: 16 }}>Sem vendas no filtro selecionado.</div>
              ) : (
                <div style={{ position: 'relative', height: 260 }}><canvas ref={vendasRef} /></div>
              )}
            </div>
          </div>

          {resumo.atrasado > 0 && (
            <div className="card" style={{ padding: '10px 16px', marginBottom: 12, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', color: '#B91C1C', fontSize: 13, fontWeight: 600 }}>
              {brl(resumo.atrasado)} em parcelas vencidas ainda não recebidas — fale com o financeiro se tiver dúvida.
            </div>
          )}

          {/* Comissões de GESTÃO — fatia de gestor/líder em vendas de outros corretores */}
          {(data?.gestao?.itens?.length || 0) > 0 && (
            <div className="card" style={{ padding: 0, marginBottom: 12 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Comissões de gestão <span className="text-xs text-secondary" style={{ fontWeight: 400 }}>· sua fatia como gestor nas vendas da equipe</span></span>
                <span className="text-xs">
                  Total <strong>{brl(data.gestao.total)}</strong> · Recebido <strong>{brl(data.gestao.pago)}</strong> · A receber <strong style={{ color: 'var(--blue-500)' }}>{brl(data.gestao.aReceber)}</strong>
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table tabela-compacta" style={{ minWidth: 620 }}>
                  <thead>
                    <tr><th>Venda</th><th>Cliente</th><th>Empreendimento</th><th>Corretor</th><th className="numeric">Sua fatia</th><th className="numeric">Recebido</th></tr>
                  </thead>
                  <tbody>
                    {data.gestao.itens.map((g: any) => (
                      <tr key={`${g.vendaId}-${g.papel}`}>
                        <td className="font-semibold">#{g.codigo}</td>
                        <td>{g.cliente}</td>
                        <td className="text-xs">{g.empreendimento} · {g.unidade}</td>
                        <td className="text-xs">{g.corretor}</td>
                        <td className="numeric money">{brl(g.valorTotal)}</td>
                        <td className="numeric text-xs">{brl(g.valorPago)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

          {/* Drilldown do card financeiro: parcelas que compõem + link pra Vendas */}
          {cardSel && (() => {
            const meta = CARD_META[cardSel];
            const itens = bucketParcelas(cardSel);
            const total = itens.reduce((s, p) => s + (p.valorCorretor || 0), 0);
            return (
              <Modal
                open={!!cardSel}
                onClose={() => setCardSel(null)}
                title={meta.label}
                subtitle={meta.def}
                size="lg"
                footer={
                  <>
                    <button className="btn btn--secondary" onClick={() => setCardSel(null)}>Fechar</button>
                    <button className="btn btn--primary" onClick={() => nav('/vendas')}>
                      <Icon name="chevron-right" size={14} /> Abrir na aba Vendas
                    </button>
                  </>
                }
              >
                <div className="flex-between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div className="text-xs text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>Total</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: meta.cor }}>{brl(total)}</div>
                  </div>
                  <div className="text-sm text-secondary">{itens.length} parcela{itens.length === 1 ? '' : 's'}</div>
                </div>
                {itens.length === 0 ? (
                  <div className="text-sm text-secondary" style={{ padding: 12 }}>Nenhuma parcela nesta categoria.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table tabela-compacta" style={{ minWidth: 520 }}>
                      <thead><tr><th>Vencimento</th><th>Venda</th><th>Empreendimento</th><th>Parcela</th><th className="numeric">Comissão</th></tr></thead>
                      <tbody>
                        {itens.map((p) => (
                          <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/vendas?venda=${p.vendaId}`)} title="Abrir esta venda">
                            <td style={{ whiteSpace: 'nowrap' }}>{dataBr(p.vencimento)}</td>
                            <td><div style={{ fontWeight: 600 }}>{p.cliente}</div><div className="text-xs text-secondary">#{p.codigo}</div></td>
                            <td>{p.empreendimento}{p.unidade ? ` · ${p.unidade}` : ''}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{p.numero}/{p.total}</td>
                            <td className="numeric money" style={{ fontWeight: 700 }}>{brl(p.valorCorretor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Modal>
            );
          })()}
        </>
      )}
    </Shell>
  );
}
