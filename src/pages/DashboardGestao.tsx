// Dashboard de GESTÃO À VISTA — base visual M-086 (CRM Sales Intelligence) nas
// cores do Pons. Pedido Elison 16/10: "dashboard vivo, com vários filtros e de
// gestão à vista; somente dados reais; corretor desativado sai da tela".
// Dados: GET /api/dashboard/gestao (servidor calcula tudo, com escopo por papel).
// Atualiza sozinho a cada 30 s (pausa com a aba escondida). Filtros ficam no link.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import { Api, ApiError } from '../lib/api';
import { formatCurrency, formatCurrencyShort, timeAgo } from '../lib/format';
import { Icon } from '../components/Icon';
import { CampoData } from '../components/CampoData';
import '../styles/dashboard-gestao.css';

Chart.register(...registerables);

type Preset = 'hoje' | '7d' | 'mes' | 'mes_ant' | 'ano' | 'custom';
const PRESETS: { id: Preset; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: 'mes', label: 'Este mês' },
  { id: 'mes_ant', label: 'Mês passado' },
  { id: 'ano', label: 'Este ano' },
  { id: 'custom', label: 'Período' },
];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function periodoDoPreset(p: Preset): { de: string; ate: string } | null {
  const hoje = new Date();
  if (p === 'hoje') return { de: ymd(hoje), ate: ymd(hoje) };
  if (p === '7d') { const d = new Date(hoje); d.setDate(d.getDate() - 6); return { de: ymd(d), ate: ymd(hoje) }; }
  if (p === 'mes') return { de: ymd(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: ymd(hoje) };
  if (p === 'mes_ant') return { de: ymd(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), ate: ymd(new Date(hoje.getFullYear(), hoje.getMonth(), 0)) };
  if (p === 'ano') return { de: ymd(new Date(hoje.getFullYear(), 0, 1)), ate: ymd(hoje) };
  return null;
}
const dataBR = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const pct = (x: number | null | undefined, casas = 1) => (x == null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(casas).replace('.', ',')}%`);
const inteiro = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('pt-BR'));
const minutos = (m: number | null | undefined) => {
  if (m == null) return '—';
  if (m < 60) return `${m.toFixed(m < 10 ? 1 : 0).replace('.', ',')} min`;
  const h = m / 60;
  return h < 48 ? `${h.toFixed(1).replace('.', ',')} h` : `${Math.round(h / 24)} dias`;
};

function Variacao({ v, menorMelhor = false }: { v: number | null | undefined; menorMelhor?: boolean }) {
  if (v == null || !Number.isFinite(v)) return <span className="dg-var dg-var--neutro">sem base</span>;
  const bom = menorMelhor ? v < 0 : v > 0;
  const cls = Math.abs(v) < 0.005 ? 'dg-var--neutro' : bom ? 'dg-var--ok' : 'dg-var--ruim';
  return <span className={`dg-var ${cls}`}>{v > 0 ? '+' : ''}{(v * 100).toFixed(1).replace('.', ',')}%</span>;
}

function Kpi({ rotulo, valor, titulo, variacao, menorMelhor, barra, nota }: {
  rotulo: string; valor: string; titulo?: string; variacao?: number | null; menorMelhor?: boolean; barra: number; nota: string;
}) {
  return (
    <div className="dg-card dg-kpi">
      <span className="dg-kpi-barra" style={{ width: `${Math.max(8, Math.min(100, barra * 100))}%` }} />
      <div className="dg-kpi-rotulo">{rotulo}</div>
      <div className="dg-kpi-valor" title={titulo}>{valor}</div>
      <div className="dg-kpi-rodape">
        {variacao !== undefined && <Variacao v={variacao} menorMelhor={menorMelhor} />}
        <span>{nota}</span>
      </div>
    </div>
  );
}

function Avatar({ nome, initials, url }: { nome: string; initials?: string; url?: string | null }) {
  if (url) return <img className="dg-avatar" src={url} alt="" loading="lazy" />;
  const ini = initials || nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return <span className="dg-avatar" aria-hidden="true">{ini}</span>;
}

const ICONE_EVENTO: Record<string, string> = { lead: 'users', venda: 'dollar', assinatura: 'pencil', pulo: 'arrow_right' };

export default function DashboardGestao({ fallback }: { fallback: React.ReactNode }) {
  const [sp, setSp] = useSearchParams();
  const preset = (sp.get('p') as Preset) || 'mes';
  const periodo = preset === 'custom' ? { de: sp.get('de') || '', ate: sp.get('ate') || '' } : periodoDoPreset(preset)!;
  const filtros = {
    de: periodo.de || undefined,
    ate: periodo.ate || undefined,
    equipeId: sp.get('equipe') || undefined,
    corretorId: sp.get('corretor') || undefined,
    empreendimentoId: sp.get('emp') || undefined,
    origem: sp.get('origem') || undefined,
    campanha: sp.get('campanha') || undefined,
  };
  const chave = JSON.stringify(filtros);

  const [data, setData] = useState<any>(null);
  const [erro, setErro] = useState<Error | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [opcoes, setOpcoes] = useState<any>(null);
  const [tv, setTv] = useState(false);
  const [abaOrigem, setAbaOrigem] = useState<'origem' | 'campanha'>('origem');
  const vistos = useRef<Set<string>>(new Set());
  const [novos, setNovos] = useState<Set<string>>(new Set());

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setBuscando(true);
    try {
      const d = await Api.dashboardGestao(JSON.parse(chave));
      // Eventos que chegaram desde a última atualização ganham o selo "novo".
      const ids = (d?.timeline || []).map((e: any) => `${e.tipo}:${e.em}:${e.leadId || e.vendaId || ''}`);
      if (vistos.current.size) setNovos(new Set(ids.filter((k: string) => !vistos.current.has(k))));
      vistos.current = new Set(ids);
      setData(d); setErro(null);
    } catch (e: any) {
      // Servidor ainda sem o endpoint novo (deploy pendente): mostra o dashboard antigo.
      if (e instanceof ApiError && e.status === 404) setIndisponivel(true);
      else if (!silencioso) setErro(e);
    } finally {
      setBuscando(false);
    }
  }, [chave]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) carregar(true); }, 30000);
    return () => clearInterval(t);
  }, [carregar]);
  useEffect(() => { Api.dashboardGestaoOpcoes().then(setOpcoes).catch(() => setOpcoes(null)); }, []);
  useEffect(() => {
    if (!tv) return;
    const sair = (e: KeyboardEvent) => { if (e.key === 'Escape') setTv(false); };
    window.addEventListener('keydown', sair);
    return () => window.removeEventListener('keydown', sair);
  }, [tv]);

  const setFiltro = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    if (k === 'equipe') n.delete('corretor'); // corretor depende da equipe
    setSp(n, { replace: true });
  };
  const setPreset = (p: Preset) => {
    const n = new URLSearchParams(sp);
    n.set('p', p);
    if (p === 'custom') {
      const base = periodoDoPreset('mes')!;
      if (!n.get('de')) n.set('de', base.de);
      if (!n.get('ate')) n.set('ate', base.ate);
    } else { n.delete('de'); n.delete('ate'); }
    setSp(n, { replace: true });
  };
  const limpar = () => setSp(new URLSearchParams(), { replace: true });
  const temFiltro = ['equipe', 'corretor', 'emp', 'origem', 'campanha'].some((k) => sp.get(k)) || preset !== 'mes';

  // ── gráfico VGV × leads ─────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!canvasRef.current || !data?.serie) return;
    chartRef.current?.destroy();
    const escuro = document.documentElement.getAttribute('data-theme') === 'dark';
    // Paleta Pons (styles/tokens.css): barras no azul Pons (blue-300 no escuro, para
    // ler sobre o azul-marinho), linha no ciano (escuro) ou azul-marinho (claro).
    const cor = { azul: escuro ? '#3FB6D4' : '#0E7C9B', ciano: escuro ? '#52F7FE' : '#263654', grade: escuro ? 'rgba(132,147,180,0.15)' : 'rgba(38,54,84,0.08)', txt: escuro ? '#8893A8' : '#3D5278' };
    const temLeads = data.kpis?.leads != null;
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: data.serie.map((b: any) => b.rotulo),
        datasets: [
          { type: 'bar', label: 'VGV vendido', data: data.serie.map((b: any) => b.vgv), backgroundColor: cor.azul, borderRadius: 8, maxBarThickness: 34, yAxisID: 'y', order: 2 },
          ...(temLeads ? [{ type: 'line' as const, label: 'Leads recebidos', data: data.serie.map((b: any) => b.leads), borderColor: cor.ciano, backgroundColor: cor.ciano, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'y1', order: 1 }] : []),
        ] as any,
      },
      options: {
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (x: any) => (x.dataset.yAxisID === 'y' ? `VGV: ${formatCurrency(x.raw)} · ${data.serie[x.dataIndex].vendas} venda(s)` : `Leads: ${x.raw}`) } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: cor.txt, maxRotation: 0, autoSkip: true, maxTicksLimit: 16 } },
          y: { beginAtZero: true, grid: { color: cor.grade }, ticks: { color: cor.txt, callback: (v: any) => formatCurrencyShort(Number(v)) } },
          ...(temLeads ? { y1: { beginAtZero: true, position: 'right' as const, grid: { display: false }, ticks: { color: cor.txt, precision: 0 } } } : {}),
        },
      },
    });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [data, tv]);

  const corretoresOpc = useMemo(() => {
    const lista = opcoes?.corretores || [];
    const eq = sp.get('equipe');
    return eq ? lista.filter((c: any) => String(c.equipeId) === eq) : lista;
  }, [opcoes, sp]);

  if (indisponivel) return <>{fallback}</>;
  if (!data && erro) {
    return (
      <div className="dg">
        <div className="dg-card"><div className="dg-vazio">Não foi possível carregar o dashboard: {erro.message} <button className="dg-limpar" onClick={() => carregar()}>Tentar de novo</button></div></div>
      </div>
    );
  }
  if (!data) {
    return <div className="dg"><div className="dg-card"><div className="dg-vazio">Carregando o dashboard…</div></div></div>;
  }

  const k = data.kpis;
  const p = data.periodo;
  const notaAnt = `vs. ${dataBR(p.anteriorDe).slice(0, 5)}–${dataBR(p.anteriorAte).slice(0, 5)}`;
  const rel = (a: number, b: number) => (Math.max(a, b) > 0 ? a / Math.max(a, b) : 0);
  const topoVgv = data.rankingCorretores?.[0]?.vgv || 0;
  const topoEq = data.rankingEquipes?.[0]?.vgv || 0;
  const topoEmp = data.empreendimentos?.[0]?.vgv || 0;
  const maxContrato = Math.max(1, ...(data.contratos || []).map((c: any) => c.valor));
  const linhasOrigem = abaOrigem === 'origem' ? data.origens : data.campanhas;

  return (
    <div className={`dg${tv ? ' dg--tv' : ''}${buscando ? ' dg-carregando' : ''}`}>
      {/* ── cabeçalho ── */}
      <div className="dg-topo">
        <div>
          <h1 className="dg-titulo">Gestão à vista</h1>
          <div className="dg-sub">
            {p.de === p.ate ? dataBR(p.de) : `${dataBR(p.de)} a ${dataBR(p.ate)}`}
            {data.escopo === 'equipe' ? ' · suas equipes' : ' · Grupo Pons'}
          </div>
        </div>
        <div className="dg-acoes">
          <span className="dg-vivo"><i /> Ao vivo · atualizado {timeAgo(data.geradoEm)}</span>
          <button className="dg-btn" onClick={() => carregar()} title="Atualizar agora"><Icon name="refresh" size={14} /> Atualizar</button>
          <button className="dg-btn dg-btn--forte" onClick={() => setTv((x) => !x)}>
            <Icon name="tv" size={14} /> {tv ? 'Sair do modo TV' : 'Modo TV'}
          </button>
        </div>
      </div>

      {/* ── filtros ── */}
      <div className="dg-filtros">
        <div className="dg-pills" role="group" aria-label="Período">
          {PRESETS.map((x) => (
            <button key={x.id} className={`dg-pill${preset === x.id ? ' dg-pill--on' : ''}`} onClick={() => setPreset(x.id)}>{x.label}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <span className="dg-datas">
            <CampoData value={sp.get('de') || ''} onChange={(iso) => iso && setFiltro('de', iso)} />
            a
            <CampoData value={sp.get('ate') || ''} onChange={(iso) => iso && setFiltro('ate', iso)} />
          </span>
        )}
        <select className={`dg-select${sp.get('equipe') ? ' dg-select--on' : ''}`} value={sp.get('equipe') || ''} onChange={(e) => setFiltro('equipe', e.target.value)} aria-label="Equipe">
          <option value="">Todas as equipes</option>
          {(opcoes?.equipes || []).map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <select className={`dg-select${sp.get('corretor') ? ' dg-select--on' : ''}`} value={sp.get('corretor') || ''} onChange={(e) => setFiltro('corretor', e.target.value)} aria-label="Corretor">
          <option value="">Todos os corretores</option>
          {corretoresOpc.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select className={`dg-select${sp.get('emp') ? ' dg-select--on' : ''}`} value={sp.get('emp') || ''} onChange={(e) => setFiltro('emp', e.target.value)} aria-label="Empreendimento">
          <option value="">Todos os empreendimentos</option>
          {(opcoes?.empreendimentos || []).map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        {(opcoes?.origens || []).length > 0 && (
          <select className={`dg-select${sp.get('origem') ? ' dg-select--on' : ''}`} value={sp.get('origem') || ''} onChange={(e) => setFiltro('origem', e.target.value)} aria-label="Origem">
            <option value="">Todas as origens</option>
            {opcoes.origens.map((o: any) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        )}
        {(opcoes?.campanhas || []).length > 0 && (
          <select className={`dg-select${sp.get('campanha') ? ' dg-select--on' : ''}`} value={sp.get('campanha') || ''} onChange={(e) => setFiltro('campanha', e.target.value)} aria-label="Campanha">
            <option value="">Todas as campanhas</option>
            {opcoes.campanhas.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {temFiltro && <button className="dg-limpar" onClick={limpar}>Limpar filtros</button>}
      </div>

      <div className="dg-grade">
        {/* ── linha do tempo ao vivo (M-086 "Live Timeline") ── */}
        <aside className="dg-card dg-timeline">
          <div className="dg-card-topo">
            <h2 className="dg-card-titulo"><span className="dg-vivo"><i /></span> Linha do tempo</h2>
            <span className="dg-card-nota">ao vivo</span>
          </div>
          <div className="dg-tl-lista">
            {(data.timeline || []).length === 0 && <div className="dg-vazio">Nada aconteceu ainda com esses filtros.</div>}
            {(data.timeline || []).map((e: any) => {
              const id = `${e.tipo}:${e.em}:${e.leadId || e.vendaId || ''}`;
              return (
                <div key={id} className={`dg-ev dg-ev--${e.tipo}${novos.has(id) ? ' dg-ev--novo' : ''}`}>
                  <span className="dg-ev-ic"><Icon name={ICONE_EVENTO[e.tipo] || 'activity'} size={14} /></span>
                  <div>
                    <div className="dg-ev-quando">{timeAgo(e.em)}</div>
                    <div className="dg-ev-tit">{e.titulo}</div>
                    {e.detalhe && <div className="dg-ev-det">{e.detalhe}</div>}
                    {e.valor ? <div className="dg-ev-det"><strong>{formatCurrency(e.valor)}</strong></div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="dg-principal">
          {/* ── números do período ── */}
          <div className="dg-linha dg-linha--kpis">
            <Kpi rotulo="VGV vendido" valor={formatCurrencyShort(k.vgv.atual)} titulo={formatCurrency(k.vgv.atual)} variacao={k.vgv.variacao}
              barra={data.meta ? Math.min(1, data.meta.pct) : rel(k.vgv.atual, k.vgv.anterior)} nota={data.meta ? `${pct(data.meta.pct, 0)} da meta · ${notaAnt}` : notaAnt} />
            <Kpi rotulo="Vendas" valor={inteiro(k.vendas.atual)} variacao={k.vendas.variacao} barra={rel(k.vendas.atual, k.vendas.anterior)}
              nota={k.canceladas?.qtd ? `${k.canceladas.qtd} cancelada(s) · ${notaAnt}` : notaAnt} />
            <Kpi rotulo="Ticket médio" valor={formatCurrencyShort(k.ticket.atual)} titulo={formatCurrency(k.ticket.atual)} variacao={k.ticket.variacao} barra={rel(k.ticket.atual, k.ticket.anterior)} nota={notaAnt} />
            {k.leads ? (
              <>
                <Kpi rotulo="Leads recebidos" valor={inteiro(k.leads.atual)} variacao={k.leads.variacao} barra={rel(k.leads.atual, k.leads.anterior)} nota={notaAnt} />
                <Kpi rotulo="Conversão dos leads" valor={pct(k.conversao.atual)} variacao={k.conversao.variacao} barra={Math.min(1, (k.conversao.atual || 0) * 10)}
                  nota={`${inteiro(k.conversao.convertidos)} lead(s) do período viraram venda`} />
                <Kpi rotulo="Tempo até aceitar (mediana)" valor={minutos(k.sla.medianaMin)} barra={k.sla.ate5minPct ?? 0}
                  nota={k.sla.distribuidos ? `${pct(k.sla.ate5minPct, 0)} aceitos em até 5 min · ${inteiro(k.sla.naoAceitos)} sem aceite` : 'sem leads distribuídos no período'} />
              </>
            ) : (
              <Kpi rotulo="Canceladas no período" valor={inteiro(k.canceladas?.qtd || 0)} barra={0.2} nota={formatCurrencyShort(k.canceladas?.valor || 0)} />
            )}
          </div>

          {/* ── gráfico + meta e alertas ── */}
          <div className="dg-linha dg-linha--2-1">
            <section className="dg-card dg-card--chart">
              <div className="dg-card-topo">
                <h2 className="dg-card-titulo">VGV {data.kpis.leads ? 'e leads ' : ''}{p.granularidade === 'dia' ? 'por dia' : 'por mês'}</h2>
                <span className="dg-card-nota">barras: VGV vendido{data.kpis.leads ? ' · linha: leads recebidos' : ''}</span>
              </div>
              <div style={{ height: tv ? 340 : 280 }}><canvas ref={canvasRef} /></div>
            </section>
            <div className="dg-principal">
              <section className="dg-card">
                <div className="dg-card-topo"><h2 className="dg-card-titulo">Meta do período</h2></div>
                {data.meta ? (
                  <>
                    <div className="dg-meta-pct">{pct(data.meta.pct, 0)}</div>
                    <div className="dg-trilho" style={{ margin: '8px 0 10px' }}>
                      <span style={{ width: `${Math.min(100, data.meta.pct * 100)}%` }} />
                      {data.meta.esperadoAteHoje ? <em style={{ left: `${Math.min(100, (data.meta.esperadoAteHoje / data.meta.valor) * 100)}%` }} title="Onde deveria estar hoje" /> : null}
                    </div>
                    <div className="dg-card-nota">
                      {formatCurrencyShort(data.meta.realizado)} de {formatCurrencyShort(data.meta.valor)}
                      {data.meta.esperadoAteHoje ? ` · esperado até hoje ${formatCurrencyShort(data.meta.esperadoAteHoje)}` : ''}
                    </div>
                    {data.meta.noRitmo != null && (
                      <div style={{ marginTop: 8 }}><span className={`dg-var ${data.meta.noRitmo ? 'dg-var--ok' : 'dg-var--ruim'}`}>{data.meta.noRitmo ? 'No ritmo da meta' : 'Abaixo do ritmo da meta'}</span></div>
                    )}
                  </>
                ) : (
                  <div className="dg-card-nota" style={{ lineHeight: 1.5 }}>
                    Nenhuma equipe tem meta de VGV cadastrada para esse recorte. Cadastre a meta mensal de cada equipe em <Link to="/equipes" style={{ color: 'var(--dg-ciano)' }}>Equipes</Link> para acompanhar aqui.
                  </div>
                )}
              </section>
              <section className="dg-card">
                <div className="dg-card-topo"><h2 className="dg-card-titulo">Alertas da operação</h2><span className="dg-card-nota">agora</span></div>
                {(data.alertas || []).length === 0 && <div className="dg-vazio">Nenhum alerta agora.</div>}
                {(data.alertas || []).map((a: any, i: number) => (
                  <Link key={i} to={a.href || '#'} className={`dg-alerta dg-alerta--${a.tipo}`}>
                    <span className="dg-alerta-ic">!</span>
                    <div>
                      <div className="dg-alerta-tit">{a.titulo}</div>
                      {a.valor ? <div className="dg-alerta-val">{formatCurrencyShort(a.valor)} em jogo</div> : null}
                    </div>
                  </Link>
                ))}
              </section>
            </div>
          </div>

          {/* ── funil + contratos ── */}
          <div className="dg-linha dg-linha--1-1">
            {data.funil && (
              <section className="dg-card">
                <div className="dg-card-topo">
                  <h2 className="dg-card-titulo">Funil dos leads do período</h2>
                  <span className="dg-card-nota">{inteiro(data.funil.perdidos)} perdido(s){data.funil.semPerfil ? ` · ${inteiro(data.funil.semPerfil)} sem perfil` : ''}</span>
                </div>
                {data.funil.total === 0 ? <div className="dg-vazio">Nenhum lead recebido no período.</div> : data.funil.etapas.map((e: any) => (
                  <div key={e.etapa} className="dg-barra-linha">
                    <span className="dg-barra-nome" title={e.etapa}>{e.etapa}</span>
                    <span className="dg-barra"><span style={{ width: `${e.pctTopo * 100}%` }} />{e.pctTopo >= 0.12 && <b>{pct(e.pctTopo, 0)}</b>}</span>
                    <span className="dg-barra-num">{inteiro(e.count)}</span>
                  </div>
                ))}
              </section>
            )}
            <section className="dg-card">
              <div className="dg-card-topo">
                <h2 className="dg-card-titulo">Contratos das vendas do período</h2>
                {k.canceladas?.qtd ? <span className="dg-card-nota">{k.canceladas.qtd} cancelada(s) · {formatCurrencyShort(k.canceladas.valor)}</span> : null}
              </div>
              {(data.contratos || []).length === 0 ? <div className="dg-vazio">Nenhuma venda no período.</div> : data.contratos.map((c: any) => (
                <div key={c.status} className="dg-barra-linha">
                  <span className="dg-barra-nome" title={c.rotulo}>{c.rotulo}</span>
                  <span className="dg-barra"><span style={{ width: `${(c.valor / maxContrato) * 100}%` }} /></span>
                  <span className="dg-barra-num">{c.qtd} · {formatCurrencyShort(c.valor)}</span>
                </div>
              ))}
            </section>
          </div>

          {/* ── rankings ── */}
          <div className="dg-linha dg-linha--2-1">
            <section className="dg-card">
              <div className="dg-card-topo"><h2 className="dg-card-titulo">Ranking de corretores</h2><span className="dg-card-nota">por VGV do período</span></div>
              {(data.rankingCorretores || []).length === 0 ? <div className="dg-vazio">Nenhuma venda de corretor ativo no período.</div> : (
                <div className="dg-tab-wrap"><table className="dg-tab" style={{ minWidth: 420 }}>
                  <thead><tr><th style={{ width: 40 }}>#</th><th>Corretor</th><th className="n" style={{ width: 92 }}>VGV</th><th className="n" style={{ width: 62 }}>Vendas</th>{k.leads && <th className="n" style={{ width: 58 }}>Leads</th>}</tr></thead>
                  <tbody>
                    {data.rankingCorretores.map((c: any, i: number) => (
                      <tr key={c.id}>
                        <td><span className={`dg-pos${i < 3 ? ` dg-pos--${i + 1}` : ''}`}>{i + 1}</span></td>
                        <td>
                          <div className="dg-pessoa">
                            <Avatar nome={c.nome} initials={c.initials} url={c.avatarUrl} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div className="dg-pessoa-nome">{c.nome}</div>
                              <div className="dg-pessoa-sub">{c.equipe || 'Sem equipe'}</div>
                              <div className="dg-mini"><span style={{ width: `${topoVgv ? (c.vgv / topoVgv) * 100 : 0}%` }} /></div>
                            </div>
                          </div>
                        </td>
                        <td className="n" title={formatCurrency(c.vgv)}><strong>{formatCurrencyShort(c.vgv)}</strong></td>
                        <td className="n">{c.vendas}</td>
                        {k.leads && <td className="n">{inteiro(c.leads)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </section>
            <section className="dg-card">
              <div className="dg-card-topo"><h2 className="dg-card-titulo">Equipes</h2><span className="dg-card-nota">VGV do período</span></div>
              {(data.rankingEquipes || []).length === 0 ? <div className="dg-vazio">Nenhuma venda ou lead nas equipes no período.</div> : data.rankingEquipes.map((e: any) => (
                <div key={e.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                    <span className="dg-pessoa-nome" title={e.nome}>{e.nome}</span>
                    <strong className="dg-forte" title={formatCurrency(e.vgv)}>{formatCurrencyShort(e.vgv)}</strong>
                  </div>
                  <div className="dg-pessoa-sub">
                    {e.vendas} venda(s){k.leads ? ` · ${inteiro(e.leads)} lead(s)` : ''} · {e.corretores} corretor(es) ativo(s)
                    {e.meta ? ` · ${pct(e.vgv / e.meta, 0)} da meta` : ''}
                  </div>
                  <div className="dg-mini"><span style={{ width: `${topoEq ? (e.vgv / topoEq) * 100 : 0}%` }} /></div>
                </div>
              ))}
            </section>
          </div>

          {/* ── empreendimentos + origem/campanha ── */}
          <div className="dg-linha dg-linha--1-1">
            <section className="dg-card">
              <div className="dg-card-topo"><h2 className="dg-card-titulo">Empreendimentos</h2><span className="dg-card-nota">VGV vendido no período</span></div>
              {(data.empreendimentos || []).length === 0 ? <div className="dg-vazio">Nenhuma venda no período.</div> : data.empreendimentos.map((e: any) => (
                <div key={e.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                    <span className="dg-pessoa-nome" title={e.nome}>{e.nome}</span>
                    <strong className="dg-forte" title={formatCurrency(e.vgv)}>{formatCurrencyShort(e.vgv)}</strong>
                  </div>
                  <div className="dg-pessoa-sub">{[e.construtora, e.cidade ? `${e.cidade}${e.estado ? '/' + e.estado : ''}` : null, `${e.vendas} venda(s)`].filter(Boolean).join(' · ')}</div>
                  <div className="dg-mini"><span style={{ width: `${topoEmp ? (e.vgv / topoEmp) * 100 : 0}%` }} /></div>
                </div>
              ))}
            </section>
            {k.leads && (
              <section className="dg-card">
                <div className="dg-card-topo">
                  <h2 className="dg-card-titulo">De onde vêm as vendas</h2>
                  <div className="dg-abas">
                    <button className={`dg-aba${abaOrigem === 'origem' ? ' dg-aba--on' : ''}`} onClick={() => setAbaOrigem('origem')}>Origem</button>
                    <button className={`dg-aba${abaOrigem === 'campanha' ? ' dg-aba--on' : ''}`} onClick={() => setAbaOrigem('campanha')}>Campanha</button>
                  </div>
                </div>
                {(linhasOrigem || []).length === 0 ? <div className="dg-vazio">Nenhum lead recebido no período.</div> : (
                  <div className="dg-tab-wrap"><table className="dg-tab" style={{ minWidth: 380 }}>
                    <thead><tr><th>{abaOrigem === 'origem' ? 'Origem' : 'Campanha'}</th><th className="n" style={{ width: 58 }}>Leads</th><th className="n" style={{ width: 58 }}>Vendas</th><th className="n" style={{ width: 58 }}>Conv.</th><th className="n" style={{ width: 80 }}>VGV</th></tr></thead>
                    <tbody>
                      {linhasOrigem.map((o: any) => (
                        <tr key={o.origem || o.campanha}>
                          <td><div className="dg-pessoa-nome" style={{ maxWidth: 220 }} title={o.rotulo || o.campanha}>{o.rotulo || o.campanha}</div></td>
                          <td className="n">{inteiro(o.leads)}</td>
                          <td className="n">{o.vendas}</td>
                          <td className="n">{pct(o.conversao)}</td>
                          <td className="n" title={formatCurrency(o.vgv)}>{formatCurrencyShort(o.vgv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
