// Tour guiado — onboarding/walkthrough leve sem libs externas.
//
// Versão 2 (responsiva): tooltip vira bottom sheet no mobile (<700px),
// posicionamento robusto com 2 passes (mede altura real do tooltip antes
// de posicionar), backdrop com pointer-events transparente pra não travar
// o scroll da página, e desktop com posicionamento dinâmico (auto bottom/top).
//
// Uso:
//   <GuidedTour
//     storageKey="integracoes-v1"
//     steps={[
//       { target: '[data-tour="x"]', title: 'X', body: '...' },
//     ]}
//     forceOpen={tour.forceOpen}
//     onDone={tour.onDone}
//   />
//
// Auto-abre uma vez (controlado por localStorage `tour:<storageKey>`).
// forceOpen=true reabre mesmo após concluído.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export interface TourStep {
  target: string;
  title?: string;
  body: string;
}

interface Props {
  steps: TourStep[];
  storageKey: string;
  forceOpen?: boolean;
  onDone?: () => void;
}

const PADDING = 12;
const MOBILE_BREAKPOINT = 700;
const TOOLTIP_DESKTOP_W = 340;
const TOOLTIP_GAP = 14;

function storageDone(key: string): boolean {
  try {
    return localStorage.getItem(`tour:${key}`) === '1';
  } catch {
    return false;
  }
}
function setStorageDone(key: string) {
  try {
    localStorage.setItem(`tour:${key}`, '1');
  } catch {}
}

