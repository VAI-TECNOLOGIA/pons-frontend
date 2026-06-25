import { useState, useEffect } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useKanbanDnd } from '../lib/useKanbanDnd';

const COLS: Record<string, { titulo: string; klass: string }> = {
  A_FAZER: { titulo: 'A Fazer', klass: '' },
  EM_ANDAMENTO: { titulo: 'Em Andamento', klass: 'kanban__col--accent' },
  EM_REVISAO: { titulo: 'Em Revisão', klass: '' },
  CONCLUIDO: { titulo: 'Concluído', klass: 'kanban__col--success' },
};

export default function Tarefas() {
  const [open, setOpen] = useState(false);
  const { data, loading, error, reload } = useApi<any[]>(() => Api.tarefas());
  const { data: users } = useApi<any[]>(() => Api.users());
  const [tarefas, setTarefas] = useState<any[]>([]);
  const toast = useToast();
  useEffect(() => { if (data) setTarefas(data); }, [data]);

  const moveStatus = async (id: number, status: string) => {
    const prev = tarefas;
    setTarefas((cur) => cur.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await Api.tarefaUpdate(id, { status });
    } catch (err: any) {
      // Reverte em caso de erro
      setTarefas(prev);
      toast.error('Erro ao mover: ' + (err.message || 'falha'));
    }
  };

  const dnd = useKanbanDnd(moveStatus);

  // Anexos (orçamentos, NFs, boletos…). Guardamos só o id e derivamos a tarefa
  // viva de `tarefas`, pra lista no modal acompanhar o reload após upload/remoção.
  const [anexoTarefaId, setAnexoTarefaId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const anexoTarefa = tarefas.find((t) => t.id === anexoTarefaId) || null;

  // Edição de tarefa: guarda só o id e deriva a tarefa viva de `tarefas`.
  const [editId, setEditId] = useState<number | null>(null);
  const editTarefa = tarefas.find((t) => t.id === editId) || null;

  const addAnexo = async (tarefaId: number, file: File) => {
    setUploading(true);
    try {
      const up = await Api.uploadDocumento(file);
      await Api.tarefaAnexoAdd(tarefaId, {
        url: up.url, key: up.key, nome: file.name, tipo: up.contentType || file.type || null, tamanho: up.size,
      });
      toast.success('Anexo adicionado');
      reload();
    } catch (err: any) {
      toast.error('Erro ao anexar: ' + (err.message || 'falha'));
    } finally {
      setUploading(false);
    }
  };

  const removeAnexo = async (tarefaId: number, anexoId: number) => {
    try {
      await Api.tarefaAnexoDelete(tarefaId, anexoId);
      reload();
    } catch (err: any) {
      toast.error('Erro ao remover: ' + (err.message || 'falha'));
    }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await Api.tarefaCreate({
        titulo: String(fd.get('titulo') || ''),
        descricao: fd.get('descricao') ? String(fd.get('descricao')) : undefined,
        area: String(fd.get('area') || 'GERAL'),
        prioridade: String(fd.get('prioridade') || 'NORMAL'),
        responsavelId: fd.get('responsavelId') ? Number(fd.get('responsavelId')) : null,
        prazo: fd.get('prazo') ? String(fd.get('prazo')) : null,
        solicitadoEm: fd.get('solicitadoEm') ? String(fd.get('solicitadoEm')) : null,
      });
      toast.success('Tarefa criada');
      setOpen(false);
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  const submitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarefa) return;
    const fd = new FormData(e.currentTarget);
    try {
      await Api.tarefaUpdate(editTarefa.id, {
        titulo: String(fd.get('titulo') || ''),
        descricao: fd.get('descricao') ? String(fd.get('descricao')) : null,
        area: String(fd.get('area') || 'GERAL'),
        prioridade: String(fd.get('prioridade') || 'NORMAL'),
        responsavelId: fd.get('responsavelId') ? Number(fd.get('responsavelId')) : null,
        prazo: fd.get('prazo') ? String(fd.get('prazo')) : null,
        solicitadoEm: fd.get('solicitadoEm') ? String(fd.get('solicitadoEm')) : null,
      });
      toast.success('Tarefa atualizada');
      setEditId(null);
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  if (loading) return <Shell onNew={() => setOpen(true)}><LoadingBlock /></Shell>;
  if (error) return <Shell onNew={() => setOpen(true)}><ErrorBlock error={error} /></Shell>;

  const priorityBadge = (p: string) =>
    p === 'URGENTE' ? (
      <span className="badge badge--cancelled" style={{ fontSize: 9, padding: '2px 6px' }}>URGENTE</span>
    ) : p === 'ALTA' ? (
      <span className="badge badge--analysis" style={{ fontSize: 9, padding: '2px 6px' }}>ALTA</span>
    ) : null;

  return (
    <>
      <Topbar
        title="Tarefas"
        right={<button className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>+ Nova Tarefa</button>}
      />
      <div className="main__content">
        <PageHeader
          breadcrumb="Gestão · Tarefas"
          title="Quadro de Tarefas"
          subtitle="Distribua trabalho · acompanhe progresso · clique no status para mover"
        />

        <div className="kanban">
          {Object.entries(COLS).map(([key, col]) => {
            const items = tarefas.filter((t) => t.status === key);
            const isDropTarget = dnd.hoverCol === key;
            return (
              <div
                className={`kanban__col ${col.klass} ${isDropTarget ? 'kanban__col--drop-target' : ''}`}
                key={key}
                data-kanban-col={key}
                onDragOver={dnd.onDragOver(key)}
                onDragLeave={dnd.onDragLeave(key)}
                onDrop={dnd.onDrop(key)}
              >
                <div className="kanban__col-header">
                  <span className="kanban__col-title">{col.titulo}</span>
                  <span className="kanban__col-count">{items.length}</span>
                </div>
                <div className="kanban__cards">
                  {items.length === 0 && isDropTarget && (
                    <div className="kanban__cards--empty-hint">Soltar aqui</div>
                  )}
                  {items.map((t: any) => (
                    <div
                      className={'kanban-card ' + (dnd.draggingId === t.id ? 'kanban-card--dragging' : '')}
                      key={t.id}
                      draggable
                      onDragStart={dnd.onDragStart(t.id)}
                      onDragEnd={dnd.onDragEnd}
                      onPointerDown={dnd.onPointerDown(t.id)}
                      onClick={() => setEditId(t.id)}
                      style={{ cursor: 'pointer' }}
                      title="Clique para editar"
                    >
                      <div className="kanban-card__header">
                        <div>
                          <div className="kanban-card__title">{t.titulo}</div>
                          <div className="kanban-card__meta">
                            {t.area}
                            {(t.solicitadoEm || t.createdAt) && ' · solicitada ' + new Date(t.solicitadoEm || t.createdAt).toLocaleDateString('pt-BR')}
                            {t.prazo && ' · até ' + new Date(t.prazo).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        <div className="flex gap-2" style={{ alignItems: 'center', flexShrink: 0 }}>
                          {priorityBadge(t.prioridade)}
                          <button
                            type="button"
                            title="Editar tarefa"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); setEditId(t.id); }}
                            style={{
                              display: 'inline-flex', alignItems: 'center',
                              padding: 3, cursor: 'pointer', borderRadius: 4,
                              border: '1px solid var(--border-light)', background: 'transparent',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            <Icon name="pencil" size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="kanban-card__footer">
                        <span className="text-xs text-secondary">
                          {t.responsavel?.nome || t.atribuidoA || '—'}
                        </span>
                        <div className="flex gap-2" style={{ alignItems: 'center' }}>
                          <button
                            type="button"
                            title="Anexos (orçamentos, NFs, boletos)"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); setAnexoTarefaId(t.id); }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 11, padding: '2px 7px', cursor: 'pointer',
                              border: '1px solid var(--border-light)', borderRadius: 4,
                              background: t.anexos?.length ? 'var(--surface-alt, #f1f5f9)' : 'transparent',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            <Icon name="paperclip" size={13} />
                            {t.anexos?.length || 0}
                          </button>
                          <select
                            value={t.status}
                            onChange={(e) => moveStatus(t.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{ fontSize: 11, padding: '2px 6px', border: '1px solid var(--border-light)', borderRadius: 4 }}
                          >
                            {Object.entries(COLS).map(([s, c]) => (
                              <option value={s} key={s}>{c.titulo}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova Tarefa" subtitle="Atribua a um responsável e defina prazo">
        {/* key amarrada ao open: o <dialog> mantém os filhos no DOM mesmo fechado,
            então remontamos o form a cada abertura pra limpar os campos não-controlados. */}
        <form key={open ? 'open' : 'closed'} onSubmit={submit}>
          <div className="form-grid">
            <div className="field field--span-2">
              <label className="field__label">Título <span className="field__required">*</span></label>
              <input name="titulo" className="field__input" required />
            </div>
            <div className="field field--span-2">
              <label className="field__label">Descrição</label>
              <textarea name="descricao" className="field__textarea" rows={2} />
            </div>
            <div className="field">
              <label className="field__label">Área</label>
              <select name="area" className="field__select" defaultValue="MARKETING">
                <option value="MARKETING">Marketing</option>
                <option value="ADM">ADM</option>
                <option value="FINANCEIRO">Financeiro</option>
                <option value="JURIDICO">Jurídico</option>
                <option value="COMERCIAL">Comercial</option>
                <option value="ASSESSORIA">Assessoria</option>
                <option value="GERAL">Geral</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label">Prioridade</label>
              <select name="prioridade" className="field__select" defaultValue="NORMAL">
                <option value="BAIXA">Baixa</option>
                <option value="NORMAL">Normal</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label">Responsável</label>
              <select name="responsavelId" className="field__select" defaultValue="">
                <option value="">— Sem atribuir —</option>
                {(users || []).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label">Data da Solicitação</label>
              <input name="solicitadoEm" type="date" className="field__input" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="field">
              <label className="field__label">Prazo</label>
              <input name="prazo" type="date" className="field__input" />
            </div>
          </div>
          <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn--secondary" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn--primary">Criar</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editTarefa} onClose={() => setEditId(null)} title="Editar Tarefa" subtitle={editTarefa?.titulo}>
        {editTarefa && (
          <form key={editTarefa.id} onSubmit={submitEdit}>
            <div className="form-grid">
              <div className="field field--span-2">
                <label className="field__label">Título <span className="field__required">*</span></label>
                <input name="titulo" className="field__input" required defaultValue={editTarefa.titulo || ''} />
              </div>
              <div className="field field--span-2">
                <label className="field__label">Descrição</label>
                <textarea name="descricao" className="field__textarea" rows={2} defaultValue={editTarefa.descricao || ''} />
              </div>
              <div className="field">
                <label className="field__label">Área</label>
                <select name="area" className="field__select" defaultValue={editTarefa.area || 'GERAL'}>
                  <option value="MARKETING">Marketing</option>
                  <option value="ADM">ADM</option>
                  <option value="FINANCEIRO">Financeiro</option>
                  <option value="JURIDICO">Jurídico</option>
                  <option value="COMERCIAL">Comercial</option>
                  <option value="ASSESSORIA">Assessoria</option>
                  <option value="GERAL">Geral</option>
                </select>
              </div>
              <div className="field">
                <label className="field__label">Prioridade</label>
                <select name="prioridade" className="field__select" defaultValue={editTarefa.prioridade || 'NORMAL'}>
                  <option value="BAIXA">Baixa</option>
                  <option value="NORMAL">Normal</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </select>
              </div>
              <div className="field">
                <label className="field__label">Responsável</label>
                <select name="responsavelId" className="field__select" defaultValue={editTarefa.responsavelId ?? ''}>
                  <option value="">— Sem atribuir —</option>
                  {(users || []).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label">Data da Solicitação</label>
                <input name="solicitadoEm" type="date" className="field__input" defaultValue={editTarefa.solicitadoEm ? new Date(editTarefa.solicitadoEm).toISOString().slice(0, 10) : ''} />
              </div>
              <div className="field">
                <label className="field__label">Prazo</label>
                <input name="prazo" type="date" className="field__input" defaultValue={editTarefa.prazo ? new Date(editTarefa.prazo).toISOString().slice(0, 10) : ''} />
              </div>
            </div>
            <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" className="btn btn--secondary" onClick={() => setEditId(null)}>Cancelar</button>
              <button type="submit" className="btn btn--primary">Salvar</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!anexoTarefa}
        onClose={() => setAnexoTarefaId(null)}
        title="Anexos da Tarefa"
        subtitle={anexoTarefa?.titulo}
      >
        {anexoTarefa && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {(anexoTarefa.anexos || []).length === 0 && (
                <div className="text-sm text-secondary">Nenhum anexo ainda. Adicione orçamentos, NFs ou boletos abaixo.</div>
              )}
              {(anexoTarefa.anexos || []).map((a: any) => (
                <div
                  key={a.id}
                  className="flex gap-2"
                  style={{ alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-light)', borderRadius: 6, padding: '8px 10px' }}
                >
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
                  >
                    <Icon name="doc" size={15} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nome}</span>
                  </a>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => removeAnexo(anexoTarefa.id, a.id)}>
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <label className="btn btn--primary btn--sm" style={{ cursor: uploading ? 'progress' : 'pointer' }}>
              {uploading ? 'Enviando…' : '+ Adicionar arquivo'}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                style={{ display: 'none' }}
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) addAnexo(anexoTarefa.id, f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}

function Shell({ children, onNew }: { children: React.ReactNode; onNew?: () => void }) {
  return (
    <>
      <Topbar title="Tarefas" right={<button className="btn btn--primary btn--sm" onClick={onNew}>+ Nova Tarefa</button>} />
      <div className="main__content">
        <PageHeader breadcrumb="Gestão · Tarefas" title="Quadro de Tarefas" />
        {children}
      </div>
    </>
  );
}
