import { useEffect, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { StatGlow } from '../components/StatGlow';
import { Api } from '../lib/api';
import { formatNome } from '../lib/format';
import './inteligencia-leads.css';

// Painel de Inteligência de Leads — para o marketing decidir onde investir.
// Macro + por origem + Pons×Parceiros + funil + por equipe/corretor + remarketing.
// Filtros: período, equipe (unidade) e corretor. Tudo sobre dado real do banco.

type Bucket = {
  key: string; label: string; total: number; abordados: number;
  responderam: number; negociando: number; fechados: number;
  conversao: number; taxaResposta: number;
};
type Intel = {
  macro: {
    totalBase: number; abordados: number; abordadosPct: number; responderam: number;
    taxaResposta: number; negociando: number; negociandoPct: number; fechados: number;
    conversao: number; semContato: number; tabulados: number; mediaContatos: number;
  };
  porOrigem: Bucket[]; porGrupo: Bucket[]; porFunil: Bucket[];
  porEquipe: Bucket[]; porCorretor: Bucket[];
  remarketing: { total: number; descricao: string };
  serie: { dia: string; novos: number }[];
  mapaConfigurado: boolean;
};

const PALETTE = ['#0E7C9B', '#88C559', '#F2B544', '#3FB6D4', '#263654', '#C70A1A', '#8493B4', '#9B59B6'];
const COR_FUNIL: Record<string, string> = {
  NOVO: '#8493B4', SDR: '#3FB6D4', EM_ATENDIMENTO: '#0E7C9B', NEGOCIANDO: '#F2B544',
  PROPOSTA: '#E08e1a', FECHADO: '#88C559', VENDIDO: '#88C559', GANHO: '#88C559',
  PERDIDO: '#C70A1A', DESCARTADO: '#9aa3b2',
};

function presetPeriodo(p: string): { de: string | null; ate: string | null } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) => d.toISOString();
  if (p === 'mes') return { de: iso(new Date(y, m, 1)), ate: iso(now) };
  if (p === 'mespassado') return { de: iso(new Date(y, m - 1, 1)), ate: iso(new Date(y, m, 0, 23, 59, 59)) };
  if (p === 'tri') return { de: iso(new Date(y, m - 2, 1)), ate: iso(now) };
  if (p === 'ano') return { de: iso(new Date(y, 0, 1)), ate: iso(now) };
  return { de: null, ate: null };
}

const n = (v: number) => (v ?? 0).toLocaleString('pt-BR');

// KPI no padrão DASH KIT (stat-glow) — ícone + accent + brilho no hover.
function Kpi({ label, value, sub, accent, icon }: { label: string; value: React.ReactNode; sub?: string; accent?: string; icon?: string }) {
  return <StatGlow icon={icon} label={label} value={value} sub={sub} accent={accent} />;
}

