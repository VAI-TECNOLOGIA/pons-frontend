import { Link } from 'react-router-dom';
import { formatCurrencyShort } from '../lib/format';

/**
 * Indicadores de decisão do Dashboard.
 * Cada bloco responde a uma pergunta que o executivo faz:
 *  - Vou bater a meta?          -> Projeção de fechamento
 *  - Estou melhor que no mês passado? -> Conversão / Ticket / Ciclo / Contratos
 *  - Onde eu perco?             -> Funil (etapa de maior vazamento)
 *  - O que está travado?        -> Pipeline financeiro (VGV preso)
 *  - Qual canal paga?           -> Origem
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
};

type Avanco = {
  realizadoMes: number;
  metaCasa: number;
  temMeta: boolean;
  diaAtual: number;
  diasNoMes: number;
};

const pct = (v: number, casas = 1) => `${(v * 100).toFixed(casas)}%`;

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
  ORIGEM_LABEL[o] ||
  o.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/** Seta + variação vs mês anterior. `inverso` = cair é bom (ex.: ciclo de venda). */
function Trend({ v, inverso = false }: { v: number | null; inverso?: boolean }) {
  if (v == null || !isFinite(v)) {
    return <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>sem base anterior</span>;
  }
  const subiu = v >= 0;
  const bom = inverso ? !subiu : subiu;
  const cor = v === 0 ? 'var(--text-secondary)' : bom ? 'var(--color-success)' : 'var(--color-danger)';
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: cor, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {v === 0 ? '—' : subiu ? '▲' : '▼'} {pct(Math.abs(v), 0)}
      <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>vs mês ant.</span>
    </span>
  );
}

function Celula({ label, valor, children }: { label: string; valor: string; children?: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', margin: '4px 0 2px' }}>{valor}</div>
      {children}
    </div>
  );
}

export function DashboardDecisao({ decisao: d, avanco: a }: { decisao: Decisao; avanco?: Avanco }) {
  // Projeção linear: no ritmo de hoje, onde o mês fecha?
  const proj = a && a.diaAtual ? (a.realizadoMes / a.diaAtual) * a.diasNoMes : null;
  const projPctMeta = proj != null && a?.metaCasa ? proj / a.metaCasa : null;
  const gap = proj != null && a?.metaCasa ? a.metaCasa - proj : null;
  const vaiBater = projPctMeta != null && projPctMeta >= 1;

  // Maior vazamento: menor conversão entre etapas (ignora o topo, que é sempre 100%).
  const vazamento = d.funil
    .slice(1)
    .reduce<{ etapa: string; conversaoEtapa: number } | null>(
      (pior, e) => (!pior || e.conversaoEtapa < pior.conversaoEtapa ? e : pior),
      null,
    );

  const presoValor = d.pipelineFinanceiro.emAnalise.valor + d.pipelineFinanceiro.emAssinatura.valor;
  const presoQtd = d.pipelineFinanceiro.emAnalise.qtd + d.pipelineFinanceiro.emAssinatura.qtd;

  return (
    <>
      {/* ---------- Projeção + tendências ---------- */}
      <div className="card mb-6">
        <div className="card__header">
          <h3 className="card__title">Indicadores de decisão</h3>
          <span className="uppercase-tag">mês corrente</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(172px,1fr))', gap: 24 }}>
          {proj != null && (
            <Celula label="Projeção de fechamento" valor={formatCurrencyShort(proj)}>
              {a?.temMeta && projPctMeta != null ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className={'badge ' + (vaiBater ? 'badge--signed' : 'badge--analysis')}>
                    {vaiBater ? 'bate a meta' : `${pct(projPctMeta, 0)} da meta`}
                  </span>
                  {!vaiBater && gap != null && (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      faltam {formatCurrencyShort(gap)}
                    </span>
                  )}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>no ritmo atual do mês</span>
              )}
            </Celula>
          )}

          <Celula label="Conversão lead → venda" valor={pct(d.conversao.atual, 2)}>
            <Trend v={d.conversao.variacao} />
          </Celula>

          <Celula label="Ticket médio" valor={formatCurrencyShort(d.ticketMedio.atual)}>
            <Trend v={d.ticketMedio.variacao} />
          </Celula>

          <Celula label="Ciclo médio" valor={d.cicloMedioDias != null ? `${d.cicloMedioDias} dias` : '—'}>
            {d.cicloMedioDias != null ? (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>da entrada do lead ao contrato</span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>sem vendas com lead no mês</span>
            )}
          </Celula>

          <Celula label="Contratos" valor={d.contratos.atual.toLocaleString('pt-BR')}>
            <Trend v={d.contratos.variacao} />
          </Celula>

          <Celula label="Leads captados" valor={d.leads.atual.toLocaleString('pt-BR')}>
            <Trend v={d.leads.variacao} />
          </Celula>
        </div>
      </div>

      {/* ---------- Funil + o que está travado ---------- */}
      <div className="grid-2-1 mb-6">
        <div className="card chart-card">
          <div className="card__header">
            <h3 className="card__title">Funil do mês</h3>
            {vazamento && vazamento.conversaoEtapa < 1 && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
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
            <h3 className="card__title">VGV em processo</h3>
            <Link to="/vendas" style={{ fontSize: 12, fontWeight: 600, color: 'var(--pons-blue)', textDecoration: 'none' }}>
              Ver vendas →
            </Link>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic' }}>{formatCurrencyShort(presoValor)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {presoQtd} contrato(s) vendidos, ainda não assinados
            </div>
          </div>
          <div className="list">
            <div className="list__item">
              <div className="list__main">
                <div className="list__title">Em análise</div>
                <div className="list__meta">{d.pipelineFinanceiro.emAnalise.qtd} contrato(s)</div>
              </div>
              <span style={{ fontWeight: 800, fontStyle: 'italic' }}>
                {formatCurrencyShort(d.pipelineFinanceiro.emAnalise.valor)}
              </span>
            </div>
            <div className="list__item">
              <div className="list__main">
                <div className="list__title">Em assinatura</div>
                <div className="list__meta">{d.pipelineFinanceiro.emAssinatura.qtd} contrato(s)</div>
              </div>
              <span style={{ fontWeight: 800, fontStyle: 'italic' }}>
                {formatCurrencyShort(d.pipelineFinanceiro.emAssinatura.valor)}
              </span>
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
