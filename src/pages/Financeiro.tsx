import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { formatCurrency, formatCurrencyShort, formatDate } from '../lib/format';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { CampoCnpj } from '../components/CampoCnpj';

const STATUS_BADGE: Record<string, [string, string]> = {
 PENDENTE: ['analysis', 'PENDENTE'],
 AGUARDANDO_APROVACAO: ['analysis', 'AGUARDANDO'],
 APROVADO: ['signature', 'APROVADO'],
 PAGO: ['paid', 'PAGO'],
 AGENDADO: ['neutral', 'AGENDADO'],
 CANCELADO: ['cancelled', 'CANCELADO'],
};

type Tab = 'extrato' | 'semana' | 'dre' | 'fluxo' | 'contas' | 'planejamento' | 'comissoes' | 'importar' | 'sicredi';

export default function Financeiro() {
 const [tab, setTab] = useState<Tab>('extrato');
 const [openNew, setOpenNew] = useState(false);
 const [metodoForm, setMetodoForm] = useState('PIX');
 const [filtroBenef, setFiltroBenef] = useState('');
 const [filtroStatus, setFiltroStatus] = useState('');
 const { data: f, loading, error, reload: reloadResumo } = useApi<any>(() => Api.finResumo());
 const { data: lancamentos, reload: reloadLanc } = useApi<any[]>(() => Api.finLancamentos());
 const toast = useToast();
 const confirm = useConfirm();

 const submit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const fd = new FormData(e.currentTarget);
 try {
 await Api.finLancamentoCreate({
 tipo: String(fd.get('tipo') || 'SAIDA'),
 categoria: String(fd.get('categoria') || 'OUTRO'),
 descricao: String(fd.get('descricao') || ''),
 valor: Number(String(fd.get('valor') || '').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0,
 vencimento: fd.get('vencimento') ? String(fd.get('vencimento')) : null,
 beneficiario: fd.get('beneficiario') ? String(fd.get('beneficiario')) : undefined,
 metodo: String(fd.get('metodo') || 'PIX'),
 favorecidoDocumento: fd.get('favorecidoDocumento') ? String(fd.get('favorecidoDocumento')) : undefined,
 favorecidoChavePix: fd.get('favorecidoChavePix') ? String(fd.get('favorecidoChavePix')) : undefined,
 favorecidoBanco: fd.get('favorecidoBanco') ? String(fd.get('favorecidoBanco')) : undefined,
 favorecidoAgencia: fd.get('favorecidoAgencia') ? String(fd.get('favorecidoAgencia')) : undefined,
 favorecidoConta: fd.get('favorecidoConta') ? String(fd.get('favorecidoConta')) : undefined,
 favorecidoTipoConta: fd.get('favorecidoTipoConta') ? String(fd.get('favorecidoTipoConta')) : undefined,
 });
 toast.success('Lançamento criado');
 setOpenNew(false);
 reloadLanc();
 reloadResumo();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 const aprovar = async (id: number) => {
 try {
 await Api.finAprovar(id);
 toast.success('Lançamento aprovado');
 reloadLanc();
 reloadResumo();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 const marcarPago = async (id: number) => {
 const ok = await confirm({
 title: 'Marcar como pago?',
 message: 'O lançamento será registrado como PAGO na data de hoje e entra no saldo realizado.',
 confirmText: 'Marcar pago',
 tone: 'primary',
 });
 if (!ok) return;
 try {
 await Api.finLancamentoUpdate(id, { status: 'PAGO' });
 toast.success('Lançamento marcado como pago');
 reloadLanc();
 reloadResumo();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 const enviarSicredi = async () => {
 const ok = await confirm({
 title: 'Enviar ao Sicredi?',
 message: 'Todos os lançamentos APROVADOS serão enviados em lote PIX ao banco Sicredi para pagamento. Confirme apenas se os valores e beneficiários foram revisados.',
 confirmText: 'Enviar lote',
 tone: 'primary',
 });
 if (!ok) return;
 try {
 const r: any = await Api.finSicrediEnviar();
 if (r?.simulado) toast.info(`Simulado: ${r.processados || 0} pagamento(s) marcados`);
 else if (r?.enviado) toast.success(`Lote ${r.lote} enviado · ${r.total} pagamento(s)`);
 else if (r?.motivo === 'nenhum_aprovado') toast.info('Nenhum lançamento aprovado.');
 else toast.error('Erro: ' + (r?.erro || 'desconhecido'));
 reloadLanc();
 reloadResumo();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 if (loading) return <Shell tab={tab} setTab={setTab} onNew={() => setOpenNew(true)} onSicredi={enviarSicredi}><LoadingBlock /></Shell>;
 if (error) return <Shell tab={tab} setTab={setTab} onNew={() => setOpenNew(true)} onSicredi={enviarSicredi}><ErrorBlock error={error} /></Shell>;
 if (!f) return null;

 return (
 <>
 <Topbar
 title="Financeiro"
 right={
 <>
 <button className="btn btn--secondary btn--sm" onClick={() => setOpenNew(true)}>+ Lançamento</button>
 </>
 }
 />

 <div className="main__content">
 <PageHeader
 breadcrumb="Financeiro · Adm master / sócios"
 title="Central Financeira"
 subtitle="Planejamento, extrato, comissões parceladas e consolidação bancária"
 />

 <div className="kpi-grid">
 <div className="kpi">
 <div className="kpi__label">Saldo realizado</div>
 <div className="kpi__value" style={{ color: (f.saldo || 0) >= 0 ? 'var(--money-positive)' : 'var(--money-negative)' }}>
 {formatCurrencyShort(f.saldo)}
 </div>
 </div>
 <div className="kpi">
 <div className="kpi__label">Entradas pagas</div>
 <div className="kpi__value">{formatCurrencyShort(f.entradasPagas ?? f.entradas)}</div>
 </div>
 <div className="kpi">
 <div className="kpi__label">A pagar</div>
 <div className="kpi__value">{formatCurrencyShort(f.aPagar)}</div>
 </div>
 <div className="kpi">
 <div className="kpi__label">Aguardando aprovação</div>
 <div className="kpi__value">{f.aguardandoAprovacao || 0}</div>
 </div>
 </div>

 <div className="tabs">
 {([
 ['extrato', 'Extrato'],
 ['semana', 'Pagamentos da semana'],
 ['dre', 'DRE'],
 ['fluxo', 'Fluxo de caixa'],
 ['contas', 'Contas a pagar/receber'],
 ['planejamento', 'Planejamento'],
 ['comissoes', 'Comissões & plano'],
 ['importar', 'Importar base'],
 ] as const).map(([key, label]) => (
 <button
 key={key}
 className={'tab ' + (tab === key ? 'tab--active' : '')}
 onClick={() => setTab(key as Tab)}
 >
 {label}
 </button>
 ))}
 </div>

 {tab === 'extrato' && (() => {
 const q = filtroBenef.trim().toLowerCase();
 const filtrados = (lancamentos || []).filter((l: any) => {
 if (filtroStatus && l.status !== filtroStatus) return false;
 if (!q) return true;
 return [l.beneficiario, l.descricao, l.categoria].some((v: any) => String(v || '').toLowerCase().includes(q));
 });
 return (
 <>
 <div className="card flex gap-2" style={{ alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
 <div className="field" style={{ margin: 0, flex: 1, minWidth: 200 }}>
 <label className="field__label">Buscar (beneficiário, descrição, categoria)</label>
 <input className="field__input" value={filtroBenef} onChange={(e) => setFiltroBenef(e.target.value)} placeholder="Ex.: João, aluguel, comissão..." />
 </div>
 <div className="field" style={{ margin: 0, minWidth: 170 }}>
 <label className="field__label">Status</label>
 <select className="field__select" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
 <option value="">Todos</option>
 <option value="PENDENTE">Pendente</option>
 <option value="AGUARDANDO_APROVACAO">Aguardando aprovação</option>
 <option value="APROVADO">Aprovado</option>
 <option value="PAGO">Pago</option>
 <option value="AGENDADO">Agendado</option>
 <option value="CANCELADO">Cancelado</option>
 </select>
 </div>
 {(filtroBenef || filtroStatus) && (
 <button className="btn btn--secondary btn--sm" onClick={() => { setFiltroBenef(''); setFiltroStatus(''); }}>Limpar</button>
 )}
 </div>
 <div className="card" style={{ padding: 0 }}>
 <table className="table">
 <thead>
 <tr>
 <th>Descrição</th>
 <th>Categoria</th>
 <th>Beneficiário</th>
 <th className="numeric">Valor</th>
 <th>Vencimento</th>
 <th>Status</th>
 <th></th>
 </tr>
 </thead>
 <tbody>
 {filtrados.length === 0 ? (
 <tr>
 <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
 {(lancamentos || []).length === 0 ? 'Nenhum lançamento ainda' : 'Nenhum lançamento para o filtro'}
 </td>
 </tr>
 ) : (
 filtrados.map((l: any) => {
 const [k, lbl] = STATUS_BADGE[l.status] || ['neutral', l.status];
 const isOut = l.tipo === 'SAIDA';
 return (
 <tr key={l.id}>
 <td className="font-semibold">{l.descricao}</td>
 <td>
 <span className="badge badge--neutral">{l.categoria}</span>
 </td>
 <td className="text-sm">{l.beneficiario}</td>
 <td className="numeric money" style={{ color: isOut ? 'var(--money-negative)' : 'var(--money-positive)' }}>
 {isOut ? '−' : '+'}
 {formatCurrency(l.valor)}
 </td>
 <td className="text-sm">{formatDate(l.vencimento)}</td>
 <td>
 <span className={`badge badge--${k}`}>{lbl}</span>
 </td>
 <td>
 <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
 {l.status === 'AGUARDANDO_APROVACAO' && (
 <button className="btn btn--secondary btn--sm" onClick={() => aprovar(l.id)}>Aprovar</button>
 )}
 {l.status !== 'PAGO' && l.status !== 'CANCELADO' && (
 <button className="btn btn--ghost btn--sm" onClick={() => marcarPago(l.id)}>Marcar pago</button>
 )}
 </div>
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>
 </>
 );
 })()}

 {tab === 'dre' && <DreTab />}
 {tab === 'semana' && <SemanaTab />}
 {tab === 'fluxo' && <FluxoTab />}
 {tab === 'contas' && <ContasTab />}
 {tab === 'planejamento' && <PlanejamentoTab />}
 {tab === 'comissoes' && <ComissoesTab />}
 {tab === 'importar' && <ImportarTab onDone={() => { reloadLanc(); reloadResumo(); }} />}

 {tab === 'sicredi' && <SicrediTab onEnviar={enviarSicredi} />}
 </div>
 <Modal open={openNew} onClose={() => setOpenNew(false)} title="Novo lançamento" subtitle="Entrada ou saída a registrar no caixa">
 <form onSubmit={submit}>
 <div className="form-grid">
 <div className="field">
 <label className="field__label">Tipo</label>
 <select name="tipo" className="field__select" defaultValue="SAIDA">
 <option value="SAIDA">Saída</option>
 <option value="ENTRADA">Entrada</option>
 </select>
 </div>
 <div className="field">
 <label className="field__label">Categoria</label>
 <select name="categoria" className="field__select" defaultValue="OUTRO">
 <option>COMISSAO</option>
 <option>ALUGUEL</option>
 <option>FOLHA</option>
 <option>MARKETING</option>
 <option>IMPOSTO</option>
 <option>VENDA</option>
 <option>REPASSE</option>
 <option>OUTRO</option>
 </select>
 </div>
 <div className="field field--span-2">
 <label className="field__label">Descrição <span className="field__required">*</span></label>
 <input name="descricao" className="field__input" required />
 </div>
 <div className="field">
 <label className="field__label">Valor <span className="field__required">*</span></label>
 <input name="valor" className="field__input" required placeholder="15000" />
 </div>
 <div className="field">
 <label className="field__label">Vencimento</label>
 <input name="vencimento" type="date" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Beneficiário</label>
 <input name="beneficiario" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Método</label>
 <select name="metodo" className="field__select" value={metodoForm} onChange={(e) => setMetodoForm(e.target.value)}>
 <option>PIX</option>
 <option>TED</option>
 <option>DOC</option>
 <option>BOLETO</option>
 </select>
 </div>
 {metodoForm !== 'BOLETO' && (
 <div className="field field--span-2">
 <CampoCnpj
 name="favorecidoDocumento"
 label="Documento do favorecido (CPF/CNPJ)"
 permitirCpf
 onInfo={(info) => {
 // CNPJ consultado na Receita → confirma quem recebe e preenche o beneficiário
 const el = document.querySelector('input[name="beneficiario"]') as HTMLInputElement | null;
 if (el && !el.value && info.razaoSocial) {
 const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
 setter.call(el, info.razaoSocial);
 el.dispatchEvent(new Event('input', { bubbles: true }));
 }
 }}
 />
 </div>
 )}
 {metodoForm === 'PIX' && (
 <div className="field field--span-2">
 <label className="field__label">Chave Pix</label>
 <input name="favorecidoChavePix" className="field__input" placeholder="CPF/CNPJ, e-mail, telefone ou aleatória" />
 </div>
 )}
 {(metodoForm === 'TED' || metodoForm === 'DOC') && (
 <>
 <div className="field">
 <label className="field__label">Banco (código/ISPB)</label>
 <input name="favorecidoBanco" className="field__input" placeholder="748" />
 </div>
 <div className="field">
 <label className="field__label">Agência</label>
 <input name="favorecidoAgencia" className="field__input" placeholder="0101" />
 </div>
 <div className="field">
 <label className="field__label">Conta</label>
 <input name="favorecidoConta" className="field__input" placeholder="12345-6" />
 </div>
 <div className="field">
 <label className="field__label">Tipo de conta</label>
 <select name="favorecidoTipoConta" className="field__select" defaultValue="CORRENTE">
 <option value="CORRENTE">Corrente</option>
 <option value="POUPANCA">Poupança</option>
 </select>
 </div>
 </>
 )}
 </div>
 <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
 <button type="button" className="btn btn--secondary" onClick={() => setOpenNew(false)}>Cancelar</button>
 <button type="submit" className="btn btn--primary">Lançar</button>
 </div>
 </form>
 </Modal>
 </>
 );
}

function Shell({ tab, setTab, children, onNew, onSicredi }: { tab: Tab; setTab: (t: Tab) => void; children: React.ReactNode; onNew?: () => void; onSicredi?: () => void }) {
 return (
 <>
 <Topbar
 title="Financeiro"
 right={
 <>
 <button className="btn btn--secondary btn--sm" onClick={onNew}>+ Lançamento</button>
 </>
 }
 />
 <div className="main__content">
 <PageHeader breadcrumb="Financeiro" title="Central Financeira" />
 {children}
 </div>
 </>
 );
}

function DreRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
 const color = value < 0 ? 'var(--color-danger)' : strong ? '#4D7A26' : 'var(--text-primary)';
 const formatted = (value < 0 ? '−' : '') + formatCurrency(Math.abs(value));
 return (
 <div
 style={{
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 padding: '9px 4px',
 fontSize: strong ? 15 : 14,
 fontWeight: strong ? 800 : 400,
 borderBottom: strong ? '2px solid var(--border-medium)' : '1px dashed var(--border-light)',
 marginTop: strong ? 6 : 0,
 }}
 >
 <span style={{ color: strong ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</span>
 <span className="money" style={{ color }}>{formatted}</span>
 </div>
 );
}

function ComissoesTab() {
  const [view, setView] = useState<'corretor' | 'plano'>('corretor');
  return (
    <>
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={'tab ' + (view === 'corretor' ? 'tab--active' : '')} onClick={() => setView('corretor')}>Por corretor</button>
        <button className={'tab ' + (view === 'plano' ? 'tab--active' : '')} onClick={() => setView('plano')}>Plano de recebimento</button>
      </div>
      {view === 'corretor' ? <ComissoesPorCorretor /> : <ComissoesPlano />}
    </>
  );
}

function ComissoesPorCorretor() {
  const hoje = new Date();
  const [from, setFrom] = useState(`${hoje.getFullYear()}-01-01`);
  const [to, setTo] = useState(hoje.toISOString().slice(0, 10));
  const { data, loading, error, reload } = useApi<any>(() => Api.finComissoesPorCorretor({ from, to }), [from, to]);
  const [baixando, setBaixando] = useState<number | null>(null);
  const [pagando, setPagando] = useState<number | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const baixar = async (corretorId: number) => {
    setBaixando(corretorId);
    try {
      await Api.finComprovantePdf(corretorId, { from, to });
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível gerar o comprovante');
    } finally {
      setBaixando(null);
    }
  };

  const marcarPago = async (c: any) => {
    const ok = await confirm({
      title: `Registrar repasse de ${c.nome}?`,
      message: `Confirma que o pagamento de ${formatCurrency(c.aReceber)} foi feito (por fora do sistema)? Isso marca a comissão como paga e registra no financeiro. O dinheiro NÃO sai daqui — é só o registro.`,
      confirmText: 'Registrar como pago',
    });
    if (!ok) return;
    setPagando(c.corretorId);
    try {
      const r = await Api.finComissaoPagar({ corretorId: c.corretorId, from, to });
      toast.success(r.pagos ? `Repasse registrado: ${formatCurrency(r.valorTotal)} (${r.pagos} comissões)` : (r.message || 'Nada pendente'));
      reload();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao registrar repasse');
    } finally {
      setPagando(null);
    }
  };

  const estornar = async (c: any) => {
    const ok = await confirm({
      title: `Estornar repasse de ${c.nome}?`,
      message: `Desfaz a marcação de pago (${formatCurrency(c.valorPago)}) e cancela os lançamentos gerados. Use só se marcou por engano.`,
      confirmText: 'Estornar',
      tone: 'danger',
    });
    if (!ok) return;
    setPagando(c.corretorId);
    try {
      const r = await Api.finComissaoEstornar({ corretorId: c.corretorId, from, to });
      toast.success(r.estornados ? `Estornado (${r.estornados} comissões, ${r.lancamentosCancelados || 0} lançamentos cancelados)` : (r.message || 'Nada pago'));
      reload();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao estornar');
    } finally {
      setPagando(null);
    }
  };

  return (
    <div className="card">
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h3 className="card__title" style={{ margin: 0 }}>Comissões por corretor</h3>
        <div className="flex gap-2" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0 }}>
            <label className="field__label">De</label>
            <input type="date" className="field__input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="field__label">Até</label>
            <input type="date" className="field__input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} />}
      {data && (
        <>
          <div className="flex gap-2" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="text-secondary text-sm">Total bruto: <strong>{formatCurrency(data.totais?.valorTotal || 0)}</strong></span>
            <span className="text-secondary text-sm">· Pago: <strong>{formatCurrency(data.totais?.valorPago || 0)}</strong></span>
            <span className="text-secondary text-sm">· A receber: <strong style={{ color: '#4D7A26' }}>{formatCurrency(data.totais?.aReceber || 0)}</strong></span>
          </div>
          <table className="table">
            <thead><tr><th>Corretor</th><th>Unidade</th><th className="text-right">Total</th><th className="text-right">Pago</th><th className="text-right">A receber</th><th></th></tr></thead>
            <tbody>
              {(data.corretores || []).map((c: any) => (
                <tr key={c.corretorId}>
                  <td>{c.nome}</td>
                  <td className="text-sm text-secondary">{c.unidade || '—'}</td>
                  <td className="text-right money">{formatCurrency(c.valorTotal)}</td>
                  <td className="text-right money">{formatCurrency(c.valorPago)}</td>
                  <td className="text-right money" style={{ color: '#4D7A26' }}>{formatCurrency(c.aReceber)}</td>
                  <td className="text-right">
                    {c.aReceber > 0 && (
                      <button className="btn btn--primary btn--sm" style={{ marginRight: 6 }} disabled={pagando === c.corretorId} onClick={() => marcarPago(c)}>
                        {pagando === c.corretorId ? '...' : 'Marcar pago'}
                      </button>
                    )}
                    {c.valorPago > 0 && (
                      <button className="btn btn--ghost btn--sm" style={{ marginRight: 6 }} disabled={pagando === c.corretorId} onClick={() => estornar(c)}>
                        Estornar
                      </button>
                    )}
                    <button className="btn btn--ghost btn--sm" disabled={baixando === c.corretorId} onClick={() => baixar(c.corretorId)}>
                      {baixando === c.corretorId ? '...' : 'PDF'}
                    </button>
                  </td>
                </tr>
              ))}
              {!data.corretores?.length && (
                <tr><td colSpan={6} className="text-secondary text-sm" style={{ textAlign: 'center', padding: 24 }}>Nenhuma comissão no período.</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ───────────── Plano de recebimento de comissões (cronograma mensal) ─────────────
function ComissoesPlano() {
  const { data, loading, error } = useApi<any>(() => Api.finComissoesPlano());
  const [aberta, setAberta] = useState<number | null>(null);
  return (
    <div className="card">
      <h3 className="card__title">Plano de recebimento de comissões</h3>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} />}
      {data && (
        <>
          <div className="kpi-grid" style={{ margin: '12px 0 16px' }}>
            <div className="kpi"><div className="kpi__label">A receber</div><div className="kpi__value" style={{ color: '#4D7A26' }}>{formatCurrencyShort(data.totalAReceber || 0)}</div></div>
            <div className="kpi"><div className="kpi__label">Já recebido</div><div className="kpi__value">{formatCurrencyShort(data.totalRecebido || 0)}</div></div>
            <div className="kpi"><div className="kpi__label">Corretor</div><div className="kpi__value">{formatCurrencyShort(data.porGrupo?.corretor || 0)}</div></div>
            <div className="kpi"><div className="kpi__label">Gestor / Casa</div><div className="kpi__value">{formatCurrencyShort((data.porGrupo?.gestor || 0) + (data.porGrupo?.casa || 0))}</div></div>
          </div>

          {!!(data.resumoMensal || []).length && (
            <>
              <h4 style={{ margin: '8px 0 6px' }}>A receber por mês</h4>
              <table className="table" style={{ marginBottom: 20 }}>
                <thead><tr><th>Mês</th><th className="text-right">Corretor</th><th className="text-right">Gestor</th><th className="text-right">Casa</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {data.resumoMensal.map((m: any, i: number) => (
                    <tr key={i}>
                      <td>{m.label}</td>
                      <td className="text-right money">{formatCurrency(m.corretor)}</td>
                      <td className="text-right money">{formatCurrency(m.gestor)}</td>
                      <td className="text-right money">{formatCurrency(m.casa)}</td>
                      <td className="text-right money" style={{ fontWeight: 700 }}>{formatCurrency(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <h4 style={{ margin: '8px 0 6px' }}>Por venda</h4>
          <table className="table">
            <thead><tr><th>Venda</th><th>Cliente</th><th className="text-right">Comissão total</th><th className="text-right">Parcelas</th><th>Próx. receb.</th><th></th></tr></thead>
            <tbody>
              {(data.vendas || []).map((v: any) => (
                <FragmentRow key={v.id} v={v} aberta={aberta} setAberta={setAberta} />
              ))}
              {!data.vendas?.length && (
                <tr><td colSpan={6} className="text-secondary text-sm" style={{ textAlign: 'center', padding: 24 }}>Nenhuma venda com comissão.</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function FragmentRow({ v, aberta, setAberta }: { v: any; aberta: number | null; setAberta: (n: number | null) => void }) {
  const open = aberta === v.id;
  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={() => setAberta(open ? null : v.id)}>
        <td className="font-semibold">{v.codigo || `#${v.id}`}<div className="text-sm text-secondary">{v.empreendimento}</div></td>
        <td>{v.cliente}</td>
        <td className="text-right money">{formatCurrency(v.comissaoTotal)}</td>
        <td className="text-right text-sm">{v.parcelasPagas}/{v.parcelas}</td>
        <td className="text-sm">{formatDate(v.proximoRecebimento)}</td>
        <td className="text-right text-sm text-secondary">{open ? '▲' : '▼'}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} style={{ background: 'var(--bg-app)' }}>
            <div style={{ padding: '4px 0 8px' }}>
              <strong className="text-sm">Rateio</strong>
              <table className="table" style={{ margin: '4px 0 12px' }}>
                <thead><tr><th>Papel</th><th>Nome</th><th className="text-right">Total</th><th className="text-right">Pago</th><th className="text-right">A receber</th></tr></thead>
                <tbody>
                  {(v.rateio || []).map((r: any, i: number) => (
                    <tr key={i}>
                      <td className="text-sm">{r.papelLabel}</td>
                      <td className="text-sm">{r.nome}</td>
                      <td className="text-right money">{formatCurrency(r.valorTotal)}</td>
                      <td className="text-right money">{formatCurrency(r.valorPago)}</td>
                      <td className="text-right money" style={{ color: '#4D7A26' }}>{formatCurrency(r.valorAReceber)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <strong className="text-sm">Cronograma</strong>
              <table className="table" style={{ marginTop: 4 }}>
                <thead><tr><th>Parcela</th><th>Vencimento</th><th className="text-right">Valor</th><th>Status</th></tr></thead>
                <tbody>
                  {(v.cronograma || []).map((c: any, i: number) => (
                    <tr key={i}>
                      <td className="text-sm">{c.numero}</td>
                      <td className="text-sm">{formatDate(c.vencimento)}</td>
                      <td className="text-right money">{formatCurrency(c.valor)}</td>
                      <td><span className={'badge badge--' + (c.status === 'RECEBIDO' ? 'paid' : 'neutral')}>{c.status === 'RECEBIDO' ? 'RECEBIDO' : 'A RECEBER'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ───────────────────────── Sicredi (status real + envio) ─────────────────────────
function SicrediTab({ onEnviar }: { onEnviar: () => void }) {
  const { data, loading, error } = useApi<any>(() => Api.finSicrediStatus());
  const configurado = data?.configurado;
  return (
    <div className="card">
      <h3 className="card__title">Sicredi — pagamento em lote PIX</h3>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} />}
      {data && (
        <>
          <div className="flex gap-2" style={{ alignItems: 'center', margin: '12px 0 14px' }}>
            <span className={'badge badge--' + (configurado ? 'paid' : 'analysis')}>
              {configurado ? 'Credenciais configuradas' : 'Não configurado'}
            </span>
          </div>
          {configurado ? (
            <>
              <p className="text-secondary text-sm" style={{ marginBottom: 14 }}>
                As credenciais Sicredi estão presentes. Os lançamentos de saída <strong>APROVADOS</strong> são enviados em lote PIX para pagamento. Revise valores e beneficiários antes de enviar.
              </p>
              <button className="btn btn--primary" onClick={onEnviar}>Enviar lote ao Sicredi</button>
            </>
          ) : (
            <p className="text-secondary">
              A integração está aguardando o Sicredi liberar/criar a conta e as credenciais (token). Sem credenciais nas Settings, o envio roda em modo simulado.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ───────────────────────── DRE (real) ─────────────────────────
function DreTab() {
  const hoje = new Date();
  const [from, setFrom] = useState(`${hoje.getFullYear()}-01-01`);
  const [to, setTo] = useState(hoje.toISOString().slice(0, 10));
  const [regime, setRegime] = useState<'competencia' | 'caixa'>('competencia');
  const [unidadeId, setUnidadeId] = useState('');
  const { data: unidades } = useApi<any[]>(() => Api.unidadesList());
  const { data, loading, error } = useApi<any>(
    () => Api.finDre({ from, to, regime, ...(unidadeId && { unidadeId }) }),
    [from, to, regime, unidadeId],
  );

  return (
    <div className="card">
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h3 className="card__title" style={{ margin: 0 }}>DRE — Demonstrativo de Resultado</h3>
        <div className="flex gap-2" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ margin: 0 }}>
            <label className="field__label">Unidade</label>
            <select className="field__select" value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
              <option value="">Todas</option>
              {(unidades || []).map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="field__label">Regime</label>
            <select className="field__select" value={regime} onChange={(e) => setRegime(e.target.value as any)}>
              <option value="competencia">Competência</option>
              <option value="caixa">Caixa</option>
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="field__label">De</label>
            <input type="date" className="field__input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="field__label">Até</label>
            <input type="date" className="field__input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} />}
      {data && (
        <div style={{ marginTop: 4 }}>
          {(data.linhas || []).map((l: any) => (
            <DreRow
              key={l.ordem}
              label={l.rotulo}
              value={l.valor}
              strong={l.tipo === 'resultado'}
            />
          ))}
          <div className="text-sm text-secondary" style={{ marginTop: 12 }}>
            Margem líquida: <strong>{((data.margemLiquida || 0) * 100).toFixed(1)}%</strong>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Pagamentos da semana ─────────────────────────
function SemanaTab() {
  const [semana, setSemana] = useState(0);
  const { data, loading, error } = useApi<any>(() => Api.finPagamentosSemana(semana), [semana]);
  return (
    <div className="card">
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h3 className="card__title" style={{ margin: 0 }}>Pagamentos a realizar na semana</h3>
        <div className="flex gap-2" style={{ alignItems: 'center' }}>
          <button className="btn btn--secondary btn--sm" onClick={() => setSemana((s) => s - 1)}>‹ Anterior</button>
          {semana !== 0 && <button className="btn btn--secondary btn--sm" onClick={() => setSemana(0)}>Hoje</button>}
          <button className="btn btn--secondary btn--sm" onClick={() => setSemana((s) => s + 1)}>Próxima ›</button>
        </div>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} />}
      {data && (
        <>
          <div className="flex gap-2" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            <span className="text-secondary text-sm">{formatDate(data.periodo?.inicio)} – {formatDate(data.periodo?.fim)}</span>
            <span className="text-secondary text-sm">· Total da semana: <strong>{formatCurrency(data.totalSemana || 0)}</strong></span>
            {data.totalAtrasado > 0 && (
              <span className="text-sm" style={{ color: 'var(--color-danger)' }}>· Atrasado em aberto: <strong>{formatCurrency(data.totalAtrasado)}</strong></span>
            )}
          </div>

          {data.totalAtrasado > 0 && (
            <div className="card" style={{ borderColor: 'var(--color-danger)', marginBottom: 14 }}>
              <h4 style={{ margin: '0 0 8px', color: 'var(--color-danger)' }}>Atrasados (não pagos)</h4>
              <table className="table">
                <thead><tr><th>Descrição</th><th>Beneficiário</th><th>Venceu</th><th className="text-right">Valor</th></tr></thead>
                <tbody>
                  {(data.atrasados || []).map((i: any) => (
                    <tr key={i.id}>
                      <td>{i.descricao}</td>
                      <td className="text-sm text-secondary">{i.beneficiario || '—'}</td>
                      <td className="text-sm">{formatDate(i.vencimento)}</td>
                      <td className="text-right money">{formatCurrency(i.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(data.porDia || []).map((d: any) => (
            <div key={d.label} style={{ marginBottom: 12 }}>
              <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 2px' }}>
                <strong>{d.label} · {formatDate(d.data)}</strong>
                <span className="money text-secondary">{formatCurrency(d.total || 0)}</span>
              </div>
              {d.itens.length === 0 ? (
                <div className="text-sm text-secondary" style={{ padding: '2px 4px 8px' }}>Sem pagamentos.</div>
              ) : (
                <table className="table">
                  <tbody>
                    {d.itens.map((i: any) => (
                      <tr key={i.id}>
                        <td>{i.descricao} <span className="badge badge--neutral">{i.categoria}</span></td>
                        <td className="text-sm text-secondary">{i.beneficiario || '—'}</td>
                        <td className="text-right money">{formatCurrency(i.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ───────────────────────── Fluxo de Caixa ─────────────────────────
function FluxoTab() {
  const [meses, setMeses] = useState(6);
  const { data, loading, error } = useApi<any>(() => Api.finFluxoCaixa(meses), [meses]);
  return (
    <div className="card">
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h3 className="card__title" style={{ margin: 0 }}>Fluxo de Caixa — realizado x projetado</h3>
        <div className="field" style={{ margin: 0 }}>
          <label className="field__label">Histórico (meses)</label>
          <select className="field__select" value={meses} onChange={(e) => setMeses(Number(e.target.value))}>
            {[3, 6, 12, 18].map((m) => <option key={m} value={m}>{m} meses</option>)}
          </select>
        </div>
      </div>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} />}
      {data && (
        <table className="table">
          <thead>
            <tr>
              <th>Mês</th>
              <th className="text-right">Entradas (real)</th>
              <th className="text-right">Saídas (real)</th>
              <th className="text-right">Líquido real</th>
              <th className="text-right">Líquido projetado</th>
              <th className="text-right">Saldo acumulado</th>
            </tr>
          </thead>
          <tbody>
            {(data.meses || []).map((m: any, idx: number) => (
              <tr key={idx} style={m.futuro ? { opacity: 0.7, fontStyle: 'italic' } : undefined}>
                <td>{m.label}{m.futuro ? ' (proj.)' : ''}</td>
                <td className="text-right money" style={{ color: 'var(--money-positive)' }}>{formatCurrencyShort(m.entradasReal)}</td>
                <td className="text-right money" style={{ color: 'var(--money-negative)' }}>{formatCurrencyShort(m.saidasReal)}</td>
                <td className="text-right money" style={{ color: m.liquidoReal >= 0 ? 'var(--money-positive)' : 'var(--money-negative)' }}>{formatCurrencyShort(m.liquidoReal)}</td>
                <td className="text-right money" style={{ color: m.liquidoProjetado >= 0 ? 'var(--money-positive)' : 'var(--money-negative)' }}>{formatCurrencyShort(m.liquidoProjetado)}</td>
                <td className="text-right money" style={{ fontWeight: 700, color: m.saldoAcumulado >= 0 ? 'var(--money-positive)' : 'var(--money-negative)' }}>{formatCurrencyShort(m.saldoAcumulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ───────────────────────── Contas a Pagar/Receber (aging) ─────────────────────────
const FAIXA_LABEL: Record<string, string> = { aVencer: 'A vencer', d1_30: '1–30 dias', d31_60: '31–60 dias', d60: '60+ dias' };
function ContasTab() {
  const [tipo, setTipo] = useState<'PAGAR' | 'RECEBER'>('PAGAR');
  const { data, loading, error } = useApi<any>(() => Api.finContas(tipo), [tipo]);
  return (
    <div className="card">
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h3 className="card__title" style={{ margin: 0 }}>Contas a {tipo === 'PAGAR' ? 'Pagar' : 'Receber'}</h3>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={'tab ' + (tipo === 'PAGAR' ? 'tab--active' : '')} onClick={() => setTipo('PAGAR')}>A Pagar</button>
          <button className={'tab ' + (tipo === 'RECEBER' ? 'tab--active' : '')} onClick={() => setTipo('RECEBER')}>A Receber</button>
        </div>
      </div>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} />}
      {data && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 16 }}>
            {(['aVencer', 'd1_30', 'd31_60', 'd60'] as const).map((f) => (
              <div className="kpi" key={f}>
                <div className="kpi__label">{FAIXA_LABEL[f]}</div>
                <div className="kpi__value" style={{ color: f === 'aVencer' ? 'var(--text-primary)' : 'var(--money-negative)' }}>
                  {formatCurrencyShort(data.aging?.[f] || 0)}
                </div>
              </div>
            ))}
          </div>
          <table className="table">
            <thead>
              <tr><th>Descrição</th><th>Categoria</th><th>Beneficiário</th><th>Vencimento</th><th>Faixa</th><th className="text-right">Valor</th></tr>
            </thead>
            <tbody>
              {(data.itens || []).map((i: any) => (
                <tr key={i.id}>
                  <td>{i.descricao}</td>
                  <td><span className="badge badge--neutral">{i.categoria}</span></td>
                  <td className="text-sm text-secondary">{i.beneficiario || '—'}</td>
                  <td className="text-sm">{formatDate(i.vencimento)}{i.diasAtraso ? <span style={{ color: 'var(--color-danger)' }}> ({i.diasAtraso}d)</span> : null}</td>
                  <td className="text-sm">{FAIXA_LABEL[i.faixa] || i.faixa}</td>
                  <td className="text-right money">{formatCurrency(i.valor)}</td>
                </tr>
              ))}
              {!data.itens?.length && (
                <tr><td colSpan={6} className="text-secondary text-sm" style={{ textAlign: 'center', padding: 24 }}>Nada em aberto.</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ───────────────────────── Planejamento (pago x pendente) ─────────────────────────
function PlanejamentoTab() {
  const { data, loading, error } = useApi<any>(() => Api.finPlanejamento());
  return (
    <div className="card">
      <h3 className="card__title">Planejamento — pago x pendente</h3>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock error={error} />}
      {data && (
        <>
          <h4 style={{ margin: '12px 0 6px' }}>Por status</h4>
          <table className="table">
            <thead><tr><th>Status</th><th>Tipo</th><th className="text-right">Qtde</th><th className="text-right">Valor</th></tr></thead>
            <tbody>
              {(data.porStatus || []).map((s: any, i: number) => (
                <tr key={i}>
                  <td><span className="badge badge--neutral">{s.status}</span></td>
                  <td className="text-sm" style={{ color: s.tipo === 'SAIDA' ? 'var(--money-negative)' : 'var(--money-positive)' }}>{s.tipo}</td>
                  <td className="text-right">{s.count}</td>
                  <td className="text-right money">{formatCurrency(s.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4 style={{ margin: '20px 0 6px' }}>Saídas por categoria</h4>
          <table className="table">
            <thead><tr><th>Categoria</th><th className="text-right">Valor</th></tr></thead>
            <tbody>
              {(data.saidasPorCategoria || []).map((c: any, i: number) => (
                <tr key={i}><td>{c.categoria}</td><td className="text-right money">{formatCurrency(c.valor)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ───────────────────────── Importar base antiga ─────────────────────────
function ImportarTab({ onDone }: { onDone: () => void }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const toast = useToast();

  const parseCsv = (raw: string): any[] => {
    const linhas = raw.trim().split(/\r?\n/).filter((l) => l.trim());
    if (!linhas.length) return [];
    const head = linhas[0].split(/[;,]/).map((h) => h.trim().toLowerCase());
    const tem = (k: string) => head.includes(k);
    // Se a 1ª linha não tem cabeçalho conhecido, assume ordem fixa.
    const temHeader = tem('tipo') || tem('valor') || tem('descricao') || tem('descrição');
    const body = temHeader ? linhas.slice(1) : linhas;
    const col = (cells: string[], names: string[]) => {
      for (const n of names) { const idx = head.indexOf(n); if (idx >= 0) return cells[idx]; }
      return undefined;
    };
    return body.map((l) => {
      const cells = l.split(/[;,]/).map((c) => c.trim());
      const v = temHeader ? {
        tipo: (col(cells, ['tipo']) || 'SAIDA').toUpperCase(),
        categoria: col(cells, ['categoria']) || 'OUTRO',
        descricao: col(cells, ['descricao', 'descrição']) || 'Importado',
        valor: col(cells, ['valor']),
        status: (col(cells, ['status']) || 'PAGO').toUpperCase(),
        vencimento: col(cells, ['vencimento']) || null,
        pagoEm: col(cells, ['pagoem', 'pago_em', 'pagamento']) || null,
        beneficiario: col(cells, ['beneficiario', 'beneficiário']) || null,
      } : {
        // ordem fixa: tipo;categoria;descricao;valor;status;vencimento;beneficiario
        tipo: (cells[0] || 'SAIDA').toUpperCase(), categoria: cells[1] || 'OUTRO',
        descricao: cells[2] || 'Importado', valor: cells[3],
        status: (cells[4] || 'PAGO').toUpperCase(), vencimento: cells[5] || null, beneficiario: cells[6] || null,
      };
      const num = Number(String(v.valor || '').replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
      return { ...v, valor: num || 0, vencimento: v.vencimento || null };
    }).filter((r) => r.valor && r.descricao);
  };

  const enviar = async () => {
    const items = parseCsv(texto);
    if (!items.length) { toast.error('Nada para importar — verifique o formato.'); return; }
    setEnviando(true); setResultado(null);
    try {
      const r: any = await Api.finImportar(items);
      setResultado(`${r.importados} lançamento(s) importado(s).`);
      toast.success(`${r.importados} importado(s)`);
      setTexto('');
      onDone();
    } catch (e: any) {
      toast.error('Erro ao importar: ' + (e?.message || 'falha'));
    } finally {
      setEnviando(false);
    }
  };

  const prev = parseCsv(texto);
  return (
    <div className="card">
      <h3 className="card__title">Importar base antiga (parcelas / comissões / lançamentos)</h3>
      <p className="text-secondary text-sm" style={{ margin: '6px 0 14px' }}>
        Cole os dados em CSV (separados por <code>;</code> ou <code>,</code>). Cabeçalho aceito:
        <code> tipo;categoria;descricao;valor;status;vencimento;beneficiario</code>. Sem cabeçalho, usa essa ordem.
        Valores em reais (ex.: <code>1.500,00</code>). Status padrão: <strong>PAGO</strong>.
      </p>
      <textarea
        className="field__input"
        style={{ width: '100%', minHeight: 180, fontFamily: 'monospace', fontSize: 13 }}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={'SAIDA;COMISSAO;Comissão venda 102;1.500,00;PAGO;2025-03-10;João Silva\nENTRADA;VENDA;Entrada apto 51;25.000,00;PAGO;2025-02-01;'}
      />
      <div className="flex gap-2" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <span className="text-secondary text-sm">{prev.length} linha(s) válida(s) detectada(s){resultado ? ` · ${resultado}` : ''}</span>
        <button className="btn btn--primary" disabled={enviando || !prev.length} onClick={enviar}>
          {enviando ? 'Importando...' : `Importar ${prev.length || ''}`}
        </button>
      </div>
    </div>
  );
}
