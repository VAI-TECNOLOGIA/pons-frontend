import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { formatCurrencyShort } from '../lib/format';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

export default function Corretores() {
 const [search, setSearch] = useState('');
 const [filtroEquipe, setFiltroEquipe] = useState<string | null>(null);
 const [filtroStatus, setFiltroStatus] = useState<string | null>(null);
 const [open, setOpen] = useState(false);
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

 if (loading) return <Shell onNew={() => setOpen(true)}><LoadingBlock /></Shell>;
 if (error) return <Shell onNew={() => setOpen(true)}><ErrorBlock error={error} /></Shell>;
 if (!corretores) return null;
 const eqs = equipes || [];

 const ativos = corretores.filter((c: any) => c.status === 'ATIVO' || c.ativo).length;

 const filtered = corretores
 .filter((c: any) => !filtroEquipe || (c.equipe?.nome || c.equipe) === filtroEquipe)
 .filter((c: any) => !filtroStatus || (filtroStatus === 'ATIVO' ? (c.status === 'ATIVO' || c.ativo) : !(c.status === 'ATIVO' || c.ativo)))
 .filter((c: any) => !search || (c.nome || '').toLowerCase().includes(search.toLowerCase()) || (c.email || c.user?.email || '').toLowerCase().includes(search.toLowerCase()));

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
 placeholder="Buscar corretor…"
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
 title={`${corretores.length} corretores · ${eqs.length} equipes`}
 subtitle={`${ativos} ativos · ${corretores.length - ativos} em probatório`}
 />

 <div className="filter-bar">
 <span
 className={'filter-chip ' + (!filtroEquipe ? 'filter-chip--active' : '')}
 onClick={() => setFiltroEquipe(null)}
 >
 Todas equipes
 </span>
 {eqs.map((e: any) => (
 <span
 key={e.id}
 className={'filter-chip ' + (filtroEquipe === e.nome ? 'filter-chip--active' : '')}
 onClick={() => setFiltroEquipe(e.nome)}
 >
 {e.nome}
 </span>
 ))}
 <span style={{ marginLeft: 'auto', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-700)', fontWeight: 700 }}>
 Status:
 </span>
 <span className={'filter-chip ' + (!filtroStatus ? 'filter-chip--active' : '')} onClick={() => setFiltroStatus(null)}>
 Todos
 </span>
 <span className={'filter-chip ' + (filtroStatus === 'ATIVO' ? 'filter-chip--active' : '')} onClick={() => setFiltroStatus('ATIVO')}>
 Ativos
 </span>
 <span className={'filter-chip ' + (filtroStatus === 'INATIVO' ? 'filter-chip--active' : '')} onClick={() => setFiltroStatus('INATIVO')}>
 Inativos
 </span>
 </div>

 <div className="card" style={{ padding: 0 }}>
 <table className="table">
 <thead>
 <tr>
 <th>Corretor</th>
 <th>Equipe</th>
 <th>CRECI</th>
 <th className="numeric">Vendas (mês)</th>
 <th className="numeric">Volume</th>
 <th>Status</th>
 <th></th>
 </tr>
 </thead>
 <tbody>
 {filtered.length === 0 ? (
 <tr>
 <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
 Nenhum corretor encontrado
 </td>
 </tr>
 ) : (
 filtered.map((c: any) => {
 const eqNome = c.equipe?.nome || c.equipe;
 const eqColor = c.equipe?.cor || eqs.find((e: any) => e.nome === eqNome)?.cor || '#1258CA';
 const isAtivo = c.status === 'ATIVO' || c.ativo;
 return (
 <tr key={c.id}>
 <td>
 <div className="flex gap-3" style={{ alignItems: 'center' }}>
 <div className="avatar">{c.initials}</div>
 <div>
 <div className="font-semibold">{c.nome}</div>
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
 <td className="numeric font-semibold">{c.vendasMes ?? 0}</td>
 <td className="numeric money">{formatCurrencyShort(c.volumeMes)}</td>
 <td>
 <span className={'badge ' + (isAtivo ? 'badge--signed' : 'badge--cancelled')}>
 {isAtivo ? 'ATIVO' : (c.status || 'INATIVO')}
 </span>
 </td>
 <td>
 {isAtivo && (
 <button
 className="btn btn--ghost btn--sm"
 onClick={() => desativar(c.id)}
 title="Desativar"
 >
 Desativar
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
 <label className="field__label">Equipe</label>
 <select name="equipeId" className="field__select" defaultValue="">
 <option value="">— Sem equipe —</option>
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
 <div className="field field--span-2">
 <label className="field__label">Senha inicial</label>
 <input name="password" className="field__input" defaultValue="pons123" />
 <div className="field__hint">O corretor pode trocar no primeiro acesso</div>
 </div>
 </div>
 <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
 <button type="button" className="btn btn--secondary" onClick={() => setOpen(false)}>Cancelar</button>
 <button type="submit" className="btn btn--primary">Criar Corretor</button>
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
