import { useState, useRef, useEffect } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Auth } from '../lib/auth';
import { Icon } from '../components/Icon';
import { formatCurrencyShort, initials } from '../lib/format';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useKanbanDnd } from '../lib/useKanbanDnd';

const STATUS_MAP: Record<string, [string, string]> = {
 PRE_ANALISE: ['analysis', 'Contrato em análise'],
 ANALISE_JURIDICA: ['analysis', 'Análise jurídica'],
 EM_ASSINATURA: ['signature', 'Em assinatura'],
 ASSINADO: ['signed', 'Assinado'],
 ASSINADO_AGUARDANDO_PAGAMENTO: ['signature', 'Assinado — aguardando pagamento'],
 INADIMPLENTE: ['cancelled', 'Inadimplente'],
 PAGO: ['signed', 'Pago'],
 AGUARDANDO_REPASSE: ['analysis', 'Aguardando repasse'],
 CANCELADO: ['cancelled', 'Cancelado'],
};

export default function Vendas() {
 const [selected, setSelected] = useState<number | null>(null);
 const [openNew, setOpenNew] = useState(false);
 const [view, setView] = useState<'lista' | 'kanban'>('lista');
 const { data: vendas, loading, error, reload } = useApi<any[]>(() => Api.vendas());
 const { data: emps } = useApi<any[]>(() => Api.empreendimentos());
 const { data: corretores } = useApi<any[]>(() => Api.corretores());
 const toast = useToast();
 const role = Auth.user?.role;
 const isCorretor = role === 'CORRETOR';
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
 aplicarGestorTrafego: fd.get('aplicarGestorTrafego') === 'on',
 });
 toast.success(r?.aguardandoAprovacao
 ? 'Venda registrada — parcelamento 4x+ enviado pro Paulo aprovar.'
 : 'Venda registrada');
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

 <ParcelasAtrasadas onSelect={setSelected} />

 <div className="flex gap-2" style={{ marginBottom: 12 }}>
 <button
 className={`btn btn--sm ${view === 'lista' ? 'btn--primary' : 'btn--secondary'}`}
 onClick={() => setView('lista')}
 >
 Lista
 </button>
 <button
 className={`btn btn--sm ${view === 'kanban' ? 'btn--primary' : 'btn--secondary'}`}
 onClick={() => setView('kanban')}
 >
 Kanban
 </button>
 </div>

 {view === 'kanban' ? (
 <VendaKanban onSelect={setSelected} podeMover={podeEditarStatus} />
 ) : (
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
 )}

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
 <div style={{ background: 'linear-gradient(135deg,#15171C,#0B0C10)', color: '#fff', padding: '24px 28px', borderRadius: '14px 14px 0 0' }}>
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

 {sel.aguardandoAprovacao && (
 <div style={{ margin: '16px 0', padding: '14px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 10 }}>
 <div style={{ fontWeight: 700, fontSize: 13, color: '#B45309', marginBottom: 4 }}>
 Parcelamento {sel.entradaParcelas}x aguardando aprovação do Paulo
 </div>
 {role === 'CEO' ? (
 <button
 className="btn btn--primary btn--sm"
 style={{ marginTop: 6 }}
 onClick={async () => {
 try {
 await Api.vendaAprovar(sel.id);
 toast.success('Parcelamento aprovado.');
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 }}
 >
 Aprovar parcelamento
 </button>
 ) : (
 <div className="text-xs text-secondary">Só o Paulo (CEO) libera esse parcelamento.</div>
 )}
 </div>
 )}

 <VendaParcelas vendaId={sel.id} podeConfirmar={podeEditarStatus} />

 <VendaDocumentos vendaId={sel.id} podeRemover={podeEditarStatus} />

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

 {isCorretor ? (
 /* Corretor não tem visão de rateio/comissão — manda só os defaults */
 <>
 <input type="hidden" name="percentualComissao" value="5" />
 <input type="hidden" name="splitVariante" value="55_45" />
 <input type="hidden" name="percentualGestorPons" value="10" />
 <input type="hidden" name="lazaroEstrategia" value="CAMPANHA" />
 </>
 ) : (
 <>
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
 <div className="flex" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
 <label style={{ display: 'flex', gap: 6 }}><input type="checkbox" name="temNotaFiscal" /> Tem Nota Fiscal (-16%)</label>
 <label style={{ display: 'flex', gap: 6 }}><input type="checkbox" name="isLead" /> Veio de Lead</label>
 <label style={{ display: 'flex', gap: 6 }} title="6,5% sobre o que sobra pra imobiliária (encadeado, não sobre o valor cheio)">
 <input type="checkbox" name="aplicarGestorTrafego" /> Gestor de tráfego (-6,5% s/ saldo imob.)
 </label>
 </div>
 {/* Legacy fields (mantidos como hidden pra não quebrar legado) */}
 <input type="hidden" name="splitCorretor" value="55" />
 <input type="hidden" name="splitGerente" value="15" />
 <input type="hidden" name="splitCasa" value="30" />
 </>
 )}

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

// Kanban comercial/financeiro: colunas por fase da venda (contrato em análise →
// assinatura → assinado aguardando pagamento → inadimplente → pago → repasse).
function VendaKanban({ onSelect, podeMover }: { onSelect: (id: number) => void; podeMover: boolean }) {
 // Hooks ANTES de qualquer return condicional (Rules of Hooks).
 const { data, loading, error } = useApi<{ colunas: any[] }>(() => Api.vendaKanban());
 const [colunas, setColunas] = useState<any[]>([]);
 const toast = useToast();
 useEffect(() => { if (data) setColunas(data.colunas); }, [data]);

 // Move otimista: tira o card da coluna de origem, joga na de destino, ajusta
 // totais. Em erro, reverte. Só dispara pra quem pode editar status.
 const moveVenda = async (id: number, toFase: string) => {
 let card: any = null;
 let fromFase: string | undefined;
 for (const col of colunas) {
 const found = col.cards.find((c: any) => c.id === id);
 if (found) { card = found; fromFase = col.fase; break; }
 }
 if (!card || fromFase === toFase) return;
 const prev = colunas;
 const valor = card.valorVenda || 0;
 setColunas((cur) => cur.map((col) => {
 if (col.fase === fromFase) return { ...col, cards: col.cards.filter((c: any) => c.id !== id), total: col.total - 1, valorTotal: col.valorTotal - valor };
 if (col.fase === toFase) return { ...col, cards: [card, ...col.cards], total: col.total + 1, valorTotal: col.valorTotal + valor };
 return col;
 }));
 try {
 await Api.vendaUpdateStatus(id, toFase);
 toast.success(`Venda movida para "${STATUS_MAP[toFase]?.[1] || toFase}"`);
 } catch (err: any) {
 setColunas(prev);
 toast.error('Erro ao mover: ' + (err?.message || 'falha'));
 }
 };

 const dnd = useKanbanDnd(moveVenda);

 if (loading) return <LoadingBlock />;
 if (error) return <ErrorBlock error={error} />;
 return (
 <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
 {colunas.map((col) => {
 const [k] = STATUS_MAP[col.fase] || ['neutral'];
 const isDropTarget = podeMover && dnd.hoverCol === col.fase;
 return (
 <div
 key={col.fase}
 data-kanban-col={col.fase}
 style={{
 minWidth: 260,
 flex: '0 0 260px',
 borderRadius: 10,
 padding: 4,
 outline: isDropTarget ? '2px dashed var(--pons-blue, #2563eb)' : '2px dashed transparent',
 background: isDropTarget ? 'var(--bg-card-hover)' : 'transparent',
 transition: 'outline-color .12s, background .12s',
 }}
 onDragOver={podeMover ? dnd.onDragOver(col.fase) : undefined}
 onDragLeave={podeMover ? dnd.onDragLeave(col.fase) : undefined}
 onDrop={podeMover ? dnd.onDrop(col.fase) : undefined}
 >
 <div className="flex" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
 <span className={`badge badge--${k}`}>{col.label}</span>
 <span className="text-xs text-secondary">
 {col.total} · {formatCurrencyShort(col.valorTotal)}
 </span>
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
 {col.cards.map((c: any) => (
 <div
 key={c.id}
 className="card"
 draggable={podeMover}
 onDragStart={podeMover ? dnd.onDragStart(c.id) : undefined}
 onDragEnd={podeMover ? dnd.onDragEnd : undefined}
 onPointerDown={podeMover ? dnd.onPointerDown(c.id) : undefined}
 style={{
 padding: 12,
 cursor: podeMover ? 'grab' : 'pointer',
 opacity: dnd.draggingId === c.id ? 0.45 : 1,
 }}
 onClick={() => onSelect(c.id)}
 >
 <div className="font-semibold">{c.clienteNome}</div>
 <div className="text-xs text-secondary">
 #{c.codigo} · {c.empreendimento}
 </div>
 <div className="flex" style={{ alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
 <span className="money">{formatCurrencyShort(c.valorVenda)}</span>
 <div className="avatar avatar--sm" title={c.corretor?.nome}>
 {c.corretor?.initials || initials(c.corretor?.nome || '')}
 </div>
 </div>
 {c.aguardandoAprovacao && (
 <div className="text-xs" style={{ color: 'var(--warning, #b45309)', marginTop: 6 }}>
 Aguardando aprovação {c.entradaParcelas}x
 </div>
 )}
 </div>
 ))}
 {!col.cards.length && (
 <div className="text-xs text-secondary" style={{ textAlign: 'center', padding: 8 }}>
 {isDropTarget ? 'Soltar aqui' : '—'}
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 );
}

// Documentos do protocolo (fotos/PDFs) anexados à venda.
function VendaDocumentos({ vendaId, podeRemover }: { vendaId: number; podeRemover?: boolean }) {
 const toast = useToast();
 const [docs, setDocs] = useState<any[]>([]);
 const [busy, setBusy] = useState(false);
 const fileRef = useRef<HTMLInputElement>(null);

 const load = async () => {
 try { setDocs(await Api.vendaDocumentos(vendaId)); } catch { /* ignore */ }
 };
 useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vendaId]);

 const upload = async (files: FileList | File[]) => {
 const list = Array.from(files);
 if (!list.length) return;
 setBusy(true);
 try {
 await Api.vendaDocumentoUpload(vendaId, list);
 toast.success(`${list.length} arquivo(s) anexado(s).`);
 await load();
 } catch (err: any) {
 toast.error('Erro ao anexar: ' + (err?.message || 'falha'));
 } finally {
 setBusy(false);
 if (fileRef.current) fileRef.current.value = '';
 }
 };

 const remover = async (docId: number) => {
 try {
 await Api.vendaDocumentoDelete(vendaId, docId);
 await load();
 } catch (err: any) {
 toast.error('Erro: ' + (err?.message || 'falha'));
 }
 };

 return (
 <div style={{ margin: '16px 0', padding: '14px 16px', background: 'var(--bg-card-hover)', borderRadius: 10 }}>
 <div className="flex-between" style={{ marginBottom: 8, alignItems: 'center' }}>
 <div className="uppercase-tag">Documentos do protocolo</div>
 <label className="btn btn--secondary btn--sm" style={{ cursor: busy ? 'wait' : 'pointer' }}>
 <Icon name="plus" size={13} /> {busy ? 'Enviando…' : 'Anexar'}
 <input
 ref={fileRef}
 type="file"
 multiple
 accept="image/*,application/pdf"
 style={{ display: 'none' }}
 disabled={busy}
 onChange={(e) => e.target.files && upload(e.target.files)}
 />
 </label>
 </div>
 {docs.length === 0 ? (
 <div className="text-xs text-secondary">Nenhum documento anexado. Fotos e PDFs até 15MB.</div>
 ) : (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
 {docs.map((d) => (
 <div key={d.id} className="flex-between" style={{ alignItems: 'center', padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 8 }}>
 <a href={d.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--pons-blue, #2563eb)', textDecoration: 'none', overflow: 'hidden' }}>
 <Icon name="doc" size={14} />
 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nome}</span>
 </a>
 {podeRemover && (
 <button className="btn btn--ghost btn--sm" onClick={() => remover(d.id)} title="Remover">
 <Icon name="trash" size={12} />
 </button>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

function ParcelasAtrasadas({ onSelect }: { onSelect: (id: number) => void }) {
 const { data, loading } = useApi<any[]>(() => Api.parcelasAtrasadas());
 const [aberto, setAberto] = useState(false);
 if (loading || !data || data.length === 0) return null;
 const totalValor = data.reduce((s, p) => s + (p.valor || 0), 0);
 return (
 <div style={{ margin: '0 0 12px', padding: '12px 16px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.35)', borderRadius: 10 }}>
 <div className="flex-between" style={{ alignItems: 'center', cursor: 'pointer' }} onClick={() => setAberto((v) => !v)}>
 <div style={{ fontWeight: 700, fontSize: 13, color: '#B91C1C' }}>
 {data.length} parcela(s) em atraso · {formatCurrencyShort(totalValor)}
 </div>
 <button className="btn btn--ghost btn--sm">{aberto ? 'Ocultar' : 'Ver'}</button>
 </div>
 {aberto && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
 {data.map((p) => (
 <div key={p.id} className="flex-between" style={{ alignItems: 'center', padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 8, cursor: 'pointer' }} onClick={() => onSelect(p.vendaId)}>
 <div style={{ fontSize: 13 }}>
 <strong>#{p.codigo}</strong> · {p.clienteNome} · parcela {p.numero}/{p.total}
 <div className="text-xs text-secondary">{p.corretor || '—'} · {p.unidade}</div>
 </div>
 <div style={{ textAlign: 'right' }}>
 <div style={{ fontSize: 13, fontWeight: 700 }}>{formatCurrencyShort(p.valor)}</div>
 <div className="text-xs" style={{ color: '#B91C1C' }}>{p.diasAtraso} dia(s)</div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

const PARCELA_BADGE: Record<string, [string, string]> = {
 AGENDADO: ['neutral', 'Agendado'],
 ABERTO: ['analysis', 'Aberto'],
 PAGO: ['signed', 'Pago'],
 ATRASADO: ['cancelled', 'Atrasado'],
};

function VendaParcelas({ vendaId, podeConfirmar }: { vendaId: number; podeConfirmar?: boolean }) {
 const toast = useToast();
 const [parcelas, setParcelas] = useState<any[]>([]);
 const [busy, setBusy] = useState<number | null>(null);

 const load = async () => {
 try {
 const v = await Api.venda(vendaId);
 setParcelas(v?.pagamentos || []);
 } catch { /* ignore */ }
 };
 useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vendaId]);

 const mudarStatus = async (pagamentoId: number, status: string) => {
 setBusy(pagamentoId);
 try {
 await Api.vendaParcelaStatus(vendaId, pagamentoId, status);
 toast.success(status === 'PAGO' ? 'Pagamento confirmado.' : 'Parcela atualizada.');
 await load();
 } catch (err: any) {
 toast.error('Erro: ' + (err?.message || 'falha'));
 } finally {
 setBusy(null);
 }
 };

 if (parcelas.length === 0) return null;
 return (
 <div style={{ margin: '16px 0', padding: '14px 16px', background: 'var(--bg-card-hover)', borderRadius: 10 }}>
 <div className="uppercase-tag" style={{ marginBottom: 8 }}>Plano de recebimento (entrada)</div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
 {parcelas.map((p) => {
 const [k, lbl] = PARCELA_BADGE[p.status] || ['neutral', p.status];
 const venc = p.vencimento ? new Date(p.vencimento).toLocaleDateString('pt-BR') : '—';
 return (
 <div key={p.id} className="flex-between" style={{ alignItems: 'center', padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 8 }}>
 <div style={{ fontSize: 13 }}>
 <strong>{p.numero}/{p.total}</strong> · {formatCurrencyShort(p.valor)} · vence {venc}
 </div>
 <div className="flex gap-2" style={{ alignItems: 'center' }}>
 <span className={`badge badge--${k}`}>{lbl}</span>
 {podeConfirmar && p.status !== 'PAGO' && (
 <button className="btn btn--primary btn--sm" disabled={busy === p.id} onClick={() => mudarStatus(p.id, 'PAGO')}>
 {busy === p.id ? '…' : 'Confirmar'}
 </button>
 )}
 {podeConfirmar && p.status === 'PAGO' && (
 <button className="btn btn--ghost btn--sm" disabled={busy === p.id} onClick={() => mudarStatus(p.id, 'ABERTO')} title="Desfazer">
 Desfazer
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
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
