// Tour guiado — onboarding/walkthrough leve sem libs externas.
//
// Design simples e previsível:
//   - Tooltip SEMPRE como bottom sheet (desktop + mobile) — flutua na base da tela
//   - Em desktop, max-width 520px centralizado horizontalmente
//   - Backdrop escuro com "buraco" sobre o target via box-shadow + halo azul
//   - Auto-scroll do target pro centro da viewport (descontando altura do tooltip)
//   - Aparece uma vez (localStorage flag). forceOpen reabre.
//
// Uso:
//   <GuidedTour
//     storageKey="integracoes-v1"
//     steps={[{ target: '[data-tour="x"]', title, body }]}
//     forceOpen={tour.forceOpen}
//     onDone={tour.onDone}
//   />

import { useCallback, useEffect, useState } from 'react';
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

const SHEET_HEIGHT_RESERVE = 320; // espaço do tooltip+padding pra calcular scroll do target

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

  // ── Posiciona highlight + scroll do target ──────────────────────
  const reposition = useCallback(() => {
    if (!open || !steps[idx]) return;
    const el = document.querySelector(steps[idx].target) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    // Scroll customizado: target a 25% do topo (longe do tooltip que fica embaixo)
    const r0 = el.getBoundingClientRect();
    const availableSpace = window.innerHeight - SHEET_HEIGHT_RESERVE;
    const targetTop = Math.max(80, availableSpace / 2 - r0.height / 2);
    const delta = r0.top - targetTop;
    window.scrollBy({ top: delta, behavior: 'smooth' });

    // Aguarda scroll terminar
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setRect(el.getBoundingClientRect());
      });
    });
  }, [open, idx, steps]);

  useEffect(() => {
    reposition();
  }, [reposition]);

  useEffect(() => {
    if (!open) return;
    const onWin = () => {
      const el = document.querySelector(steps[idx]?.target) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open, idx, steps]);

  function close(markDone = true) {
    setOpen(false);
    setRect(null);
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
      {/* Backdrop escuro sobre TODA a tela (cobre uniformemente, sem "buraco"). */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          pointerEvents: 'none',
          background: 'rgba(0,0,0,0.62)',
        }}
      />

      {/* Halo azul ao redor do target — NÃO escurece nada, apenas destaca com pulse animado */}
      {rect && (
        <div
          style={{
            position: 'fixed',
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            zIndex: 9999,
            pointerEvents: 'none',
            borderRadius: 12,
            border: '3px solid rgba(96,165,250,1)',
            boxShadow: '0 0 0 4px rgba(96,165,250,0.25), 0 0 40px rgba(96,165,250,0.4)',
            background: 'transparent',
            transition: 'top 240ms cubic-bezier(0.4,0,0.2,1), left 240ms cubic-bezier(0.4,0,0.2,1), width 240ms cubic-bezier(0.4,0,0.2,1), height 240ms cubic-bezier(0.4,0,0.2,1)',
            animation: 'tourPulse 2.2s ease-in-out infinite',
          }}
        />
      )}

      {/* Tooltip = bottom sheet (desktop + mobile) */}
      <div
        role="dialog"
        aria-label="Tour guiado"
        style={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(calc(100% - 32px), 540px)',
          zIndex: 10000,
          pointerEvents: 'auto',
          background: '#1E40AF',
          color: '#fff',
          borderRadius: 14,
          padding: 20,
          boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
          fontSize: 14,
          lineHeight: 1.5,
          maxHeight: '50vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
          animation: 'tourSlideUp 280ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Dots de progresso */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
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
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: 'rgba(255,255,255,0.7)',
              alignSelf: 'center',
            }}
          >
            {idx + 1} / {steps.length}
          </span>
        </div>

        {step.title && (
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{step.title}</div>
        )}
        <div style={{ color: 'rgba(255,255,255,0.92)' }}>{step.body}</div>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {!first && (
            <button
              type="button"
              onClick={prev}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.35)',
                color: '#fff',
                padding: '9px 16px',
                borderRadius: 8,
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Anterior
            </button>
          )}
          <button
            type="button"
            onClick={() => close(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              padding: '9px 12px',
              fontSize: 12,
              cursor: 'pointer',
              textDecoration: 'underline',
              marginRight: 'auto',
            }}
          >
            Pular
          </button>
          <button
            type="button"
            onClick={next}
            style={{
              minWidth: 140,
              background: '#fff',
              color: '#1E40AF',
              border: 'none',
              padding: '11px 20px',
              borderRadius: 8,
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
      </div>

      <style>{`
        @keyframes tourSlideUp {
          from { transform: translate(-50%, 100%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes tourPulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(96,165,250,0.25), 0 0 40px rgba(96,165,250,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(96,165,250,0.18), 0 0 60px rgba(96,165,250,0.55); }
        }
        @media (max-width: 600px) {
          [role="dialog"][aria-label="Tour guiado"] {
            bottom: 0 !important;
            border-radius: 16px 16px 0 0 !important;
            width: 100% !important;
            padding-bottom: max(20px, env(safe-area-inset-bottom)) !important;
          }
        }
      `}</style>
    </>
  );
}

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
