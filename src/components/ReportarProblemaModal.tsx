// Modal "Reportar problema" — captura screenshot via html2canvas (lazy-load),
// permite fallback manual de imagem, valida descrição ≥ 10 chars e envia
// multipart pra POST /api/feedback. Screenshot vai pro Cloudflare R2 (prefix=feedback).
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Api } from '../lib/api';
import { Auth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Icon } from './Icon';
import { Modal } from './Modal';

type Category = 'bug' | 'performance' | 'outro';

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'bug', label: 'Bug · Algo não funciona' },
  { value: 'performance', label: 'Performance · Lentidão ou travamento' },
  { value: 'outro', label: 'Outro' },
];

const CAPTURE_TIMEOUT_MS = 6000;

// Carrega html2canvas só no momento de capturar (não bloqueia o bundle inicial)
async function loadHtml2Canvas(): Promise<any> {
  // @ts-expect-error — biblioteca opcional, carregada lazily
  const mod = await import('html2canvas');
  return mod.default || mod;
}

async function captureScreenshot(): Promise<File | null> {
  try {
    const html2canvas = await loadHtml2Canvas();
    const work = html2canvas(document.body, {
      backgroundColor: null,
      logging: false,
      scale: 1,
      useCORS: true,
      allowTaint: true,
      imageTimeout: 3000,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      width: window.innerWidth,
      height: window.innerHeight,
      x: window.scrollX,
      y: window.scrollY,
    });
    const canvas: HTMLCanvasElement = await Promise.race([
      work,
      new Promise<HTMLCanvasElement>((_, rej) =>
        setTimeout(() => rej(new Error('timeout')), CAPTURE_TIMEOUT_MS),
      ),
    ]);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png', 0.92),
    );
    if (!blob) return null;
    return new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
  } catch (e) {
    console.warn('[ReportarProblema] screenshot falhou:', e);
    return null;
  }
}

// Esconde TODOS os <dialog> abertos enquanto a captura roda — caso contrário
// o próprio modal apareceria na foto.
async function withModalsHidden<T>(fn: () => Promise<T>): Promise<T> {
  const dialogs = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'));
  const prev: Array<{ el: HTMLElement; visibility: string }> = [];
  for (const d of dialogs) {
    prev.push({ el: d, visibility: d.style.visibility });
    d.style.visibility = 'hidden';
  }
  // 2 rAF pro browser repintar sem o modal
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  try {
    return await fn();
  } finally {
    for (const { el, visibility } of prev) el.style.visibility = visibility;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ReportarProblemaModal({ open, onClose }: Props) {
  const toast = useToast();
  const user = Auth.user;

  const [category, setCategory] = useState<Category | ''>('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureFailed, setCaptureFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Captura automática quando o modal abre
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCapturing(true);
    setCaptureFailed(false);
    setScreenshot(null);
    setPreviewUrl(null);

    (async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const file = await withModalsHidden(captureScreenshot);
      if (cancelled) return;
      if (file) {
        setScreenshot(file);
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setCaptureFailed(true);
      }
      setCapturing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function reset() {
    setCategory('');
    setDescription('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setScreenshot(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    if (sending) return;
    reset();
    onClose();
  }

  async function retakeScreenshot() {
    setCapturing(true);
    setCaptureFailed(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setScreenshot(null);
    setPreviewUrl(null);
    const file = await withModalsHidden(captureScreenshot);
    if (file) {
      setScreenshot(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setCaptureFailed(true);
      toast.error('Falha ao capturar · anexe imagem manualmente');
    }
    setCapturing(false);
  }

  function pickManualFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      toast.error('Selecione uma imagem');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Imagem > 10MB · reduza');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setScreenshot(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function removeScreenshot() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setScreenshot(null);
    setPreviewUrl(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!category) {
      toast.error('Selecione uma categoria');
      return;
    }
    if (description.trim().length < 10) {
      toast.error('Descreva com pelo menos 10 caracteres');
      return;
    }
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('type', category);
      fd.append('description', description.trim());
      fd.append('currentUrl', window.location.href);
      fd.append('userAgent', navigator.userAgent.slice(0, 500));
      if (screenshot) fd.append('screenshot', screenshot);

      const r = await Api.feedbackSubmit(fd);
      const n = r.adminsNotified ?? 0;
      toast.success(n > 0 ? `Relatório enviado · ${n} ${n === 1 ? 'admin notificado' : 'admins notificados'}` : 'Relatório enviado');
      reset();
      onClose();
    } catch (e: any) {
      toast.error('Erro ao enviar: ' + (e.message || 'falha'));
    } finally {
      setSending(false);
    }
  }

  const senderName = user?.name?.split(' ')[0] ?? user?.email ?? 'anônimo';

  return (
    <Modal open={open} onClose={handleClose} title="Reportar problema" subtitle={`Encontrou um bug? Nos ajude a melhorar. Enviando como ${senderName}.`} size="md">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <label className="field__label">Tipo do problema</label>
          <select
            className="field__select"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            required
            disabled={sending}
          >
            <option value="">Selecione…</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label">Descreva o problema</label>
          <textarea
            className="field__textarea"
            rows={4}
            minLength={10}
            maxLength={4000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="O que aconteceu? O que você esperava?"
            required
            disabled={sending}
          />
          <p className="field__hint">Mínimo 10 caracteres.</p>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="field__label" style={{ margin: 0 }}>
              Captura de tela
            </label>
            {(screenshot || capturing) && !sending && (
              <button
                type="button"
                onClick={() => void retakeScreenshot()}
                className="btn btn--ghost btn--sm"
                disabled={capturing}
                style={{ fontSize: 12 }}
              >
                <Icon name="refresh" size={12} /> {capturing ? ' …' : ' Trocar'}
              </button>
            )}
          </div>

          {capturing ? (
            <div
              className="card"
              style={{
                padding: 24,
                textAlign: 'center',
                color: 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
              }}
            >
              <span className="spinner" /> Capturando tela…
            </div>
          ) : previewUrl ? (
            <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: 0 }}>
              <img
                src={previewUrl}
                alt="Captura"
                style={{ width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block' }}
              />
              <button
                type="button"
                onClick={removeScreenshot}
                disabled={sending}
                title="Remover imagem"
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: 'rgba(0,0,0,.7)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="x" size={13} />
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, marginBottom: 8 }}>
                {captureFailed
                  ? 'Não conseguimos capturar a tela automaticamente · anexe manualmente:'
                  : 'Nenhuma imagem · você pode anexar manualmente:'}
              </p>
              <label style={{ display: 'inline-block', cursor: 'pointer' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={pickManualFile}
                  style={{ display: 'none' }}
                />
                <span className="btn btn--ghost btn--sm">Anexar imagem</span>
              </label>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            paddingTop: 12,
            borderTop: '1px solid var(--border-light)',
          }}
        >
          <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={sending}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={sending}>
            {sending ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Enviando…
              </>
            ) : (
              <>
                <Icon name="send" size={14} /> Enviar relatório
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
