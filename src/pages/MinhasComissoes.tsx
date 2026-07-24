// "Minhas Comissões" — extrato consolidado do corretor: quanto já recebeu,
// quanto tem a receber, o que entra este mês e nos próximos, + a lista de
// TODAS as parcelas de comissão dele (de todas as vendas) por vencimento.
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';

const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

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

function Card({ label, valor, cor, hint }: { label: string; valor: number; cor: string; hint?: string }) {
  return (
    <div className="card" style={{ padding: '16px 18px', borderLeft: `4px solid ${cor}` }}>
      <div className="text-xs text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 'clamp(18px, 5.2vw, 24px)', fontWeight: 800, marginTop: 4, color: cor, whiteSpace: 'nowrap' }}>{brl(valor)}</div>
      {hint && <div className="text-xs text-secondary" style={{ marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export default function MinhasComissoes() {
  const { data, loading, error } = useApi<any>(() => Api.minhasComissoes(), []);

  if (loading && !data) return <Shell><LoadingBlock /></Shell>;
  if (error && !data) return <Shell><ErrorBlock error={error} label="Erro ao carregar comissões" /></Shell>;
  const resumo = data?.resumo || { recebido: 0, aReceber: 0, esteMs: 0, proximos: 0, atrasado: 0 };
  const parcelas: any[] = data?.parcelas || [];

  // status "efetivo" pra tela: parcela não paga com vencimento passado = atrasada
  const hoje = new Date();
  const statusEfetivo = (p: any) => {
    if (p.status === 'PAGO') return 'PAGO';
    return new Date(p.vencimento) < hoje ? 'ATRASADO' : (p.status || 'AGENDADO');
  };

  return (
    <Shell>
      {parcelas.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Icon name="wallet" size={32} />
          <div style={{ marginTop: 12, fontWeight: 600 }}>Nenhuma comissão registrada ainda.</div>
          <div className="text-xs text-secondary" style={{ marginTop: 4 }}>Assim que você tiver vendas, as parcelas de comissão aparecem aqui.</div>
        </div>
      ) : (
        <>
          <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 8 }}>
            <Card label="Já recebido" valor={resumo.recebido} cor="var(--color-success, #16A34A)" />
            <Card label="A receber" valor={resumo.aReceber} cor="var(--pons-blue, #0E7C9B)" />
            <Card label="Entra este mês" valor={resumo.esteMs} cor="#B45309" />
            <Card label="Próximos meses" valor={resumo.proximos} cor="var(--text-secondary, #64748B)" />
          </div>
          {resumo.atrasado > 0 && (
            <div className="card" style={{ padding: '10px 16px', marginBottom: 16, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', color: '#B91C1C', fontSize: 13, fontWeight: 600 }}>
              {brl(resumo.atrasado)} em parcelas vencidas ainda não recebidas — fale com o financeiro se tiver dúvida.
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 700, fontSize: 14 }}>
              Extrato de parcelas <span className="text-xs text-secondary" style={{ fontWeight: 400 }}>· {parcelas.length} parcela{parcelas.length > 1 ? 's' : ''}, por vencimento</span>
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
                    const [k, lbl] = STATUS_PARCELA[statusEfetivo(p)] || ['neutral', p.status];
                    return (
                      <tr key={p.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{dataBr(p.vencimento)}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{p.cliente}</div>
                          <div className="text-xs text-secondary">#{p.codigo}{p.salaGpi ? ` · Sala ${p.salaGpi}` : ''}</div>
                        </td>
                        <td>{p.empreendimento}{p.unidade ? ` · ${p.unidade}` : ''}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{p.numero}/{p.total}</td>
                        <td className="numeric money" style={{ fontWeight: 700 }}>{brl(p.valorCorretor)}</td>
                        <td><span className={`badge badge--${k}`}>{lbl}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
