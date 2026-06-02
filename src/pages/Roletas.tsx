import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { SLAStatusPanel } from '../components/SLAStatusPanel';
import { Modal } from '../components/Modal';
import { Link } from 'react-router-dom';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { timeAgo } from '../lib/format';

const MODO_LABEL: Record<string, string> = {
 ROUND_ROBIN: 'Round-robin (igualitário)',
 PERFORMANCE: 'Por performance',
 PONDERADA: 'Ponderada (por peso)',
 MANUAL: 'Manual (gestor aprova)',
};

export default function Roletas() {
 const [openNew, setOpenNew] = useState(false);
 const [openSim, setOpenSim] = useState(false);
 const [simResult, setSimResult] = useState<any>(null);
 const { data: roletas, loading, error, reload } = useApi<any[]>(() => Api.roletas());
 const { data: funil } = useApi<any>(() => Api.funilEmpresa());
 const toast = useToast();

 const criar = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const fd = new FormData(e.currentTarget);
 try {
 await Api.roletaCreate({
 nome: String(fd.get('nome') || ''),
 descricao: fd.get('descricao') ? String(fd.get('descricao')) : undefined,
 modo: String(fd.get('modo') || 'ROUND_ROBIN'),
 origemFiltro: fd.get('origemFiltro') ? String(fd.get('origemFiltro')) : undefined,
 campanhaFiltro: fd.get('campanhaFiltro') ? String(fd.get('campanhaFiltro')) : undefined,
 slaHoras: Number(fd.get('slaHoras')) || 4,
 prioridade: Number(fd.get('prioridade')) || 5,
 maxTransferencias: Number(fd.get('maxTransferencias')) || 10,
 destinoFallbackTipo: String(fd.get('destinoFallbackTipo') || 'BOLSAO'),
 destinoFallbackUserId: fd.get('destinoFallbackUserId') ? Number(fd.get('destinoFallbackUserId')) : null,
 expedienteDias: Array.from(fd.getAll('expedienteDias')).join(',') || '1,2,3,4,5',
 expedienteInicioHora: Number(fd.get('expedienteInicioHora')) || 8,
 expedienteFimHora: Number(fd.get('expedienteFimHora')) || 18,
 rotacaoIntervaloMin: fd.get('rotacaoIntervaloMin') ? Number(fd.get('rotacaoIntervaloMin')) : null,
 ativa: true,
 });
 toast.success('Roleta criada');
 setOpenNew(false);
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 const simular = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const fd = new FormData(e.currentTarget);
 try {
 const r = await Api.roletaSimular({
 origem: String(fd.get('origem') || 'META_ADS'),
 campanha: fd.get('campanha') ? String(fd.get('campanha')) : '',
 });
 setSimResult(r);
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 const togglePausar = async (pid: number, ativo: boolean) => {
 try {
 await Api.roletaParticipanteUpdate(pid, { ativo: !ativo });
 toast.success(ativo ? 'Corretor pausado' : 'Corretor reativado');
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 if (loading) return <Shell onNew={() => setOpenNew(true)} onSim={() => { setSimResult(null); setOpenSim(true); }}><LoadingBlock /></Shell>;
 if (error) return <Shell onNew={() => setOpenNew(true)} onSim={() => { setSimResult(null); setOpenSim(true); }}><ErrorBlock error={error} /></Shell>;
 if (!roletas) return null;

 const totalLeadsBase = funil?.total ?? 0;
 const movimentando = funil?.movimentando ?? 0;
 const estagios = funil?.estagios || [];
 const maxEst = Math.max(...estagios.map((e: any) => e.n), 1);
 const porOrigem = funil?.porOrigem || [];

 return (
 <>
 <Topbar
 title="Roletas de Distribuição"
 right={
 <>
 <Link to="/formularios" className="btn btn--secondary btn--sm">Formulários / Webhooks</Link>
 <button className="btn btn--secondary btn--sm" onClick={() => { setSimResult(null); setOpenSim(true); }}>Simular Lead</button>
 <button className="btn btn--primary btn--sm" onClick={() => setOpenNew(true)}>+ Nova Roleta</button>
 </>
 }
 />
 <div className="main__content">
 <PageHeader
 breadcrumb="Comercial · Roletas"
 title={`${roletas.length} roletas ativas`}
 subtitle="Distribuição automática de leads · round-robin, performance, ponderada e manual"
 />

 <SLAStatusPanel />

 <div className="mb-6">
 <div className="card" style={{ background: 'linear-gradient(135deg,#0F1729,#1A2444)', color: 'white', border: 'none' }}>
 <div className="flex-between" style={{ marginBottom: 16 }}>
 <div>
 <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
 Funil completo da empresa
 </div>
 <div style={{ fontSize: 32, fontWeight: 900, fontStyle: 'italic' }}>
 {totalLeadsBase.toLocaleString('pt-BR')}{' '}
 <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>leads na base</span>
 </div>
 </div>
 <div style={{ textAlign: 'right' }}>
 <div style={{ fontSize: 28, fontWeight: 900, fontStyle: 'italic', color: '#88C559' }}>
 {movimentando}
 </div>
 <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)' }}>
 movimentando
 </div>
 </div>
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
 {estagios.map((e: any) => (
 <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
 <div style={{ width: 90, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
 {e.label}
 </div>
 <div style={{ flex: 1, height: 24, background: 'rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
 <div
 style={{
 height: '100%',
 width: `${Math.max(6, (e.n / maxEst) * 100)}%`,
 background: 'linear-gradient(90deg,#1258CA,#5D8FE0)',
 borderRadius: 6,
 display: 'flex',
 alignItems: 'center',
 padding: '0 10px',
 fontSize: 12,
 fontWeight: 800,
 fontStyle: 'italic',
 }}
 >
 {(e.n || 0).toLocaleString('pt-BR')}
 </div>
 </div>
 </div>
 ))}
 </div>

 <div>
 <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
 De onde estão entrando
 </div>
 {porOrigem.map((o: any) => (
 <div className="flex-between" key={o.origem} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13 }}>
 <span style={{ color: 'rgba(255,255,255,0.8)' }}>{o.origem}</span>
 <span style={{ fontWeight: 800, fontStyle: 'italic' }}>{(o.n || 0).toLocaleString('pt-BR')}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>

 <div className="grid-2">
 {roletas.map((r: any) => {
 const participantes = r.participantes || [];
 return (
 <div className="card" style={{ position: 'relative', overflow: 'hidden' }} key={r.id}>
 <div className="racing-stripe" style={{ ['--team-color' as any]: r.ativa ? 'var(--pons-blue)' : 'var(--gray-300)' }} />
 <div className="card__header" style={{ marginTop: 8 }}>
 <div>
 <h3 className="card__title">{r.nome}</h3>
 <p className="card__subtitle">{r.descricao || ''}</p>
 </div>
 <span className={'badge ' + (r.ativa ? 'badge--signed' : 'badge--neutral') + ' badge--dot'}>
 {r.ativa ? 'ATIVA' : 'PAUSADA'}
 </span>
 </div>

 <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
 <span className="badge badge--neutral">{MODO_LABEL[r.modo] || r.modo}</span>
 {r.origemFiltro && <span className="badge badge--neutral">{r.origemFiltro}</span>}
 {r.campanhaFiltro && <span className="badge badge--launch">campanha: {r.campanhaFiltro}</span>}
 {r.slaHoras != null && <span className="badge badge--analysis">SLA {r.slaHoras}h</span>}
 <span className="badge badge--neutral">prioridade {r.prioridade ?? 0}</span>
 </div>

 <div className="flex-between mb-2">
 <span className="uppercase-tag">Corretores na fila ({participantes.length})</span>
 <span className="text-xs text-secondary">{r.leadsDistribuidos ?? 0} leads distribuídos</span>
 </div>

 <div className="list">
 {participantes.length === 0 ? (
 <div className="text-sm text-secondary" style={{ padding: '8px 0' }}>Sem corretores nesta roleta</div>
 ) : (
 participantes.map((p: any) => (
 <div className="list__item" style={{ padding: '8px 0' }} key={p.id}>
 <div className="avatar avatar--sm" style={p.ativo ? {} : { opacity: 0.4 }}>{p.initials}</div>
 <div className="list__main">
 <div className="list__title" style={p.ativo ? {} : { opacity: 0.5, textDecoration: 'line-through' }}>{p.nome}</div>
 <div className="list__meta">
 {p.totalRecebidos ?? 0} recebidos · {p.ultimaAtribuicao ? 'último ' + timeAgo(p.ultimaAtribuicao) : 'nenhum ainda'}
 {r.modo === 'PONDERADA' && ' · peso ' + (p.peso ?? 1)}
 </div>
 </div>
 <button className="btn btn--ghost btn--sm" onClick={() => togglePausar(p.id, p.ativo)}>
 {p.ativo ? 'Pausar' : 'Ativar'}
 </button>
 </div>
 ))
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>

 <Modal open={openNew} onClose={() => setOpenNew(false)} title="Nova Roleta" subtitle="Defina modo, filtros e SLA — adicione corretores depois">
 <form onSubmit={criar}>
 <div className="form-grid">
 <div className="field field--span-2">
 <label className="field__label">Nome <span className="field__required">*</span></label>
 <input name="nome" className="field__input" required />
 </div>
 <div className="field field--span-2">
 <label className="field__label">Descrição</label>
 <input name="descricao" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Modo</label>
 <select name="modo" className="field__select" defaultValue="ROUND_ROBIN">
 <option value="ROUND_ROBIN">Round-robin (igualitário)</option>
 <option value="PERFORMANCE">Por performance</option>
 <option value="PONDERADA">Ponderada (por peso)</option>
 <option value="MANUAL">Manual (gestor aprova)</option>
 </select>
 </div>
 <div className="field">
 <label className="field__label">Filtro de origem</label>
 <select name="origemFiltro" className="field__select" defaultValue="">
 <option value="">Todas as origens</option>
 <option value="META_ADS">Meta Ads</option>
 <option value="INSTAGRAM">Instagram</option>
 <option value="GOOGLE">Google</option>
 <option value="SITE">Site</option>
 <option value="INDICACAO">Indicação</option>
 </select>
 </div>
 <div className="field">
 <label className="field__label">Filtro de campanha</label>
 <input name="campanhaFiltro" className="field__input" placeholder="ex: VIP, Park View…" />
 </div>
 <div className="field">
 <label className="field__label">SLA (horas)</label>
 <input name="slaHoras" type="number" className="field__input" defaultValue="4" />
 </div>
 <div className="field">
 <label className="field__label">Prioridade</label>
 <input name="prioridade" type="number" className="field__input" defaultValue="5" />
 </div>
 <div className="field">
 <label className="field__label">Max. transferências antes de fallback</label>
 <input name="maxTransferencias" type="number" className="field__input" defaultValue="10" min={1} />
 <div className="field__hint">Após N transferências SLA, lead cai no destino fallback</div>
 </div>
 <div className="field">
 <label className="field__label">Tipo de destino fallback</label>
 <select name="destinoFallbackTipo" className="field__select" defaultValue="BOLSAO">
 <option value="BOLSAO">Bolsão (recaptura)</option>
 <option value="USER">Usuário específico</option>
 </select>
 <div className="field__hint">Se USER, preencha ID do user em campo separado pela API</div>
 </div>
 <div className="field" style={{ gridColumn: '1 / -1' }}>
 <label className="field__label">Expediente — dias da semana</label>
 <div className="flex" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
 {[['0','Dom'],['1','Seg'],['2','Ter'],['3','Qua'],['4','Qui'],['5','Sex'],['6','Sab']].map(([v,l]) => (
 <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
 <input type="checkbox" name="expedienteDias" value={v} defaultChecked={['1','2','3','4','5'].includes(v)} />
 {l}
 </label>
 ))}
 </div>
 </div>
 <div className="field">
 <label className="field__label">Início expediente</label>
 <select name="expedienteInicioHora" className="field__select" defaultValue="8">
 {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}h</option>)}
 </select>
 </div>
 <div className="field">
 <label className="field__label">Fim expediente</label>
 <select name="expedienteFimHora" className="field__select" defaultValue="18">
 {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}h</option>)}
 </select>
 </div>
 <div className="field">
 <label className="field__label">Rotação contínua (opcional)</label>
 <select name="rotacaoIntervaloMin" className="field__select" defaultValue="">
 <option value="">Desligada</option>
 <option value="5">A cada 5 min</option>
 <option value="10">A cada 10 min</option>
 <option value="15">A cada 15 min</option>
 <option value="20">A cada 20 min</option>
 <option value="30">A cada 30 min</option>
 <option value="60">A cada 1h</option>
 <option value="120">A cada 2h</option>
 <option value="240">A cada 4h</option>
 </select>
 <div className="field__hint">Imobilead-style: rotaciona leads sem resposta entre corretores a cada intervalo</div>
 </div>
 </div>
 <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
 <button type="button" className="btn btn--secondary" onClick={() => setOpenNew(false)}>Cancelar</button>
 <button type="submit" className="btn btn--primary">Criar Roleta</button>
 </div>
 </form>
 </Modal>

 <Modal open={openSim} onClose={() => setOpenSim(false)} title="Simular chegada de lead" subtitle="Testa qual roleta captura e qual corretor recebe">
 <form onSubmit={simular}>
 <div className="form-grid form-grid--single">
 <div className="field">
 <label className="field__label">Origem</label>
 <select name="origem" className="field__select" defaultValue="META_ADS">
 <option value="META_ADS">Meta Ads</option>
 <option value="INSTAGRAM">Instagram</option>
 <option value="GOOGLE">Google</option>
 <option value="SITE">Site</option>
 </select>
 </div>
 <div className="field">
 <label className="field__label">Campanha (opcional)</label>
 <input name="campanha" className="field__input" placeholder="ex: VIP, Park View…" />
 </div>
 </div>
 {simResult && (
 <div style={{ marginTop: 16 }}>
 {simResult.corretorId ? (
 <div className="card" style={{ background: 'var(--color-success-bg)', borderColor: '#88C559', padding: 14 }}>
 <div className="font-bold">{simResult.corretorNome}</div>
 <div className="text-sm" style={{ color: '#4D7A26' }}>via roleta "{simResult.roletaNome}"</div>
 </div>
 ) : (
 <div className="card" style={{ background: 'var(--color-warning-bg)', borderColor: '#F2D88A', padding: 14 }}>
 <div className="font-bold" style={{ color: '#8A6914' }}>Sem distribuição automática</div>
 <div className="text-sm" style={{ color: '#8A6914' }}>
 {simResult.motivo === 'sem_roleta'
 ? 'Nenhuma roleta casou — iria para o bolsão.'
 : 'Nenhum corretor elegível agora (roleta manual ou todos pausados).'}
 </div>
 </div>
 )}
 </div>
 )}
 <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
 <button type="button" className="btn btn--secondary" onClick={() => setOpenSim(false)}>Fechar</button>
 <button type="submit" className="btn btn--primary">Simular</button>
 </div>
 </form>
 </Modal>
 </>
 );
}

function Shell({ children, onNew, onSim }: { children: React.ReactNode; onNew?: () => void; onSim?: () => void }) {
 return (
 <>
 <Topbar
 title="Roletas de Distribuição"
 right={
 <>
 <Link to="/formularios" className="btn btn--secondary btn--sm">Formulários / Webhooks</Link>
 <button className="btn btn--secondary btn--sm" onClick={onSim}>Simular Lead</button>
 <button className="btn btn--primary btn--sm" onClick={onNew}>+ Nova Roleta</button>
 </>
 }
 />
 <div className="main__content">
 <PageHeader breadcrumb="Comercial · Roletas" title="Roletas" />
 {children}
 </div>
 </>
 );
}
