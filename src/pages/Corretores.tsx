import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { formatCurrencyShort } from '../lib/format';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { MultiFiltro } from '../components/MultiFiltro';
import { Auth } from '../lib/auth';

export default function Corretores() {
 // Gestor (líder de equipe) cadastra corretor SÓ nas equipes que lidera — a lista
 // de equipes já vem escopada do backend; aqui a UI força a escolha da equipe.
 const isGestor = Auth.user?.role === 'GERENTE_EQUIPE';
 const [search, setSearch] = useState('');
 const [filtroEquipe, setFiltroEquipe] = useState<string[]>([]); // nomes das equipes (multi)
 const [filtroStatus, setFiltroStatus] = useState<string | null>('ATIVO'); // padrão: só ativos na lista
 const [open, setOpen] = useState(false);
 const [painelId, setPainelId] = useState<number | null>(null);
 // Deep-link: /corretores?painel=123 abre a ficha direto (ex.: clique no nome do
 // corretor lá no Atendimento).
 const [searchParams, setSearchParams] = useSearchParams();
 useEffect(() => {
   const p = Number(searchParams.get('painel'));
   if (p) { setPainelId(p); searchParams.delete('painel'); setSearchParams(searchParams, { replace: true }); }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);
 const [leadsDe, setLeadsDe] = useState<any | null>(null);
 const [scoreDe, setScoreDe] = useState<any | null>(null);
 const [ordenar, setOrdenar] = useState('leads_desc');
 const { data: corretores, loading, error, reload } = useApi<any[]>(() => Api.corretores());
 const { data: equipes } = useApi<any[]>(() => Api.equipes());
 const toast = useToast();
 const confirm = useConfirm();

 const submit = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const fd = new FormData(e.currentTarget);
 const passwordInput = String(fd.get('password') || '').trim();
 try {
 const r: any = await Api.corretorCreate({
 name: String(fd.get('name') || ''),
 email: String(fd.get('email') || ''),
 // Só envia password se o admin digitou — backend gera senha aleatória se vazio
 ...(passwordInput ? { password: passwordInput } : {}),
 phone: fd.get('phone') ? String(fd.get('phone')) : undefined,
 creci: fd.get('creci') ? String(fd.get('creci')) : undefined,
 equipeId: fd.get('equipeId') ? Number(fd.get('equipeId')) : null,
 status: String(fd.get('status') || 'ATIVO'),
 metaMensal: Number(fd.get('metaMensal')) || 2_000_000,
 banco: fd.get('banco') ? String(fd.get('banco')) : undefined,
 pixKey: fd.get('pixKey') ? String(fd.get('pixKey')) : undefined,
 ...(fd.get('dataAdmissao') ? { dataAdmissao: String(fd.get('dataAdmissao')) } : {}),
 ...(fd.get('percentualComissaoAtual') ? { percentualComissaoAtual: Number(fd.get('percentualComissaoAtual')) } : {}),
 });
 if (r?.senhaTemporaria) {
 toast.success(`Corretor cadastrado. Senha temporária: ${r.senhaTemporaria}`, 12000);
 } else {
 toast.success('Corretor cadastrado');
 }
 setOpen(false);
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 const desativar = async (id: number) => {
 const ok = await confirm({
 title: 'Desativar corretor?',
 message: 'O corretor perderá acesso ao sistema imediatamente. Ele não poderá fazer login nem receber novos leads.',
 confirmText: 'Desativar',
 tone: 'danger',
 });
 if (!ok) return;
 try {
 await Api.corretorDesativar(id);
 toast.success('Corretor desativado');
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 const reativar = async (id: number) => {
 const ok = await confirm({
 title: 'Reativar corretor?',
 message: 'O corretor volta a ter acesso. Leads de BM pessoal que haviam sido arquivados retornam para ele.',
 confirmText: 'Reativar',
 });
 if (!ok) return;
 try {
 await Api.corretorReativar(id);
 toast.success('Corretor reativado');
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 }
 };

 if (loading) return <Shell onNew={() => setOpen(true)}><LoadingBlock /></Shell>;
 if (error) return <Shell onNew={() => setOpen(true)}><ErrorBlock error={error} /></Shell>;
 if (!corretores) return null;
 const eqs = equipes || [];

 const ativos = corretores.filter((c: any) => c.status === 'ATIVO' || c.ativo).length;

 const ts = (d: any) => (d ? new Date(d).getTime() : 0);
 const sortFns: Record<string, (a: any, b: any) => number> = {
 leads_desc: (a, b) => (b.leadsCount ?? 0) - (a.leadsCount ?? 0),
 leads_asc: (a, b) => (a.leadsCount ?? 0) - (b.leadsCount ?? 0),
 nome_asc: (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'),
 nome_desc: (a, b) => (b.nome || '').localeCompare(a.nome || '', 'pt-BR'),
 entrada_desc: (a, b) => ts(b.dataAdmissao) - ts(a.dataAdmissao),
 entrada_asc: (a, b) => ts(a.dataAdmissao) - ts(b.dataAdmissao),
 };
 const filtered = corretores
 .filter((c: any) => !filtroEquipe.length || filtroEquipe.includes(c.equipe?.nome || c.equipe))
 .filter((c: any) => !filtroStatus || (filtroStatus === 'ATIVO' ? (c.status === 'ATIVO' || c.ativo) : !(c.status === 'ATIVO' || c.ativo)))
 .filter((c: any) => {
 if (!search.trim()) return true;
 // Busca ampla: nome, CRECI, e-mail, telefone (só dígitos) e equipe
 const q = search.trim().toLowerCase();
 const dig = q.replace(/\D/g, '');
 return (c.nome || '').toLowerCase().includes(q)
 || (c.creci || '').toLowerCase().includes(q)
 || (c.email || c.user?.email || '').toLowerCase().includes(q)
 || (c.equipe?.nome || '').toLowerCase().includes(q)
 || (dig.length >= 4 && String(c.phone || '').replace(/\D/g, '').includes(dig));
 })
 .sort(sortFns[ordenar] || sortFns.leads_desc);

 return (
 <>
 <Topbar
 title="Corretores"
 right={
 <>
 <div className="topbar__search">
 <Icon name="target" className="topbar__search-icon icon" />
 <input
 type="text"
 placeholder="Nome, CRECI, telefone, e-mail ou equipe…"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 />
 </div>
 <button className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>+ Novo Corretor</button>
 </>
 }
 />

 <div className="main__content">
 <PageHeader
 breadcrumb="Gestão · Corretores"
 title={
 filtroEquipe.length
 ? `${filtered.length} corretor${filtered.length === 1 ? '' : 'es'} · ${filtroEquipe.length === 1 ? filtroEquipe[0] : `${filtroEquipe.length} equipes`}`
 : (search.trim() || (filtroStatus && filtroStatus !== 'ATIVO') || !filtroStatus)
 ? `${filtered.length} corretor${filtered.length === 1 ? '' : 'es'} no filtro`
 : `${ativos} corretores · ${eqs.length} equipes`
 }
 subtitle={
 (filtroEquipe.length || search.trim() || filtroStatus !== 'ATIVO')
 ? `${filtered.filter((c: any) => c.status === 'ATIVO' || c.ativo).length} ativos no recorte`
 : `${corretores.length - ativos} inativo(s) fora da lista — use o filtro de status pra vê-los`
 }
 />

 <div className="filter-bar">
 {/* Busca também aqui dentro — a da topbar some no celular */}
 <input
 type="text"
 className="field__input filtro-sel"
 style={{ height: 32, fontSize: 13, paddingTop: 0, paddingBottom: 0, minWidth: 180, flex: '1 1 180px' }}
 placeholder="Buscar por nome, CRECI, telefone…"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 />
 <MultiFiltro
 label={`Equipes (${eqs.length})`}
 opcoes={eqs.map((e: any) => ({ value: e.nome, label: e.nome }))}
 values={filtroEquipe}
 onChange={setFiltroEquipe}
 />
 <select
 className="field__select filtro-sel"
 style={{ height: 32, fontSize: 13, paddingTop: 0, paddingBottom: 0, fontWeight: 600 }}
 value={filtroStatus || ''}
 onChange={(e) => setFiltroStatus(e.target.value || null)}
 title="Filtrar por status"
 >
 <option value="">Status: todos (inclui inativos)</option>
 <option value="ATIVO">Status: ativos</option>
 <option value="INATIVO">Status: inativos</option>
 </select>
 <select
 className="field__select filtro-sel"
 style={{ height: 32, fontSize: 13, paddingTop: 0, paddingBottom: 0 }}
 value={ordenar}
 onChange={(e) => setOrdenar(e.target.value)}
 title="Ordenar corretores"
 >
 <option value="leads_desc">Ordenar: mais leads</option>
 <option value="leads_asc">Ordenar: menos leads</option>
 <option value="nome_asc">Ordenar: nome A–Z</option>
 <option value="nome_desc">Ordenar: nome Z–A</option>
 <option value="entrada_desc">Ordenar: entrada + recente</option>
 <option value="entrada_asc">Ordenar: entrada + antiga</option>
 </select>
 </div>

 <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
 <table className="table tabela-corretores">
 <thead>
 <tr>
 <th>Corretor</th>
 <th>Equipe</th>
 <th>CRECI</th>
 <th className="numeric">Score (mês)</th>
 <th className="numeric">Leads</th>
 <th className="numeric">Vendas (mês)</th>
 <th className="numeric">Volume</th>
 <th>Status</th>
 <th></th>
 </tr>
 </thead>
 <tbody>
 {filtered.length === 0 ? (
 <tr>
 <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
 Nenhum corretor encontrado
 </td>
 </tr>
 ) : (
 filtered.map((c: any) => {
 const eqNome = c.equipe?.nome || c.equipe;
 const eqColor = c.equipe?.cor || eqs.find((e: any) => e.nome === eqNome)?.cor || '#0E7C9B';
 const isAtivo = c.status === 'ATIVO' || c.ativo;
 return (
 <tr key={c.id}>
 <td>
 <div className="flex gap-3" style={{ alignItems: 'center' }}>
 <div className="avatar">{c.initials}</div>
 <div>
 <div className="font-semibold" style={{ cursor: 'pointer', color: 'var(--color-info-fg)' }} onClick={() => setPainelId(c.id)} title="Abrir painel do corretor">{c.nome}</div>
 <div className="text-xs text-secondary">{c.email || c.user?.email}</div>
 </div>
 </div>
 </td>
 <td>
 {eqNome ? (
 <span className="badge" style={{ background: `${eqColor}20`, color: eqColor }}>
 {eqNome}
 </span>
 ) : (
 <span className="text-xs text-secondary">—</span>
 )}
 </td>
 <td className="text-xs">{c.creci || '—'}</td>
 <td className="numeric">
   <button className="btn btn--ghost btn--sm" style={{ fontWeight: 700, color: (c.scoreMes || 0) > 0 ? 'var(--color-success)' : 'var(--color-info-fg)' }} onClick={() => setScoreDe(c)} title="Ver histórico de score deste corretor">
     {c.scoreMes ?? 0}
   </button>
 </td>
 <td className="numeric">
 {(c.leadsCount ?? 0) > 0 ? (
 <button className="btn btn--ghost btn--sm" style={{ fontWeight: 700, color: 'var(--color-info-fg)' }} onClick={() => setLeadsDe(c)} title="Ver os leads deste corretor">
 {c.leadsCount}
 </button>
 ) : (
 <span className="text-secondary">0</span>
 )}
 </td>
 <td className="numeric font-semibold">{c.vendasMes ?? 0}</td>
 <td className="numeric money">{formatCurrencyShort(c.volumeMes)}</td>
 <td>
 <span className={'badge ' + (isAtivo ? 'badge--signed' : 'badge--cancelled')}>
 {isAtivo ? 'ATIVO' : (c.status || 'INATIVO')}
 </span>
 </td>
 <td>
 {isAtivo ? (
 <button
 className="btn btn--ghost btn--sm"
 onClick={() => desativar(c.id)}
 title="Desativar"
 >
 Desativar
 </button>
 ) : (
 <button
 className="btn btn--ghost btn--sm"
 onClick={() => reativar(c.id)}
 title="Reativar"
 >
 Reativar
 </button>
 )}
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>
 </div>

 <Modal open={open} onClose={() => setOpen(false)} title="Novo Corretor" subtitle="Será criado com login + perfil de corretor" size="lg">
 <form onSubmit={submit}>
 <div className="form-grid">
 <div className="field field--span-2">
 <label className="field__label">Nome completo <span className="field__required">*</span></label>
 <input name="name" className="field__input" required />
 </div>
 <div className="field">
 <label className="field__label">E-mail <span className="field__required">*</span></label>
 <input name="email" type="email" className="field__input" required />
 </div>
 <div className="field">
 <label className="field__label">Telefone</label>
 <input name="phone" className="field__input" placeholder="(48) 99999-0000" />
 </div>
 <div className="field">
 <label className="field__label">CRECI</label>
 <input name="creci" className="field__input" placeholder="12345-F SC" />
 </div>
 <div className="field">
 <label className="field__label">Equipe{isGestor && <span className="field__required"> *</span>}</label>
 <select name="equipeId" className="field__select" required={isGestor} defaultValue={isGestor && eqs.length ? String(eqs[0].id) : ''}>
 {!isGestor && <option value="">— Sem equipe —</option>}
 {eqs.map((eq: any) => (
 <option key={eq.id} value={eq.id}>{eq.nome}</option>
 ))}
 </select>
 </div>
 <div className="field">
 <label className="field__label">Status</label>
 <select name="status" className="field__select" defaultValue="ATIVO">
 <option value="ATIVO">Ativo</option>
 <option value="PROBATORIO">Probatório</option>
 </select>
 </div>
 <div className="field">
 <label className="field__label">Meta mensal (R$)</label>
 <input name="metaMensal" type="number" className="field__input" defaultValue="2000000" />
 </div>
 <div className="field">
 <label className="field__label">Banco</label>
 <input name="banco" className="field__input" placeholder="Bradesco" />
 </div>
 <div className="field">
 <label className="field__label">PIX</label>
 <input name="pixKey" className="field__input" placeholder="CPF ou e-mail" />
 </div>
 <div className="field">
 <label className="field__label">Data de Entrada</label>
 <input name="dataAdmissao" type="date" className="field__input" />
 </div>
 <div className="field">
 <label className="field__label">Rateio de comissão atual (%)</label>
 <input name="percentualComissaoAtual" type="number" step="0.01" min="0" max="100" className="field__input" placeholder="ex.: 55" />
 <div className="field__hint">Split negociado do corretor — vale nas vendas novas.</div>
 </div>
 <div className="field field--span-2">
 <label className="field__label">Senha inicial</label>
 <input name="password" type="password" className="field__input" required minLength={6} placeholder="mínimo 6 caracteres" autoComplete="new-password" />
 <div className="field__hint">Defina uma senha única — o corretor troca no primeiro acesso</div>
 </div>
 </div>
 <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
 <button type="button" className="btn btn--secondary" onClick={() => setOpen(false)}>Cancelar</button>
 <button type="submit" className="btn btn--primary">Criar Corretor</button>
 </div>
 </form>
 </Modal>

 {painelId && <CorretorPainelDrawer id={painelId} onClose={() => setPainelId(null)} onSaved={reload} />}
 {leadsDe && <LeadsCorretorModal corretor={leadsDe} onClose={() => setLeadsDe(null)} />}
 {scoreDe && <ScoreCorretorModal corretor={scoreDe} onClose={() => setScoreDe(null)} />}
 </>
 );
}

// Rótulos amigáveis + ícone/cor pra cada tipo de evento de score.
const SCORE_TIPO_LABEL: Record<string, string> = {
 RESPOSTA_RAPIDA: 'Resposta rápida ao lead',
 NEGOCIANDO: 'Avançou pra negociação',
 CONTRATO: 'Contrato',
 VENDA: 'Venda fechada',
 SEM_RESPOSTA: 'Lead sem resposta',
 AJUSTE_MANUAL: 'Ajuste manual (gestor)',
};
const scoreTipoLabel = (t: string) => SCORE_TIPO_LABEL[t] || t;

function ScoreCorretorModal({ corretor, onClose }: { corretor: any; onClose: () => void }) {
 const { data, loading, error } = useApi<{ eventos: any[]; porTipo: Record<string, number> }>(() => Api.corretorScoreEventos(corretor.id), [corretor.id]);
 const fmtData = (d: string) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
 const eventos = data?.eventos || [];
 const porTipo = data?.porTipo || {};
 return (
 <Modal open onClose={onClose} title={`Histórico de score — ${corretor.nome}`} subtitle={`Score no mês: ${corretor.scoreMes ?? 0} · ${corretor.equipe?.nome || 'sem equipe'}`} size="xl">
 {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : (
 <>
 {Object.keys(porTipo).length > 0 && (
 <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
 {Object.entries(porTipo).map(([tipo, pts]) => (
 <span key={tipo} className="badge" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
 {scoreTipoLabel(tipo)}: <strong style={{ color: pts >= 0 ? 'var(--color-success)' : 'var(--color-danger, #e5484d)', marginLeft: 4 }}>{pts >= 0 ? '+' : ''}{pts}</strong>
 </span>
 ))}
 </div>
 )}
 <table className="table">
 <thead><tr><th>Ação</th><th>Detalhe</th><th>Quando</th><th className="numeric">Pontos</th></tr></thead>
 <tbody>
 {eventos.length === 0 ? (
 <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>Nenhum evento de score ainda.</td></tr>
 ) : (
 eventos.map((e) => (
 <tr key={e.id}>
 <td className="font-semibold">{scoreTipoLabel(e.tipo)}</td>
 <td className="text-sm text-secondary">{e.descricao || (e.leadId ? `Lead #${e.leadId}` : e.origem === 'GESTOR_MANUAL' ? 'Ajuste do gestor' : '—')}</td>
 <td className="text-sm text-secondary">{fmtData(e.createdAt)}</td>
 <td className="numeric" style={{ fontWeight: 700, color: (e.pontos ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger, #e5484d)' }}>
 {(e.pontos ?? 0) >= 0 ? '+' : ''}{e.pontos ?? 0}
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 <div className="text-xs text-secondary" style={{ marginTop: 8 }}>Mostrando os últimos {eventos.length} eventos.</div>
 </>
 )}
 </Modal>
 );
}

function LeadsCorretorModal({ corretor, onClose }: { corretor: any; onClose: () => void }) {
 const { data, loading, error } = useApi<any[]>(() => Api.corretorLeads(corretor.id), [corretor.id]);
 const fmtData = (d: string) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');
 return (
 <Modal open onClose={onClose} title={`Leads — ${corretor.nome}`} subtitle={`${corretor.leadsCount ?? (data?.length || 0)} leads · ${corretor.equipe?.nome || 'sem equipe'}`} size="xl">
 {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : (
 <table className="table">
 <thead><tr><th>Nome</th><th>Telefone</th><th>Produto</th><th>Data de entrada</th></tr></thead>
 <tbody>
 {(data || []).length === 0 ? (
 <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>Nenhum lead atribuído.</td></tr>
 ) : (
 (data || []).map((l) => (
 <tr key={l.id}>
 <td className="font-semibold">{l.nome}</td>
 <td className="text-sm">{l.telefone || '—'}</td>
 <td className="text-sm">{l.produto || '—'}</td>
 <td className="text-sm text-secondary">{fmtData(l.data)}</td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 )}
 </Modal>
 );
}

function Shell({ children, onNew }: { children: React.ReactNode; onNew?: () => void }) {
 return (
 <>
 <Topbar
 title="Corretores"
 right={<button className="btn btn--primary btn--sm" onClick={onNew}>+ Novo Corretor</button>}
 />
 <div className="main__content">
 <PageHeader breadcrumb="Gestão · Corretores" title="Corretores" />
 {children}
 </div>
 </>
 );
}

// Painel do corretor: cadastro (Data de Entrada + Rateio de comissão atual) +
// tabela de vendas com o % TRAVADO de cada uma (snapshot do fechamento).
function CorretorPainelDrawer({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => void }) {
  const { data: c, loading, error, reload } = useApi<any>(() => Api.corretor(id), [id]);
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const fmt = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');
  const dataInput = c?.dataAdmissao ? new Date(c.dataAdmissao).toISOString().slice(0, 10) : '';

  const salvar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: any = {};
    const dt = String(fd.get('dataAdmissao') || '');
    if (dt) payload.dataAdmissao = dt;
    const pct = String(fd.get('percentualComissaoAtual') || '');
    payload.percentualComissaoAtual = pct ? Number(pct) : null;
    setSaving(true);
    try {
      await Api.corretorUpdate(id, payload);
      toast.success('Cadastro atualizado');
      reload();
      onSaved();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={c ? `Painel — ${c.nome}` : 'Painel do corretor'} size="xl">
      {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : c ? (
        <>
          <div className="flex gap-3" style={{ alignItems: 'center', marginBottom: 16 }}>
            <div className="avatar">{c.initials}</div>
            <div>
              <div className="font-semibold">{c.nome}</div>
              <div className="text-xs text-secondary">{c.creci ? `CRECI ${c.creci} · ` : ''}{c.status}{c.equipe?.nome ? ` · ${c.equipe.nome}` : ''}</div>
            </div>
          </div>

          <form onSubmit={salvar}>
            <h4 style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Cadastro</h4>
            <div className="form-grid">
              <div className="field">
                <label className="field__label">Data de Entrada</label>
                <input name="dataAdmissao" type="date" className="field__input" defaultValue={dataInput} />
              </div>
              <div className="field">
                <label className="field__label">Rateio de comissão atual (%)</label>
                <input name="percentualComissaoAtual" type="number" step="0.01" min="0" max="100" className="field__input" defaultValue={c.percentualComissaoAtual ?? ''} placeholder="ex.: 55" />
                <div className="field__hint">Negociação Pons × corretor. Vale nas vendas NOVAS — não altera as antigas.</div>
              </div>
            </div>
            <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>{saving ? 'Salvando…' : 'Salvar cadastro'}</button>
            </div>
          </form>

          <h4 style={{ fontWeight: 700, fontSize: 13, margin: '18px 0 6px' }}>Rateio de comissão por venda</h4>
          <div className="text-xs text-secondary" style={{ marginBottom: 8 }}>
            Cada venda mantém o <strong>% de quando foi fechada</strong>. Alterar o rateio atual acima só vale pras próximas — vendas e parcelas abaixo permanecem no percentual anterior.
          </div>
          <table className="table">
            <thead><tr><th>Venda</th><th>Data</th><th className="numeric">Valor</th><th className="numeric">% travado</th><th className="numeric">Comissão corretor</th></tr></thead>
            <tbody>
              {(c.vendasRecentes || []).length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma venda registrada</td></tr>
              ) : c.vendasRecentes.map((v: any) => (
                <tr key={v.id}>
                  <td><div className="font-semibold text-xs">{v.empreendimento}</div><div className="text-xs text-secondary">{v.codigo} · {v.unidade}</div></td>
                  <td className="text-xs">{fmtDate(v.createdAt)}</td>
                  <td className="numeric">{fmt(v.valorVenda)}</td>
                  <td className="numeric">{v.splitCorretorPct != null ? <span className="badge badge--info">{v.splitCorretorPct}%</span> : <span className="text-secondary">—</span>}</td>
                  <td className="numeric money">{v.comissaoCorretor != null ? fmt(v.comissaoCorretor) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </Modal>
  );
}
