import { Link } from 'react-router-dom';
import { formatCurrencyShort } from '../lib/format';
import { IaMark } from './IaMark';
import './pitwall.css';

/**
 * Pit wall — a mesa de comando do mês.
 * Cada bloco responde a uma pergunta que o executivo faz:
 *  - Vou bater a meta?        -> Briefing + A corrida do mês
 *  - O que custa dinheiro?    -> Quadro do pit (alertas por R$ em risco)
 *  - Estou melhor que antes?  -> Telemetria (variação vs mês anterior)
 *  - Onde eu perco?           -> Setores do funil
 *  - Por que demora?          -> Esteira do contrato
 *  - Qual canal paga?         -> Origem
 */

type Metrica = { atual: number; anterior: number; variacao: number | null };

export type Decisao = {
  conversao: Metrica;
  ticketMedio: Metrica;
  volume: Metrica;
  contratos: Metrica;
  leads: Metrica;
  cicloMedioDias: number | null;
  funil: Array<{ etapa: string; count: number; pctTopo: number; conversaoEtapa: number }>;
  origem: Array<{ origem: string; leads: number; vendas: number; vgv: number; conversao: number }>;
  pipelineFinanceiro: {
    emAnalise: { qtd: number; valor: number };
    emAssinatura: { qtd: number; valor: number };
  };
  ritmo?: {
    dias: Array<{ dia: number; acumulado: number | null }>;
    diasNoMes: number;
    diaAtual: number;
    realizado: number;
    projecao: number;
    mediaHistorica: number;
    melhorMes: number;
    metaSaude: {
      metaCasa: number;
      melhorMes: number;
      mediaHistorica: number;
      razaoMelhorMes: number | null;
      implausivel: boolean;
    };
  };
  esteira?: { amostra: number; criacaoAprovacao: number | null; aprovacaoAssinatura: number | null; total: number | null };
  sla?: { horas: number | null; amostra: number };
  serie30d?: Array<{ dia: string; contratos: number; vgv: number }>;
};

export type Alerta = { tipo: string; titulo: string; valor?: number | null; acao?: string | null; href?: string | null };

type Avanco = { realizadoMes: number; metaCasa: number; temMeta: boolean; diaAtual: number; diasNoMes: number };

const pct = (v: number, casas = 1) => `${(v * 100).toFixed(casas).replace('.', ',')}%`;

// Rótulos de canal: o banco guarda META_ADS, INDICACAO… mas o executivo lê "Meta Ads".
const ORIGEM_LABEL: Record<string, string> = {
  META_ADS: 'Meta Ads',
  INDICACAO: 'Indicação',
  INSTAGRAM: 'Instagram',
  WHATSAPP: 'WhatsApp',
  SITE: 'Site',
  MANUAL: 'Cadastro manual',
  IMPORTACAO: 'Importação',
  OUTRO: 'Outro',
};
const labelOrigem = (o: string) =>
  ORIGEM_LABEL[o] || o.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/** Horas -> "3h12" ou "2,1 d" quando passa de um dia. */
function fmtHoras(h: number) {
  if (h >= 24) return `${(h / 24).toFixed(1).replace('.', ',')} d`;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h${String(mm).padStart(2, '0')}`;
}

/** Seta + variação vs mês anterior. `inverso` = cair é bom (ex.: ciclo de venda). */
function Trend({ v, inverso = false }: { v: number | null; inverso?: boolean }) {
  if (v == null || !isFinite(v)) {
    return <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>sem base anterior</span>;
  }
  const subiu = v >= 0;
  const bom = inverso ? !subiu : subiu;
  const cor = v === 0 ? 'var(--text-secondary)' : bom ? 'var(--color-success)' : 'var(--color-danger)';
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, color: cor }}>
      {v === 0 ? '—' : subiu ? '▲' : '▼'} {pct(Math.abs(v), 0)}
      <span style={{ fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 4 }}>vs mês ant.</span>
    </span>
  );
}

/** Sparkline de 30 dias. Só desenha se houver algum valor > 0. */
function Spark({ pontos, cor }: { pontos: number[]; cor: string }) {
  const max = Math.max(...pontos, 0);
  if (!pontos.length || max <= 0) return <div style={{ height: 26 }} />;
  const passo = 100 / Math.max(pontos.length - 1, 1);
  const d = pontos.map((p, i) => `${(i * passo).toFixed(1)},${(24 - (p / max) * 20).toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 100 26" preserveAspectRatio="none" style={{ width: '100%', height: 26, marginTop: 6 }} aria-hidden="true">
      <polyline points={d} fill="none" stroke={cor} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Celula({ label, valor, children }: { label: string; valor: string; children?: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, fontStyle: 'italic', margin: '5px 0 3px' }}>{valor}</div>
      {children}
    </div>
  );
}

