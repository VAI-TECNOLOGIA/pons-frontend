// Análise de Vendas — relatório dedicado (CEO + Financeiro). NÃO é o dashboard
// inicial: seção própria com KPIs comparativos (período anterior e ano
// anterior), gráfico de VGV por mês, vendas por SALA, tabela mês a mês, quebras
// (status/empreendimento/construtora/corretor), financeiro (recebido/a receber/
// atrasado/repasse), filtros e exportação em Excel (várias abas).
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { exportarXlsxAbas } from '../lib/xlsx-simple';
import { useToast } from '../lib/toast';
import { Chart, registerables } from 'chart.js';
import { EmptyState } from '../components/EmptyState';

Chart.register(...registerables);

const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brlFull = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Data "só dia" gravada como meia-noite UTC (importação de planilha, vencimento)
// sai em UTC pra não virar o dia anterior no fuso do Brasil.
const dataBr = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  const soDia = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', ...(soDia ? { timeZone: 'UTC' } : {}) });
};
// 'YYYY-MM-DD' (competência devolvida pelo backend) → dd/mm/aa, sem fuso.
const diaBr = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : dataBr(s));
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const PALETTE = ['#0E7C9B', '#88C559', '#F2B544', '#3FB6D4', '#C084FC', '#F87171', '#8493B4', '#34D399'];

// Início/fim do DIA do calendário em horário de Brasília (-03:00), qualquer que
// seja o fuso do aparelho (CEO viajando não pode ver o mês deslocado 1 dia).
const pad2 = (n: number) => String(n).padStart(2, '0');
const diaCal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const inicioDia = (dia: string) => (dia ? `${dia}T00:00:00-03:00` : '');
const fimDia = (dia: string) => (dia ? `${dia}T23:59:59-03:00` : '');

// Presets de período (estáveis ao longo do dia: a chave do cache não muda a cada render).
function preset(p: string) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const faixa = (de: Date, ate: Date) => ({ de: inicioDia(diaCal(de)), ate: fimDia(diaCal(ate)) });
  if (p === 'mes') return faixa(new Date(y, m, 1), now);
  if (p === 'mesAnt') return faixa(new Date(y, m - 1, 1), new Date(y, m, 0));
  if (p === 'tri') return faixa(new Date(y, m - 2, 1), now);
  if (p === '6m') return faixa(new Date(y, m - 5, 1), now);
  if (p === '12m') return faixa(new Date(y, m - 11, 1), now);
  if (p === 'ano') return faixa(new Date(y, 0, 1), now);
  if (p === 'anoAnt') return faixa(new Date(y - 1, 0, 1), new Date(y - 1, 11, 31));
  return { de: '', ate: '' };
}

type Filtros = { de: string; ate: string; empreendimentoId: string; construtora: string; equipeId: string; corretorId: string; sala: string; status: string };

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
        <PageHeader breadcrumb="Comercial · Análise de Vendas" title="Análise de Vendas" subtitle="Histórico de vendas, VGV, vendas por sala e por corretor, financeiro e comparativos. Exporte tudo em Excel." />
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

function Kpi({ label, valor, delta, spark, cor, sub, destaque }: { label: string; valor: string; delta?: number; spark?: number[]; cor: string; sub?: React.ReactNode; destaque?: boolean }) {
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
    <div className={'card' + (destaque ? ' kpi-card--destaque' : '')} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, ...(destaque ? { boxShadow: `inset 3px 0 0 ${cor}, var(--shadow-sm)` } : {}) }}>
      <div className="flex-between" style={{ alignItems: 'flex-start' }}>
        <div className="text-xs text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{label}</div>
        {delta !== undefined && <Delta v={delta} />}
      </div>
      <div className="kpi-card__valor" style={{ fontSize: 'clamp(19px, 4.5vw, 26px)', fontWeight: 800, color: cor, whiteSpace: 'nowrap' }}>{valor}</div>
      {sub && <div className="text-xs text-secondary">{sub}</div>}
      {spark && spark.length > 1 && <div style={{ height: 34, marginTop: -4 }}><canvas ref={ref} /></div>}
    </div>
  );
}