export function GuidedTour({ steps, storageKey, forceOpen, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; placement: 'bottom' | 'top' | 'sheet' } | null>(null);
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isMobile = vw < MOBILE_BREAKPOINT;

  // ── Auto-open na 1ª vez ──────────────────────────────────────────
  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setIdx(0);
      return;
    }
    if (!storageDone(storageKey)) {
      const t = setTimeout(() => {
        if (document.querySelector(steps[0]?.target)) setOpen(true);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [forceOpen, storageKey, steps]);

  // ── Resize listener ─────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Posiciona tooltip + highlight ───────────────────────────────
  const reposition = useCallback(() => {
    if (!open || !steps[idx]) return;
    const el = document.querySelector(steps[idx].target) as HTMLElement | null;
    if (!el) {
      setRect(null);
      setPos(null);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    // Aguarda scroll terminar via requestAnimationFrame chain
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setRect(r);
        computePos(r);
      });
    });
  }, [open, idx, steps]); // eslint-disable-line react-hooks/exhaustive-deps

  function computePos(r: DOMRect) {
    if (isMobile) {
      // Bottom sheet — fixed bottom, full width
      setPos({ top: window.innerHeight, left: 0, width: vw, placement: 'sheet' });
      return;
    }
    const tooltipH = tooltipRef.current?.offsetHeight || 220;
    const w = Math.min(TOOLTIP_DESKTOP_W, vw - 2 * PADDING);
    const spaceBelow = window.innerHeight - r.bottom - PADDING;
    const spaceAbove = r.top - PADDING;
    const placement: 'bottom' | 'top' = spaceBelow >= tooltipH + TOOLTIP_GAP
      ? 'bottom'
      : spaceAbove >= tooltipH + TOOLTIP_GAP
        ? 'top'
        : 'bottom'; // fallback
    let top = placement === 'bottom' ? r.bottom + TOOLTIP_GAP : r.top - TOOLTIP_GAP - tooltipH;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(PADDING, Math.min(window.innerWidth - w - PADDING, left));
    // Se passar do bottom do viewport, joga acima do final do viewport
    if (top + tooltipH > window.innerHeight - PADDING) {
      top = window.innerHeight - tooltipH - PADDING;
    }
    if (top < PADDING) top = PADDING;
    setPos({ top, left, width: w, placement });
  }

  // Reposiciona quando step muda
  useEffect(() => {
    reposition();
  }, [reposition]);

  // 2º pass: depois que o tooltip monta com altura real, refaz cálculo desktop
  useEffect(() => {
    if (!open || !rect || isMobile) return;
    const id = requestAnimationFrame(() => computePos(rect));
    return () => cancelAnimationFrame(id);
  }, [open, rect, isMobile, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reposiciona no resize/scroll
  useEffect(() => {
    if (!open) return;
    const onWin = () => reposition();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open, reposition]);

  function close(markDone = true) {
    setOpen(false);
    setRect(null);
    setPos(null);
    if (markDone) setStorageDone(storageKey);
    onDone?.();
  }

  function next() {
    if (idx >= steps.length - 1) close(true);
    else setIdx(idx + 1);
  }
  function prev() {
    if (idx > 0) setIdx(idx - 1);
  }

  if (!open || !steps.length) return null;
  const step = steps[idx];
  const last = idx === steps.length - 1;
  const first = idx === 0;

  return (
    <>
      {/* Backdrop — pointer-events: none pra não travar scroll/clicks da página */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          pointerEvents: 'none',
          background: rect ? 'transparent' : 'rgba(0,0,0,0.55)',
          transition: 'background 200ms',
        }}
      />

      {/* Highlight do target (halo + sombra que escurece o resto) */}
      {rect && (
        <div
          style={{
            position: 'fixed',
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            zIndex: 9999,
            pointerEvents: 'none',
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 3px rgba(96,165,250,0.8)',
            transition: 'top 220ms, left 220ms, width 220ms, height 220ms',
          }}
        />
      )}

      {/* Tooltip — pointer-events: auto pra capturar clicks dos botões */}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          ...(pos?.placement === 'sheet'
            ? {
                bottom: 0,
                left: 0,
                right: 0,
                width: '100%',
                borderRadius: '16px 16px 0 0',
                paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
                animation: 'tourSlideUp 280ms cubic-bezier(0.4,0,0.2,1)',
              }
            : pos
              ? {
                  top: pos.top,
                  left: pos.left,
                  width: pos.width,
                  borderRadius: 12,
                  transition: 'top 220ms, left 220ms',
                }
              : { visibility: 'hidden', top: 0, left: 0, width: TOOLTIP_DESKTOP_W }),
          zIndex: 10000,
          pointerEvents: 'auto',
          background: '#1E40AF',
          color: '#fff',
          padding: 20,
          boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
          fontSize: 14,
          lineHeight: 1.5,
          maxHeight: pos?.placement === 'sheet' ? '70vh' : `calc(100vh - ${2 * PADDING}px)`,
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Dots de progresso */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
          {steps.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === idx ? 22 : 6,
                height: 6,
                borderRadius: 3,
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.4)',
                transition: 'width 220ms',
                flexShrink: 0,
              }}
            />
          ))}
        </div>

        {step.title && (
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{step.title}</div>
        )}
        <div style={{ color: 'rgba(255,255,255,0.92)' }}>{step.body}</div>

        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {!first && (
            <button
              type="button"
              onClick={prev}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
                padding: '9px 14px',
                borderRadius: 6,
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              Anterior
            </button>
          )}
          <button
            type="button"
            onClick={next}
            style={{
              flex: 1,
              minWidth: 140,
              background: '#fff',
              color: '#1E40AF',
              border: 'none',
              padding: '11px 16px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {last ? (
              <>
                <Icon name="check" size={14} /> Concluir
              </>
            ) : (
              <>
                Próximo <Icon name="arrowRight" size={14} />
              </>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => close(true)}
          style={{
            marginTop: 10,
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 12,
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: '4px 0',
          }}
        >
          Pular tour
        </button>
      </div>

      <style>{`
        @keyframes tourSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

/** Helper hook pra controlar abertura via botão externo (ícone "?") */
export function useTourTrigger(storageKey: string) {
  const [forceOpen, setForceOpen] = useState(false);
  return {
    forceOpen,
    open: () => {
      try { localStorage.removeItem(`tour:${storageKey}`); } catch {}
      setForceOpen(true);
    },
    onDone: () => setForceOpen(false),
  };
}