/* ============================ A CORRIDA DO MÊS ============================ */
function RaceChart({ ritmo }: { ritmo: NonNullable<Decisao['ritmo']> }) {
  const { dias, diasNoMes, diaAtual, realizado, projecao, mediaHistorica } = ritmo;
  const W = 620, H = 190, L = 52, R = 14, T = 16, B = 30;

  // A meta fica FORA da escala quando é implausível — senão a curva do realizado some.
  const topo = Math.max(projecao, mediaHistorica, realizado) * 1.18 || 1;
  const x = (dia: number) => L + ((dia - 1) / (diasNoMes - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / topo) * (H - T - B);

  const realizados = dias.filter((d) => d.acumulado != null) as Array<{ dia: number; acumulado: number }>;
  const linhaReal = realizados.map((d) => `${x(d.dia)},${y(d.acumulado)}`).join(' ');
  const linhaProj = `${x(diaAtual)},${y(realizado)} ${x(diasNoMes)},${y(projecao)}`;
  // ritmo da média histórica, pro-rata dia a dia
  const linhaHist = `${x(1)},${y(0)} ${x(diasNoMes)},${y(mediaHistorica)}`;

  const gap = mediaHistorica > 0
    ? `M ${x(1)},${y(0)} L ${x(diasNoMes)},${y(mediaHistorica)} L ${x(diasNoMes)},${y(projecao)} L ${x(diaAtual)},${y(realizado)} Z`
    : '';

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * topo);
  const fmtTick = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : '0');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 190 }} role="img" aria-label="Ritmo acumulado do mês">
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--border-light)" strokeWidth={1} />
          <text x={L - 8} y={y(v) + 3.5} fontSize={9.5} fill="var(--text-secondary)" textAnchor="end">{fmtTick(v)}</text>
        </g>
      ))}
      {gap && mediaHistorica > projecao && <path d={gap} fill="var(--color-danger)" opacity={0.1} />}
      {mediaHistorica > 0 && (
        <polyline points={linhaHist} fill="none" stroke="var(--color-success)" strokeWidth={2} strokeDasharray="6 4" />
      )}
      <polyline points={linhaProj} fill="none" stroke="var(--pons-blue)" strokeWidth={2} strokeDasharray="3 4" opacity={0.55} />
      {realizados.length > 1 && <polyline points={linhaReal} fill="none" stroke="var(--pons-blue)" strokeWidth={2.6} />}
      <circle cx={x(diaAtual)} cy={y(realizado)} r={4} fill="var(--pons-blue)" />
      <text x={x(diaAtual) + 8} y={y(realizado) - 6} fontSize={10.5} fontWeight={700} fill="var(--pons-blue)">
        hoje · {formatCurrencyShort(realizado)}
      </text>
      <text x={W - R} y={y(projecao) - 7} fontSize={10} fill="var(--text-secondary)" textAnchor="end">projeção</text>
      <text x={L} y={H - 8} fontSize={9.5} fill="var(--text-secondary)">dia 1</text>
      <text x={x(diaAtual)} y={H - 8} fontSize={9.5} fill="var(--text-secondary)" textAnchor="middle">{diaAtual}</text>
      <text x={W - R} y={H - 8} fontSize={9.5} fill="var(--text-secondary)" textAnchor="end">{diasNoMes}</text>
    </svg>
  );
}

