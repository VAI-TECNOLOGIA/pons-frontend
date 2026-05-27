import { createContext, useCallback, useContext, useState } from 'react';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';

type Tone = 'danger' | 'primary' | 'info';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: Tone;
}

interface ConfirmCtx {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<ConfirmCtx | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const close = (result: boolean) => {
    setOpen(false);
    resolver?.(result);
    setResolver(null);
  };

  const tone = opts?.tone || 'primary';
  const iconName = tone === 'danger' ? 'warn' : tone === 'info' ? 'bell' : 'checkCircle';
  const iconColor = tone === 'danger' ? 'var(--color-danger)' : tone === 'info' ? 'var(--pons-blue)' : 'var(--color-success)';
  const confirmClass = tone === 'danger' ? 'btn btn--danger' : 'btn btn--primary';

  return (
    <Ctx.Provider value={{ confirm }}>
      {children}
      <Modal
        open={open}
        onClose={() => close(false)}
        title={opts?.title || 'Confirmar'}
        size="sm"
        footer={
          <>
            <button className="btn btn--secondary" onClick={() => close(false)}>
              {opts?.cancelText || 'Cancelar'}
            </button>
            <button className={confirmClass} onClick={() => close(true)}>
              {opts?.confirmText || 'Confirmar'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: tone === 'danger' ? 'var(--color-danger-bg)' : tone === 'info' ? 'var(--color-info-bg)' : 'var(--color-success-bg)',
              color: iconColor,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name={iconName} size={20} />
          </div>
          <div style={{ flex: 1, fontSize: 14, lineHeight: 1.5, color: 'var(--text-primary)' }}>
            {opts?.message}
          </div>
        </div>
      </Modal>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useConfirm deve estar dentro de ConfirmProvider');
  return c.confirm;
}
