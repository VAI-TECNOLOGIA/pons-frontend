import { useEffect, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { LeadCamposCustom } from '../components/LeadCamposCustom';
import { timeAgo, initials } from '../lib/format';
import { Api } from '../lib/api';
import { FichaLeadModal } from '../components/FichaLeadModal';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { Auth } from '../lib/auth';

const STATUS_MAP: Record<string, [string, string]> = {
 NOVO: ['neutral', 'Tentando Contato'],
 SDR: ['neutral', 'Tentando Contato'],
 NAO_RESPONDE: ['cancelled', 'Não responde'],
 LISTA_VIP: ['analysis', 'Lista VIP'],
 EM_ATENDIMENTO: ['analysis', 'Em atendimento'],
 QUALIFICANDO: ['analysis', 'Em atendimento'],
 FLUXO: ['analysis', 'Fluxo'],
 POS_FLUXO: ['analysis', 'Pós Fluxo'],
 VISITA: ['launch', 'Vídeo/Visita'],
 NEGOCIANDO: ['signature', 'Em Negociação'],
 PROPOSTA: ['signature', 'Em Negociação'],
 FECHADO: ['paid', 'Venda'],
 PERDIDO: ['cancelled', 'Perdido'],
};
const STATUSES = ['NOVO', 'NAO_RESPONDE', 'LISTA_VIP', 'EM_ATENDIMENTO', 'FLUXO', 'POS_FLUXO', 'VISITA', 'NEGOCIANDO', 'FECHADO', 'PERDIDO'];

const PAGE_SIZE = 100;

export default function Leads() {
 const [filterStatus, setFilterStatus] = useState<string | null>(null);
 // Painel de filtros (server-side — a busca roda no banco, não na página carregada)
 const [mostrarFiltros, setMostrarFiltros] = useState(false);
 const [filtroOrigem, setFiltroOrigem] = useState('');
 const [filtroCorretor, setFiltroCorretor] = useState(''); // '' | 'sem' | id do corretor
 const [filtroCampanha, setFiltroCampanha] = useState('');
 const [filtroEmp, setFiltroEmp] = useState(''); // empreendimento de interesse (Produto)
 const [dataInicial, setDataInicial] = useState('');
 const [dataFinal, setDataFinal] = useState('');
 const [busca, setBusca] = useState('');
 const [buscaDeb, setBuscaDeb] = useState('');
 const [page, setPage] = useState(1);
 const [open, setOpen] = useState(false);
 const [campoLead, setCampoLead] = useState<any>(null);

 // Busca com debounce (não bater na API a cada tecla)
 useEffect(() => {
 const t = setTimeout(() => { setBuscaDeb(busca.trim()); setPage(1); }, 400);
 return () => clearTimeout(t);
 }, [busca]);

 const params: any = { page, limit: PAGE_SIZE };
 if (filterStatus) params.status = filterStatus;
 if (filtroOrigem) params.origem = filtroOrigem;
 if (filtroCampanha) params.campanha = filtroCampanha;
 if (filtroEmp) params.empreendimentoId = filtroEmp;
 if (filtroCorretor === 'sem') params.semCorretor = 'true';
 else if (filtroCorretor) params.corretorId = filtroCorretor;
 if (dataInicial) params.dataInicial = dataInicial;
 if (dataFinal) params.dataFinal = dataFinal;
 if (buscaDeb) params.q = buscaDeb;
 const paramsKey = JSON.stringify(params);

 const { data: resp, loading: lLoad, error: lErr, reload } = useApi<{ total: number; leads: any[] }>(() => Api.leadsPaginado(params), [paramsKey]);
 const { data: stats, reload: reloadStats } = useApi<any>(() => Api.leadStats());
 const { data: empreendimentos } = useApi<any[]>(() => Api.empreendimentos());
 const { data: corretores } = useApi<any[]>(() => Api.corretores());
 const { data: opcoes } = useApi<{ origens: string[]; campanhas: string[] }>(() => Api.leadFiltrosOpcoes());
 const toast = useToast();
 const confirm = useConfirm();

 // ── Seleção em massa (checkboxes) — mesma mecânica da Distribuição/bolsão,
 // replicada aqui de propósito: com os filtros novos dá pra filtrar e
 // transferir/arquivar direto da listagem. ──────────────────────────────
 const role = Auth.user?.role || '';
 const podeTransferir = ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING', 'GERENTE_EQUIPE'].includes(role);
 const podeArquivar = ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'].includes(role);
 const [sel, setSel] = useState<Set<number>>(new Set());
 const [alvoTransf, setAlvoTransf] = useState<number | ''>('');
 const [transferindo, setTransferindo] = useState(false);
 const [arquivando, setArquivando] = useState(false);
 const toggleSel = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
 // Limpa a seleção quando filtro/página muda (evita id selecionado fora da tela)
 useEffect(() => { setSel(new Set()); }, [paramsKey]);

 const transferirSelecionados = async () => {
 if (!sel.size || !alvoTransf) return;
 setTransferindo(true);
 try {
 const r = await Api.roletaTransferirMassa([...sel], Number(alvoTransf));
 toast.success(`${r.transferidos} lead(s) transferido(s) para ${r.corretor}.`);
 setSel(new Set()); setAlvoTransf('');
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 } finally {
 setTransferindo(false);
 }
 };
 const arquivarSelecionados = async () => {
 if (!sel.size) return;
 const ok = await confirm({ title: `Arquivar ${sel.size} lead(s)?`, message: 'Eles somem das telas (útil pra duplicatas/testes), mas ficam preservados no banco.', tone: 'danger' });
 if (!ok) return;
 setArquivando(true);
 try {
 const r = await Api.leadsArquivar([...sel]);
 toast.success(`${r.arquivados} lead(s) arquivado(s).`);
 setSel(new Set());
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 } finally {
 setArquivando(false);
 }
 };

 if (lLoad && !resp) return <LeadsShell onNew={() => setOpen(true)}><LoadingBlock /></LeadsShell>;
 if (lErr && !resp) return <LeadsShell onNew={() => setOpen(true)}><ErrorBlock error={lErr} label="Erro ao carregar leads" /></LeadsShell>;
 if (!resp) return null;

 const leads = resp.leads || [];
 const total = resp.total ?? leads.length;
 const filtered = leads;
 const temFiltro = !!(filtroOrigem || filtroCorretor || filtroCampanha || filtroEmp || dataInicial || dataFinal || buscaDeb || filterStatus);
 const limparFiltros = () => {
 setFilterStatus(null); setFiltroOrigem(''); setFiltroCorretor(''); setFiltroCampanha('');
 setFiltroEmp(''); setDataInicial(''); setDataFinal(''); setBusca(''); setBuscaDeb(''); setPage(1);
 };
 // troca de filtro sempre volta pra página 1
 const aoFiltrar = (setter: (v: any) => void) => (v: any) => { setter(v); setPage(1); };

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
 onClick={() => { setFilterStatus(null); setPage(1); }}
 >
 Todos
 </span>
 {STATUSES.map((s) => (
 <span
 key={s}
 className={'filter-chip ' + (filterStatus === s ? 'filter-chip--active' : '')}
 onClick={() => { setFilterStatus(s); setPage(1); }}
 >
 {STATUS_MAP[s]?.[1] || s}
 </span>
 ))}
 <input className="field__input leads-filtros__busca" placeholder="Pesquisar nome/telefone…" value={busca} onChange={(e) => setBusca(e.target.value)} />
 <button className={'btn btn--sm ' + (mostrarFiltros ? 'btn--primary' : 'btn--secondary')} onClick={() => setMostrarFiltros((v) => !v)}>
 <Icon name="settings" size={13} /> {mostrarFiltros ? 'Fechar Filtros' : 'Filtros'}
 </button>
 </div>

 {mostrarFiltros && (
 <div className="card fade-in" style={{ padding: '16px 18px', marginBottom: 14 }}>
 <div className="leads-filtros">
 <div className="leads-filtros__grupo">
 <div className="uppercase-tag" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="calendar" size={13} /> Período</div>
 <div className="leads-filtros__linha">
 <input type="date" className="field__input" value={dataInicial} onChange={(e) => aoFiltrar(setDataInicial)(e.target.value)} />
 <span className="text-xs text-secondary leads-filtros__sep">–</span>
 <input type="date" className="field__input" value={dataFinal} onChange={(e) => aoFiltrar(setDataFinal)(e.target.value)} />
 </div>
 <div className="field__hint" style={{ marginTop: 4 }}>Data de entrada do lead no sistema.</div>
 </div>
 <div className="leads-filtros__grupo">
 <div className="uppercase-tag" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="target" size={13} /> Jornada do lead</div>
 <div className="leads-filtros__linha">
 <select className="field__select" value={filtroOrigem} onChange={(e) => aoFiltrar(setFiltroOrigem)(e.target.value)}>
 <option value="">Origem</option>
 {(opcoes?.origens || []).map((o) => <option key={o} value={o}>{o}</option>)}
 </select>
 <select className="field__select" value={filterStatus || ''} onChange={(e) => aoFiltrar(setFilterStatus)(e.target.value || null)}>
 <option value="">Status</option>
 {STATUSES.map((s) => <option key={s} value={s}>{STATUS_MAP[s]?.[1] || s}</option>)}
 </select>
 </div>
 </div>
 <div className="leads-filtros__grupo">
 <div className="uppercase-tag" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="layers" size={13} /> Segmentação</div>
 <div className="leads-filtros__linha">
 <select className="field__select" value={filtroEmp} onChange={(e) => aoFiltrar(setFiltroEmp)(e.target.value)}>
 <option value="">Produto</option>
 {(empreendimentos || []).map((e2: any) => <option key={e2.id} value={e2.id}>{e2.nome}</option>)}
 </select>
 <select className="field__select" value={filtroCampanha} onChange={(e) => aoFiltrar(setFiltroCampanha)(e.target.value)}>
 <option value="">Campanha</option>
 {(opcoes?.campanhas || []).map((c) => <option key={c} value={c}>{c}</option>)}
 </select>
 </div>
 </div>
 <div className="leads-filtros__grupo">
 <div className="uppercase-tag" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="users" size={13} /> Equipe</div>
 <div className="leads-filtros__linha">
 <select className="field__select" value={filtroCorretor} onChange={(e) => aoFiltrar(setFiltroCorretor)(e.target.value)}>
 <option value="">Corretor</option>
 <option value="sem">Sem corretor (bolsão)</option>
 {(corretores || []).map((c: any) => <option key={c.id} value={c.id}>{c.nome || c.user?.name}</option>)}
 </select>
 </div>
 </div>
 </div>
 </div>
 )}

 <div className="text-xs text-secondary" style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
 <span>Mostrando <strong>{leads.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{(page - 1) * PAGE_SIZE + leads.length}</strong> de <strong>{total.toLocaleString('pt-BR')}</strong></span>
 {temFiltro && (
 <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={limparFiltros}>limpar filtros</span>
 )}
 <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
 <button className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Anterior</button>
 <button className="btn btn--ghost btn--sm" disabled={page * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Próxima →</button>
 </span>
 </div>

 {/* Barra de ação em massa — aparece com leads selecionados (igual à da Distribuição) */}
 {podeTransferir && sel.size > 0 && (
 <div className="flex" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--pons-cyan, #52f7fe)', borderRadius: 10 }}>
 <strong style={{ fontSize: 14 }}>{sel.size} selecionado(s)</strong>
 <button className="btn btn--ghost btn--sm" onClick={() => setSel(new Set())}>Limpar seleção</button>
 {podeArquivar && (
 <button className="btn btn--ghost btn--sm" style={{ color: 'var(--color-danger, #e5484d)' }} onClick={arquivarSelecionados} disabled={arquivando}>{arquivando ? 'Arquivando…' : 'Arquivar'}</button>
 )}
 <span style={{ marginLeft: 'auto' }} className="text-xs text-secondary">Transferir para:</span>
 <select className="field__select" style={{ width: 'auto', height: 34 }} value={alvoTransf} onChange={(e) => setAlvoTransf(e.target.value ? Number(e.target.value) : '')}>
 <option value="">Escolher corretor…</option>
 {(corretores || []).filter((c: any) => c.ativo !== false).map((c: any) => (
 <option key={c.id} value={c.id}>{c.nome || c.user?.name}{c.equipe?.nome ? ` · ${c.equipe.nome}` : ''}</option>
 ))}
 </select>
 <button className="btn btn--primary btn--sm" onClick={transferirSelecionados} disabled={!alvoTransf || transferindo}>
 {transferindo ? 'Transferindo…' : `Transferir ${sel.size}`}
 </button>
 </div>
 )}

 <div className="card fade-in" style={{ padding: 0 }}>
 <table className="table row-hover">
 <thead>
 <tr>
 {podeTransferir && (
 <th style={{ width: 34 }}>
 <input type="checkbox" checked={sel.size >= filtered.length && filtered.length > 0} onChange={() => setSel((s) => s.size >= filtered.length ? new Set() : new Set(filtered.map((l: any) => l.id)))} title="Selecionar todos os da página" />
 </th>
 )}
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
 <td colSpan={podeTransferir ? 8 : 7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
 Nenhum lead
 </td>
 </tr>
 ) : (
 filtered.map((l) => {
 const [k, lab] = STATUS_MAP[l.status] || ['neutral', l.status];
 return (
 <tr key={l.id} style={sel.has(l.id) ? { background: 'var(--bg-elevated)' } : undefined}>
 {podeTransferir && (
 <td><input type="checkbox" checked={sel.has(l.id)} onChange={() => toggleSel(l.id)} /></td>
 )}
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
 <option value="NOVO">Tentando Contato</option>
 <option value="EM_ATENDIMENTO">Em atendimento</option>
 <option value="NEGOCIANDO">Em Negociação</option>
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