/* ================================ BRIEFING ================================ */
function Briefing({ d, a }: { d: Decisao; a?: Avanco }) {
  const r = d.ritmo;
  const proj = r?.projecao ?? (a && a.diaAtual ? (a.realizadoMes / a.diaAtual) * a.diasNoMes : null);
  const vsHist = r && r.mediaHistorica > 0 && proj != null ? proj / r.mediaHistorica : null;
  const pctMeta = proj != null && a?.metaCasa ? proj / a.metaCasa : null;

  const vazamento = d.funil.slice(1).reduce<{ etapa: string; conversaoEtapa: number } | null>(
    (pior, e) => (!pior || e.conversaoEtapa < pior.conversaoEtapa ? e : pior), null);
  const preso = d.pipelineFinanceiro.emAnalise.valor + d.pipelineFinanceiro.emAssinatura.valor;

  return (
    <div className="card mb-6 pitwall">
      <div className="pitwall__top">
        <IaMark size={20} />
        <span className="pitwall__eyebrow">Briefing do mês</span>
        {r && <span className="pitwall__stamp">Volta {r.diaAtual} de {r.diasNoMes}</span>}
      </div>

      <p className="pitwall__line">
        {proj != null ? (
          <>
            No ritmo atual, o mês fecha em <b>{formatCurrencyShort(proj)}</b>
            {vsHist != null && (
              <> — <em className={vsHist >= 1 ? 'pos' : 'neg'}>{vsHist.toFixed(1).replace('.', ',')}×</em> a média dos últimos meses</>
            )}
            {pctMeta != null && (
              <>, mas <em className="neg">{pct(pctMeta, 1)}</em> da meta cadastrada</>
            )}.
          </>
        ) : (
          <>Ainda sem vendas suficientes no mês para projetar o fechamento.</>
        )}
        <br />
        {vazamento && vazamento.conversaoEtapa < 1 && (
          <>Seu maior gargalo é <b>{vazamento.etapa}</b> ({pct(vazamento.conversaoEtapa, 1)})</>
        )}
        {preso > 0 && (
          <>{vazamento ? ', e ' : ''}<b>{formatCurrencyShort(preso)}</b> estão vendidos e ainda não assinados.</>
        )}
      </p>

      {r?.metaSaude.implausivel && (
        <p className="pitwall__warn">
          A meta cadastrada ({formatCurrencyShort(r.metaSaude.metaCasa)}) é{' '}
          <b>{r.metaSaude.razaoMelhorMes?.toFixed(0)}× o melhor mês já realizado</b> ({formatCurrencyShort(r.metaSaude.melhorMes)}).
          Ela é a soma da meta individual de todos os corretores ativos — enquanto estiver assim, o “% da meta” não é um indicador útil.
        </p>
      )}
    </div>
  );
}

/* ============================== QUADRO DO PIT ============================== */
const DOT: Record<string, string> = {
  danger: 'var(--color-danger)',
  warning: 'var(--color-warning, #F2B544)',
  info: 'var(--pons-blue)',
  success: 'var(--color-success)',
};

