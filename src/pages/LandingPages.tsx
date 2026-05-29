import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Api } from '../lib/api';
import { useApi, ErrorBlock, LoadingBlock } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';

const TIPOS = ['IMOVEL', 'CORRETOR', 'EMPREENDIMENTO', 'CAMPANHA'];

export default function LandingPages() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const { data, loading, error, reload } = useApi<any[]>(() => Api.lpList());
  const toast = useToast();
  const confirm = useConfirm();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: any = {
      slug: String(fd.get('slug') || ''),
      titulo: String(fd.get('titulo') || ''),
      tipo: String(fd.get('tipo') || 'CAMPANHA'),
      headline: String(fd.get('headline') || '') || null,
      subheadline: String(fd.get('subheadline') || '') || null,
      blocoTexto: String(fd.get('blocoTexto') || '') || null,
      cta: String(fd.get('cta') || 'Quero saber mais'),
      whatsappNumber: String(fd.get('whatsappNumber') || '') || null,
      pixelMeta: String(fd.get('pixelMeta') || '') || null,
      pixelGA: String(fd.get('pixelGA') || '') || null,
      pixelGTM: String(fd.get('pixelGTM') || '') || null,
      pixelTikTok: String(fd.get('pixelTikTok') || '') || null,
      ativa: true,
    };
    try {
      if (editing) await Api.lpUpdate(editing.id, payload);
      else await Api.lpCreate(payload);
      toast.success('LP salva'); setOpen(false); setEditing(null); reload();
    } catch (err: any) { toast.error('Erro: ' + (err.message || 'falha')); }
  };

  const excluir = async (lp: any) => {
    const ok = await confirm({ title: 'Excluir?', message: `Excluir LP "${lp.titulo}"?`, tone: 'danger' });
    if (!ok) return;
    await Api.lpDelete(lp.id); toast.success('Excluída'); reload();
  };

  return (
    <>
      <Topbar
        title="Landing Pages"
        right={<button className="btn btn--primary btn--sm" onClick={() => { setEditing(null); setOpen(true); }}>+ Nova LP</button>}
      />
      <div className="main__content">
        <PageHeader breadcrumb="Marketing · Captação" title="Landing Pages Dinâmicas" subtitle="LPs por imóvel, corretor, empreendimento ou campanha — com pixels integrados" />

        {loading ? <LoadingBlock /> : error ? <ErrorBlock error={error} /> : null}

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {(data || []).map((lp) => (
            <div key={lp.id} className="card">
              <div className="flex-between" style={{ marginBottom: 8 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>{lp.titulo}</h3>
                <span className="badge badge--info">{lp.tipo}</span>
              </div>
              <div className="text-xs text-secondary"><code>/lp/{lp.slug}</code></div>
              <div className="flex" style={{ gap: 16, marginTop: 10 }}>
                <div><div className="text-xs text-secondary">Views</div><strong>{lp.visualizacoes}</strong></div>
                <div><div className="text-xs text-secondary">Conversões</div><strong>{lp.conversoes}</strong></div>
              </div>
              <div className="flex" style={{ gap: 6, marginTop: 12 }}>
                <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(lp); setOpen(true); }}>Editar</button>
                <button className="btn btn--ghost btn--sm" onClick={() => excluir(lp)}>Excluir</button>
              </div>
            </div>
          ))}
          {data?.length === 0 && <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>Nenhuma LP criada</div>}
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        title={editing ? 'Editar LP' : 'Nova Landing Page'}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button>
            <button type="submit" form="lp-form" className="btn btn--primary">Salvar</button>
          </>
        }
      >
        <form id="lp-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label className="field__label">Slug *</label><input name="slug" className="field__input" required defaultValue={editing?.slug} placeholder="apartamento-marina-itapema" pattern="[a-z0-9-]+" /></div>
            <div className="field"><label className="field__label">Tipo *</label>
              <select name="tipo" className="field__select" defaultValue={editing?.tipo || 'CAMPANHA'}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field__label">Título *</label><input name="titulo" className="field__input" required defaultValue={editing?.titulo} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field__label">Headline</label><input name="headline" className="field__input" defaultValue={editing?.headline || ''} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field__label">Subheadline</label><input name="subheadline" className="field__input" defaultValue={editing?.subheadline || ''} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field__label">Bloco texto (markdown)</label><textarea name="blocoTexto" className="field__textarea" rows={4} defaultValue={editing?.blocoTexto || ''} /></div>
            <div className="field"><label className="field__label">CTA</label><input name="cta" className="field__input" defaultValue={editing?.cta || 'Quero saber mais'} /></div>
            <div className="field"><label className="field__label">WhatsApp</label><input name="whatsappNumber" className="field__input" defaultValue={editing?.whatsappNumber || ''} /></div>
            <div className="field"><label className="field__label">Pixel Meta</label><input name="pixelMeta" className="field__input" defaultValue={editing?.pixelMeta || ''} /></div>
            <div className="field"><label className="field__label">Pixel GA</label><input name="pixelGA" className="field__input" defaultValue={editing?.pixelGA || ''} /></div>
            <div className="field"><label className="field__label">Pixel GTM</label><input name="pixelGTM" className="field__input" defaultValue={editing?.pixelGTM || ''} /></div>
            <div className="field"><label className="field__label">Pixel TikTok</label><input name="pixelTikTok" className="field__input" defaultValue={editing?.pixelTikTok || ''} /></div>
          </div>
        </form>
      </Modal>
    </>
  );
}
