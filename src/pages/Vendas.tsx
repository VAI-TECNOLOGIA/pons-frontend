import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Auth } from '../lib/auth';
import { formatCurrencyShort, initials } from '../lib/format';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';

const STATUS_MAP: Record<string, [string, string]> = {
 PRE_ANALISE: ['analysis', 'Pré-análise'],
 ANALISE_JURIDICA: ['analysis', 'Análise jurídica'],
 EM_ASSINATURA: ['signature', 'Em assinatura'],
 ASSINADO: ['signed', 'Assinado'],
 CANCELADO: ['cancelled', 'Cancelado'],
};

export default function Vendas() {
 const [selected, setSelected] = useState<number | null>(null);
 const [openNew, setOpenNew] = useState(false);
 const { data: vendas, loading, error, reload } = useApi<any[]>(() => Api.vendas());
 const { data: emps } = useApi<any[]>(() => Api.empreendimentos());
 const { data: corretores } = useApi<any[]>(() => Api.corretores());
 const toast = useToast();
 const role = Auth.user?.role;
 const podeEditarStatus = role === 'CEO' || role === 'DIRETOR_FINANCEIRO';

 const submit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const fd = new FormData(e.currentTarget);
 const num = (v: FormDataEntryValue | null) =>
 Number(String(v || '').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
 try {
 const r = await Api.vendaCreate({
 clienteNome: String(fd.get('clienteNome') || ''),
 clienteCpf: fd.get('clienteCpf') ? String(fd.get('clienteCpf')) : undefined,
 clienteEmail: fd.get('clienteEmail') ? String(fd.get('clienteEmail')) : undefined,
 clienteTelefone: fd.get('clienteTelefone') ? String(fd.get('clienteTelefone')) : undefined,
 empreendimentoId: Number(fd.get('empreendimentoId')),
 corretorTitularId: Number(fd.get('corretorTitularId') || 0),
 unidade: String(fd.get('unidade') || ''),
 tipologia: fd.get('tipologia') ? String(fd.get('tipologia')) : undefined,
 valorVenda: num(fd.get('valorVenda')),
 entradaTotal: num(fd.get('entradaTotal')),
 entradaParcelas: Number(fd.get('entradaParcelas')) || 1,
 percentualComissao: num(fd.get('percentualComissao')),
 splitCorretor: num(fd.get('splitCorretor')) || 55,
 splitGerente: num(fd.get('splitGerente')) || 15,
 splitCasa: num(fd.get('splitCasa')) || 30,
 // Sinalizadores Pons
 temNotaFiscal: fd.get('temNotaFiscal') === 'on',
 isLead: fd.get('isLead') === 'on',
 lazaroEstrategia: String(fd.get('lazaroEstrategia') || 'CAMPANHA'),
 splitVariante: String(fd.get('splitVariante') || '55_45'),
 percentualGestor: Number(fd.get('percentualGestorPons') || 10),
 });
 toast.success('Venda registrada');
 setOpenNew(false);
 await reload();
 if (r?.id) setSelected(r.id);
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || err.details?.message || 'falha'));
 }
 };

 const atualizarStatus = async (id: number, status: string) => {
 try {
 await Api.vendaUpdateStatus(id, status);
 toast.success('Status atualizado');
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 if (loading) return <Shell onNew={() => setOpenNew(true)}><LoadingBlock /></Shell>;
 if (error) return <Shell onNew={() => setOpenNew(true)}><ErrorBlock error={error} /></Shell>;
 if (!vendas) return null;
 const sel = selected ? vendas.find((v: any) => v.id === selected) : null;

 return (
 <>
 <Topbar
 title="Vendas"
 right={
 <button className="btn btn--primary btn--sm" onClick={() => setOpenNew(true)}>
 + Nova Venda
 </button>
 }
 />
 <div className="main__content">
 <PageHeader
 breadcrumb="Comercial · Vendas"
 title={`${vendas.length} vendas`}
 subtitle="Clique numa venda para ver comissão, rateio e plano de recebimento"
 />

 <div className="card" style={{ padding: 0 }}>
 <table className="table">
 <thead>
 <tr>
 <th>Código</th>
 <th>Cliente</th>
 <th>Empreendimento</th>
 <th>Corretor</th>
 <th className="numeric">Valor</th>
 <th>Status</th>
 </tr>
 </thead>
 <tbody>
 {vendas.map((v: any) => {
 const [k, lbl] = STATUS_MAP[v.status] || ['neutral', v.status];
 const cliente = v.clienteNome || v.cliente || '—';
 const empNome = typeof v.empreendimento === 'string' ? v.empreendimento : v.empreendimento?.nome || '';
 const corrNome = typeof v.corretor === 'string' ? v.corretor : v.corretor?.nome || v.corretorTitular?.user?.name || '—';
 const corrInit = v.corretor?.initials || initials(corrNome);
 const valor = v.valorVenda ?? v.valor ?? 0;
 return (
 <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(v.id)}>
 <td className="font-semibold">#{v.codigo || String(v.id).padStart(5, '0')}</td>
 <td>{cliente}</td>
 <td>
 {empNome} · {v.unidade}
 </td>
 <td>
 <div className="flex gap-2" style={{ alignItems: 'center' }}>
 <div className="avatar avatar--sm">{corrInit}</div>
 {corrNome.split(' ')[0]}
 </div>
 </td>
 <td className="numeric money">{formatCurrencyShort(valor)}</td>
 <td>
 <span className={`badge badge--${k}`}>{lbl}</span>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>

 {sel && (
 <div
 role="dialog"
 onClick={(e) => {
 if (e.target === e.currentTarget) setSelected(null);
 }}
 style={{
 position: 'fixed',
 inset: 0,
 background: 'rgba(38,54,84,0.5)',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 zIndex: 500,
 }}
 >
 <div style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderRadius: 14, maxWidth: 720, width: '96%', boxShadow: 'var(--shadow-xl)' }}>
 <div style={{ background: 'linear-gradient(135deg,#0F1729,#1A2444)', color: '#fff', padding: '24px 28px', borderRadius: '14px 14px 0 0' }}>
 <div className="flex-between" style={{ alignItems: 'flex-start' }}>
 <div>
 <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
 Venda #{String(sel.id).padStart(5, '0')}
 </div>
 <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{sel.clienteNome || sel.cliente}</div>
 <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
 {(typeof sel.empreendimento === 'string' ? sel.empreendimento : sel.empreendimento?.nome) || ''} · {sel.unidade} · {sel.corretorTitular?.user?.name || sel.corretor?.nome || sel.corretor}
 </div>
 </div>
 <div style={{ textAlign: 'right' }}>
 <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
 Valor da venda
 </div>
 <div style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', color: '#88C559' }}>
 {formatCurrencyShort(sel.valorVenda ?? sel.valor)}
 </div>
 </div>
 </div>
 </div>
 <div style={{ padding: '24px 28px' }}>
 <div className="text-secondary text-sm" style={{ marginBottom: 16 }}>
 Comissão estimada: <strong>{formatCurrencyShort(sel.comissao ?? (sel.valorVenda ?? sel.valor) * 0.05)}</strong>
 </div>
 <div style={{ margin: '16px 0', padding: '14px 16px', background: 'var(--bg-card-hover)', borderRadius: 10 }}>
 <div className="uppercase-tag" style={{ marginBottom: 8 }}>Status da venda</div>
 {podeEditarStatus ? (
 <select
 className="field__select"
 value={sel.status}
 onChange={(e) => atualizarStatus(sel.id, e.target.value)}
 style={{ width: 'auto', minWidth: 200 }}
 >
 {Object.entries(STATUS_MAP).map(([val, [, lbl]]) => (
 <option key={val} value={val}>{lbl}</option>
 ))}
 </select>
 ) : (
 <div className="text-xs text-secondary">Somente Financeiro/CEO altera o status.</div>
 )}
 </div>
 <div className="flex" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
 <button className="btn btn--secondary" onClick={() => setSelected(null)}>
 Fechar
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 <Modal open={openNew} onClose={() => setOpenNew(false)} title="Nova Venda" subtitle="Cadastre cliente, imóvel e rateio de comissão" size="lg">
 <form onSubmit={submit}>
 <div className="uppercase-tag" style={{ marginBottom: 8 }}>Cliente</div>
 <div className="form-grid" style={{ marginBottom: 16 }}>
 <div className="field field--span-2">
 <label className="field__label">Nome do cliente <span className="field__required">*</span></label>
 <input name="clienteNome" className="field__input" required />
 </div>
 <div className="field">
 <label className="field__label">CPF</label>
 <input name="clienteCpf" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Telefone</label>
 <input name="clienteTelefone" className="field__input" />
 </div>
 <div className="field field--span-2">
 <label className="field__label">E-mail</label>
 <input name="clienteEmail" type="email" className="field__input" />
 </div>
 </div>

 <div className="uppercase-tag" style={{ marginBottom: 8 }}>Imóvel & corretor</div>
 <div className="form-grid" style={{ marginBottom: 16 }}>
 <div className="field">
 <label className="field__label">Empreendimento <span className="field__required">*</span></label>
 <select name="empreendimentoId" className="field__select" required>
 {(emps || []).map((e: any) => (
 <option key={e.id} value={e.id}>{e.nome}</option>
 ))}
 </select>
 </div>
 <div className="field">
 <label className="field__label">Unidade <span className="field__required">*</span></label>
 <input name="unidade" className="field__input" required placeholder="Apt 1207 · Torre A" />
 </div>
 <div className="field">
 <label className="field__label">Tipologia</label>
 <input name="tipologia" className="field__input" placeholder="3 suítes" />
 </div>
 <div className="field">
 <label className="field__label">Corretor titular <span className="field__required">*</span></label>
 <select name="corretorTitularId" className="field__select" required>
 {(corretores || []).map((c: any) => (
 <option key={c.id} value={c.id}>{c.nome}</option>
 ))}
 </select>
 </div>
 </div>

 <div className="uppercase-tag" style={{ marginBottom: 8 }}>Valores</div>
 <div className="form-grid" style={{ marginBottom: 16 }}>
 <div className="field">
 <label className="field__label">Valor da venda <span className="field__required">*</span></label>
 <input name="valorVenda" className="field__input" required placeholder="780000" />
 </div>
 <div className="field">
 <label className="field__label">Entrada total</label>
 <input name="entradaTotal" className="field__input" placeholder="156000" />
 </div>
 <div className="field">
 <label className="field__label">Parcelas da entrada</label>
 <input name="entradaParcelas" type="number" min={1} className="field__input" defaultValue="5" />
 </div>
 </div>

 <div className="uppercase-tag" style={{ marginBottom: 8 }}>Comissão & rateio Pons</div>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
 <div className="field">
 <label className="field__label">% Comissão (sobre venda)</label>
 <input type="number" step="0.01" name="percentualComissao" className="field__input" defaultValue="5" />
 </div>
 <div className="field">
 <label className="field__label">Split</label>
 <select name="splitVariante" className="field__select" defaultValue="55_45">
 <option value="55_45">Corretor 55% / Imob. 45%</option>
 <option value="50_50">Corretor 50% / Imob. 50%</option>
 </select>
 </div>
 <div className="field">
 <label className="field__label">% Gestor</label>
 <select name="percentualGestorPons" className="field__select" defaultValue="10">
 <option value="10">10%</option><option value="13">13%</option>
 </select>
 </div>
 <div className="field">
 <label className="field__label">Estratégia (se Lead)</label>
 <select name="lazaroEstrategia" className="field__select" defaultValue="CAMPANHA">
 <option value="CAMPANHA">Campanha (-6,5%)</option>
 <option value="LAZARO">Lázaro (-3% corretor / -1% imob.)</option>
 </select>
 </div>
 </div>
 <div className="flex" style={{ gap: 16, marginBottom: 16 }}>
 <label style={{ display: 'flex', gap: 6 }}><input type="checkbox" name="temNotaFiscal" /> Tem Nota Fiscal (-16%)</label>
 <label style={{ display: 'flex', gap: 6 }}><input type="checkbox" name="isLead" /> Veio de Lead</label>
 </div>
 {/* Legacy fields (mantidos como hidden pra não quebrar legado) */}
 <input type="hidden" name="splitCorretor" value="55" />
 <input type="hidden" name="splitGerente" value="15" />
 <input type="hidden" name="splitCasa" value="30" />

 <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
 <button type="button" className="btn btn--secondary" onClick={() => setOpenNew(false)}>Cancelar</button>
 <button type="submit" className="btn btn--primary">Criar venda</button>
 </div>
 </form>
 </Modal>
 </div>
 </>
 );
}

function Shell({ children, onNew }: { children: React.ReactNode; onNew?: () => void }) {
 return (
 <>
 <Topbar
 title="Vendas"
 right={<button className="btn btn--primary btn--sm" onClick={onNew}>+ Nova Venda</button>}
 />
 <div className="main__content">
 <PageHeader breadcrumb="Comercial · Vendas" title="Vendas" />
 {children}
 </div>
 </>
 );
}
