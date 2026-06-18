import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { formatCurrencyShort } from '../lib/format';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';

export default function Equipes() {
 const [view, setView] = useState<'escuderias' | 'resultados'>('escuderias');
 const [open, setOpen] = useState(false);
 const { data: equipes, loading, error, reload } = useApi<any[]>(() => Api.equipes());
 const toast = useToast();

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

 const totais = equipes.reduce(
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
 {equipes.map((eq: any, idx: number) => {
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

 {lider && (
 <div style={{ padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 8, marginBottom: 12 }}>
 <div className="uppercase-tag" style={{ marginBottom: 4 }}>Líder</div>
 <div className="flex gap-2" style={{ alignItems: 'center' }}>
 <div className="avatar avatar--sm">{liderInit}</div>
 <span className="font-semibold text-sm">{lider}</span>
 </div>
 </div>
 )}

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
 {equipes.map((e: any) => {
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
