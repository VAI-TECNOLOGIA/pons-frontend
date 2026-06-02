import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

// Sprint 5 M13 — Campos customizados no Lead
export default function CamposCustom() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const { data, loading, error, reload } = useApi<any[]>(() => Api.camposCustom());
  const toast = useToast();
  const confirm = useConfirm();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    let opcoes = null;
    if (String(fd.get('tipo')) === 'SELECT') {
      const opsTxt = String(fd.get('opcoes') || '').trim();
      opcoes = opsTxt.split('\n').map((s) => s.trim()).filter(Boolean);
    }
    const payload = {
      nome: String(fd.get('nome') || ''),
      slug: String(fd.get('slug') || '').toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      tipo: String(fd.get('tipo') || 'TEXT'),
      opcoes,
      obrigatorio: fd.get('obrigatorio') === 'on',
      ordem: Number(fd.get('ordem') || 0),
      ativo: true,
    };
    try {
      if (editing) await Api.campoUpdate(editing.id, payload);
      else await Api.campoCreate(payload);
      toast.success('Salvo'); setOpen(false); setEditing(null); reload();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  const excluir = async (c: any) => {
    const ok = await confirm({ title: 'Excluir?', message: `Excluir campo "${c.nome}"?`, tone: 'danger' });
    if (!ok) return;
    await Api.campoDelete(c.id); toast.success('Excluído'); reload();
  };

  return (
    <>
      <Topbar title="Campos personalizados" right={<button className="btn btn--primary btn--sm" onClick={() => { setEditing(null); setOpen(true); }}>+ Novo campo</button>} />
      <div className="main__content">
        <PageHeader breadcrumb="Configurações · Campos" title="Campos personalizados do Lead" subtitle="Adicione campos extras que aparecem no form e na ficha do lead" />
        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}
        <div className="card">
          <table className="table">
            <thead><tr><th>Ordem</th><th>Nome</th><th>Slug</th><th>Tipo</th><th>Obrigatório</th><th></th></tr></thead>
            <tbody>
              {(data || []).map((c: any) => (
                <tr key={c.id}>
                  <td>{c.ordem}</td>
                  <td><strong>{c.nome}</strong></td>
                  <td className="text-xs"><code>{c.slug}</code></td>
                  <td><span className="badge badge--info">{c.tipo}</span></td>
                  <td>{c.obrigatorio ? '✓' : '—'}</td>
                  <td className="flex" style={{ gap: 6 }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(c); setOpen(true); }}>Editar</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => excluir(c)}>×</button>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum campo customizado</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? 'Editar campo' : 'Novo campo'} footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>
          <button type="submit" form="cc-form" className="btn btn--primary">Salvar</button>
        </>
      }>
        <form id="cc-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label className="field__label">Nome *</label><input name="nome" className="field__input" required defaultValue={editing?.nome} /></div>
            <div className="field"><label className="field__label">Slug *</label><input name="slug" className="field__input" required defaultValue={editing?.slug} pattern="[a-z0-9_]+" /></div>
            <div className="field">
              <label className="field__label">Tipo</label>
              <select name="tipo" className="field__select" defaultValue={editing?.tipo || 'TEXT'}>
                <option>TEXT</option><option>NUMBER</option><option>DATE</option><option>SELECT</option><option>BOOLEAN</option>
              </select>
            </div>
            <div className="field"><label className="field__label">Ordem</label><input type="number" name="ordem" className="field__input" defaultValue={editing?.ordem || 0} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Opções (uma por linha — só para SELECT)</label>
              <textarea name="opcoes" className="field__textarea" rows={3} defaultValue={editing?.opcoes ? (editing.opcoes as string[]).join('\n') : ''} />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', gap: 8 }}>
                <input type="checkbox" name="obrigatorio" defaultChecked={editing?.obrigatorio} /> Obrigatório
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
