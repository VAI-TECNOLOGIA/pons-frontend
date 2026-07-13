import { useRef, useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { Auth } from '../lib/auth';

import './videos.css';

function ytThumb(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

const CATEGORIAS = [
  { value: '', label: 'Todos' },
  { value: 'POLITICA', label: 'Política' },
  { value: 'OFERTA', label: 'Ofertas' },
  { value: 'TREINAMENTO', label: 'Treinamento' },
];

const CAT_BADGE: Record<string, [string, string]> = {
  POLITICA: ['badge--neutral', 'Política'],
  OFERTA: ['badge--launch', 'Oferta'],
  TREINAMENTO: ['badge--signature', 'Treinamento'],
};

const PODE_GERIR_VIDEOS = new Set(['CEO', 'DIRETOR_COMERCIAL', 'MARKETING', 'ASSESSORA_MARKETING']);

export default function Videos() {
  const podeGerir = PODE_GERIR_VIDEOS.has(Auth.user?.role || '');
  const [filtro, setFiltro] = useState('');
  const [open, setOpen] = useState(false);
  const [capaPreview, setCapaPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const capaFileRef = useRef<HTMLInputElement>(null);
  const { data, loading, error, reload } = useApi<any[]>(() => Api.videos(filtro || undefined), [filtro]);
  const toast = useToast();
  const confirm = useConfirm();

  const onCapaPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      toast.error('Imagem maior que 4MB. Reduza antes de enviar.');
      e.target.value = '';
      return;
    }
    setCapaPreview(URL.createObjectURL(f));
  };

  const resetForm = () => {
    setCapaPreview(null);
    if (capaFileRef.current) capaFileRef.current.value = '';
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      // Se o usuário escolheu uma imagem de capa, faz upload pro R2 primeiro
      let thumbnail: string | undefined;
      const file = capaFileRef.current?.files?.[0];
      if (file) {
        const up = new FormData();
        up.append('file', file);
        up.append('prefix', 'uploads');
        const r = await fetch('/api/uploads', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + (Auth.token || '') },
          body: up,
        });
        if (!r.ok) throw new Error('upload_capa_falhou');
        const j = await r.json();
        thumbnail = j.url;
      }
      await Api.videoCreate({
        titulo: String(fd.get('titulo') || ''),
        url: String(fd.get('url') || ''),
        categoria: String(fd.get('categoria') || 'OFERTA'),
        descricao: fd.get('descricao') ? String(fd.get('descricao')) : undefined,
        // Se vazio, o frontend cai no ytThumb() automaticamente (capa do próprio vídeo)
        ...(thumbnail ? { thumbnail } : {}),
      });
      toast.success('Vídeo adicionado');
      setOpen(false);
      resetForm();
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Excluir vídeo?',
      message: 'O vídeo será removido da central. Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await Api.videoDelete(id);
      toast.success('Vídeo excluído');
      reload();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'falha'));
    }
  };

  if (loading) return <Shell onNew={() => setOpen(true)}><LoadingBlock /></Shell>;
  if (error) return <Shell onNew={() => setOpen(true)}><ErrorBlock error={error} /></Shell>;
  const videos = data || [];

  return (
    <>
      <Topbar
        title="Vídeos"
        right={podeGerir ? (
          <button className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
            + Adicionar vídeo
          </button>
        ) : undefined}
      />
      <div className="main__content">
        <PageHeader
          breadcrumb="Conteúdo · Vídeos"
          title="Central de Vídeos"
          subtitle="Política da empresa, ofertas e treinamentos para a equipe"
        />

        <div className="filter-bar">
          {CATEGORIAS.map((c) => (
            <span
              key={c.value}
              className={'filter-chip ' + (filtro === c.value ? 'filter-chip--active' : '')}
              onClick={() => setFiltro(c.value)}
            >
              {c.label}
            </span>
          ))}
        </div>

        <div className="grid-3">
          {videos.length === 0 ? (
            <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Nenhum vídeo nesta categoria. Adicione o primeiro!
            </div>
          ) : (
            videos.map((v: any) => {
              const [bk, lbl] = CAT_BADGE[v.categoria] || ['badge--neutral', v.categoria];
              const thumb = v.thumbnail || v.thumb || ytThumb(v.url);
              return (
                <div className="video-card" key={v.id} style={{ position: 'relative' }}>
                  {podeGerir && (
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={(e) => excluir(v.id, e)}
                      title="Excluir"
                      style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, padding: '4px 8px' }}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                  <div
                    className="video-thumb"
                    style={thumb ? { background: `url(${thumb}) center/cover` } : {}}
                    onClick={() => v.url && window.open(v.url, '_blank')}
                  >
                    <div className="video-thumb__play">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--pons-navy)">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  <div style={{ padding: 16 }}>
                    <span className={`badge ${bk}`} style={{ fontSize: 9 }}>{lbl}</span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: '8px 0 4px' }}>{v.titulo}</h3>
                    <p className="text-xs text-secondary" style={{ margin: 0 }}>{v.descricao || v.duracao || ''}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); resetForm(); }}
        title="Adicionar vídeo"
        subtitle="Link do YouTube ou Vimeo"
        size="lg"
      >
        <form onSubmit={submit}>
          <div className="form-grid form-grid--single">
            <div className="field">
              <label className="field__label">Título <span className="field__required">*</span></label>
              <input name="titulo" className="field__input" required />
            </div>
            <div className="field">
              <label className="field__label">Link <span className="field__required">*</span></label>
              <input name="url" className="field__input" required placeholder="https://youtube.com/watch?v=..." />
            </div>
            <div className="field">
              <label className="field__label">Categoria</label>
              <select name="categoria" className="field__select" defaultValue="OFERTA">
                <option value="OFERTA">Ofertas</option>
                <option value="POLITICA">Política</option>
                <option value="TREINAMENTO">Treinamento</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label">Imagem de capa (opcional)</label>
              <div className="video-capa">
                <label htmlFor="video-capa-file" className="video-capa__picker">
                  {capaPreview ? (
                    <img src={capaPreview} alt="Preview da capa" />
                  ) : (
                    <div className="video-capa__placeholder">
                      <Icon name="pencil" size={20} />
                      <span>Clique pra escolher</span>
                    </div>
                  )}
                </label>
                <input
                  id="video-capa-file"
                  ref={capaFileRef}
                  type="file"
                  accept="image/*"
                  onChange={onCapaPick}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                />
                {capaPreview && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => { setCapaPreview(null); if (capaFileRef.current) capaFileRef.current.value = ''; }}
                  >
                    Remover
                  </button>
                )}
              </div>
              <div className="field__hint">
                Se não preencher, vamos usar a capa do próprio vídeo (YouTube/Vimeo).
              </div>
            </div>
            <div className="field">
              <label className="field__label">Descrição</label>
              <textarea name="descricao" className="field__textarea" rows={3} />
            </div>
          </div>
          <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); resetForm(); }}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
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
        title="Vídeos"
        right={<button className="btn btn--primary btn--sm" onClick={onNew}>+ Adicionar vídeo</button>}
      />
      <div className="main__content">
        <PageHeader breadcrumb="Conteúdo · Vídeos" title="Central de Vídeos" />
        {children}
      </div>
    </>
  );
}
