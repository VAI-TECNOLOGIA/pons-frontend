import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

// Sprint 4 M9 — Webhook outbound (saídas de lead)
export default function WebhookSaidas() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const { data, loading, error, reload } = useApi<any[]>(() => Api.webhookSaidas());
  const toast = useToast();
  const confirm = useConfirm();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    let headers = null;
    const hTxt = String(fd.get('headers') || '').trim();
    if (hTxt) { try { headers = JSON.parse(hTxt); } catch { toast.error('Headers: JSON inválido'); return; } }
    const payload = {
      nome: String(fd.get('nome') || ''),
      url: String(fd.get('url') || ''),
      headers,
      payloadTemplate: String(fd.get('payloadTemplate') || '') || null,
      triggers: String(fd.get('triggers') || 'lead.created'),
      ativo: true,
    };
    try {
      if (editing) await Api.wsUpdate(editing.id, payload);
      else await Api.wsCreate(payload);
      toast.success('Salvo'); setOpen(false); setEditing(null); reload();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  const excluir = async (w: any) => {
    const ok = await confirm({ title: 'Excluir?', message: `Excluir webhook "${w.nome}"?`, tone: 'danger' });
    if (!ok) return;
    await Api.wsDelete(w.id); toast.success('Excluído'); reload();
  };

  return (
    <>
      <Topbar title="Webhooks de Saída" right={<button className="btn btn--primary btn--sm" onClick={() => { setEditing(null); setOpen(true); }}>+ Novo webhook</button>} />
      <div className="main__content">
        <PageHeader breadcrumb="Integrações · Saídas" title="Webhooks Outbound" subtitle="Dispara POSTs pra sistemas externos quando eventos casarem com triggers" />
        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}
        <div className="card">
          <table className="table">
            <thead><tr><th>Nome</th><th>URL</th><th>Triggers</th><th>Envios</th><th>Falhas</th><th></th></tr></thead>
            <tbody>
              {(data || []).map((w: any) => (
                <tr key={w.id}>
                  <td><strong>{w.nome}</strong></td>
                  <td className="text-xs"><code style={{ fontSize: 11 }}>{w.url}</code></td>
                  <td className="text-xs">{w.triggers}</td>
                  <td>{w.totalEnvios}</td>
                  <td style={{ color: w.totalFalhas > 0 ? 'var(--color-danger)' : 'inherit' }}>{w.totalFalhas}</td>
                  <td className="flex" style={{ gap: 6 }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(w); setOpen(true); }}>Editar</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => excluir(w)}>×</button>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Sem webhooks cadastrados</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? 'Editar webhook' : 'Novo webhook'} size="lg" footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>
          <button type="submit" form="ws-form" className="btn btn--primary">Salvar</button>
        </>
      }>
        <form id="ws-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label className="field__label">Nome *</label><input name="nome" className="field__input" required defaultValue={editing?.nome} /></div>
            <div className="field"><label className="field__label">URL *</label><input name="url" type="url" className="field__input" required defaultValue={editing?.url} placeholder="https://api.exemplo.com/leads" /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Headers (JSON, opcional)</label>
              <input name="headers" className="field__input" defaultValue={editing?.headers ? JSON.stringify(editing.headers) : ''} placeholder='{"X-API-Key": "..."}' />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Triggers (CSV)</label>
              <input name="triggers" className="field__input" defaultValue={editing?.triggers || 'lead.created'} />
              <div className="text-xs text-secondary">Ex: lead.created,lead.status_changed:FECHADO</div>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Template payload (Mustache, opcional)</label>
              <textarea name="payloadTemplate" className="field__textarea" rows={4} defaultValue={editing?.payloadTemplate || ''} placeholder='{"nome":"{{nome}}","tel":"{{telefone}}"}' />
              <div className="text-xs text-secondary">Deixe vazio pra enviar o Lead inteiro como JSON</div>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
