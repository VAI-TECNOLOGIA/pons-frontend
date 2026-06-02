import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

// Sprint 4 M5 — Cadências de Follow-up automáticas
export default function Cadencias() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const { data, loading, error, reload } = useApi<any[]>(() => Api.cadenciasList());
  const toast = useToast();
  const confirm = useConfirm();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    let triggers = []; let acoes = [];
    try { triggers = JSON.parse(String(fd.get('triggers') || '[]')); } catch { toast.error('Triggers: JSON inválido'); return; }
    try { acoes = JSON.parse(String(fd.get('acoes') || '[]')); } catch { toast.error('Ações: JSON inválido'); return; }
    const payload = { nome: String(fd.get('nome') || ''), triggers, acoes, ativa: true };
    try {
      if (editing) await Api.cadenciaUpdate(editing.id, payload);
      else await Api.cadenciaCreate(payload);
      toast.success('Salvo'); setOpen(false); setEditing(null); reload();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  const excluir = async (c: any) => {
    const ok = await confirm({ title: 'Excluir?', message: `Excluir cadência "${c.nome}"?`, tone: 'danger' });
    if (!ok) return;
    await Api.cadenciaDelete(c.id); toast.success('Excluída'); reload();
  };

  return (
    <>
      <Topbar title="Cadências" right={<button className="btn btn--primary btn--sm" onClick={() => { setEditing(null); setOpen(true); }}>+ Nova cadência</button>} />
      <div className="main__content">
        <PageHeader breadcrumb="Marketing · Automação" title="Cadências de Follow-up" subtitle="Sequência automática de TASK/EMAIL/WHATSAPP disparada por trigger" />
        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}
        <div className="card">
          <table className="table">
            <thead><tr><th>Nome</th><th>Triggers</th><th>Passos</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(data || []).map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.nome}</strong></td>
                  <td className="text-xs"><code>{JSON.stringify(c.triggers).slice(0, 60)}</code></td>
                  <td>{Array.isArray(c.acoes) ? c.acoes.length : 0}</td>
                  <td><span className={`badge ${c.ativa ? 'badge--launch' : 'badge--neutral'}`}>{c.ativa ? 'Ativa' : 'Pausada'}</span></td>
                  <td className="flex" style={{ gap: 6 }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(c); setOpen(true); }}>Editar</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => excluir(c)}>×</button>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma cadência criada</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? 'Editar cadência' : 'Nova cadência'} size="lg" footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>
          <button type="submit" form="cad-form" className="btn btn--primary">Salvar</button>
        </>
      }>
        <form id="cad-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field__label">Nome *</label><input name="nome" className="field__input" required defaultValue={editing?.nome} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Triggers (JSON array)</label>
              <textarea name="triggers" className="field__textarea" rows={3} defaultValue={editing ? JSON.stringify(editing.triggers, null, 2) : '[{ "event": "LEAD_ATRIBUIDO" }]'} />
              <div className="text-xs text-secondary">Eventos: LEAD_ATRIBUIDO · STATUS_CHANGED:NEGOCIANDO</div>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Ações (JSON array)</label>
              <textarea name="acoes" className="field__textarea" rows={6} defaultValue={editing ? JSON.stringify(editing.acoes, null, 2) : '[\n  { "tipo": "TASK", "delay": "0min", "titulo": "Ligar para {{nome}}" },\n  { "tipo": "WHATSAPP", "delay": "15min", "template": "Oi {{nome}}, tudo bem?" }\n]'} />
              <div className="text-xs text-secondary">Tipos: TASK / EMAIL / WHATSAPP / WAIT · delay: "15min" / "1h" / "1d"</div>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
