import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

// Sprint 4 M4 — Múltiplos bolsões configuráveis
export default function Bolsoes() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const { data, loading, error, reload } = useApi<any[]>(() => Api.bolsoesList());
  const toast = useToast();
  const confirm = useConfirm();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    let regras = null;
    const regrasTxt = String(fd.get('regrasElegibilidade') || '').trim();
    if (regrasTxt) { try { regras = JSON.parse(regrasTxt); } catch { toast.error('Regras: JSON inválido'); return; } }
    const payload = {
      nome: String(fd.get('nome') || ''),
      descricao: String(fd.get('descricao') || '') || null,
      ordem: Number(fd.get('ordem') || 0),
      regrasElegibilidade: regras,
      ativo: true,
    };
    try {
      if (editing) await Api.bolsaoUpdate(editing.id, payload);
      else await Api.bolsaoCreate(payload);
      toast.success('Salvo'); setOpen(false); setEditing(null); reload();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  const excluir = async (b: any) => {
    const ok = await confirm({ title: 'Excluir?', message: `Excluir bolsão "${b.nome}"?`, tone: 'danger' });
    if (!ok) return;
    await Api.bolsaoDelete(b.id); toast.success('Excluído'); reload();
  };

  return (
    <>
      <Topbar title="Bolsões" right={<button className="btn btn--primary btn--sm" onClick={() => { setEditing(null); setOpen(true); }}>+ Novo bolsão</button>} />
      <div className="main__content">
        <PageHeader breadcrumb="Comercial · Bolsões" title="Bolsões de Recaptura" subtitle="Filtros configuráveis pra organizar leads sem corretor por origem/cidade/status" />
        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}
        <div className="card">
          <table className="table">
            <thead><tr><th>Ordem</th><th>Nome</th><th>Descrição</th><th>Regras</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(data || []).map((b: any) => (
                <tr key={b.id}>
                  <td>{b.ordem}</td>
                  <td><strong>{b.nome}</strong></td>
                  <td className="text-xs text-secondary">{b.descricao || '—'}</td>
                  <td className="text-xs"><code>{JSON.stringify(b.regrasElegibilidade || {})}</code></td>
                  <td><span className={`badge ${b.ativo ? 'badge--launch' : 'badge--neutral'}`}>{b.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td className="flex" style={{ gap: 6 }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(b); setOpen(true); }}>Editar</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => excluir(b)}>×</button>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum bolsão cadastrado</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? 'Editar bolsão' : 'Novo bolsão'} size="lg" footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>
          <button type="submit" form="bolsao-form" className="btn btn--primary">Salvar</button>
        </>
      }>
        <form id="bolsao-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label className="field__label">Nome *</label><input name="nome" className="field__input" required defaultValue={editing?.nome} /></div>
            <div className="field"><label className="field__label">Ordem</label><input type="number" name="ordem" className="field__input" defaultValue={editing?.ordem || 0} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field__label">Descrição</label><input name="descricao" className="field__input" defaultValue={editing?.descricao || ''} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label className="field__label">Regras de elegibilidade (JSON)</label>
              <textarea name="regrasElegibilidade" className="field__textarea" rows={4} defaultValue={editing?.regrasElegibilidade ? JSON.stringify(editing.regrasElegibilidade, null, 2) : ''} placeholder='{"origens": ["META_ADS"], "cidades": ["Itapema"], "statusInclude": ["NOVO"]}' />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