function FinCard({ label, valor, cor, hint, onClick }: { label: string; valor: number; cor: string; hint?: string; onClick?: () => void }) {
  return (
    <div className="card" style={{ padding: '14px 16px', borderLeft: `4px solid ${cor}`, cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
      <div className="flex-between" style={{ alignItems: 'flex-start' }}>
        <div className="text-xs text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{label}</div>
        {onClick && <Icon name="chevron-right" size={15} className="text-secondary" />}
      </div>
      <div style={{ fontSize: 'clamp(18px, 4vw, 22px)', fontWeight: 800, color: cor, whiteSpace: 'nowrap' }}>{brlFull(valor)}</div>
      {hint && <div className="text-xs text-secondary">{hint}</div>}
    </div>
  );
}

// Metadados de cada card financeiro: o que ele significa (mostrado no drilldown).
const FIN_META: Record<string, { label: string; cor: string; def: string }> = {
  recebido: { label: 'Recebido', cor: 'var(--color-success, #16A34A)', def: 'Parcelas já pagas das vendas feitas no período (pode ter sido paga depois do período).' },
  aReceber: { label: 'A receber', cor: 'var(--pons-blue, #0E7C9B)', def: 'Parcelas ainda não vencidas das vendas feitas no período — previsão de entrada.' },
  atrasado: { label: 'Atrasado', cor: '#DC2626', def: 'Parcelas vencidas e não pagas das vendas feitas no período — precisam de cobrança.' },
  comissaoCorretor: { label: 'Repasse corretores', cor: '#8493B4', def: 'Parte da comissão destinada aos corretores (rateio da planilha da venda).' },
};

// Cabeçalho de card com atalho "ver todas (N)" que abre o modal da lista cheia.
function CardHead({ title, total, onVerTodas }: { title: string; total: number; onVerTodas: () => void }) {
  return (
    <div className="flex-between" style={{ marginTop: 0, marginBottom: 10, gap: 8 }}>
      <h3 className="card__title" style={{ margin: 0 }}>{title}</h3>
      {total > 0 && (
        <button onClick={onVerTodas} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pons-blue, #0E7C9B)', fontSize: 12, fontWeight: 700, padding: 2, whiteSpace: 'nowrap' }}>
          Ver todas ({total}) <Icon name="chevron-right" size={14} />
        </button>
      )}
    </div>
  );
}

// Seta de variação compacta (tabelas): verde sobe, vermelho desce.
function VarCel({ v }: { v: number | null }) {
  if (v == null) return <span className="text-secondary">—</span>;
  const cor = v > 0 ? 'var(--color-success, #16A34A)' : v < 0 ? 'var(--color-danger, #DC2626)' : 'var(--text-secondary)';
  return <span style={{ color: cor, fontWeight: 600, whiteSpace: 'nowrap' }}>{pct(v)}</span>;
}
const variacao = (a: number, b: number): number | null => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null);

export default function AnaliseVendas() {
  const [periodo, setPeriodo] = useState('6m');
  const [customDe, setCustomDe] = useState('');
  const [customAte, setCustomAte] = useState('');
  const [empreendimentoId, setEmp] = useState('');
  const [construtora, setConstr] = useState('');
  const [equipeId, setEquipe] = useState('');
  const [corretorId, setCorretor] = useState('');
  const [sala, setSala] = useState('');
  const [status, setStatus] = useState('');
  const [finSel, setFinSel] = useState<string | null>(null); // card financeiro aberto no drilldown
  const [listaSel, setListaSel] = useState<'empreendimentos' | 'corretores' | 'construtoras' | null>(null); // modal "ver todas"
  const [exportando, setExportando] = useState(false);
  const nav = useNavigate();
  const toast = useToast();

  const janelaDe = (p: string) => (p === 'custom'
    ? { de: inicioDia(customDe), ate: fimDia(customAte) }
    : preset(p));
  const montarFiltros = (over: Partial<Filtros> = {}): Filtros => ({
    ...janelaDe(periodo), empreendimentoId, construtora, equipeId, corretorId, sala, status, ...over,
  });
  // Filtros APLICADOS (o que está na tela). A chave do cache é o próprio filtro:
  // voltar pra página com outro filtro nunca mostra número de filtro antigo.
  const [aplicados, setAplicados] = useState<Filtros>(() => montarFiltros());
  const aplicar = (over: Partial<Filtros> = {}) => setAplicados(montarFiltros(over));
  const { data, loading, error } = useApi<any>(() => Api.vendasAnalytics(aplicados), [JSON.stringify(aplicados)]);

  const chVgvRef = useRef<HTMLCanvasElement>(null);
  const chStatusRef = useRef<HTMLCanvasElement>(null);
  const insts = useRef<Chart[]>([]);

  useEffect(() => {
    insts.current.forEach((c) => c.destroy());
    insts.current = [];
    if (!data) return;
    Chart.defaults.font.family = 'Inter, sans-serif';

    if (chVgvRef.current && data.serie?.length) {
      const temAno = data.serie.some((m: any) => m.vgvAnoAnterior != null);
      insts.current.push(new Chart(chVgvRef.current, {
        data: {
          labels: data.serie.map((m: any) => m.label),
          datasets: [
            { type: 'bar', label: 'VGV', data: data.serie.map((m: any) => m.vgv), backgroundColor: '#0E7C9B', borderRadius: 6, maxBarThickness: 44, order: 3 },
            { type: 'line', label: 'Período anterior', data: data.serie.map((m: any) => m.vgvAnterior), borderColor: '#F2B544', borderWidth: 2, borderDash: [5, 4], pointRadius: 2, tension: 0.35, order: 1 } as any,
            ...(temAno ? [{ type: 'line', label: 'Ano anterior', data: data.serie.map((m: any) => m.vgvAnoAnterior || 0), borderColor: '#8493B4', borderWidth: 2, borderDash: [2, 3], pointRadius: 2, tension: 0.35, order: 2 } as any] : []),
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

  const salasOpc: { valor: string; rotulo: string }[] = data?.filtros?.salas || [];
  const corretoresOpc: { id: number; nome: string }[] = data?.filtros?.corretores || [];
  const temFiltro = !!(empreendimentoId || construtora || equipeId || corretorId || sala || status);

  // Excel com várias abas: resumo, mês a mês, por sala, por corretor, por
  // empreendimento e a lista de vendas do período (mesmos filtros da tela).
  async function exportar() {
    setExportando(true);
    try {
      const d: any = await Api.vendasAnalytics({ ...aplicados, lista: 1 });
      const nomeDe = (lista: any[], id: string, campo = 'nome') => lista.find((x: any) => String(x.id) === String(id))?.[campo] || id;
      const filtrosTxt = [
        aplicados.sala && `Sala: ${salasOpc.find((x) => x.valor === aplicados.sala)?.rotulo || aplicados.sala}`,
        aplicados.corretorId && `Corretor: ${nomeDe(d.filtros?.corretores || [], aplicados.corretorId)}`,
        aplicados.empreendimentoId && `Empreendimento: ${nomeDe(d.filtros?.empreendimentos || [], aplicados.empreendimentoId)}`,
        aplicados.construtora && `Construtora: ${aplicados.construtora}`,
        aplicados.equipeId && `Equipe: ${nomeDe(d.filtros?.equipes || [], aplicados.equipeId)}`,
        aplicados.status && `Status: ${(d.filtros?.status || []).find((x: any) => x.value === aplicados.status)?.label || aplicados.status}`,
      ].filter(Boolean).join(' · ') || 'Nenhum';
      const r = d.resumo;
      // Sem base de comparação (zero) a variação fica vazia, como na tela.
      const linhaKpi = (nome: string, k: any) => [nome, k.atual, k.anterior, k.anterior > 0 ? k.variacao : null, k.anoAnterior ?? null, k.anoAnterior > 0 ? k.variacaoAno : null];
      const grupo = (x: any) => [x.vendas, x.vgv, x.ticketMedio ?? null, x.comissao, x.recebido ?? null, x.aReceber ?? null, x.atrasado ?? null];
      const cabGrupo = ['Vendas', 'VGV (R$)', 'Ticket médio (R$)', 'Comissão bruta (R$)', 'Recebido (R$)', 'A receber (R$)', 'Atrasado (R$)'];
      const hoje = new Date().toLocaleDateString('pt-BR');
      const soDia = (x: any) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : '');
      const nomeArq = soDia(d.periodo?.de) && soDia(d.periodo?.ate)
        ? `relatorio-vendas-${d.periodo.de}-a-${d.periodo.ate}.xlsx`
        : `relatorio-vendas-${diaCal(new Date())}.xlsx`;
      exportarXlsxAbas(nomeArq, [
        {
          nome: 'Resumo',
          cabecalho: ['Indicador', 'Período', 'Período anterior', 'Variação (%)', 'Ano anterior', 'Variação ano (%)'],
          linhas: [
            linhaKpi('VGV (R$)', r.vgv), linhaKpi('Vendas', r.vendas), linhaKpi('Comissão bruta (R$)', r.comissao), linhaKpi('Ticket médio (R$)', r.ticketMedio),
            [],
            ['Período', `${diaBr(d.periodo.de)} a ${diaBr(d.periodo.ate)}`],
            ...(d.periodo.anterior ? [['Período anterior', `${diaBr(d.periodo.anterior.de)} a ${diaBr(d.periodo.anterior.ate)}`]] : []),
            ...(d.periodo.anoAnterior ? [['Ano anterior', `${diaBr(d.periodo.anoAnterior.de)} a ${diaBr(d.periodo.anoAnterior.ate)}`]] : []),
            ['Filtros', filtrosTxt],
            ['Recebido (R$)', d.financeiro.recebido], ['A receber (R$)', d.financeiro.aReceber], ['Atrasado (R$)', d.financeiro.atrasado], ['Repasse corretores (R$)', d.financeiro.comissaoCorretor],
            ['Gerado em', hoje],
            ['Observação', 'Vendas canceladas não entram. Data da venda = data de cadastro no sistema. Comissão bruta = VGV x % de comissão da venda.'],
          ],
        },
        {
          nome: 'Mês a mês',
          cabecalho: ['Mês', 'Vendas', 'VGV (R$)', 'Variação vs mês anterior (%)', 'Vendas ano anterior', 'VGV ano anterior (R$)', 'Variação vs ano anterior (%)', 'Comissão bruta (R$)', 'Ticket médio (R$)'],
          linhas: (d.serie || []).map((m: any, i: number, arr: any[]) => [
            m.label, m.vendas, m.vgv, i > 0 ? variacao(m.vgv, arr[i - 1].vgv) : null,
            m.vendasAnoAnterior ?? null, m.vgvAnoAnterior ?? null, m.vgvAnoAnterior != null ? variacao(m.vgv, m.vgvAnoAnterior) : null,
            m.comissao, m.ticketMedio ?? (m.vendas ? Math.round(m.vgv / m.vendas) : 0),
          ]),
        },
        { nome: 'Por sala', cabecalho: ['Sala', ...cabGrupo, 'Corretores'], linhas: (d.porSala || []).map((x: any) => [x.label, ...grupo(x), x.corretores ?? null]) },
        { nome: 'Por corretor', cabecalho: ['Corretor', 'Sala principal', 'Equipe', ...cabGrupo], linhas: (d.todos?.corretores || []).map((x: any) => [x.label, x.sala || '', x.equipe || '', ...grupo(x)]) },
        { nome: 'Por empreendimento', cabecalho: ['Empreendimento', ...cabGrupo], linhas: (d.todos?.empreendimentos || []).map((x: any) => [x.label, ...grupo(x)]) },
        { nome: 'Por construtora', cabecalho: ['Construtora', ...cabGrupo], linhas: (d.todos?.construtoras || []).map((x: any) => [x.label, ...grupo(x)]) },
        {
          nome: 'Vendas',
          cabecalho: ['Data', 'Código', 'Sala', 'Corretor', 'Equipe', 'Empreendimento', 'Unidade', 'Construtora', 'Cliente', 'VGV (R$)', '% comissão', 'Comissão bruta (R$)', 'Status', 'Recebido (R$)', 'A receber (R$)', 'Atrasado (R$)'],
          linhas: (d.lista || []).map((v: any) => [
            diaBr(v.data), v.codigo, v.sala, v.corretor, v.equipe, v.empreendimento, v.unidade, v.construtora, v.cliente,
            v.vgv, v.percentualComissao, v.comissao, v.status, v.recebido, v.aReceber, v.atrasado,
          ]),
        },
      ]);
      if (!d.lista) toast.error('A lista de vendas ainda não está disponível no servidor — as outras abas foram exportadas.');
    } catch (e: any) {
      toast.error('Não foi possível exportar: ' + (e?.message || 'erro'));
    } finally {
      setExportando(false);
    }
  }

  const botaoExportar = (
    <button className="btn btn--secondary btn--sm" onClick={exportar} disabled={exportando || !data} title="Baixar o relatório em Excel (mesmos filtros da tela)">
      <Icon name="sheet" size={15} /> {exportando ? 'Gerando…' : 'Exportar Excel'}
    </button>
  );

  const barraFiltros = (
    <div className="card" style={{ padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div className="field" style={{ margin: 0, minWidth: 150 }}>
        <label className="field__label">Período</label>
        <select className="field__select" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          <option value="mes">Este mês</option>
          <option value="mesAnt">Mês passado</option>
          <option value="tri">Últimos 3 meses</option>
          <option value="6m">Últimos 6 meses</option>
          <option value="12m">Últimos 12 meses</option>
          <option value="ano">Este ano</option>
          <option value="anoAnt">Ano passado</option>
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
      {salasOpc.length > 0 && (
        <div className="field" style={{ margin: 0, minWidth: 150 }}>
          <label className="field__label">Sala</label>
          <select className="field__select" value={sala} onChange={(e) => setSala(e.target.value)}>
            <option value="">Todas</option>
            {salasOpc.map((x) => <option key={x.valor} value={x.valor}>{x.rotulo}</option>)}
          </select>
        </div>
      )}
      {corretoresOpc.length > 0 && (
        <div className="field" style={{ margin: 0, minWidth: 170 }}>
          <label className="field__label">Corretor</label>
          <select className="field__select" value={corretorId} onChange={(e) => setCorretor(e.target.value)}>
            <option value="">Todos</option>
            {corretoresOpc.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
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
      <button className="btn btn--primary" onClick={() => aplicar()}>Aplicar filtros</button>
      {temFiltro && (
        <button className="btn btn--secondary" onClick={() => {
          setEmp(''); setConstr(''); setEquipe(''); setCorretor(''); setSala(''); setStatus('');
          aplicar({ empreendimentoId: '', construtora: '', equipeId: '', corretorId: '', sala: '', status: '' });
        }}>Limpar</button>
      )}
    </div>
  );

  if (loading && !data) return <Shell right={botaoExportar}>{barraFiltros}<LoadingBlock /></Shell>;
  if (error && !data) return <Shell right={botaoExportar}>{barraFiltros}<ErrorBlock error={error} label="Erro ao carregar a análise" /></Shell>;
  if (!data) return null;

  const r = data.resumo;
  const sVgv = data.serie.map((m: any) => m.vgv);
  const sVendas = data.serie.map((m: any) => m.vendas);
  const sCom = data.serie.map((m: any) => m.comissao);
  const totalVgvQuebra = (data.porStatus || []).reduce((s: number, x: any) => s + x.vgv, 0) || 1;
  const temAno = r.vgv?.anoAnterior != null;
  const subAno = (k: any, fmt: (n: number) => string) => (k?.anoAnterior != null
    ? <>Ano anterior: {fmt(k.anoAnterior)} · <VarCel v={k.anoAnterior > 0 ? k.variacaoAno : null} /></>
    : undefined);
  const porSala: any[] = data.porSala || [];
  const vgvSalas = porSala.reduce((s, x) => s + (x.vgv || 0), 0) || 1;
  const serie: any[] = data.serie || [];
  const tot = serie.reduce((a, m) => ({
    vendas: a.vendas + m.vendas, vgv: a.vgv + m.vgv, comissao: a.comissao + m.comissao,
    vendasAno: a.vendasAno + (m.vendasAnoAnterior || 0), vgvAno: a.vgvAno + (m.vgvAnoAnterior || 0),
  }), { vendas: 0, vgv: 0, comissao: 0, vendasAno: 0, vgvAno: 0 });
  const filtrarPor = (over: Partial<Filtros>) => {
    if ('sala' in over) setSala(over.sala || '');
    if ('corretorId' in over) setCorretor(over.corretorId || '');
    aplicar(over);
    // quem rola é o .main (layout), não a janela
    (document.querySelector('.main') || window).scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Shell right={botaoExportar}>
      {barraFiltros}

      {data.periodo?.anterior && (
        <div className="text-xs text-secondary" style={{ margin: '-6px 0 10px' }}>
          Período: <strong>{diaBr(data.periodo.de)} a {diaBr(data.periodo.ate)}</strong>
          {' · '}comparado com {diaBr(data.periodo.anterior.de)} a {diaBr(data.periodo.anterior.ate)}
          {data.periodo.anoAnterior && <> e com o mesmo período do ano anterior ({diaBr(data.periodo.anoAnterior.de)} a {diaBr(data.periodo.anoAnterior.ate)})</>}
        </div>
      )}

      {/* KPIs comparativos com sparkline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Kpi destaque label="VGV no período" valor={brl(r.vgv.atual)} delta={r.vgv.variacao} spark={sVgv} cor="#0E7C9B" sub={subAno(r.vgv, brl)} />
        <Kpi label="Vendas" valor={String(r.vendas.atual)} delta={r.vendas.variacao} spark={sVendas} cor="#88C559" sub={subAno(r.vendas, String)} />
        <Kpi label="Comissão bruta" valor={brl(r.comissao.atual)} delta={r.comissao.variacao} spark={sCom} cor="#C084FC" sub={subAno(r.comissao, brl)} />
        <Kpi label="Ticket médio" valor={brl(r.ticketMedio.atual)} delta={r.ticketMedio.variacao} cor="#F2B544" sub={subAno(r.ticketMedio, brl)} />
      </div>

      {/* Financeiro */}
      <div className="uppercase-tag" style={{ margin: '6px 0 8px' }}>Financeiro das vendas do período</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>
        <FinCard label="Recebido" valor={data.financeiro.recebido} cor={FIN_META.recebido.cor} hint="Parcelas pagas · toque para detalhar" onClick={() => setFinSel('recebido')} />
        <FinCard label="A receber" valor={data.financeiro.aReceber} cor={FIN_META.aReceber.cor} hint="Parcelas futuras · toque para detalhar" onClick={() => setFinSel('aReceber')} />
        <FinCard label="Atrasado" valor={data.financeiro.atrasado} cor={FIN_META.atrasado.cor} hint="Vencido não pago · toque para detalhar" onClick={() => setFinSel('atrasado')} />
        <FinCard label="Repasse corretores" valor={data.financeiro.comissaoCorretor} cor={FIN_META.comissaoCorretor.cor} hint="Comissão dos corretores · toque para detalhar" onClick={() => setFinSel('comissaoCorretor')} />
      </div>

      {/* Drilldown do card financeiro: o que compõe o número + botão pra Vendas */}
      {finSel && (() => {
        const meta = FIN_META[finSel];
        const total = data.financeiro[finSel] || 0;
        const qtd = data.financeiro[finSel + 'Qtd'] || 0;
        const itens: any[] = data.financeiro.itens?.[finSel] || [];
        return (
          <Modal
            open={!!finSel}
            onClose={() => setFinSel(null)}
            title={meta.label}
            subtitle={meta.def}
            size="lg"
            footer={
              <>
                <button className="btn btn--secondary" onClick={() => setFinSel(null)}>Fechar</button>
                <button className="btn btn--primary" onClick={() => nav('/vendas')}>
                  <Icon name="chevron-right" size={14} /> Abrir na aba Vendas
                </button>
              </>
            }
          >
            <div className="flex-between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div className="text-xs text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>Total no período</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: meta.cor }}>{brlFull(total)}</div>
              </div>
              <div className="text-sm text-secondary">{qtd} parcela{qtd === 1 ? '' : 's'}{qtd > itens.length ? ` · mostrando as ${itens.length} maiores` : ''}</div>
            </div>
            {itens.length === 0 ? (
              <div className="text-sm text-secondary" style={{ padding: 12 }}>Nenhuma parcela nesta categoria no período.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table tabela-compacta" style={{ minWidth: 560 }}>
                  <thead><tr><th>Venda</th><th>Cliente</th><th>Empreendimento</th><th>Vencimento</th><th className="numeric">Valor</th></tr></thead>
                  <tbody>
                    {itens.map((it, i) => (
                      <tr key={i} style={{ cursor: 'pointer' }} onClick={() => nav(`/vendas?venda=${it.vendaId}`)} title="Abrir esta venda">
                        <td className="font-semibold" style={{ whiteSpace: 'nowrap' }}>#{it.codigo}</td>
                        <td>{it.cliente}</td>
                        <td>{it.empreendimento}{it.unidade ? ` · ${it.unidade}` : ''}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{dataBr(it.vencimento)}</td>
                        <td className="numeric money">{brl(it.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Modal>
        );
      })()}

      {/* "Ver todas": lista completa de empreendimentos / corretores / construtoras */}
      {listaSel && (() => {
        const cfg = {
          empreendimentos: { titulo: 'Empreendimentos', col: 'Empreendimento' },
          corretores: { titulo: 'Corretores', col: 'Corretor' },
          construtoras: { titulo: 'Construtoras', col: 'Construtora' },
        }[listaSel];
        const linhas: any[] = data.todos?.[listaSel] || [];
        const totVgv = linhas.reduce((s, x) => s + (x.vgv || 0), 0) || 1;
        const x0 = linhas[0];
        const ehCorretores = listaSel === 'corretores';
        const podeFiltrarCorretor = ehCorretores && corretoresOpc.length > 0;
        return (
          <Modal
            open={!!listaSel}
            onClose={() => setListaSel(null)}
            title={`Todos os ${cfg.titulo.toLowerCase()}`}
            subtitle={`${linhas.length} no período · ordenados por VGV${podeFiltrarCorretor ? ' · toque num corretor para filtrar o relatório' : ''}`}
            size="lg"
            footer={<button className="btn btn--secondary" onClick={() => setListaSel(null)}>Fechar</button>}
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="table tabela-compacta" style={{ minWidth: ehCorretores ? 760 : 560 }}>
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>#</th>
                    <th>{cfg.col}</th>
                    {ehCorretores && x0?.sala !== undefined && <th>Sala</th>}
                    {ehCorretores && <th>Equipe</th>}
                    <th className="numeric">Vendas</th>
                    <th className="numeric">VGV</th>
                    <th className="numeric">% VGV</th>
                    <th className="numeric">Comissão</th>
                    {x0?.recebido !== undefined && <th className="numeric">Recebido</th>}
                    {x0?.aReceber !== undefined && <th className="numeric">A receber</th>}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((x, i) => (
                    <tr key={i} style={podeFiltrarCorretor ? { cursor: 'pointer' } : undefined} title={podeFiltrarCorretor ? 'Ver o relatório só deste corretor' : undefined}
                      onClick={podeFiltrarCorretor ? () => { setListaSel(null); filtrarPor({ corretorId: String(x.corretorId ?? x.chave) }); } : undefined}>
                      <td className="text-secondary">{i + 1}º</td>
                      <td style={{ fontWeight: 600 }}>{x.label}</td>
                      {ehCorretores && x0?.sala !== undefined && <td className="text-secondary" style={{ whiteSpace: 'nowrap' }}>{x.sala || '—'}</td>}
                      {ehCorretores && <td className="text-secondary" style={{ whiteSpace: 'nowrap' }}>{x.equipe || '—'}</td>}
                      <td className="numeric">{x.vendas}</td>
                      <td className="numeric money">{brl(x.vgv)}</td>
                      <td className="numeric">{Math.round((x.vgv / totVgv) * 100)}%</td>
                      <td className="numeric">{brl(x.comissao)}</td>
                      {x0?.recebido !== undefined && <td className="numeric">{brl(x.recebido)}</td>}
                      {x0?.aReceber !== undefined && <td className="numeric">{brl(x.aReceber)}</td>}
                    </tr>
                  ))}
                  {linhas.length === 0 && <tr><td colSpan={10}><EmptyState size="sm" title="Sem dados no período" /></td></tr>}
                </tbody>
              </table>
            </div>
          </Modal>
        );
      })()}

      {/* Gráfico principal: VGV por mês x período anterior */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 className="card__title" style={{ margin: '0 0 8px' }}>Evolução de VGV</h3>
        <div style={{ position: 'relative', height: 300 }}><canvas ref={chVgvRef} /></div>
      </div>

      {/* Vendas por sala (salas do controle de vendas do financeiro) */}
      {data.porSala && (
        <div className="card" style={{ padding: 0, marginBottom: 16 }}>
          <div className="flex-between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', gap: 8, flexWrap: 'wrap' }}>
            <h3 className="card__title" style={{ margin: 0 }}>Vendas por sala</h3>
            <span className="text-xs text-secondary">{aplicados.sala ? 'Filtrado por sala' : 'Toque numa sala para ver só as vendas dela'}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table tabela-compacta" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th>Sala</th><th className="numeric">Vendas</th><th className="numeric">VGV</th><th style={{ width: 150 }}>Participação</th>
                  <th className="numeric">Ticket médio</th><th className="numeric">Comissão</th><th className="numeric">Recebido</th><th className="numeric">A receber</th><th className="numeric">Corretores</th>
                </tr>
              </thead>
              <tbody>
                {porSala.map((x, i) => {
                  const part = Math.round((x.vgv / vgvSalas) * 1000) / 10;
                  return (
                    <tr key={x.chave} style={{ cursor: 'pointer' }} title="Ver o relatório só desta sala" onClick={() => filtrarPor({ sala: x.chave })}>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{x.label}</td>
                      <td className="numeric">{x.vendas}</td>
                      <td className="numeric money">{brl(x.vgv)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="progress" style={{ flex: 1 }}><div className="progress__fill" style={{ width: `${part}%`, background: PALETTE[i % PALETTE.length] }} /></div>
                          <span className="text-xs" style={{ minWidth: 38, textAlign: 'right' }}>{part.toLocaleString('pt-BR')}%</span>
                        </div>
                      </td>
                      <td className="numeric">{brl(x.ticketMedio)}</td>
                      <td className="numeric">{brl(x.comissao)}</td>
                      <td className="numeric">{brl(x.recebido)}</td>
                      <td className="numeric">{brl(x.aReceber)}</td>
                      <td className="numeric">{x.corretores}</td>
                    </tr>
                  );
                })}
                {porSala.length === 0 && <tr><td colSpan={9}><EmptyState size="sm" title="Sem vendas no período" /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Histórico mês a mês */}
      <div className="card" style={{ padding: 0, marginBottom: 16 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
          <h3 className="card__title" style={{ margin: 0 }}>Histórico mês a mês</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table tabela-compacta" style={{ minWidth: temAno ? 820 : 560 }}>
            <thead>
              <tr>
                <th>Mês</th><th className="numeric">Vendas</th><th className="numeric">VGV</th><th className="numeric">vs mês anterior</th>
                {temAno && <><th className="numeric">VGV ano anterior</th><th className="numeric">vs ano anterior</th></>}
                <th className="numeric">Comissão</th><th className="numeric">Ticket médio</th>
              </tr>
            </thead>
            <tbody>
              {serie.map((m, i) => (
                <tr key={m.mes}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{m.label}</td>
                  <td className="numeric">{m.vendas}</td>
                  <td className="numeric money">{brl(m.vgv)}</td>
                  <td className="numeric"><VarCel v={i > 0 ? variacao(m.vgv, serie[i - 1].vgv) : null} /></td>
                  {temAno && <>
                    <td className="numeric">{m.vgvAnoAnterior ? brl(m.vgvAnoAnterior) : '—'}</td>
                    <td className="numeric"><VarCel v={variacao(m.vgv, m.vgvAnoAnterior || 0)} /></td>
                  </>}
                  <td className="numeric">{brl(m.comissao)}</td>
                  <td className="numeric">{m.vendas ? brl(m.vgv / m.vendas) : '—'}</td>
                </tr>
              ))}
              {serie.length > 1 && (
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-medium)' }}>
                  <td>Total</td>
                  <td className="numeric">{tot.vendas}</td>
                  <td className="numeric money">{brl(tot.vgv)}</td>
                  <td />
                  {temAno && <>
                    <td className="numeric">{tot.vgvAno ? brl(tot.vgvAno) : '—'}</td>
                    <td className="numeric"><VarCel v={variacao(tot.vgv, tot.vgvAno)} /></td>
                  </>}
                  <td className="numeric">{brl(tot.comissao)}</td>
                  <td className="numeric">{tot.vendas ? brl(tot.vgv / tot.vendas) : '—'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quebras: status (rosca) + top empreendimentos. Sem align-items:start
          aqui: o card do gráfico estica junto com a lista ao lado, e a rosca
          fica centrada na altura do card vizinho (margin auto), sem espaço
          vazio embaixo e sem ficar gigante. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column' }}>
          <h3 className="card__title" style={{ marginTop: 0 }}>VGV por status</h3>
          <div style={{ position: 'relative', height: 340, margin: 'auto 0' }}><canvas ref={chStatusRef} /></div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <CardHead title="Top empreendimentos" total={(data.todos?.empreendimentos || []).length} onVerTodas={() => setListaSel('empreendimentos')} />
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
          <CardHead title="Ranking de corretores" total={(data.todos?.corretores || []).length} onVerTodas={() => setListaSel('corretores')} />
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
                    <div className="text-xs text-secondary" style={{ marginBottom: 3 }}>{c.sala && c.sala !== 'Sem sala informada' ? c.sala : (c.equipe || '—')} · {c.vendas} venda{c.vendas > 1 ? 's' : ''}</div>
                    <div className="progress"><div className="progress__fill" style={{ width: `${pct}%`, background: medalha || 'var(--pons-blue)' }} /></div>
                  </div>
                </div>
              );
            })}
            {(data.topCorretores || []).length === 0 && <div className="text-xs text-secondary" style={{ padding: 12 }}>Sem vendas no período.</div>}
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <CardHead title="Por construtora" total={(data.todos?.construtoras || []).length} onVerTodas={() => setListaSel('construtoras')} />
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
