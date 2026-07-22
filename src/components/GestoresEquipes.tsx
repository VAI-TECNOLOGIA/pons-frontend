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
 const toast = useToast();

 const abrir = (g: any) => {
 setEditing(g);
 setMarcadas(g.equipeIds || []);
 };

 const toggle = (id: number) => {
 setMarcadas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
 };

 const salvar = async () => {
 if (!editing) return;
 setSalvando(true);
 try {
 await Api.gestorEquipesSalvar(editing.id, marcadas);
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
 <span className="gest-card__role">{ROLE_LABEL[g.role] || g.role}</span>
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
