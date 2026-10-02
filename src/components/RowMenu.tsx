import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

// Menu "⋯" para ações RARAS de uma linha de tabela. As ações frequentes ficam
// visíveis na linha; só o que quase não é usado entra aqui.
// Posição fixa (calculada do botão), renderizado no <body> via portal: não é
// cortado pelo overflow da tabela nem deslocado por ancestral com transform.
export interface RowMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export function RowMenu({ items, label = 'Mais ações' }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const alturaMenu = items.length * 36 + 12;
    const abreParaCima = r.bottom + alturaMenu > window.innerHeight - 8;
    setPos({ top: abreParaCima ? r.top - alturaMenu - 4 : r.bottom + 4, right: window.innerWidth - r.right });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const fechar = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    const rolar = () => setOpen(false);
    document.addEventListener('mousedown', fechar);
    document.addEventListener('keydown', tecla);
    window.addEventListener('scroll', rolar, true);
    window.addEventListener('resize', rolar);
    return () => {
      document.removeEventListener('mousedown', fechar);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('scroll', rolar, true);
      window.removeEventListener('resize', rolar);
    };
  }, [open]);

  if (!items.length) return null;
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="btn btn--ghost btn--sm row-menu__trigger"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="more" size={16} />
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} role="menu" className="row-menu" style={{ top: pos.top, right: pos.right }}>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className={'row-menu__item' + (it.danger ? ' row-menu__item--danger' : '')}
              onClick={() => { setOpen(false); it.onClick(); }}
            >
              {it.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
