import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';

import './toast.css';

type ToastKind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: ToastKind; message: string; }

interface ToastCtx {
  push: (kind: ToastKind, message: string, durationMs?: number) => void;
  success: (m: string, durationMs?: number) => void;
  error: (m: string, durationMs?: number) => void;
  info: (m: string, durationMs?: number) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  // Janela aberta (<dialog> modal) fica na camada de cima do navegador e escondia o aviso
  // atrás do fundo escuro (Gláucia 04/11). O aviso vira um popover e é reaberto a cada
  // aviso novo, para ficar acima de qualquer janela aberta.
  const stackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stackRef.current as any;
    if (!el || typeof el.showPopover !== 'function') return;
    try {
      if (el.matches(':popover-open')) el.hidePopover();
      if (items.length) el.showPopover();
    } catch { /* navegador sem suporte: segue como antes */ }
  }, [items]);

  const push = useCallback((kind: ToastKind, message: string, durationMs = 4000) => {
    const id = Date.now() + Math.random();
    setItems((cur) => [...cur, { id, kind, message }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), durationMs);
  }, []);

  const api: ToastCtx = {
    push,
    success: (m, durationMs) => push('success', m, durationMs),
    error: (m, durationMs) => push('error', m, durationMs),
    info: (m, durationMs) => push('info', m, durationMs),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite" ref={stackRef} {...({ popover: 'manual' } as any)}>
        {items.map((t) => (
          <div className={'toast toast--' + t.kind} key={t.id}>
            <Icon name={t.kind === 'success' ? 'check' : t.kind === 'error' ? 'warn' : 'bell'} size={16} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast deve estar dentro de ToastProvider');
  return c;
}
