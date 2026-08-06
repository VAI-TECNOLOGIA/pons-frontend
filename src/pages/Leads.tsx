import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { LeadsFiltrosPanel } from '../components/LeadsFiltrosPanel';
import { CorretorPicker } from '../components/CorretorPicker';
import { DestinoPicker, type DestinoTransf } from '../components/DestinoPicker';
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
 PAROU_RESPONDER: ['cancelled', 'Parou de responder'],
 POS_FLUXO: ['analysis', 'Pós Fluxo'],
 VISITA: ['launch', 'Vídeo/Visita'],
 NEGOCIANDO: ['signature', 'Em Negociação'],
 PROPOSTA: ['signature', 'Em Negociação'],
 FECHADO: ['paid', 'Venda'],
 PERDIDO: ['cancelled', 'Perdido'],
};
const STATUSES = ['NOVO', 'NAO_RESPONDE', 'LISTA_VIP', 'EM_ATENDIMENTO', 'FLUXO', 'PAROU_RESPONDER', 'POS_FLUXO', 'VISITA', 'NEGOCIANDO', 'FECHADO', 'PERDIDO'];

const PAGE_SIZE = 100;

export default function Leads() {
 const [filterStatus, setFilterStatus] = useState<string[]>([]); // chips e painel: multi-status
 // Painel de filtros (server-side — a busca roda no banco, não na página carregada)
 const [mostrarFiltros, setMostrarFiltros] = useState(false);
 const [filtroOrigem, setFiltroOrigem] = useState<string[]>([]);
 const [filtroCorretor, setFiltroCorretor] = useState(''); // '' | 'sem' | id do corretor
 // ?base=ID na URL (vindo da tela Bases de Leads) já abre filtrado
 const [searchParams] = useSearchParams();
 const [filtroEquipe, setFiltroEquipe] = useState<string[]>([]); // ids das equipes
 const [filtroBase, setFiltroBase] = useState<string[]>(() => (searchParams.get('base') ? [String(searchParams.get('base'))] : []));
 const [filtroCampanha, setFiltroCampanha] = useState<string[]>([]);
 const [filtroFormulario, setFiltroFormulario] = useState<string[]>([]);
 const [filtroEmp, setFiltroEmp] = useState<string[]>([]); // empreendimentos de interesse (Produto)
 const [dataInicial, setDataInicial] = useState('');
 const [dataFinal, setDataFinal] = useState('');
 const [semFollowup, setSemFollowup] = useState(false); // KPI "Sem follow-up"
 const [novosHoje, setNovosHoje] = useState(false); // KPI "Novos hoje"
 const [kpiAtivo, setKpiAtivo] = useState<'' | 'novos' | 'negociacao' | 'semfollowup'>(''); // qual card está selecionado
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
 if (filterStatus.length) params.status = filterStatus.join(',');
 if (filtroOrigem.length) params.origem = filtroOrigem.join(',');
 if (filtroCampanha.length) params.campanha = filtroCampanha.join(',');
 if (filtroFormulario.length) params.formulario = filtroFormulario.join(',');
 if (filtroEmp.length) params.empreendimentoId = filtroEmp.join(',');
 if (filtroCorretor === 'sem') params.semCorretor = 'true';
 else if (filtroCorretor) params.corretorId = filtroCorretor;
 if (filtroEquipe.length) params.equipeId = filtroEquipe.join(',');
 if (filtroBase.length) params.baseId = filtroBase.join(',');
 if (dataInicial) params.dataInicial = dataInicial;
 if (dataFinal) params.dataFinal = dataFinal;
 if (semFollowup) params.semFollowup = 'true';
 if (novosHoje) params.novosHoje = 'true';
 if (buscaDeb) params.q = buscaDeb;
 const paramsKey = JSON.stringify(params);

 const { data: resp, loading: lLoad, error: lErr, reload } = useApi<{ total: number; leads: any[] }>(() => Api.leadsPaginado(params), [paramsKey]);
 const { data: stats, reload: reloadStats } = useApi<any>(() => Api.leadStats());
 const { data: empreendimentos } = useApi<any[]>(() => Api.empreendimentos());
 const { data: corretores } = useApi<any[]>(() => Api.corretores());
 const { data: equipesFiltro } = useApi<any[]>(() => Api.equipes());
 const { data: filas } = useApi<any[]>(() => Api.roletas().catch(() => [] as any));
 const { data: bases } = useApi<any[]>(() => Api.basesLead().catch(() => [] as any));
 const { data: bolsoesNomeados } = useApi<any[]>(() => Api.bolsoes().catch(() => [] as any));
 const { data: opcoes } = useApi<{ origens: string[]; campanhas: string[]; formularios?: string[] }>(() => Api.leadFiltrosOpcoes());
 const toast = useToast();
 const confirm = useConfirm();

 // ── Seleção em massa (checkboxes) — mesma mecânica da Distribuição/bolsão,
 // replicada aqui de propósito: com os filtros novos dá pra filtrar e
 // transferir/arquivar direto da listagem. ──────────────────────────────
 const role = Auth.user?.role || '';
 const podeTransferir = ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING', 'GERENTE_EQUIPE'].includes(role);
 const podeArquivar = ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING'].includes(role);
 const [sel, setSel] = useState<Set<number>>(new Set());
 const [alvoTransf, setAlvoTransf] = useState<DestinoTransf | null>(null);
 const [transferindo, setTransferindo] = useState(false);
 const [telefoneVisivel, setTelefoneVisivel] = useState(false); // mostrar telefone pro corretor ao transferir
 const [arquivando, setArquivando] = useState(false);
 const toggleSel = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
 // Limpa a seleção quando filtro/página muda (evita id selecionado fora da tela)
 useEffect(() => { setSel(new Set()); }, [paramsKey]);

 const transferirSelecionados = async () => {
 if (!sel.size || !alvoTransf) return;
 setTransferindo(true);
 try {
 const r = await Api.leadsTransferirDestino([...sel], alvoTransf, telefoneVisivel);
 toast.success(`${r.transferidos} lead(s) transferido(s) para ${r.corretor}.`);
 setSel(new Set()); setAlvoTransf(null); setTelefoneVisivel(false);
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
 const temFiltro = !!(filtroOrigem.length || filtroCorretor || filtroEquipe.length || filtroCampanha.length || filtroFormulario.length || filtroEmp.length || filtroBase.length || dataInicial || dataFinal || buscaDeb || filterStatus.length || semFollowup || novosHoje);
 const limparFiltros = () => {
 setFilterStatus([]); setFiltroOrigem([]); setFiltroCorretor(''); setFiltroEquipe([]); setFiltroCampanha([]); setFiltroFormulario([]);
 setFiltroEmp([]); setFiltroBase([]); setDataInicial(''); setDataFinal(''); setSemFollowup(false); setNovosHoje(false); setKpiAtivo(''); setBusca(''); setBuscaDeb(''); setPage(1);
 };
 // Clicar num KPI (card) aplica o filtro correspondente. Toggle: clicar de novo limpa.
 const NEGOCIACAO_STATUS = ['NEGOCIANDO', 'PROPOSTA', 'EM_ATENDIMENTO', 'FLUXO', 'POS_FLUXO', 'VISITA'];
 const aplicarKpi = (kpi: 'novos' | 'negociacao' | 'semfollowup') => {
 // sempre zera os filtros que os KPIs controlam, pra não somar/conflitar
 setFilterStatus([]); setDataInicial(''); setDataFinal(''); setSemFollowup(false); setNovosHoje(false); setPage(1);
 if (kpiAtivo === kpi) { setKpiAtivo(''); return; } // toggle off
 setKpiAtivo(kpi);
 if (kpi === 'novos') setNovosHoje(true);
 else if (kpi === 'negociacao') setFilterStatus(NEGOCIACAO_STATUS);
 else if (kpi === 'semfollowup') setSemFollowup(true);
 };
 // troca de filtro sempre volta pra página 1
 const aoFiltrar = (setter: (v: any) => void) => (v: any) => { setter(v); setPage(1); };

 const submit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const fd = new FormData(e.currentTarget);
 try {
 const r = await Api.leadCreate({
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
 if (r?.jaExistia) {
 toast.info(`Este telefone já está cadastrado no lead "${r.nome}" — nenhum lead novo foi criado.`, 8000);
 } else {
 toast.success('Lead criado com sucesso');
 }
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
 title={temFiltro ? `${total.toLocaleString('pt-BR')} leads no filtro` : `${stats?.total ?? leads.length} leads no sistema`}
 subtitle={`${stats?.novosHoje ?? 0} novos hoje · ${stats?.qualificados ?? 0} em negociação · ${stats?.semFollowup ?? 0} sem follow-up há +3 dias`}
 />

 <div className="kpi-grid">
 <KpiSimple color="blue" label="Novos hoje" value={stats?.novosHoje ?? 0} onClick={() => aplicarKpi('novos')} active={kpiAtivo === 'novos'} />
 <KpiSimple color="green" label="Em negociação" value={stats?.qualificados ?? 0} onClick={() => aplicarKpi('negociacao')} active={kpiAtivo === 'negociacao'} />
 <KpiSimple color="amber" label="Sem follow-up" value={stats?.semFollowup ?? 0} onClick={() => aplicarKpi('semfollowup')} active={kpiAtivo === 'semfollowup'} />
 <KpiSimple color="navy" label={temFiltro ? 'Total no filtro' : 'Total no funil'} value={temFiltro ? total : (stats?.total ?? leads.length)} onClick={limparFiltros} />
 </div>

 <div className="filter-bar">
 <span
 className={'filter-chip ' + (!filterStatus.length ? 'filter-chip--active' : '')}
 onClick={() => { setFilterStatus([]); setPage(1); }}
 >
 Todos
 </span>
 {STATUSES.map((s) => (
 <span
 key={s}
 className={'filter-chip ' + (filterStatus.includes(s) ? 'filter-chip--active' : '')}
 onClick={() => { setFilterStatus((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]); setPage(1); }}
 title="Clique pra marcar/desmarcar (pode combinar vários)"
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
 <LeadsFiltrosPanel
 v={{ dataInicial, dataFinal, origem: filtroOrigem, status: filterStatus, campanha: filtroCampanha, formulario: filtroFormulario, empreendimentoId: filtroEmp, corretorId: filtroCorretor, equipeId: filtroEquipe, baseId: filtroBase }}
 onAplicar={(f) => {
 setDataInicial(f.dataInicial);
 setDataFinal(f.dataFinal);
 setFiltroOrigem(f.origem);
 setFilterStatus(f.status);
 setFiltroCampanha(f.campanha);
 setFiltroFormulario(f.formulario);
 setFiltroEmp(f.empreendimentoId);
 setFiltroCorretor(f.corretorId);
 setFiltroEquipe(f.equipeId);
 setFiltroBase(f.baseId);
 setPage(1);
 }}
 statuses={STATUSES.map((k) => ({ key: k, label: STATUS_MAP[k]?.[1] || k }))}
 opcoes={opcoes}
 corretores={corretores}
 empreendimentos={empreendimentos}
 equipes={equipesFiltro}
 bases={bases}
 />
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
 <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} title="Por padrão o telefone fica oculto (corretor fala pelo template). Marque pra liberar o número.">
 <input type="checkbox" checked={telefoneVisivel} onChange={(e) => setTelefoneVisivel(e.target.checked)} />
 <span className="text-xs text-secondary">Mostrar telefone</span>
 </label>
 <span className="text-xs text-secondary">Transferir para:</span>
 <DestinoPicker corretores={corretores} equipes={equipesFiltro} filas={filas} bases={bases} bolsoes={bolsoesNomeados} value={alvoTransf} onChange={setAlvoTransf} />
 <button className="btn btn--primary btn--sm" onClick={transferirSelecionados} disabled={!alvoTransf || transferindo}>
 {transferindo ? 'Transferindo…' : `Transferir ${sel.size}`}
 </button>
 </div>
 )}

 <div className="card fade-in" style={{ padding: 0, overflowX: 'auto' }}>
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

function KpiSimple({ color, label, value, onClick, active }: { color: string; label: string; value: number; onClick?: () => void; active?: boolean }) {
 return (
 <div
 className="kpi"
 onClick={onClick}
 style={onClick ? { cursor: 'pointer', outline: active ? '2px solid var(--pons-blue)' : undefined, outlineOffset: -2, borderRadius: 10 } : undefined}
 title={onClick ? (active ? 'Clique pra limpar o filtro' : `Filtrar por "${label}"`) : undefined}
 >
 <div className={`kpi__icon kpi__icon--${color}`}>
 <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
 <circle cx="12" cy="12" r="10" />
 </svg>
 </div>
 <div className="kpi__label">{label}{onClick && active ? ' ·  ✕' : ''}</div>
 <div className="kpi__value">{value}</div>
 </div>
 );
}