function BarList({ items }: { items: { label: string; value: number; extra?: string; cor?: string }[] }) {
  if (!items.length) return <div className="il-empty">Sem dados no período.</div>;
  const mx = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="il-bars">
      {items.map((it, i) => (
        <div className="il-bar" key={it.label + i}>
          <div className="il-bar__head">
            <span className="il-bar__label" title={it.label}>{it.label}</span>
            <span className="il-bar__val">{n(it.value)}{it.extra ? ` · ${it.extra}` : ''}</span>
          </div>
          <div className="il-bar__track">
            <div className="il-bar__fill" style={{ width: `${Math.round((it.value / mx) * 100)}%`, background: it.cor || PALETTE[i % PALETTE.length], color: it.cor || PALETTE[i % PALETTE.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Sparkline({ serie }: { serie: { dia: string; novos: number }[] }) {
  if (!serie.length) return <div className="il-empty">Sem dados no período.</div>;
  const w = 640, h = 130, pad = 8;
  const max = Math.max(1, ...serie.map((s) => s.novos));
  const denom = Math.max(1, serie.length - 1);
  const pts = serie.map((s, i) => {
    const x = pad + (i / denom) * (w - 2 * pad);
    const yy = h - pad - (s.novos / max) * (h - 2 * pad);
    return [x, yy] as [number, number];
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pad.toFixed(1)},${h - pad} Z`;
  return (
    <svg className="il-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Novos leads por dia">
      <path d={area} fill="rgba(14,124,155,.12)" />
      <path d={line} fill="none" stroke="#0E7C9B" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function TabelaBuckets({ rows, primeira }: { rows: Bucket[]; primeira: string }) {
  if (!rows.length) return <div className="il-empty">Sem dados no período.</div>;
  return (
    <div className="il-tablewrap">
      <table className="il-table">
        <thead>
          <tr>
            <th>{primeira}</th><th>Total</th><th>Abordados</th><th>Resp.</th><th>Negociando</th><th>Fechados</th><th>Conversão</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="il-table__name" title={r.label}>{r.label}</td>
              <td>{n(r.total)}</td>
              <td>{n(r.abordados)}</td>
              <td>{r.taxaResposta}%</td>
              <td>{n(r.negociando)}</td>
              <td>{n(r.fechados)}</td>
              <td><strong>{r.conversao}%</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InteligenciaLeads() {
  const [periodo, setPeriodo] = useState('mes');
  const [unidadeId, setUnidadeId] = useState('');
  const [corretorId, setCorretorId] = useState('');
  const [unidades, setUnidades] = useState<any[]>([]);
  const [corretores, setCorretores] = useState<any[]>([]);
  const [data, setData] = useState<Intel | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Api.unidadesList().then((u) => setUnidades(Array.isArray(u) ? u : [])).catch(() => {});
    Api.corretores().then((c) => setCorretores(Array.isArray(c) ? c : [])).catch(() => {});
  }, []);

  useEffect(() => {
    let vivo = true;
    setLoading(true); setErro('');
    const { de, ate } = presetPeriodo(periodo);
    const params: Record<string, string> = {};
    if (de) params.de = de;
    if (ate) params.ate = ate;
    if (unidadeId) params.unidadeId = unidadeId;
    if (corretorId) params.corretorId = corretorId;
    Api.inteligenciaLeads(params)
      .then((d: Intel) => { if (vivo) setData(d); })
      .catch((e: any) => { if (vivo) setErro(e?.message || 'Não foi possível carregar os indicadores.'); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [periodo, unidadeId, corretorId]);

  const m = data?.macro;

  return (
    <>
      <Topbar title="Inteligência de Leads" />
      <div className="il">
        <PageHeader
          breadcrumb="Marketing"
          title="Inteligência de Leads"
          subtitle="O que acontece com cada lead — da base importada à venda. Use os filtros para ver por período, equipe ou corretor."
        />

        {/* Filtros */}
        <div className="il-filtros">
          <label className="il-filtro">
            <span>Período</span>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              <option value="mes">Este mês</option>
              <option value="mespassado">Mês passado</option>
              <option value="tri">Último trimestre</option>
              <option value="ano">Este ano</option>
              <option value="tudo">Toda a base</option>
            </select>
          </label>
          <label className="il-filtro">
            <span>Equipe</span>
            <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
              <option value="">Todas as equipes</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
          <label className="il-filtro">
            <span>Corretor</span>
            <select value={corretorId} onChange={(e) => setCorretorId(e.target.value)}>
              <option value="">Todos os corretores</option>
              {corretores.map((c) => <option key={c.id} value={c.id}>{formatNome(c.nome || c.user?.name) || `Corretor ${c.id}`}</option>)}
            </select>
          </label>
        </div>

        {loading && <div className="il-loading">Carregando indicadores…</div>}
        {erro && !loading && <div className="il-erro">{erro}</div>}

        {!loading && !erro && m && (
          <>
            {/* KPIs macro */}
            <div className="dash-grid" style={{ marginBottom: 14 }}>
              <Kpi icon="database" label="Base total no período" value={n(m.totalBase)} sub={`${n(m.tabulados)} já tabulados`} />
              <Kpi icon="whatsapp" label="Abordados no WhatsApp" value={n(m.abordados)} sub={`${m.abordadosPct}% da base`} accent="#0E7C9B" />
              <Kpi icon="chat" label="Taxa de resposta" value={`${m.taxaResposta}%`} sub={`${n(m.responderam)} responderam`} accent="#3FB6D4" />
              <Kpi icon="fire" label="Em negociação" value={n(m.negociando)} sub={`${m.negociandoPct}% da base`} accent="#F2B544" />
              <Kpi icon="target" label="Conversão (fechados)" value={`${m.conversao}%`} sub={`${n(m.fechados)} fechados`} accent="#88C559" />
              <Kpi icon="megafone" label="Remarketing" value={n(data!.remarketing.total)} sub="Anúncio sem resposta" accent="#C70A1A" />
            </div>

            {/* Pons × Parceiros + Origem */}
            <div className="il-grid2">
              <section className="il-card">
                <h3>Tráfego: Pons × Parceiros</h3>
                {data!.mapaConfigurado ? (
                  <BarList items={data!.porGrupo.map((g, i) => ({ label: g.label, value: g.total, extra: `${g.conversao}% conv.`, cor: PALETTE[i % PALETTE.length] }))} />
                ) : (
                  <div className="il-hint">
                    Recorte ainda não configurado. Defina quais origens/campanhas são <b>Tráfego Pons</b> e quais são <b>Parceiros</b> para liberar esta visão.
                    <span className="il-hint__tag">configurável</span>
                  </div>
                )}
              </section>
              <section className="il-card">
                <h3>Por origem do lead</h3>
                <BarList items={data!.porOrigem.map((o) => ({ label: o.label, value: o.total, extra: `${o.conversao}% conv.` }))} />
              </section>
            </div>

            {/* Funil + Série */}
            <div className="il-grid2">
              <section className="il-card">
                <h3>Funil — etapas dos leads</h3>
                <BarList items={data!.porFunil.map((f) => ({ label: f.label, value: f.total, cor: COR_FUNIL[f.key] || '#0E7C9B' }))} />
              </section>
              <section className="il-card">
                <h3>Novos leads por dia</h3>
                <Sparkline serie={data!.serie} />
                <div className="il-spark__foot">
                  <span>{data!.serie[0]?.dia?.split('-').reverse().join('/') || '—'}</span>
                  <span>Média de {m.mediaContatos} contatos por lead abordado</span>
                  <span>{data!.serie[data!.serie.length - 1]?.dia?.split('-').reverse().join('/') || '—'}</span>
                </div>
              </section>
            </div>

            {/* Por equipe */}
            <section className="il-card">
              <h3>Desempenho por equipe</h3>
              <TabelaBuckets rows={data!.porEquipe} primeira="Equipe / Unidade" />
            </section>

            {/* Por corretor */}
            <section className="il-card">
              <h3>Desempenho por corretor</h3>
              <TabelaBuckets rows={data!.porCorretor.map((r) => ({ ...r, label: formatNome(r.label) }))} primeira="Corretor" />
            </section>
          </>
        )}
      </div>
    </>
  );
}
