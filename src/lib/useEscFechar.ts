import { useEffect } from 'react';

// Fecha um painel suspenso (seletor/popover) com a tecla ESC.
export function useEscFechar(aberto: boolean, fechar: () => void) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aberto, fechar]);
}
