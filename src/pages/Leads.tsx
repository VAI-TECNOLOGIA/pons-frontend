import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { LeadCamposCustom } from '../components/LeadCamposCustom';
import { timeAgo, initials } from '../lib/format';
import { Api } from '../lib/api';
import { FichaLeadModal } from '../components/FichaLeadModal';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';

const STATUS_MAP: Record<string, [string, string]> = {
 NOVO: ['neutral', 'NOVO'],
 SDR: ['analysis', 'EM SDR'],
 NEGOCIANDO: ['signature', 'NEGOCIANDO'],
 PROPOSTA: ['signed', 'PROPOSTA'],
 FECHADO: ['paid', 'FECHADO'],
 PERDIDO: ['cancelled', 'PERDIDO'],
};
const STATUSES = ['NOVO', 'SDR', 'NEGOCIANDO', 'PROPOSTA', 'FECHADO', 'PERDIDO'];

export default function Leads() {
 const [filterStatus, setFilterStatus] = useState<string | null>(null);
 const [filtroOrigem, setFiltroOrigem] = useState('');
 const [filtroCorretor, setFiltroCorretor] = useState(''); // '' | 'sem' | nome do corretor
 const [busca, setBusca] = useState('');
 const [open, setOpen] = useState(false);
 const [campoLead, setCampoLead] = useState<any>(null);
 const { data: leads, loading: lLoad, error: lErr, reload } = useApi<any[]>(() => Api.leads());
 const { data: stats, reload: reloadStats } = useApi<any>(() => Api.leadStats());
 const { data: empreendimentos } = useApi<any[]>(() => Api.empreendimentos());
 const toast = useToast();

 if (lLoad) return <LeadsShell onNew={() => setOpen(true)}><LoadingBlock /></LeadsShell>;
 if (lErr) return <LeadsShell onNew={() => setOpen(true)}><ErrorBlock error={lErr} label="Erro ao carregar leads" /></LeadsShell>;
 if (!leads) return null;

 const counts = leads.reduce<Record<string, number>>((acc, l) => {
 acc[l.status] = (acc[l.status] || 0) + 1;
 return acc;
 }, {});

 const origensDisp = [...new Set(leads.map((l) => l.origem).filter(Boolean))].sort();
 const corretoresDisp = [...new Set(leads.filter((l) => l.corretor).map((l) => l.corretor.nome))].sort();
 const filtered = leads.filter((l) => {
 if (filterStatus && l.status !== filterStatus) return false;
 if (filtroOrigem && (l.origem || '') !== filtroOrigem) return false;
 if (filtroCorretor === 'sem' && l.corretor) return false;
 if (filtroCorretor && filtroCorretor !== 'sem' && (l.corretor?.nome || '') !== filtroCorretor) return false;
 if (busca) { const q = busca.toLowerCase(); if (!`${l.nome || ''} ${l.telefone || ''} ${l.email || ''}`.toLowerCase().includes(q)) return false; }
 return true;
 });

 const submit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const fd = new FormData(e.currentTarget);
 try {
 await Api.leadCreate({
 nome: String(fd.get('nome') || ''),
 email: fd.get('email') ? String(fd.get('email')) : undefined,
 telefone: fd.get('telefone') ? String(fd.get('telefone')) : undefined,
 origem: String(fd.get('origem') || 'MANUAL'),
 status: String(fd.get('status') || 'NOVO'),
 vip: fd.get('vip') === 'true',
 empreendimentoInteresseId: fd.get('empreendimentoInteresseId')
 ? Number(fd.get('empreendimentoInteresseId'))
 : undefined,
 });
 toast.success('Lead criado com sucesso');
 setOpen(false);
 reload();
 reloadStats();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha ao criar'));
 }
 };

 return (
 <>
 <Topbar
 title="Leads"
 right={
 <button className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
 + Novo Lead
 </button>
 }
 />

 <div className="main__content">
 <PageHeader
 breadcrumb="Comercial · Leads"
 title={`${stats?.total ?? leads.length} leads no sistema`}
 subtitle={`${stats?.novosHoje ?? 0} novos hoje · ${stats?.qualificados ?? 0} em negociação · ${stats?.semFollowup ?? 0} sem follow-up há +3 dias`}
 />

 <div className="kpi-grid">
 <KpiSimple color="blue" label="Novos hoje" value={stats?.novosHoje ?? 0} />
 <KpiSimple color="green" label="Em negociação" value={stats?.qualificados ?? 0} />
 <KpiSimple color="amber" label="Sem follow-up" value={stats?.semFollowup ?? 0} />
 <KpiSimple color="navy" label="Total no funil" value={stats?.total ?? leads.length} />
 </div>

 <div className="filter-bar">
 <span
 className={'filter-chip ' + (!filterStatus ? 'filter-chip--active' : '')}
 onClick={() => setFilterStatus(null)}
 >
 Todos · {leads.length}
 </span>
 {STATUSES.map((s) => (
 <span
 key={s}
 className={'filter-chip ' + (filterStatus === s ? 'filter-chip--active' : '')}
 onClick={() => setFilterStatus(s)}
 >
 {s} ({counts[s] || 0})
 </span>
 ))}
 {/* Filtros de controle */}
 <input className="field__input" style={{ marginLeft: 'auto', width: 180, height: 32 }} placeholder="Buscar nome/telefone…" value={busca} onChange={(e) => setBusca(e.target.value)} />
 <select className="field__select" style={{ width: 'auto', height: 32 }} value={filtroOrigem} onChange={(e) => setFiltroOrigem(e.target.value)}>
 <option value="">Origem: todas</option>
 {origensDisp.map((o) => <option key={o} value={o}>{o}</option>)}
 </select>
 <select className="field__select" style={{ width: 'auto', height: 32 }} value={filtroCorretor} onChange={(e) => setFiltroCorretor(e.target.value)}>
 <option value="">Corretor: todos</option>
 <option value="sem">Sem corretor (bolsão)</option>
 {corretoresDisp.map((c) => <option key={c} value={c}>{c}</option>)}
 </select>
 </div>
 {(filtroOrigem || filtroCorretor || busca) && (
 <div className="text-xs text-secondary" style={{ marginTop: -8, marginBottom: 8 }}>
 {filtered.length} resultado(s) · <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setFiltroOrigem(''); setFiltroCorretor(''); setBusca(''); }}>limpar filtros</span>
 </div>
 )}

 <div className="card fade-in" style={{ padding: 0 }}>
 <table className="table row-hover">
 <thead>
 <tr>
 <th>Lead</th>
 <th>Origem</th>
 <th>Interesse</th>
 <th>Corretor</th>
 <th>Status</th>
 <th>Entrada</th>
 <th>WhatsApp</th>
 </tr>
 </thead>
 <tbody>
 {filtered.length === 0 ? (
 <tr>
 <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
 Nenhum lead
 </td>
 </tr>
 ) : (
 filtered.map((l) => {
 const [k, lab] = STATUS_MAP[l.status] || ['neutral', l.status];
 return (
 <tr key={l.id}>
 <td>
 <div className="flex gap-3" style={{ alignItems: 'center' }}>
 <div className="avatar avatar--sm">{initials(l.nome)}</div>
 <div>
 <div className="font-semibold" style={{ cursor: 'pointer' }} onClick={() => setCampoLead(l)} title="Ver campos personalizados">
 {l.nome}{' '}
 {l.vip && (
 <span className="badge badge--launch" style={{ fontSize: 9, padding: '2px 6px' }}>
 VIP
 </span>
 )}
 </div>
 <div className="text-xs text-secondary">{l.telefone || l.email || '—'}</div>
 </div>
 </div>
 </td>
 <td>
 <span className="badge badge--neutral">{l.origem}</span>
 </td>
 <td className="text-xs">{l.interesse || '—'}</td>
 <td>
 {l.corretor ? (
 <div className="flex gap-2" style={{ alignItems: 'center' }}>
 <div className="avatar avatar--sm">{l.corretor.initials}</div>
 {l.corretor.nome.split(' ')[0]}
 </div>
 ) : (
 <span className="text-xs text-secondary">—</span>
 )}
 </td>
 <td>
 <span className={`badge badge--${k}`}>{lab}</span>
 </td>
 <td className="text-xs">{timeAgo(l.distribuidoEm || l.createdAt)}</td>
 <td>
 {(() => {
 const digits = String(l.telefone || '').replace(/\D/g, '');
 const podeAbrir = !l.telefoneOculto && digits.length >= 10;
 if (!podeAbrir) return <span className="wa-lock" title="Libere o contato pra ver o número"><Icon name="lock" size={14} /></span>;
 return (
 <a className="wa-btn" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" title="Abrir conversa no WhatsApp" aria-label="WhatsApp">
 <Icon name="whatsapp" size={17} />
 </a>
 );
 })()}
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>
 </div>

 <Modal
 open={open}
 onClose={() => setOpen(false)}
 title="Novo Lead"
 subtitle="Cadastre um lead manualmente — entrará no funil imediatamente"
 >
 <form id="form-lead" onSubmit={submit}>
 <div className="form-grid">
 <div className="field field--span-2">
 <label className="field__label">Nome <span className="field__required">*</span></label>
 <input name="nome" className="field__input" required />
 </div>
 <div className="field">
 <label className="field__label">E-mail</label>
 <input name="email" type="email" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Telefone</label>
 <input name="telefone" className="field__input" placeholder="(48) 99999-0000" />
 </div>
 <div className="field">
 <label className="field__label">Origem</label>
 <select name="origem" className="field__select" defaultValue="MANUAL">
 <option value="META_ADS">Meta Ads</option>
 <option value="INSTAGRAM">Instagram</option>
 <option value="GOOGLE">Google</option>
 <option value="INDICACAO">Indicação</option>
 <option value="SITE">Site</option>
 <option value="MANUAL">Manual</option>
 </select>
 </div>
 <div className="field">
 <label className="field__label">Status</label>
 <select name="status" className="field__select" defaultValue="NOVO">
 <option value="NOVO">Novo</option>
 <option value="SDR">Em SDR</option>
 <option value="NEGOCIANDO">Negociando</option>
 </select>
 </div>
 <div className="field">
 <label className="field__label">Empreendimento de interesse</label>
 <select name="empreendimentoInteresseId" className="field__select" defaultValue="">
 <option value="">—</option>
 {(empreendimentos || []).map((e: any) => (
 <option key={e.id} value={e.id}>{e.nome}</option>
 ))}
 </select>
 </div>
 <div className="field">
 <label className="field__label">VIP?</label>
 <select name="vip" className="field__select" defaultValue="false">
 <option value="false">Não</option>
 <option value="true">Sim</option>
 </select>
 </div>
 </div>
 <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
 <button type="button" className="btn btn--secondary" onClick={() => setOpen(false)}>
 Cancelar
 </button>
 <button type="submit" className="btn btn--primary">Criar Lead</button>
 </div>
 </form>
 </Modal>

 {campoLead && <FichaLeadModal leadId={campoLead.id} onClose={() => setCampoLead(null)} />}
 </>
 );
}

function LeadsShell({ children, onNew }: { children: React.ReactNode; onNew?: () => void }) {
 return (
 <>
 <Topbar
 title="Leads"
 right={
 <button className="btn btn--primary btn--sm" onClick={onNew}>
 + Novo Lead
 </button>
 }
 />
 <div className="main__content">
 <PageHeader breadcrumb="Comercial · Leads" title="Leads" />
 {children}
 </div>
 </>
 );
}

function KpiSimple({ color, label, value }: { color: string; label: string; value: number }) {
 return (
 <div className="kpi">
 <div className={`kpi__icon kpi__icon--${color}`}>
 <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
 <circle cx="12" cy="12" r="10" />
 </svg>
 </div>
 <div className="kpi__label">{label}</div>
 <div className="kpi__value">{value}</div>
 </div>
 );
}
