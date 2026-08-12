import { useState, useEffect } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { Auth } from '../lib/auth';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useKanbanDnd } from '../lib/useKanbanDnd';
import { CalendarView, type CalendarEvent } from '../components/CalendarView';

const COLS: Record<string, { titulo: string; klass: string }> = {
  A_FAZER: { titulo: 'A Fazer', klass: '' },
  EM_ANDAMENTO: { titulo: 'Em Andamento', klass: 'kanban__col--accent' },
  EM_REVISAO: { titulo: 'Em Revisão', klass: '' },
  CONCLUIDO: { titulo: 'Concluído', klass: 'kanban__col--success' },
};

// Formata data (YYYY-MM-DD ou ISO) como DD/MM/AAAA SEM conversão de fuso — evita
// a data "voltar" um dia (meia-noite UTC vira dia anterior em BRT). Datas de
// solicitação/prazo são "dia cheio", então basta ler a parte da data direto.
const dataBr = (s?: string | null) => {
  if (!s) return '';
  const [y, m, d] = String(s).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : new Date(s).toLocaleDateString('pt-BR');
};

// Data + hora "DD/MM/AAAA HH:MM" lendo a string direto (wall-clock, sem conversão
// de fuso — mesma razão do dataBr). A hora só aparece se não for 00:00 (tarefas
// antigas eram "dia cheio" à meia-noite e seguem mostrando só a data).
const dataBrHora = (s?: string | null) => {
  if (!s) return '';
  const iso = String(s);
  const [y, m, d] = iso.slice(0, 10).split('-');
  const hm = iso.slice(11, 16);
  const dataStr = d && m && y ? `${d}/${m}/${y}` : new Date(s).toLocaleDateString('pt-BR');
  return hm && hm !== '00:00' ? `${dataStr} ${hm}` : dataStr;
};

// Prazo (wall-clock) → Date LOCAL no dia/hora certos, pra o calendário posicionar
// no dia correto (evita a data "voltar um dia" por fuso).
const prazoParaData = (s?: string | null): Date | null => {
  if (!s) return null;
  const iso = String(s);
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const hh = Number(iso.slice(11, 13)) || 0;
  const mi = Number(iso.slice(14, 16)) || 0;
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hh, mi);
};

const COR_PRIORIDADE: Record<string, string> = {
  URGENTE: '#E5484D', ALTA: '#F2B544', NORMAL: '#3FB6D4', BAIXA: '#88C559',
};

