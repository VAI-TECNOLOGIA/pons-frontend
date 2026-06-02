import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

// Sprint 5 M14 — Regras automáticas (rule engine)
export default function Regras() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const { data, loading, error, reload } = useApi<any[]>(() => Api.regrasList());
  const toast = useToast();
  const confirm = useConfirm();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    let condicoes = []; let acoes = [];
    try { condicoes = JSON.parse(String(fd.get('condicoes') || '[]')); } catch { toast.error('Condições: JSON inválido'); return; }
    try { acoes = JSON.parse(String(fd.get('acoes') || '[]')); } catch { toast.error('Ações: JSON inválido'); return; }
    const payload = {
      nome: String(fd.get('nome') || ''),
      trigger: String(fd.get('trigger') || 'lead.created'),
      condicoes, acoes,
      prioridade: Number(fd.get('prioridade') || 0),
      ativa: true,
    };
    try {
      if (editing) await Api.regraUpdate(editing.id, payload);
      else await Api.regraCreate(payload);
      toast.success('Salvo'); setOpen(false); setEditing(null); reload();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  const excluir = async (r: any) => {
    const ok = await confirm({ title: 'Excluir?', message: `Excluir regra "${r.nome}"?`, tone: 'danger' });
    if (!ok) return;
    await Api.regraDelete(r.id); toast.success('Excluída'); reload();
  };

  return (
    <>
      <Topbar title="Regras Automáticas" right={<button className="btn btn--primary btn--sm" onClick={() => { setEditing(null); setOpen(true); }}>+ Nova regra</button>} />
      <div className="main__content">
        <PageHeader breadcrumb="Configurações · Automação" title="Regras Automáticas do Lead" subtitle="Quando (condições) → Executar (ações). Rule engine para automatizar fluxos" />
        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}
        <div className="card">
          <table className="table">
            <thead><tr><th>Prio</th><th>Nome</th><th>Trigger</th><th>Condições</th><th>Ações</th><th>Execuções</th><th></th></tr></thead>
            <tbody>
              {(data || []).map((r: any) => (
                <tr key={r.id}>
                  <td>{r.prioridade}</td>
                  <td><strong>{r.nome}</strong></td>
                  <td className="text-xs"><span className="badge badge--info">{r.trigger}</span></td>
                  <td className="text-xs"><code>{JSON.stringify(r.condicoes).slice(0,60)}</code></td>
                  <td className="text-xs">{Array.isArray(r.acoes) ? r.acoes.length : 0}</td>
                  <td>{r.totalExecucoes}</td>
                  <td className="flex" style={{ gap: 6 }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(r); setOpen(true); }}>Editar</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => excluir(r)}>×</button>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma regra criada</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? 'Editar regra' : 'Nova regra'} size="lg" footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>
          <button type="submit" form="rg-form" className="btn btn--primary">Salvar</button>
        </>
      }>
        <form id="rg-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label className="field__label">Nome *</label><input name="nome" className="field__input" required defaultValue={editing?.nome} /></div>
            <div className="field">
              <label className="field__label">Trigger</label>
              <select name="trigger" className="field__select" defaultValue={editing?.trigger || 'lead.created'}>
                <option value="lead.created">lead.created</option>
                <option value="lead.status_changed">lead.status_changed</option>
                <option value="lead.tag_added">lead.tag_added</option>
              </select>
            </div>
            <div className="field"><label className="field__label">Prioridade</label><input type="number" name="prioridade" className="field__input" defaultValue={editing?.prioridade || 0} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Condições (JSON array)</label>
              <textarea name="condicoes" className="field__textarea" rows={4} defaultValue={editing ? JSON.stringify(editing.condicoes, null, 2) : '[{ "campo": "origem", "op": "eq", "valor": "META_ADS" }]'} />
              <div className="text-xs text-secondary">op: eq · neq · contains · gt · lt · in</div>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Ações (JSON array)</label>
              <textarea name="acoes" className="field__textarea" rows={5} defaultValue={editing ? JSON.stringify(editing.acoes, null, 2) : '[\n  { "tipo": "SET_TAG", "tag": "quente" },\n  { "tipo": "INICIAR_CADENCIA", "trigger": "LEAD_ATRIBUIDO" }\n]'} />
              <div className="text-xs text-secondary">Tipos: SET_TAG · SET_STATUS · ATRIBUIR_FILA · ATRIBUIR_CORRETOR · INICIAR_CADENCIA</div>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
