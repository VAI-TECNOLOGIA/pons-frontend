// Painel do Diretor Financeiro — consolida numa tela só o que o Marcelo pediro:
// (A) previsão de entrada no caixa por empresa/CNPJ e por mês, (B) parcelas da
// semana/vencidas a confirmar (com botão Confirmar), (D) contas a pagar (aging)
// e (E) resumo do caixa do mês. Fonte: GET /financeiro/painel-diretor.
import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';

const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const mesLabel = (mk: string) => {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
};
const dataBR = (s: string) => (s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—');
const vencido = (s: string) => s && new Date(s) < new Date(new Date().toDateString());

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar title="Painel Financeiro" />
      <div className="main__content">
        <PageHeader breadcrumb="Financeiro · Painel do Diretor" title="Painel Financeiro" subtitle="Previsão de entrada por empresa, o que confirmar hoje, contas a pagar e o caixa do mês — tudo em uma tela." />
        {children}
      </div>
    </>
  );
}

export default function PainelFinanceiro() {
  const { data, loading, error, reload } = useApi<any>(() => Api.finPainelDiretor());
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const toast = useToast();

  const confirmar = async (p: any) => {
    setConfirmando(p.parcelaId);
    try {
      await Api.vendaParcelaStatus(p.vendaId, p.parcelaId, 'PAGO');
      toast.success(`Parcela ${p.numero} de ${p.cliente} confirmada.`);
      reload();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || 'falha'));
    } finally {
      setConfirmando(null);
    }
  };

  if (loading && !data) return <Shell><LoadingBlock /></Shell>;
  if (error && !data) return <Shell><ErrorBlock error={error} label="Erro ao carregar o painel" /></Shell>;

  const { previsao, aConfirmar = [], contas, resumo } = data || {};
  const empresasComValor = (previsao?.porEmpresa || []).filter((e: any) => e.total > 0);
  const empresaKeys = (previsao?.empresas || []).map((e: any) => e.key);

  return (
    <Shell>
      {/* E) Resumo do caixa */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <ResumoCard titulo="A receber (total)" valor={previsao?.totalAReceber} icon="dollar" cor="var(--pons-blue)" />
        <ResumoCard titulo="Vencidas (atrasadas)" valor={previsao?.vencidasTotal} icon="clock" cor="#e5484d" />
        <ResumoCard titulo="Entrou no mês" valor={resumo?.entrouMes} icon="arrow_up" cor="#16A34A" />
        <ResumoCard titulo="Saiu no mês" valor={resumo?.saiuMes} icon="arrow_down" cor="#e5484d" />
        <ResumoCard titulo="Saldo do mês" valor={resumo?.saldoMes} icon="bank" cor={(resumo?.saldoMes || 0) >= 0 ? '#16A34A' : '#e5484d'} />
      </div>

      {/* A) Previsão de entrada por empresa */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="flex-between" style={{ marginBottom: 10 }}>
          <strong>Previsão de entrada — por empresa (CNPJ)</strong>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {empresasComValor.length === 0 && <span className="text-sm text-secondary">Sem parcelas a receber no momento.</span>}
          {empresasComValor.map((e: any) => (
            <div key={e.key} style={{ padding: '12px 14px', border: '1px solid var(--border-light)', borderRadius: 10, background: 'var(--bg-card-hover)' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{e.razaoSocial}</div>
              <div className="text-xs text-secondary">{e.cnpj || 'sem CNPJ vinculado'}</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6, color: 'var(--pons-blue)' }}>{brl(e.total)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* A) Previsão de entrada por mês (x empresa) */}
      <div className="card" style={{ marginBottom: 16, padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}><strong>Previsão de entrada — por mês</strong></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Mês</th>
                {empresaKeys.map((k: string) => <th key={k} style={{ textAlign: 'right' }}>{(previsao.empresas.find((e: any) => e.key === k)?.razaoSocial || k).split(' ').slice(0, 3).join(' ')}</th>)}
                <th style={{ textAlign: 'right' }}>Sem empresa</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(previsao?.porMes || []).length === 0 && <tr><td colSpan={empresaKeys.length + 3} className="text-secondary" style={{ textAlign: 'center', padding: 16 }}>Nenhuma parcela prevista.</td></tr>}
              {(previsao?.porMes || []).map((m: any) => (
                <tr key={m.mes}>
                  <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{mesLabel(m.mes)}</td>
                  {empresaKeys.map((k: string) => <td key={k} style={{ textAlign: 'right' }} className="text-xs">{m.empresas[k] ? brl(m.empresas[k]) : '—'}</td>)}
                  <td style={{ textAlign: 'right' }} className="text-xs">{m.empresas.SEM ? brl(m.empresas.SEM) : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{brl(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* B) Entrou / a confirmar */}
      <div className="card" style={{ marginBottom: 16, padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
          <strong>A confirmar (venceu / vence esta semana)</strong>
          <span className="text-xs text-secondary"> — marque como pago quando o dinheiro cair na conta</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table row-hover">
            <thead>
              <tr><th>Venc.</th><th>Cliente</th><th>Empreend.</th><th>Parcela</th><th>Empresa</th><th style={{ textAlign: 'right' }}>Valor</th><th></th></tr>
            </thead>
            <tbody>
              {aConfirmar.length === 0 && <tr><td colSpan={7} className="text-secondary" style={{ textAlign: 'center', padding: 16 }}>Nada pendente pra confirmar. 🎉</td></tr>}
              {aConfirmar.map((p: any) => (
                <tr key={p.parcelaId}>
                  <td className="text-xs" style={{ color: vencido(p.vencimento) ? '#e5484d' : undefined, fontWeight: vencido(p.vencimento) ? 700 : 400 }}>{dataBR(p.vencimento)}</td>
                  <td className="text-xs">{p.cliente}</td>
                  <td className="text-xs">{p.empreendimento}</td>
                  <td className="text-xs">{p.numero}/{p.totalParcelas}</td>
                  <td className="text-xs">{p.empresa}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }} className="text-xs">{brl(p.valor)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn--primary btn--sm" disabled={confirmando === p.parcelaId} onClick={() => confirmar(p)}>
                      {confirmando === p.parcelaId ? 'Confirmando…' : 'Confirmar pago'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* D) Contas a pagar */}
      <div className="card">
        <div className="flex-between" style={{ marginBottom: 10 }}>
          <strong>Contas a pagar</strong>
          <span style={{ fontWeight: 800, color: '#e5484d' }}>{brl(contas?.total)}</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <AgingCard titulo="A vencer" valor={contas?.aging?.aVencer} cor="var(--text-primary)" />
          <AgingCard titulo="Vencido 1–30d" valor={contas?.aging?.d1_30} cor="#F59E0B" />
          <AgingCard titulo="Vencido 31–60d" valor={contas?.aging?.d31_60} cor="#e5484d" />
          <AgingCard titulo="Vencido 60d+" valor={contas?.aging?.d60} cor="#b91c1c" />
        </div>
      </div>
    </Shell>
  );
}

function ResumoCard({ titulo, valor, icon, cor }: { titulo: string; valor: number; icon: string; cor: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div className="flex" style={{ alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
        <Icon name={icon} size={14} /> <span className="text-xs">{titulo}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: cor }}>{brl(valor)}</div>
    </div>
  );
}

function AgingCard({ titulo, valor, cor }: { titulo: string; valor: number; cor: string }) {
  return (
    <div style={{ padding: '10px 12px', border: '1px solid var(--border-light)', borderRadius: 10 }}>
      <div className="text-xs text-secondary">{titulo}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: cor }}>{brl(valor)}</div>
    </div>
  );
}
