// Tour guiado — onboarding/walkthrough leve sem libs externas.
//
// Como usar:
//   <GuidedTour
//     storageKey="integracoes-v1"
//     steps={[
//       { target: '[data-tour="meta-card"]', title: 'WhatsApp Meta', body: 'Conecte aqui.' },
//       { target: '[data-tour="google-card"]', title: 'Google Calendar', body: '...' },
//     ]}
//     onDone={() => setTourOpen(false)}
//     forceOpen={tourOpen}
//   />
//
// Comportamento:
//   - Auto-abre na primeira vez (controlado por localStorage flag = storageKey).
//   - forceOpen=true reabre mesmo se já completou (botão "?" da página).
//   - Posiciona tooltip auto (abaixo > acima > direita) conforme espaço.
//   - Click fora ou Escape NÃO fecha (evita perder o tour por acidente). Só botão Cancelar.
//   - Highlight do target via box-shadow gigante invertido na overlay.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export interface TourStep {
  target: string;          // CSS selector do elemento a destacar
  title?: string;
  body: string;
  side?: 'bottom' | 'top' | 'right' | 'left' | 'auto';
}

interface Props {
  steps: TourStep[];
  storageKey: string;
  forceOpen?: boolean;     // quando true, abre mesmo se já marcou como done
  onDone?: () => void;     // chamado ao concluir OU cancelar (pra fechar via parent)
}

const PADDING = 8;
const TOOLTIP_W = 340;
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
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; placement: string } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Decide se abre — automaticamente na 1ª vez OU se forceOpen
  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setIdx(0);
      return;
    }
    if (!storageDone(storageKey)) {
      // Esperar 600ms pro DOM da página assentar (cards renderizam após fetch)
      const t = setTimeout(() => {
        if (document.querySelector(steps[0]?.target)) setOpen(true);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [forceOpen, storageKey, steps]);

  // Calcula posição quando step muda
  const recalc = useCallback(() => {
    if (!open || !steps[idx]) return;
    const el = document.querySelector(steps[idx].target) as HTMLElement | null;
    if (!el) {
      setRect(null);
      setTooltipPos(null);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Aguarda scroll terminar (rough)
    setTimeout(() => {
      const r = el.getBoundingClientRect();
      setRect(r);
      // Calcula placement
      const side = steps[idx].side || 'auto';
      const tH = tooltipRef.current?.offsetHeight || 180;
      const spaceBelow = window.innerHeight - r.bottom - PADDING;
      const spaceAbove = r.top - PADDING;
      let placement = side === 'auto'
        ? (spaceBelow >= tH + TOOLTIP_GAP ? 'bottom' : spaceAbove >= tH + TOOLTIP_GAP ? 'top' : 'right')
        : side;

      let top = 0, left = 0;
      if (placement === 'bottom') {
        top = r.bottom + TOOLTIP_GAP;
        left = Math.max(PADDING, Math.min(window.innerWidth - TOOLTIP_W - PADDING, r.left + r.width / 2 - TOOLTIP_W / 2));
      } else if (placement === 'top') {
        top = r.top - TOOLTIP_GAP - tH;
        left = Math.max(PADDING, Math.min(window.innerWidth - TOOLTIP_W - PADDING, r.left + r.width / 2 - TOOLTIP_W / 2));
      } else if (placement === 'right') {
        top = Math.max(PADDING, Math.min(window.innerHeight - tH - PADDING, r.top + r.height / 2 - tH / 2));
        left = r.right + TOOLTIP_GAP;
        if (left + TOOLTIP_W > window.innerWidth - PADDING) {
          placement = 'left';
          left = r.left - TOOLTIP_GAP - TOOLTIP_W;
        }
      } else { // left
        top = Math.max(PADDING, Math.min(window.innerHeight - tH - PADDING, r.top + r.height / 2 - tH / 2));
        left = r.left - TOOLTIP_GAP - TOOLTIP_W;
      }
      setTooltipPos({ top, left, placement });
    }, 350);
  }, [open, idx, steps]);

  useLayoutEffect(() => {
    recalc();
    const onResize = () => recalc();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [recalc]);

  function close(markDone = true) {
    setOpen(false);
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
      {/* Backdrop com "buraco" sobre o target via box-shadow */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          pointerEvents: 'auto',
          background: rect ? 'transparent' : 'rgba(0,0,0,0.55)',
          transition: 'background 200ms',
        }}
      />
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
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 3px rgba(96,165,250,0.7)',
            transition: 'top 250ms, left 250ms, width 250ms, height 250ms',
          }}
        />
      )}

      {/* Tooltip */}
      {tooltipPos && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: tooltipPos.top,
            left: tooltipPos.left,
            width: TOOLTIP_W,
            zIndex: 10000,
            background: '#1E40AF',
            color: '#fff',
            borderRadius: 12,
            padding: 18,
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            fontSize: 14,
            lineHeight: 1.5,
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
                }}
              />
            ))}
          </div>

          {step.title && (
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{step.title}</div>
          )}
          <div style={{ color: 'rgba(255,255,255,0.92)' }}>{step.body}</div>

          {/* Botões */}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            {!first && (
              <button
                type="button"
                onClick={prev}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff',
                  padding: '8px 14px',
                  borderRadius: 6,
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
              onClick={next}
              style={{
                flex: 1,
                background: '#fff',
                color: '#1E40AF',
                border: 'none',
                padding: '10px 16px',
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
            }}
          >
            Pular tour
          </button>
        </div>
      )}
    </>
  );
}

/** Helper hook pra controlar abertura via botão externo (ícone "?") */
export function useTourTrigger(storageKey: string) {
  const [forceOpen, setForceOpen] = useState(false);
  return {
    forceOpen,
    open: () => {
      // Limpa o flag pra que o tour role completo
      try { localStorage.removeItem(`tour:${storageKey}`); } catch {}
      setForceOpen(true);
    },
    onDone: () => setForceOpen(false),
  };
}