export default function Tarefas() {
  // Corretor não atribui tarefa a ninguém — o campo Responsável some pra ele
  // (e o backend força a tarefa pro próprio corretor de qualquer forma).
  const ehCorretor = Auth.user?.role === 'CORRETOR';
  // Regra: Namíta/admin/marketing NÃO vê corretores pra atribuir tarefa; GESTOR/
  // SÓCIO vê (pra dar tarefa pro time da equipe dele). A lista já vem escopada
  // do backend — aqui só decidimos mostrar ou não os corretores dela.
  const ehGestor = Auth.user?.role === 'GERENTE_EQUIPE' || Auth.user?.role === 'SOCIO_UNIDADE';
  // Bolha marketing (quadro: Vine, Namíta, Bianca, Estevan + Paulo/Vinícius):
  // atribui só entre os membros do quadro.
  const MKT_ROLES = ['MARKETING', 'GESTOR_MARKETING', 'GESTOR_TRAFEGO', 'ASSESSORA_MARKETING'];
  const ehBolhaMkt = MKT_ROLES.includes(Auth.user?.role || '');
  const MEMBROS_QUADRO_MKT = [...MKT_ROLES, 'CEO', 'DIRETOR_COMERCIAL'];
  const podeAtribuir = (u: any) =>
    ehBolhaMkt
      ? (MEMBROS_QUADRO_MKT.includes(u.role) || u.id === Auth.user?.id)
      : (ehGestor || u.role !== 'CORRETOR');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'kanban' | 'calendario'>('kanban');
  const [waOn, setWaOn] = useState(false); // "Enviar pelo WhatsApp" no criar tarefa
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
      const lembEm = String(fd.get('lembreteEm') || '');
      await Api.tarefaCreate({
        titulo: String(fd.get('titulo') || ''),
        descricao: fd.get('descricao') ? String(fd.get('descricao')) : undefined,
        area: String(fd.get('area') || 'GERAL'),
        prioridade: String(fd.get('prioridade') || 'NORMAL'),
        responsavelId: fd.get('responsavelId') ? Number(fd.get('responsavelId')) : null,
        prazo: fd.get('prazo') ? String(fd.get('prazo')) : null,
        solicitadoEm: fd.get('solicitadoEm') ? String(fd.get('solicitadoEm')) : null,
        link: fd.get('link') ? String(fd.get('link')) : null,
        // Lembrete WhatsApp: só agenda se o usuário ligou "Enviar pelo WhatsApp" + hora.
        lembreteTelefone: waOn && fd.get('lembreteTelefone') ? String(fd.get('lembreteTelefone')) : null,
        lembreteEm: waOn && lembEm ? new Date(lembEm).toISOString() : null,
      });
      toast.success(waOn && lembEm ? 'Tarefa criada — lembrete agendado no WhatsApp' : 'Tarefa criada');
      setOpen(false); setWaOn(false);
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

  // Tarefas com prazo viram eventos do calendário (posicionadas pelo dia do prazo).
  const calEvents: CalendarEvent[] = tarefas
    .filter((t) => t.prazo)
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      inicio: prazoParaData(t.prazo) || new Date(),
      tipo: t.prioridade,
      cor: COR_PRIORIDADE[t.prioridade] || '#3FB6D4',
      concluido: t.status === 'CONCLUIDO',
    }));

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

        <div className="flex gap-2" style={{ marginBottom: 16 }}>
          <button className={`btn btn--sm ${view === 'kanban' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setView('kanban')}>Kanban</button>
          <button className={`btn btn--sm ${view === 'calendario' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setView('calendario')}>Calendário</button>
        </div>

        {view === 'kanban' && (
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
                            {(t.solicitadoEm || t.createdAt) && ' · solicitada ' + dataBr(t.solicitadoEm || t.createdAt)}
                            {t.prazo && ' · até ' + dataBrHora(t.prazo)}
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
                            className="kanban-card__select"
                            value={t.status}
                            onChange={(e) => moveStatus(t.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
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
        )}

        {view === 'calendario' && (
          <CalendarView
            events={calEvents}
            initialView="mes"
            onEventClick={(ev) => setEditId(Number(ev.id))}
            onNew={() => setOpen(true)}
            onToggleDone={(ev, concluido) => moveStatus(Number(ev.id), concluido ? 'CONCLUIDO' : 'A_FAZER')}
          />
        )}
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setWaOn(false); }} title="Nova Tarefa" subtitle="Atribua a um responsável e defina prazo">
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
                <option value="MARKETING">Marketing (privada — só o time de marketing vê)</option>
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
            {!ehCorretor && (
            <div className="field">
              <label className="field__label">Responsável</label>
              <select name="responsavelId" className="field__select" defaultValue="">
                <option value="">— Sem atribuir —</option>
                {/* Corretores fora da atribuição pra Namíta/admin; gestor vê os da equipe dele; marketing só o time de marketing */}
                {(users || []).filter(podeAtribuir).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            )}
            <div className="field">
              <label className="field__label">Data da Solicitação</label>
              <input name="solicitadoEm" type="date" className="field__input" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="field">
              <label className="field__label">Prazo</label>
              <input name="prazo" type="datetime-local" className="field__input" />
            </div>
            <div className="field field--span-2">
              <label className="field__label">Link (opcional)</label>
              <input name="link" type="url" className="field__input" placeholder="https://… (reunião, imóvel, localização)" />
            </div>
            <div className="field field--span-2">
              <label className="field__label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={waOn} onChange={(e) => setWaOn(e.target.checked)} />
                Enviar lembrete pelo WhatsApp (API oficial)
              </label>
            </div>
            {waOn && (
              <>
                <div className="field">
                  <label className="field__label">Disparar o alerta em <span className="field__required">*</span></label>
                  <input name="lembreteEm" type="datetime-local" className="field__input" required={waOn} />
                </div>
                <div className="field">
                  <label className="field__label">Número (WhatsApp)</label>
                  <input name="lembreteTelefone" className="field__input" placeholder="vazio = telefone do responsável" />
                </div>
                <div className="field field--span-2">
                  <div className="text-xs text-secondary">
                    Na hora marcada, o sistema envia um <strong>template oficial</strong> com o resumo: <strong>título · horário · link</strong>.
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); setWaOn(false); }}>Cancelar</button>
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
                  <option value="MARKETING">Marketing (privada — só o time de marketing vê)</option>
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
              {!ehCorretor && (
              <div className="field">
                <label className="field__label">Responsável</label>
                <select name="responsavelId" className="field__select" defaultValue={editTarefa.responsavelId ?? ''}>
                  <option value="">— Sem atribuir —</option>
                  {/* Sem corretores; mantém só o responsável atual se a tarefa antiga já apontar pra um */}
                  {(users || []).filter((u: any) => podeAtribuir(u) || u.id === editTarefa.responsavelId).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              )}
              <div className="field">
                <label className="field__label">Data da Solicitação</label>
                <input name="solicitadoEm" type="date" className="field__input" defaultValue={editTarefa.solicitadoEm ? String(editTarefa.solicitadoEm).slice(0, 10) : ''} />
              </div>
              <div className="field">
                <label className="field__label">Prazo</label>
                <input name="prazo" type="datetime-local" className="field__input" defaultValue={editTarefa.prazo ? String(editTarefa.prazo).slice(0, 16) : ''} />
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
