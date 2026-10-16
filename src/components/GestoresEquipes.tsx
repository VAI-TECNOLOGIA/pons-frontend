import { useState } from 'react';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import './gestores-equipes.css';

// Quais equipes cada gestor enxerga: lista os perfis não-corretores; clicar
// abre modal com checkbox por equipe. Salvo em Equipe.gestores — alimenta a
// visibilidade (leads/vendas/equipe) e a transferência direta entre as marcadas.
// Usado na página /gestores (sidebar Equipe) e na aba Gestores das Configurações.
export function GestoresEquipes() {
 const { data, loading, error, reload } = useApi<any[]>(() => Api.gestoresEquipes());
 const { data: equipesData } = useApi<any[]>(() => Api.equipes());
 const [editing, setEditing] = useState<any | null>(null);
 const [marcadas, setMarcadas] = useState<number[]>([]);
 const [salvando, setSalvando] = useState(false);
 // % do gestor (sobre a parte da imobiliária) nas vendas NOVAS da sala dele.
 const [pct, setPct] = useState('');
 // Vendas já lançadas com o % antigo: prévia + aplicar o % do cadastro.
 const [vendasPct, setVendasPct] = useState<any | null>(null);
 const [aplicando, setAplicando] = useState(false);
 const verVendas = async () => {
 if (!editing) return;
 try { setVendasPct(await Api.gestorVendas(editing.id)); }
 catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
 };
 const aplicarVendas = async () => {
 if (!editing) return;
 setAplicando(true);
 try {
 const r = await Api.gestorAplicarVendas(editing.id);
 toast.success(r.ajustadas ? `${r.ajustadas} venda(s) ajustada(s) para ${vendasPct?.percentualGestor}%` : 'Nenhuma venda para ajustar');
 setVendasPct(null);
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 } finally {
 setAplicando(false);
 }
 };
 const toast = useToast();

 const abrir = (g: any) => {
 setEditing(g);
 setMarcadas(g.equipeIds || []);
 setPct(g.percentualGestor == null ? '' : String(g.percentualGestor).replace('.', ','));
 setVendasPct(null);
 };

 const toggle = (id: number) => {
 setMarcadas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
 };

 const salvar = async () => {
 if (!editing) return;
 setSalvando(true);
 try {
 await Api.gestorEquipesSalvar(editing.id, marcadas);
 if ((editing.lideradas || []).length) {
 const novo = pct.trim() === '' ? null : Number(pct.replace(',', '.'));
 if (novo !== null && (!Number.isFinite(novo) || novo < 0 || novo > 100)) throw new Error('% do gestor inválido');
 if (novo !== (editing.percentualGestor ?? null)) await Api.gestorPercentual(editing.id, novo);
 }
 toast.success(`Equipes de ${editing.nome} atualizadas`);
 setEditing(null);
 reload();
 } catch (err: any) {
 toast.error('Erro: ' + (err.message || 'falha'));
 } finally {
 setSalvando(false);
 }
 };

 if (loading) return <LoadingBlock />;
 if (error) return <ErrorBlock error={error} />;
 const gestores = data || [];
 const equipes = (equipesData || []).filter((e: any) => e.ativo !== false);
 const ROLE_LABEL: Record<string, string> = {
 CEO: 'CEO', DIRETOR_COMERCIAL: 'Diretor Comercial', DIRETOR_FINANCEIRO: 'Diretor Financeiro',
 DIRETOR_JURIDICO: 'Diretor Jurídico', SOCIO_UNIDADE: 'Sócio de Unidade', GERENTE_EQUIPE: 'Gerente',
 MARKETING: 'Marketing', ASSESSORA: 'Assessora', ASSESSORA_MARKETING: 'Assessora de Marketing',
 GESTOR_TRAFEGO: 'Gestor de Tráfego', GESTOR_MARKETING: 'Diretor de Marketing e Gestor Comercial da 2ª Avenida',
 FINANCEIRO: 'Financeiro', ADMINISTRATIVO: 'Administrativo', DEV: 'Dev',
 };

 return (
 <>
 <div className="gest-grid">
 {gestores.map((g: any) => {
 const extras = g.equipes.filter((e: any) => !g.lideradas.some((l: any) => l.id === e.id));
 const todas = [...g.lideradas.map((e: any) => ({ ...e, lider: true })), ...extras];
 return (
 <button key={g.id} className="gest-card" onClick={() => abrir(g)}>
 <div className="gest-card__head">
 <span className="gest-card__avatar">{g.initials || g.nome.slice(0, 2).toUpperCase()}</span>
 <span className="gest-card__id">
 <span className="gest-card__nome">{g.nome}</span>
 <span className="gest-card__role">{ROLE_LABEL[g.role] || g.role}{g.lideradas.length > 0 && ` · gestor ${g.percentualGestor ?? 10}%${g.percentualGestor == null ? ' (padrão)' : ''}`}</span>
 </span>
 <span className="gest-card__edit"><Icon name="pencil" size={14} /></span>
 </div>
 <div className="gest-card__equipes">
 {todas.length ? todas.map((e: any) => (
 <span key={e.id} className={'gest-chip' + (e.lider ? ' gest-chip--lider' : '')} title={e.lider ? 'Líder formal da equipe' : undefined}>
 <span className="gest-chip__dot" style={{ background: (equipes.find((x: any) => x.id === e.id) || {}).cor || 'var(--pons-blue)' }} />
 {e.nome}
 </span>
 )) : (
 <span className="gest-card__vazio">Nenhuma equipe vinculada</span>
 )}
 </div>
 </button>
 );
 })}
 </div>

 <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Equipes de ${editing.nome}` : ''}>
 {editing && (
 <div className="gest-modal">
 <p className="gest-modal__hint">
 Marque as equipes que este gestor pode ver. Entre as equipes marcadas ele também
 transfere corretores direto, sem precisar de aprovação.
 </p>
 <div className="gest-modal__lista">
 {equipes.map((e: any) => {
 const lidera = (editing.lideradas || []).some((l: any) => l.id === e.id);
 const on = lidera || marcadas.includes(e.id);
 return (
 <label key={e.id} className={'gest-eq' + (on ? ' gest-eq--on' : '') + (lidera ? ' gest-eq--lider' : '')}>
 <input type="checkbox" checked={on} disabled={lidera} onChange={() => toggle(e.id)} />
 <span className="gest-eq__check"><Icon name="check" size={12} /></span>
 <span className="gest-eq__dot" style={{ background: e.cor }} />
 <span className="gest-eq__nome">{e.nome}</span>
 {lidera && <span className="gest-eq__badge">Líder</span>}
 </label>
 );
 })}
 </div>
 {(editing.lideradas || []).length > 0 && (
 <label className="field" style={{ margin: '12px 0 4px' }}>
 <span className="field__label">% do gestor nas vendas da sala</span>
 <input className="field__input" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value.replace(/[^\d,.]/g, ''))} placeholder="10 (padrão)" style={{ maxWidth: 160 }} />
 <span className="field__hint">Sobre a parte da imobiliária. Vale para as vendas novas; venda já lançada fica com o % de quando fechou. Vazio = padrão de 10%.</span>
 </label>
 )}
 {(editing.lideradas || []).length > 0 && (
 <div style={{ margin: '4px 0 12px' }}>
 {!vendasPct ? (
 <button type="button" className="btn btn--ghost btn--sm" onClick={verVendas} title="Vendas já lançadas com outro % de gestor">
 Aplicar o % às vendas já lançadas…
 </button>
 ) : (() => {
 const moeda = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
 const lista = vendasPct.vendas.filter((v: any) => v.pctAtual !== v.pctNovo);
 const ajustaveis = lista.filter((v: any) => v.podeAjustar);
 return (
 <div style={{ border: '1px solid var(--border-light)', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
 <div className="text-sm">
 Vendas de <strong>{vendasPct.gestor}</strong> com outro % (o cadastro salvo é <strong>{vendasPct.percentualGestor}%</strong>). Só muda onde a comissão do gestor ainda não foi paga; a diferença sai da parte da imobiliária e cada venda guarda o antes no histórico.
 </div>
 {lista.length === 0 ? <div className="text-sm text-secondary">Todas as vendas já estão com {vendasPct.percentualGestor}%.</div> : (
 <div style={{ maxHeight: 220, overflowY: 'auto' }}>
 {lista.map((v: any) => (
 <div key={v.id} className="flex-between text-sm" style={{ padding: '4px 0', borderBottom: '1px solid var(--border-light)', opacity: v.podeAjustar ? 1 : 0.55, gap: 8 }}>
 <span><strong>{v.codigo}</strong> · {v.cliente} <span className="text-xs text-secondary">({v.corretor})</span></span>
 <span className="text-xs" style={{ whiteSpace: 'nowrap' }}>{v.pctAtual}% → {v.pctNovo}% · {moeda(v.valorAtual)} → {moeda(v.valorNovo)}{v.motivo ? ` · fica (${v.motivo})` : ''}</span>
 </div>
 ))}
 </div>
 )}
 <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
 <button type="button" className="btn btn--secondary btn--sm" onClick={() => setVendasPct(null)}>Fechar</button>
 <button type="button" className="btn btn--primary btn--sm" disabled={aplicando || ajustaveis.length === 0} onClick={aplicarVendas}>
 {aplicando ? 'Aplicando…' : `Aplicar ${vendasPct.percentualGestor}% em ${ajustaveis.length} venda(s)`}
 </button>
 </div>
 </div>
 );
 })()}
 </div>
 )}
 <div className="gest-modal__foot">
 <span className="gest-modal__count">
 {(editing.lideradas || []).length + marcadas.filter((id: number) => !(editing.lideradas || []).some((l: any) => l.id === id)).length} equipe(s) selecionada(s)
 </span>
 <div className="gest-modal__acoes">
 <button className="btn btn--secondary" onClick={() => setEditing(null)}>Cancelar</button>
 <button className="btn btn--primary" disabled={salvando} onClick={salvar}>
 {salvando ? 'Salvando...' : 'Salvar'}
 </button>
 </div>
 </div>
 </div>
 )}
 </Modal>
 </>
 );
}
