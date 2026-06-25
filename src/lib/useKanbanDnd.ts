import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook genérico pra drag & drop entre colunas de kanban.
 *
 * Desktop (mouse): HTML5 Drag API nativa.
 * Touch (celular/tablet): a HTML5 Drag API NÃO dispara em toque, então usamos
 * Pointer Events com long-press (~180ms) pra iniciar o arrasto — antes disso o
 * gesto é tratado como scroll normal da página. Pra o touch funcionar, as
 * COLUNAS precisam ter o atributo data-kanban-col="<status>" e os CARDS precisam
 * de onPointerDown={onPointerDown(id)}.
 */
const LONG_PRESS_MS = 180;
const MOVE_CANCEL_PX = 10;

export function useKanbanDnd(onMove: (id: number, toStatus: string) => void) {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);

  // ── Desktop: HTML5 Drag API ──────────────────────────────────────────
  const onDragStart = useCallback((id: number) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/id', String(id));
    setDraggingId(id);
  }, []);

  const onDragEnd = useCallback(() => {
    setDraggingId(null);
    setHoverCol(null);
  }, []);

  const onDragOver = useCallback((status: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (hoverCol !== status) setHoverCol(status);
  }, [hoverCol]);

  const onDragLeave = useCallback((status: string) => () => {
    setHoverCol((c) => (c === status ? null : c));
  }, []);

  const onDrop = useCallback((status: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData('text/id'));
    setDraggingId(null);
    setHoverCol(null);
    if (id) onMove(id, status);
  }, [onMove]);

  // ── Touch: Pointer Events + long-press ───────────────────────────────
  const active = useRef<{ id: number; el: HTMLElement } | null>(null);

  const colAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    return el?.closest<HTMLElement>('[data-kanban-col]')?.getAttribute('data-kanban-col') ?? null;
  };

  // Enquanto o arrasto por toque está ativo, escutamos no document pra rastrear
  // o dedo mesmo fora do card e bloqueamos o scroll (touchmove não-passivo).
  useEffect(() => {
    if (draggingId == null || !active.current) return;
    const finish = (commit: boolean, x?: number, y?: number) => {
      const st = active.current;
      if (st) st.el.style.pointerEvents = '';
      if (commit && st && x != null && y != null) {
        const target = colAt(x, y);
        if (target) onMove(st.id, target);
      }
      active.current = null;
      setDraggingId(null);
      setHoverCol(null);
    };
    const move = (e: PointerEvent) => {
      e.preventDefault();
      setHoverCol(colAt(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => finish(true, e.clientX, e.clientY);
    const cancel = () => finish(false);
    const blockScroll = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('touchmove', blockScroll, { passive: false });
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
      document.removeEventListener('touchmove', blockScroll);
    };
  }, [draggingId, onMove]);

  const onPointerDown = useCallback((id: number) => (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return; // desktop usa HTML5 drag
    const el = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;

    const clearPre = () => {
      document.removeEventListener('pointermove', preMove);
      document.removeEventListener('pointerup', preEnd);
      document.removeEventListener('pointercancel', preEnd);
    };
    const preMove = (ev: PointerEvent) => {
      // Mexeu antes do long-press → é scroll, cancela a intenção de arrastar.
      if (Math.abs(ev.clientX - startX) > MOVE_CANCEL_PX || Math.abs(ev.clientY - startY) > MOVE_CANCEL_PX) {
        clearTimeout(timer);
        clearPre();
      }
    };
    const preEnd = () => {
      clearTimeout(timer);
      clearPre();
    };
    const timer = setTimeout(() => {
      clearPre();
      active.current = { id, el };
      el.style.pointerEvents = 'none'; // deixa elementFromPoint enxergar a coluna sob o card
      setDraggingId(id); // arma o efeito de arrasto por toque
    }, LONG_PRESS_MS);

    document.addEventListener('pointermove', preMove);
    document.addEventListener('pointerup', preEnd);
    document.addEventListener('pointercancel', preEnd);
  }, []);

  return { draggingId, hoverCol, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, onPointerDown };
}
