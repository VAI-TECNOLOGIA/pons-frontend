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
import { createPortal } from 'react-dom';
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

// Acha o ancestral que realmente rola (a página usa um container interno com
// overflow, não a window). Cai pra window se nenhum for encontrado.
function getScrollParent(el: HTMLElement): HTMLElement | Window {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return window;
}

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

  // ── Posiciona highlight ──────────────────────────────────────────
  // O halo sempre mede a posição REAL do alvo (getBoundingClientRect) e é
  // re-medido a cada scroll/resize/frame, então fica colado no elemento
  // independentemente de quanto a página conseguiu rolar.
  const reposition = useCallback(() => {
    if (!open || !steps[idx]) return;
    const el = document.querySelector(steps[idx].target) as HTMLElement | null;
    setRect(el ? el.getBoundingClientRect() : null);
  }, [open, idx, steps]);

  // Ao trocar de passo: rola o alvo para uma posição confortável (acima do
  // bottom sheet) e mede de imediato. O scroll pode estar num container interno
  // (não na window), então rolamos o ancestral scrollável correto.
  useEffect(() => {
    if (!open || !steps[idx]) return;
    const el = document.querySelector(steps[idx].target) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    const r0 = el.getBoundingClientRect();
    const availableSpace = window.innerHeight - SHEET_HEIGHT_RESERVE;
    const finalTop = Math.max(80, availableSpace / 2 - r0.height / 2);
    const delta = r0.top - finalTop;
    if (Math.abs(delta) > 4) getScrollParent(el).scrollBy({ top: delta, behavior: 'smooth' });
    reposition();
  }, [open, idx, steps, reposition]);

  // Mantém o halo colado no alvo durante o scroll suave, scroll do usuário e resize.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(reposition); };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    // Acompanha a animação do scroll suave (~700ms) re-medindo a cada frame.
    const start = performance.now();
    const follow = () => { reposition(); if (performance.now() - start < 800) raf = requestAnimationFrame(follow); };
    raf = requestAnimationFrame(follow);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      cancelAnimationFrame(raf);
    };
  }, [open, idx, reposition]);

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

  if (!open || !steps.length || typeof document === 'undefined') return null;
  const step = steps[idx];
  const last = idx === steps.length - 1;
  const first = idx === 0;

  // Render via portal pra escapar do containing block do .main__content
  // (que tem transform da animação page-enter e quebra position:fixed)
  return createPortal(
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
            border: '3px solid rgba(82,247,254,1)',
            boxShadow: '0 0 0 4px rgba(82,247,254,0.22), 0 0 40px rgba(82,247,254,0.4)',
            background: 'transparent',
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
          background: '#0E0F13',
          color: '#fff',
          border: '1px solid rgba(82,247,254,0.28)',
          borderRadius: 14,
          padding: 20,
          boxShadow: '0 16px 48px rgba(0,0,0,0.55), 0 0 40px rgba(82,247,254,0.08)',
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
                background: i === idx ? '#52f7fe' : 'rgba(255,255,255,0.28)',
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
              background: '#52f7fe',
              color: '#04222b',
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
          0%, 100% { box-shadow: 0 0 0 4px rgba(82,247,254,0.22), 0 0 40px rgba(82,247,254,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(82,247,254,0.16), 0 0 60px rgba(82,247,254,0.55); }
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
    </>,
    document.body,
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
