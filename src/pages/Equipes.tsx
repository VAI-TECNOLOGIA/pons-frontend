import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { formatCurrencyShort } from '../lib/format';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import './equipes.css';

export default function Equipes() {
 const [view, setView] = useState<'escuderias' | 'resultados'>('escuderias');
 const [open, setOpen] = useState(false);
 const { data: equipes, loading, error, reload } = useApi<any[]>(() => Api.equipes());
 const toast = useToast();
 const nav = useNavigate();

 // ── Transferência de corretor entre equipes (gestores) ────────────────
 const { data: corretores } = useApi<any[]>(() => Api.corretores());
 const { data: transfs, reload: reloadTransfs } = useApi<any[]>(() => Api.equipeTransferencias());
 const [transfCorretor, setTransfCorretor] = useState('');
 const [transfDestino, setTransfDestino] = useState('');
 const [transfBusy, setTransfBusy] = useState(false);
 const [transfBusca, setTransfBusca] = useState('');
 const [transfFiltroEquipe, setTransfFiltroEquipe] = useState('');
 const pendentes = (transfs || []).filter((t: any) => t.status === 'PENDENTE');

 // O que o usuário logado comanda (líder formal ou gestor marcado no painel):
 // só pode transferir corretor DESSAS equipes — a lista já nem mostra os demais.
 const { data: minhas } = useApi<{ admin: boolean; equipeIds: number[] }>(() => Api.equipesMinhas());
 const comando = (equipeId?: number) => !!minhas && (minhas.admin || (!!equipeId && minhas.equipeIds.includes(equipeId)));
 // Não-admin com equipes atribuídas: os cards/resultados mostram SÓ as equipes
 // que ele comanda (a lista completa segue disponível como destino de transferência).
 const cardVisivel = (equipeId?: number) => !minhas || minhas.admin || !minhas.equipeIds.length || comando(equipeId);
 const equipesVisiveis = (equipes || []).filter((eq: any) => cardVisivel(eq.id));

 // Busca por nome/telefone + filtro por equipe atual no seletor de corretor
 const normaliza = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
 const soDigitos = (s: string) => (s || '').replace(/\D/g, '');
 const corretoresFiltrados = (corretores || []).filter((c: any) => {
 if (!comando(c.equipe?.id)) return false;
 if (transfFiltroEquipe && String(c.equipe?.id || '') !== transfFiltroEquipe) return false;
 if (!transfBusca.trim()) return true;
 const q = transfBusca.trim();
 const porNome = normaliza(c.nome || c.user?.name || '').includes(normaliza(q));
 const dig = soDigitos(q);
 const porFone = dig.length >= 4 && soDigitos(c.phone || '').includes(dig);
 return porNome || porFone;
 });

 // ── Atribuir líder ─────────────────────────────────────────────────────
 const [liderEquipe, setLiderEquipe] = useState<any | null>(null);
 const [liderBusca, setLiderBusca] = useState('');
 const [liderBusy, setLiderBusy] = useState(false);

 const atribuirLider = async (userId: number, nome: string) => {
 if (!liderEquipe) return;
 setLiderBusy(true);
 try {
 await Api.equipeAtribuirLider(liderEquipe.id, userId);
 toast.success(`${nome} agora é líder de ${liderEquipe.nome}.`);
 setLiderEquipe(null); setLiderBusca('');
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message === 'sem_permissao' ? 'só admin ou o gestor da equipe pode atribuir líder.' : err.message || 'falha'));
 } finally {
 setLiderBusy(false);
 }
 };

 // Candidatos a líder: corretores + gestores (sócias/gerentes sem registro de
 // corretor também podem liderar — o backend cria o vínculo na hora). A lista
 // de gestores é admin-only no backend; se vier 403, segue só com corretores.
 const { data: gestoresData } = useApi<any[]>(() => Api.gestoresEquipes().catch(() => []));
 const candidatosBase = [
 ...(corretores || []).map((c: any) => ({ userId: c.userId, nome: c.nome, phone: c.phone, sub: c.equipe?.nome || 'sem equipe' })),
 ...(gestoresData || [])
 .filter((g: any) => !(corretores || []).some((c: any) => c.userId === g.id))
 .map((g: any) => ({ userId: g.id, nome: g.nome, phone: '', sub: g.role })),
 ];
 const candidatosLider = candidatosBase.filter((c: any) => {
 if (!liderBusca.trim()) return true;
 const q = liderBusca.trim();
 const dig = soDigitos(q);
 return normaliza(c.nome || '').includes(normaliza(q)) || (dig.length >= 4 && soDigitos(c.phone || '').includes(dig));
 });

 const solicitarTransf = async () => {
 if (!transfCorretor || !transfDestino) return;
 setTransfBusy(true);
 try {
 const r = await Api.equipeTransferir({ corretorId: Number(transfCorretor), equipeDestinoId: Number(transfDestino) });
 toast.success(r.efetivada ? 'Transferência efetivada.' : 'Solicitação enviada — aguardando aprovação do gestor da equipe de destino.');
 setTransfCorretor(''); setTransfDestino('');
 reload(); reloadTransfs();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message === 'sem_permissao' ? 'só o gestor da equipe atual do corretor pode transferir.' : err.message || 'falha'));
 } finally {
 setTransfBusy(false);
 }
 };

 const decidirTransf = async (id: number, aprovar: boolean) => {
 try {
 await Api.equipeTransfDecidir(id, aprovar);
 toast.success(aprovar ? 'Transferência aprovada.' : 'Transferência recusada.');
 reload(); reloadTransfs();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 const submit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const fd = new FormData(e.currentTarget);
 try {
 await Api.equipeCreate({
 nome: String(fd.get('nome') || ''),
 descricao: fd.get('descricao') ? String(fd.get('descricao')) : undefined,
 cor: String(fd.get('cor') || '#0E7C9B'),
 });
 toast.success('Equipe criada');
 setOpen(false);
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 if (loading) return <Shell onNew={() => setOpen(true)}><LoadingBlock /></Shell>;
 if (error) return <Shell onNew={() => setOpen(true)}><ErrorBlock error={error} /></Shell>;
 if (!equipes) return null;

 const totais = equipesVisiveis.reduce(
 (acc: any, e: any) => ({
 vendas: acc.vendas + (e.vendasMes ?? 0),
 receita: acc.receita + (e.volumeMes ?? 0),
 corretores: acc.corretores + (e.totalCorretores ?? e.corretores ?? (e.membros?.length || 0)),
 }),
 { vendas: 0, receita: 0, corretores: 0 },
 );

 return (
 <>
 <Topbar
 title="Equipes"
 right={
 <button className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
 + Nova Equipe
 </button>
 }
 />
 <div className="main__content">
 <PageHeader
 breadcrumb="Gestão · Equipes"
 title="Equipes Comerciais"
 subtitle="Organização do time de corretores por empreendimento ou foco"
 />

 {/* Pendências de transferência — aparece pra quem pode aprovar/acompanhar */}
 {pendentes.length > 0 && (
 <div className="card" style={{ marginBottom: 16, border: '1px solid rgba(245,158,11,0.4)' }}>
 <div className="uppercase-tag" style={{ marginBottom: 10 }}>Transferências aguardando aprovação</div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
 {pendentes.map((t: any) => (
 <div key={t.id} className="flex-between" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
 <div style={{ fontSize: 13 }}>
 <strong>{t.corretor?.nome}</strong>
 <span className="text-secondary"> · {t.origem?.nome || 'sem equipe'} → <strong>{t.destino?.nome}</strong></span>
 </div>
 {t.podeAprovar ? (
 <div className="flex gap-2">
 <button className="btn btn--primary btn--sm" onClick={() => decidirTransf(t.id, true)}>Aprovar</button>
 <button className="btn btn--ghost btn--sm" onClick={() => decidirTransf(t.id, false)}>Recusar</button>
 </div>
 ) : (
 <span className="badge badge--analysis" style={{ fontSize: 10 }}>Aguardando gestor de {t.destino?.nome}</span>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Transferir corretor: direto entre equipes do mesmo gestor; senão pende aprovação */}
 <div className="card transf-card">
 <div className="flex-between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
 <div className="uppercase-tag">Transferir corretor de equipe</div>
 {minhas?.admin && (
 <button className="btn btn--ghost btn--sm" onClick={() => nav('/gestores')}>
 <Icon name="users" size={13} /> Gestores das equipes
 </button>
 )}
 </div>
 <div className="transf-grid">
 <div className="transf-col">
 <div className="transf-col__label">1 · Escolha o corretor</div>
 <div className="transf-filtros">
 <div className="transf-busca">
 <Icon name="search" size={14} />
 <input
 placeholder="Nome ou telefone…"
 value={transfBusca}
 onChange={(e) => setTransfBusca(e.target.value)}
 />
 {transfBusca && (
 <button className="transf-busca__clear" onClick={() => setTransfBusca('')} title="Limpar busca">
 <Icon name="x" size={12} />
 </button>
 )}
 </div>
 <select className="field__select transf-filtro-equipe" value={transfFiltroEquipe} onChange={(e) => setTransfFiltroEquipe(e.target.value)}>
 <option value="">{minhas?.admin ? 'Todas as equipes' : 'Minhas equipes'}</option>
 {equipes.filter((eq: any) => comando(eq.id)).map((eq: any) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
 </select>
 </div>
 <div className="transf-lista">
 {corretoresFiltrados.slice(0, 30).map((c: any) => {
 const on = transfCorretor === String(c.id);
 return (
 <button
 key={c.id}
 className={'transf-item' + (on ? ' transf-item--on' : '')}
 onClick={() => setTransfCorretor(on ? '' : String(c.id))}
 >
 <span className="avatar avatar--sm" style={{ flexShrink: 0 }}>{(c.nome || '?').split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase()}</span>
 <span className="transf-item__info">
 <span className="transf-item__nome">{c.nome || c.user?.name}</span>
 <span className="transf-item__sub">
 {c.equipe?.nome ? (
 <span className="transf-item__equipe" style={{ ['--eq-cor' as any]: c.equipe?.cor || 'var(--pons-blue)' }}>{c.equipe.nome}</span>
 ) : 'sem equipe'}
 {c.phone ? ` · ${c.phone}` : ''}
 </span>
 </span>
 <span className="transf-item__check"><Icon name="check" size={13} /></span>
 </button>
 );
 })}
 {!corretoresFiltrados.length && (
 <div className="transf-vazio">Nenhum corretor encontrado com essa busca.</div>
 )}
 </div>
 {corretoresFiltrados.length > 30 && (
 <div className="field__hint" style={{ marginTop: 6 }}>Mostrando 30 de {corretoresFiltrados.length} — refine a busca pra ver os demais.</div>
 )}
 </div>
 <div className="transf-col">
 <div className="transf-col__label">2 · Equipe de destino</div>
 <div className="transf-chips">
 {equipes.filter((eq: any) => {
 const sel = (corretores || []).find((c: any) => String(c.id) === transfCorretor);
 return !sel || sel.equipe?.id !== eq.id;
 }).map((eq: any) => {
 const on = transfDestino === String(eq.id);
 return (
 <button
 key={eq.id}
 className={'transf-chip' + (on ? ' transf-chip--on' : '')}
 onClick={() => setTransfDestino(on ? '' : String(eq.id))}
 >
 <span className="transf-chip__dot" style={{ background: eq.cor }} />
 {eq.nome}
 </button>
 );
 })}
 </div>
 {(() => {
 const sel = (corretores || []).find((c: any) => String(c.id) === transfCorretor);
 const dest = equipes.find((eq: any) => String(eq.id) === transfDestino);
 return (
 <div className="transf-resumo">
 {sel && dest ? (
 <>
 <strong>{sel.nome}</strong>
 <span className="text-secondary"> · {sel.equipe?.nome || 'sem equipe'}</span>
 <Icon name="chevron-right" size={13} />
 <strong style={{ color: dest.cor }}>{dest.nome}</strong>
 </>
 ) : (
 <span className="text-secondary">Escolha o corretor e a equipe de destino.</span>
 )}
 </div>
 );
 })()}
 <button className="btn btn--primary transf-enviar" disabled={!transfCorretor || !transfDestino || transfBusy} onClick={solicitarTransf}>
 {transfBusy ? 'Enviando…' : 'Transferir corretor'}
 </button>
 </div>
 </div>
 <div className="field__hint" style={{ marginTop: 6 }}>
 Entre equipes do mesmo gestor a transferência é imediata; pra equipe de outro gestor, ele recebe a solicitação e aprova.
 </div>
 </div>

 <div className="tabs">
 <button className={'tab ' + (view === 'escuderias' ? 'tab--active' : '')} onClick={() => setView('escuderias')}>
 ️ Escuderias
 </button>
 <button className={'tab ' + (view === 'resultados' ? 'tab--active' : '')} onClick={() => setView('resultados')}>
 Resultados
 </button>
 </div>

 {view === 'escuderias' && (
 <div className="grid-3">
 {equipesVisiveis.map((eq: any, idx: number) => {
 const lider = typeof eq.lider === 'string' ? eq.lider : eq.lider?.nome || '';
 const liderInit = typeof eq.lider === 'string' || !eq.lider?.initials
 ? lider.split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase()
 : eq.lider.initials;
 const totalCorr = eq.totalCorretores ?? eq.corretores ?? (eq.membros?.length || 0);
 return (
 <div className="card" style={{ position: 'relative', overflow: 'hidden' }} key={eq.id}>
 <div className="racing-stripe" style={{ ['--team-color' as any]: eq.cor }} />
 <div className="card__header" style={{ marginTop: 8 }}>
 <div>
 <div className="uppercase-tag" style={{ color: eq.cor, marginBottom: 2 }}>
 Escuderia · P{idx + 1}
 </div>
 <h3 className="card__title" style={{ fontStyle: 'italic' }}>{eq.nome}</h3>
 <p className="card__subtitle">{eq.descricao || 'Equipe ativa'}</p>
 </div>
 <span className="badge" style={{ background: `${eq.cor}1a`, color: eq.cor }}>
 {totalCorr} ️
 </span>
 </div>

 <div style={{ padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 8, marginBottom: 12 }}>
 <div className="flex-between" style={{ alignItems: 'center', gap: 8 }}>
 {lider ? (
 <div className="flex gap-2" style={{ alignItems: 'center', minWidth: 0 }}>
 <div className="avatar avatar--sm">{liderInit}</div>
 <div style={{ minWidth: 0 }}>
 <div className="uppercase-tag">Líder</div>
 <span className="font-semibold text-sm" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lider}</span>
 </div>
 </div>
 ) : (
 <span className="text-secondary text-sm">Sem líder definido</span>
 )}
 {comando(eq.id) && (
 <button className="btn btn--secondary btn--sm" style={{ flexShrink: 0 }} onClick={() => { setLiderEquipe(eq); setLiderBusca(''); }}>
 {lider ? 'Trocar líder' : 'Atribuir líder'}
 </button>
 )}
 </div>
 </div>

 {(eq.vendasMes != null || eq.volumeMes != null) && (
 <div className="flex-between" style={{ marginTop: 12 }}>
 <div>
 <div className="uppercase-tag">Vendas mês</div>
 <div className="font-semibold">{eq.vendasMes ?? 0}</div>
 </div>
 <div>
 <div className="uppercase-tag">Volume</div>
 <div className="font-semibold money">{formatCurrencyShort(eq.volumeMes)}</div>
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}

 {view === 'resultados' && (
 <>
 <div className="kpi-grid">
 <div className="kpi"><div className="kpi__label">Vendas no período</div><div className="kpi__value">{totais.vendas}</div></div>
 <div className="kpi"><div className="kpi__label">Receita gerada</div><div className="kpi__value">{formatCurrencyShort(totais.receita)}</div></div>
 <div className="kpi"><div className="kpi__label">Comissão paga (5%)</div><div className="kpi__value">{formatCurrencyShort(totais.receita * 0.05)}</div></div>
 <div className="kpi"><div className="kpi__label">Corretores</div><div className="kpi__value">{totais.corretores}</div></div>
 </div>

 <div className="card" style={{ padding: 0 }}>
 <table className="table">
 <thead>
 <tr>
 <th>Escuderia</th>
 <th className="numeric">Corretores</th>
 <th className="numeric">Vendas</th>
 <th className="numeric">Receita gerada</th>
 <th className="numeric">Comissão paga</th>
 <th className="numeric">Ticket médio</th>
 </tr>
 </thead>
 <tbody>
 {equipesVisiveis.map((e: any) => {
 const totalCorr = e.totalCorretores ?? e.corretores ?? (e.membros?.length || 0);
 const volume = e.volumeMes ?? 0;
 const vendas = e.vendasMes ?? 0;
 return (
 <tr key={e.id}>
 <td><span className="badge" style={{ background: `${e.cor}1a`, color: e.cor }}>{e.nome}</span></td>
 <td className="numeric">{totalCorr}</td>
 <td className="numeric font-semibold">{vendas}</td>
 <td className="numeric money">{formatCurrencyShort(volume)}</td>
 <td className="numeric money">{formatCurrencyShort(volume * 0.05)}</td>
 <td className="numeric money">{formatCurrencyShort(volume / Math.max(vendas, 1))}</td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </>
 )}
 </div>

 <Modal open={!!liderEquipe} onClose={() => setLiderEquipe(null)} title={liderEquipe ? `Líder de ${liderEquipe.nome}` : ''} subtitle="Busque por nome ou telefone e clique pra atribuir">
 {liderEquipe && (
 <div>
 <input
 className="field__input"
 style={{ marginBottom: 10 }}
 placeholder="Buscar por nome ou telefone…"
 value={liderBusca}
 onChange={(e) => setLiderBusca(e.target.value)}
 autoFocus
 />
 <div style={{ display: 'grid', gap: 6, maxHeight: 'min(48vh, 380px)', overflowY: 'auto' }}>
 {candidatosLider.slice(0, 60).map((c: any) => (
 <button
 key={c.userId}
 className="btn btn--secondary"
 disabled={liderBusy}
 style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-start', textAlign: 'left' }}
 onClick={() => atribuirLider(c.userId, c.nome)}
 >
 <span className="avatar avatar--sm" style={{ flexShrink: 0 }}>{(c.nome || '?').split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase()}</span>
 <span style={{ minWidth: 0 }}>
 <span className="font-semibold text-sm" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
 <span className="text-secondary" style={{ fontSize: 12 }}>{c.sub}{c.phone ? ` · ${c.phone}` : ''}</span>
 </span>
 </button>
 ))}
 {!candidatosLider.length && <span className="text-secondary text-sm">Ninguém encontrado com essa busca.</span>}
 </div>
 </div>
 )}
 </Modal>

 <Modal open={open} onClose={() => setOpen(false)} title="Nova Equipe" subtitle="Escuderia comercial">
 <form onSubmit={submit}>
 <div className="form-grid form-grid--single">
 <div className="field">
 <label className="field__label">Nome <span className="field__required">*</span></label>
 <input name="nome" className="field__input" required placeholder="Ex: Time Litoral" />
 </div>
 <div className="field">
 <label className="field__label">Descrição</label>
 <input name="descricao" className="field__input" placeholder="O que essa equipe faz?" />
 </div>
 <div className="field">
 <label className="field__label">Cor da equipe</label>
 <input name="cor" type="color" className="field__input" defaultValue="#0E7C9B" style={{ height: 44, padding: 4 }} />
 </div>
 </div>
 <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
 <button type="button" className="btn btn--secondary" onClick={() => setOpen(false)}>Cancelar</button>
 <button type="submit" className="btn btn--primary">Criar Equipe</button>
 </div>
 </form>
 </Modal>
 </>
 );
}

function Shell({ children, onNew }: { children: React.ReactNode; onNew?: () => void }) {
 return (
 <>
 <Topbar
 title="Equipes"
 right={<button className="btn btn--primary btn--sm" onClick={onNew}>+ Nova Equipe</button>}
 />
 <div className="main__content">
 <PageHeader breadcrumb="Gestão · Equipes" title="Equipes Comerciais" />
 {children}
 </div>
 </>
 );
}
