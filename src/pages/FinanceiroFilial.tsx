import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';

// Financeiro escopado ao SÓCIO de filial: só os números consolidados das filiais
// dele (o backend restringe /financeiro/resumo e /financeiro/dre por unidade).
// Read-only — sem lançamentos, caixa, aprovação ou Sicredi.

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
const hoje = new Date();
const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

export default function FinanceiroFilial() {
  const [from, setFrom] = useState(ymd(inicioMes));
  const [to, setTo] = useState(ymd(hoje));
  const [regime, setRegime] = useState<'competencia' | 'caixa'>('competencia');

  const resumo = useApi<any>(() => Api.finResumo(), []);
  const dre = useApi<any>(() => Api.finDre({ from, to, regime }), [from, to, regime]);

  return (
    <>
      <Topbar title="Financeiro da Filial" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Financeiro · Filial"
          title="Financeiro da Filial"
          subtitle="Resultado consolidado das suas filiais. Somente leitura."
        />

        {/* KPIs (resumo) */}
        {resumo.loading ? <LoadingBlock /> : resumo.error ? <ErrorBlock error={resumo.error} /> : (
          <div className="grid-3" style={{ marginBottom: 20 }}>
            <Kpi label="Saldo (pago)" valor={resumo.data?.saldo} destaque />
            <Kpi label="Entradas pagas" valor={resumo.data?.entradasPagas} />
            <Kpi label="Saídas pagas" valor={resumo.data?.saidasPagas} />
            <Kpi label="A receber" valor={resumo.data?.aReceber} />
            <Kpi label="A pagar" valor={resumo.data?.aPagar} />
          </div>
        )}

        {/* Filtros DRE */}
        <div className="filter-bar" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="text-xs text-secondary">De <input type="date" className="field__input" style={{ width: 150 }} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-xs text-secondary">Até <input type="date" className="field__input" style={{ width: 150 }} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <span className="filter-chip" style={{ cursor: 'default' }}>Regime:</span>
          <span className={'filter-chip ' + (regime === 'competencia' ? 'filter-chip--active' : '')} onClick={() => setRegime('competencia')}>Competência</span>
          <span className={'filter-chip ' + (regime === 'caixa' ? 'filter-chip--active' : '')} onClick={() => setRegime('caixa')}>Caixa</span>
        </div>

        {/* DRE */}
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>DRE — Demonstrativo de Resultado</h3>
          {dre.loading ? <LoadingBlock /> : dre.error ? <ErrorBlock error={dre.error} /> : (
            <table className="table">
              <tbody>
                {(dre.data?.linhas || []).map((l: any) => (
                  <tr key={l.ordem} style={l.tipo === 'resultado' || l.tipo === 'subtotal' ? { fontWeight: 700 } : undefined}>
                    <td>{l.rotulo}</td>
                    <td style={{ textAlign: 'right', color: l.valor < 0 ? 'var(--color-danger, #C70A1A)' : 'inherit' }}>{brl(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {dre.data && (
            <p className="text-xs text-secondary" style={{ marginTop: 10 }}>
              Margem líquida: {((dre.data.margemLiquida || 0) * 100).toFixed(1)}%
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function Kpi({ label, valor, destaque }: { label: string; valor?: number; destaque?: boolean }) {
  return (
    <div className="card" style={destaque ? { borderColor: 'var(--pons-blue)' } : undefined}>
      <div className="text-xs text-secondary">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: (valor || 0) < 0 ? 'var(--color-danger, #C70A1A)' : 'var(--text-primary)' }}>{brl(valor || 0)}</div>
    </div>
  );
}
