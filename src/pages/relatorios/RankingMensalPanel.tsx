// Fechamento mensal do ranking de vendas (pedido Marcelo): fecha o mês (dia
// 30/31, também automático por cron), confirma no 5º dia útil (situação
// contratual) e baixa o PDF. Só gestão — corretor não vê VGV.
import { useState } from 'react';
import { Api } from '../../lib/api';
import { useApi, LoadingBlock } from '../../lib/useApi';
import { useToast } from '../../lib/toast';
import { useConfirm } from '../../lib/confirm';
import { formatCurrency } from '../../lib/format';

const MESNOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function RankingMensalPanel() {
  const hoje = new Date();
  // Padrão: mês anterior (o que normalmente se fecha/confirma).
  const refInicial = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const [ano, setAno] = useState(refInicial.getFullYear());
  const [mes, setMes] = useState(refInicial.getMonth() + 1);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const { data, loading, error, reload } = useApi<any>(() => Api.rankMensalGet(ano, mes), [ano, mes]);
  const naoFechado = (error as any)?.status === 404;

  const fechar = async () => {
    const ok = await confirm({ title: 'Fechar o mês?', message: `Congela o ranking de ${MESNOME[mes - 1]}/${ano} com as vendas atuais. Pode refazer depois.` });
    if (!ok) return;
    setBusy(true);
    try { await Api.rankMensalFechar(ano, mes); toast.success('Mês fechado'); reload(); }
    catch (e: any) { toast.error(e?.message || 'Falha ao fechar'); }
    finally { setBusy(false); }
  };
  const confirmar = async () => {
    const ok = await confirm({ title: 'Confirmar situação contratual?', message: 'Relê o status atual de cada venda do mês (assinada, paga, cancelada) e marca o ranking como confirmado.' });
    if (!ok) return;
    setBusy(true);
    try { await Api.rankMensalConfirmar(ano, mes); toast.success('Ranking confirmado'); reload(); }
    catch (e: any) { toast.error(e?.message || 'Falha ao confirmar'); }
    finally { setBusy(false); }
  };
  const baixarPdf = () => Api.finPdf(`/ranking-mensal/${ano}/${mes}/pdf`);

  const anos = [hoje.getFullYear(), hoje.getFullYear() - 1];

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <h3 className="card__title" style={{ margin: 0 }}>Fechamento mensal do ranking</h3>
        <div className="flex gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="field__select" style={{ width: 'auto' }} value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESNOME.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select className="field__select" style={{ width: 'auto' }} value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {data && <button className="btn btn--secondary btn--sm" onClick={baixarPdf}>Baixar PDF</button>}
        </div>
      </div>

      {loading && <LoadingBlock />}

      {naoFechado && !loading && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <p className="text-secondary" style={{ marginBottom: 12 }}>{MESNOME[mes - 1]}/{ano} ainda não foi fechado.</p>
          <button className="btn btn--primary" disabled={busy} onClick={fechar}>{busy ? 'Fechando…' : 'Fechar mês agora'}</button>
          <p className="text-xs text-secondary" style={{ marginTop: 10 }}>O fechamento também roda sozinho no último dia do mês.</p>
        </div>
      )}
      {error && !naoFechado && <div className="text-sm" style={{ color: 'var(--color-danger)' }}>{(error as any).message}</div>}

      {data && !loading && (
        <>
          <div className="flex gap-2" style={{ marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`badge ${data.status === 'CONFIRMADO' ? 'badge--signature' : 'badge--info'}`}>{data.status === 'CONFIRMADO' ? 'Confirmado' : 'Fechado'}</span>
            <span className="text-sm text-secondary">VGV total: <strong>{formatCurrency(data.totalVgv)}</strong> · {data.totalVendas} vendas</span>
            <div style={{ flex: 1 }} />
            <button className="btn btn--secondary btn--sm" disabled={busy} onClick={fechar}>Refazer fechamento</button>
            {data.status !== 'CONFIRMADO' && <button className="btn btn--primary btn--sm" disabled={busy} onClick={confirmar}>{busy ? '…' : 'Confirmar situação'}</button>}
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <div>
              <h4 style={{ margin: '0 0 8px' }}>Ranking de corretores</h4>
              <table className="table">
                <thead><tr><th style={{ width: 30 }}>#</th><th>Corretor</th><th className="text-center">Vendas</th><th className="text-right">VGV</th></tr></thead>
                <tbody>
                  {data.porCorretor.map((c: any) => (
                    <tr key={c.nome}><td>{c.posicao}</td><td>{c.nome}</td><td className="text-center">{c.vendas}</td><td className="text-right money">{formatCurrency(c.vgv)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px' }}>VGV por unidade</h4>
              <table className="table">
                <thead><tr><th>Unidade</th><th className="text-center">Vendas</th><th className="text-right">VGV</th></tr></thead>
                <tbody>
                  {data.porUnidade.map((u: any) => (
                    <tr key={u.nome}><td>{u.nome}</td><td className="text-center">{u.vendas}</td><td className="text-right money">{formatCurrency(u.vgv)}</td></tr>
                  ))}
                  <tr style={{ fontWeight: 700 }}><td>Total do mês</td><td className="text-center">{data.totalVendas}</td><td className="text-right money">{formatCurrency(data.totalVgv)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {data.situacaoContratual && (
            <div style={{ marginTop: 18 }}>
              <h4 style={{ margin: '0 0 8px' }}>Confirmação — situação contratual das vendas</h4>
              <table className="table">
                <thead><tr><th>Situação</th><th className="text-center">Vendas</th><th className="text-right">VGV</th><th className="text-center">Mudou desde o fechamento</th></tr></thead>
                <tbody>
                  {data.situacaoContratual.map((s: any) => (
                    <tr key={s.status}><td>{s.label}</td><td className="text-center">{s.vendas}</td><td className="text-right money">{formatCurrency(s.vgv)}</td><td className="text-center">{s.mudou || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