function PitBoard({ alertas }: { alertas: Alerta[] }) {
  const ord = [...alertas].sort((a, b) => (b.valor || 0) - (a.valor || 0));
  return (
    <div className="card chart-card">
      <div className="card__header">
        <h3 className="card__title">Quadro do pit</h3>
        <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>o que custa dinheiro agora</span>
      </div>
      <div>
        {ord.map((al, i) => {
          const inner = (
            <>
              <span style={{ width: 8, height: 8, borderRadius: '50%', flex: '0 0 8px', background: DOT[al.tipo] || DOT.info }} />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{al.titulo}</span>
              {al.valor ? (
                <span style={{ fontWeight: 900, fontStyle: 'italic', fontSize: 15, whiteSpace: 'nowrap' }}>
                  {formatCurrencyShort(al.valor)}
                </span>
              ) : (
                <span style={{ color: 'var(--text-secondary)' }}>—</span>
              )}
              {al.acao && (
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pons-blue)', whiteSpace: 'nowrap' }}>{al.acao} →</span>
              )}
            </>
          );
          const style: React.CSSProperties = {
            display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0',
            borderTop: i === 0 ? 'none' : '1px solid var(--border-light)',
            textDecoration: 'none', color: 'inherit',
          };
          return al.href ? (
            <Link key={i} to={al.href} style={{ ...style, cursor: 'pointer' }}>{inner}</Link>
          ) : (
            <div key={i} style={style}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================ COMPONENTE ============================== */
export function DashboardDecisao({
  decisao: d,
  avanco: a,
  alertas = [],
}: {
  decisao: Decisao;
  avanco?: Avanco;
  alertas?: Alerta[];
}) {
  const r = d.ritmo;
  const serie = d.serie30d || [];
  const vazamento = d.funil.slice(1).reduce<{ etapa: string; conversaoEtapa: number } | null>(
    (pior, e) => (!pior || e.conversaoEtapa < pior.conversaoEtapa ? e : pior), null);

  const presoValor = d.pipelineFinanceiro.emAnalise.valor + d.pipelineFinanceiro.emAssinatura.valor;
  const presoQtd = d.pipelineFinanceiro.emAnalise.qtd + d.pipelineFinanceiro.emAssinatura.qtd;
  const es = d.esteira;

  return (
    <>
      <Briefing d={d} a={a} />

      {/* ---------- A corrida do mês + quadro do pit ---------- */}
      <div className="grid-2-1 mb-6">
        {r ? (
          <div className="card chart-card">
            <div className="card__header">
              <h3 className="card__title">A corrida do mês</h3>
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', gap: 16 }}>
                <span><i style={{ display: 'inline-block', width: 12, height: 2, background: 'var(--pons-blue)', verticalAlign: 'middle', marginRight: 5 }} />realizado</span>
                <span><i style={{ display: 'inline-block', width: 12, height: 2, background: 'var(--color-success)', verticalAlign: 'middle', marginRight: 5 }} />ritmo da média</span>
              </span>
            </div>
            <RaceChart ritmo={r} />
          </div>
        ) : (
          <div className="card chart-card">
            <div className="card__header"><h3 className="card__title">A corrida do mês</h3></div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sem histórico suficiente para desenhar o ritmo.</p>
          </div>
        )}

        {alertas.length > 0 ? <PitBoard alertas={alertas} /> : (
          <div className="card chart-card">
            <div className="card__header"><h3 className="card__title">Quadro do pit</h3></div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum gargalo no funil.</p>
          </div>
        )}
      </div>

      {/* ---------- Telemetria ---------- */}
      <div className="card mb-6">
        <div className="card__header">
          <h3 className="card__title">Telemetria</h3>
          <span className="uppercase-tag">mês corrente</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: 24 }}>
          <Celula label="Conversão lead → venda" valor={pct(d.conversao.atual, 2)}>
            <Trend v={d.conversao.variacao} />
          </Celula>

          <Celula label="Ticket médio" valor={formatCurrencyShort(d.ticketMedio.atual)}>
            <Trend v={d.ticketMedio.variacao} />
            <Spark pontos={serie.map((s) => s.vgv)} cor="var(--pons-blue)" />
          </Celula>

          <Celula label="Contratos" valor={d.contratos.atual.toLocaleString('pt-BR')}>
            <Trend v={d.contratos.variacao} />
            <Spark pontos={serie.map((s) => s.contratos)} cor="var(--pons-blue)" />
          </Celula>

          <Celula label="Ciclo médio" valor={d.cicloMedioDias != null ? `${d.cicloMedioDias} dias` : '—'}>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              {d.cicloMedioDias != null ? 'da entrada do lead ao contrato' : 'sem vendas com lead no mês'}
            </span>
          </Celula>

          <Celula label="SLA 1º contato" valor={d.sla?.horas != null ? fmtHoras(d.sla.horas) : '—'}>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              {d.sla?.horas != null ? `${d.sla.amostra.toLocaleString('pt-BR')} leads · 30 d` : 'sem leads distribuídos com resposta'}
            </span>
          </Celula>

          <Celula label="Leads captados" valor={d.leads.atual.toLocaleString('pt-BR')}>
            <Trend v={d.leads.variacao} />
          </Celula>
        </div>
      </div>

      {/* ---------- Setores do funil + esteira ---------- */}
      <div className="row-2 mb-6" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card chart-card">
          <div className="card__header">
            <h3 className="card__title">Setores do funil</h3>
            {vazamento && vazamento.conversaoEtapa < 1 && (
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                maior perda em <b style={{ color: 'var(--color-danger)' }}>{vazamento.etapa}</b>
              </span>
            )}
          </div>
          {d.funil[0]?.count ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {d.funil.map((e, i) => {
                const pior = vazamento?.etapa === e.etapa && e.conversaoEtapa < 1;
                return (
                  <div key={e.etapa}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{e.etapa}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {e.count.toLocaleString('pt-BR')}
                        {i > 0 && (
                          <b style={{ marginLeft: 8, color: pior ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                            {pct(e.conversaoEtapa, 1)}
                          </b>
                        )}
                      </span>
                    </div>
                    <div className="progress" style={{ height: 8 }}>
                      <div
                        className="progress__fill"
                        style={{
                          width: `${Math.max(e.pctTopo * 100, e.count > 0 ? 1.5 : 0)}%`,
                          background: pior ? 'var(--color-danger)' : undefined,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum lead captado neste mês ainda.</p>
          )}
        </div>

        <div className="card chart-card">
          <div className="card__header">
            <h3 className="card__title">Esteira do contrato</h3>
            {es && es.amostra > 0 && (
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{es.amostra} assinados · 90 d</span>
            )}
          </div>

          {es && es.amostra > 0 && es.total != null ? (
            <>
              <div style={{ display: 'flex', textAlign: 'center', marginBottom: 12 }}>
                <Perna dias={es.criacaoAprovacao} nome="Venda → aprovação" />
                <Perna dias={es.aprovacaoAssinatura} nome="Aprovação → assinatura" />
                <Perna dias={es.total} nome="Total até assinar" destaque />
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Da criação do contrato até a assinatura do cliente. Ajuda a separar o que é gargalo comercial do que é
                jurídico ou do próprio cliente.
              </p>
            </>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Nenhum contrato assinado nos últimos 90 dias — sem dados para medir a esteira.
            </p>
          )}

          <div className="list" style={{ marginTop: 14, borderTop: '1px solid var(--border-light)', paddingTop: 6 }}>
            <div className="list__item">
              <div className="list__main">
                <div className="list__title">VGV em processo</div>
                <div className="list__meta">{presoQtd} contrato(s) vendidos, ainda não assinados</div>
              </div>
              <span style={{ fontWeight: 900, fontStyle: 'italic', fontSize: 16 }}>{formatCurrencyShort(presoValor)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- De onde vem o dinheiro ---------- */}
      {d.origem.length > 0 && (
        <div className="card chart-card mb-6">
          <div className="card__header">
            <h3 className="card__title">Origem — leads, conversão e VGV</h3>
            <Link to="/relatorios" style={{ fontSize: 12, fontWeight: 600, color: 'var(--pons-blue)', textDecoration: 'none' }}>
              Relatórios →
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Canal</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Leads</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Vendas</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Conversão</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>VGV</th>
                </tr>
              </thead>
              <tbody>
                {d.origem.map((o) => (
                  <tr key={o.origem} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{labelOrigem(o.origem)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{o.leads.toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{o.vendas}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: o.vendas ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                      {pct(o.conversao, 2)}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, fontStyle: 'italic' }}>
                      {formatCurrencyShort(o.vgv)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Perna({ dias, nome, destaque = false }: { dias: number | null; nome: string; destaque?: boolean }) {
  return (
    <div style={{ flex: 1, padding: '10px 8px', borderLeft: destaque ? '1px dashed var(--border-light)' : undefined }}>
      <div style={{ fontSize: 20, fontWeight: 900, fontStyle: 'italic', color: destaque ? 'var(--pons-blue)' : undefined }}>
        {dias != null ? `${String(dias).replace('.', ',')} d` : '—'}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>{nome}</div>
    </div>
  );
}
