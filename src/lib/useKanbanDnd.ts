import { useState, useCallback } from 'react';

/**
 * Hook genérico pra drag & drop entre colunas de kanban.
 * Usa HTML5 Drag API nativa (sem libs).
 */
export function useKanbanDnd(onMove: (id: number, toStatus: string) => void) {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);

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
    // Só limpa se estamos saindo da coluna marcada
    setHoverCol((c) => (c === status ? null : c));
  }, []);

  const onDrop = useCallback((status: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData('text/id'));
    setDraggingId(null);
    setHoverCol(null);
    if (id) onMove(id, status);
  }, [onMove]);

  return { draggingId, hoverCol, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop };
}
