import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { formatCurrency, formatCurrencyShort, formatDate } from '../lib/format';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

const STATUS_BADGE: Record<string, [string, string]> = {
 PENDENTE: ['analysis', 'PENDENTE'],
 AGUARDANDO_APROVACAO: ['analysis', 'AGUARDANDO'],
 APROVADO: ['signature', 'APROVADO'],
 PAGO: ['paid', 'PAGO'],
 AGENDADO: ['neutral', 'AGENDADO'],
 CANCELADO: ['cancelled', 'CANCELADO'],
};

type Tab = 'extrato' | 'dre' | 'fluxo' | 'contas' | 'planejamento' | 'comissoes' | 'sicredi';

export default function Financeiro() {
 const [tab, setTab] = useState<Tab>('extrato');
 const [openNew, setOpenNew] = useState(false);
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
 <button className="btn btn--primary btn--sm" onClick={enviarSicredi}>Enviar ao Sicredi</button>
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
 ['extrato', ' Extrato'],
 ['dre', ' DRE'],
 ['fluxo', ' Fluxo de Caixa'],
 ['contas', ' Contas a Pagar/Receber'],
 ['planejamento', '️ Planejamento'],
 ['comissoes', ' Comissões & Plano'],
 ['sicredi', ' Sicredi'],
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

 {tab === 'extrato' && (
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
 {(lancamentos || []).length === 0 ? (
 <tr>
 <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
 Nenhum lançamento ainda
 </td>
 </tr>
 ) : (
 (lancamentos || []).map((l: any) => {
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
 {l.status === 'AGUARDANDO_APROVACAO' && (
 <button className="btn btn--secondary btn--sm" onClick={() => aprovar(l.id)}>Aprovar</button>
 )}
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>
 )}

 {tab === 'dre' && (
 <div className="card">
 <h3 className="card__title">DRE — Demonstrativo de Resultado</h3>
 <div style={{ marginTop: 16 }}>
 <DreRow label="Receita bruta" value={5_800_000} />
 <DreRow label="Comissões pagas" value={-580_000} />
 <DreRow label="Folha de pagamento" value={-420_000} />
 <DreRow label="Aluguel & infraestrutura" value={-48_000} />
 <DreRow label="Marketing" value={-46_000} />
 <DreRow label="Impostos & taxas" value={-220_000} />
 <DreRow label="Outras despesas" value={-86_000} />
 <DreRow label="Resultado líquido" value={4_400_000} strong />
 </div>
 </div>
 )}

 {(tab === 'fluxo' || tab === 'contas' || tab === 'planejamento' || tab === 'comissoes' || tab === 'sicredi') && (
 <div className="card">
 <h3 className="card__title">Em desenvolvimento</h3>
 <p className="text-secondary">
 Esta aba será habilitada quando o backend financeiro estiver plugado. Por enquanto, use o resumo no topo e a aba Extrato.
 </p>
 </div>
 )}
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
 <select name="metodo" className="field__select" defaultValue="PIX">
 <option>PIX</option>
 <option>TED</option>
 <option>BOLETO</option>
 </select>
 </div>
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
 <button className="btn btn--primary btn--sm" onClick={onSicredi}>Enviar ao Sicredi</button>
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
