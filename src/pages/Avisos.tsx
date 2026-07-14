import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { timeAgo } from '../lib/format';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { Auth } from '../lib/auth';

const PODE_PUBLICAR = new Set(['CEO', 'DIRETOR_COMERCIAL', 'MARKETING', 'ASSESSORA', 'ASSESSORA_MARKETING', 'GESTOR_TRAFEGO']);

import './avisos.css';

const TIPO_BADGE: Record<string, [string, string]> = {
  INFO: ['badge--neutral', 'INFO'],
  CAMPANHA: ['badge--launch', 'CAMPANHA'],
  URGENTE: ['badge--cancelled', 'URGENTE'],
  EVENTO: ['badge--signature', 'EVENTO'],
};

export default function Avisos() {
  const [open, setOpen] = useState(false);
  const { data: avisos, loading, error, reload } = useApi<any[]>(() => Api.avisos());
  const toast = useToast();
  const confirm = useConfirm();
  const podePublicar = PODE_PUBLICAR.has(Auth.user?.role || '');

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await Api.avisoCreate({
        titulo: String(fd.get('titulo') || ''),
        conteudo: String(fd.get('conteudo') || ''),
        tipo: String(fd.get('tipo') || 'INFO'),
        fixado: fd.get('fixado') === 'on',
      });
      toast.success('Aviso publicado');
      setOpen(false);
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  const excluir = async (id: number) => {
    const ok = await confirm({
      title: 'Excluir aviso?',
      message: 'Esta ação não pode ser desfeita. O aviso será removido do mural permanentemente.',
      confirmText: 'Excluir',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await Api.avisoDelete(id);
      toast.success('Aviso excluído');
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  if (loading) return <Shell onNew={() => setOpen(true)}><LoadingBlock /></Shell>;
  if (error) return <Shell onNew={() => setOpen(true)}><ErrorBlock error={error} /></Shell>;
  if (!avisos) return null;

  return (
    <>
      <Topbar
        title="Avisos"
        right={podePublicar ? (
          <button className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
            + Novo aviso
          </button>
        ) : undefined}
      />
      <div className="main__content">
        <PageHeader
          breadcrumb="Comunicação · Mural"
          title="Mural de Avisos"
          subtitle="Comunicados da empresa, campanhas vigentes e eventos"
        />

        <div className="mural">
          {avisos.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
              Nenhum aviso publicado ainda.
            </div>
          ) : (
            avisos.map((a: any) => {
              const tipo = a.tipo || 'INFO';
              const [bk, lbl] = TIPO_BADGE[tipo] || ['badge--neutral', tipo];
              return (
                <div className={`aviso aviso--${tipo}`} key={a.id}>
                  {(a.fixado || a.pinned) && (
                    <span className="aviso__pin" title="Fixado">
                      <Icon name="pin" size={16} />
                    </span>
                  )}
                  <span className={`badge ${bk}`} style={{ fontSize: 9 }}>
                    {lbl}
                  </span>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: '10px 0 6px' }}>{a.titulo}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--gray-700)', margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>
                    {a.conteudo}
                  </p>
                  <div className="flex-between" style={{ alignItems: 'center' }}>
                    <div className="text-xs text-secondary">
                      {a.autorNome || 'Grupo Pons'} · {timeAgo(a.createdAt)}
                    </div>
                    {podePublicar && (
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => excluir(a.id)}
                        title="Excluir"
                        style={{ padding: '4px 8px' }}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo aviso"
        subtitle="Será publicado no mural visível pra toda a equipe"
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="aviso-form" className="btn btn--primary">
              Publicar
            </button>
          </>
        }
      >
        <form id="aviso-form" onSubmit={submit}>
          <div className="form-grid form-grid--single">
            <div className="field">
              <label className="field__label">
                Título <span className="field__required">*</span>
              </label>
              <input name="titulo" className="field__input" required />
            </div>
            <div className="field">
              <label className="field__label">Tipo</label>
              <select name="tipo" className="field__select" defaultValue="INFO">
                <option value="INFO">Informação</option>
                <option value="CAMPANHA">Campanha</option>
                <option value="EVENTO">Evento</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label">
                Conteúdo <span className="field__required">*</span>
              </label>
              <textarea name="conteudo" className="field__textarea" rows={4} required />
            </div>
            <div className="field">
              <label className="field__label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" name="fixado" /> Fixar no topo
              </label>
            </div>
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
        title="Avisos"
        right={
          <button className="btn btn--primary btn--sm" onClick={onNew}>
            + Novo aviso
          </button>
        }
      />
      <div className="main__content">
        <PageHeader breadcrumb="Comunicação · Mural" title="Mural de Avisos" />
        {children}
      </div>
    </>
  );
}
