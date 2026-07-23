import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

// Filtro multi-seleção estilo Imobilead: os selecionados viram CHIPS dentro do
// próprio campo (com × pra tirar) e a lista abre embaixo com os marcados
// destacados. NÃO dispara busca nenhuma — quem aplica é o botão "Filtrar" do
// painel. Dropdown via portal (nunca é cortado por card/modal).
export type OpcaoFiltro = { value: string; label: string };

export function MultiFiltro({
  label,
  opcoes,
  values,
  onChange,
}: {
  label: string;
  opcoes: OpcaoFiltro[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; acima: boolean } | null>(null);

  const abrir = () => {
    const r = boxRef.current?.getBoundingClientRect();
    if (r) {
      const abaixo = window.innerHeight - r.bottom;
      const acima = abaixo < 300 && r.top > abaixo;
      setPos({ top: acima ? r.top - 4 : r.bottom + 4, left: r.left, width: Math.max(r.width, 280), acima });
    }
    setOpen(true);
  };

  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const lista = opcoes.filter((o) => !busca.trim() || norm(o.label).includes(norm(busca)));
  const marcado = (v: string) => values.includes(v);
  const toggle = (v: string) => {
    onChange(marcado(v) ? values.filter((x) => x !== v) : [...values, v]);
    setBusca('');
    inputRef.current?.focus();
  };
  const labelDe = (v: string) => opcoes.find((o) => o.value === v)?.label ?? v;

  return (
    <>
      <div
        ref={boxRef}
        className="field__input"
        onClick={() => { abrir(); inputRef.current?.focus(); }}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          alignItems: 'center',
          minHeight: 36,
          height: 'auto',
          padding: '4px 8px',
          cursor: 'text',
          flex: '1 1 220px',
          minWidth: 200,
        }}
      >
        {values.map((v) => (
          <span
            key={v}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid var(--pons-blue)',
              color: 'var(--pons-blue)',
              borderRadius: 6,
              padding: '1px 6px',
              fontSize: 12,
              fontWeight: 600,
              maxWidth: 190,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelDe(v)}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggle(v); }}
              title="Remover"
              style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <Icon name="x" size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={busca}
          onChange={(e) => { setBusca(e.target.value); abrir(); }}
          onFocus={abrir}
          placeholder={values.length ? '' : label}
          style={{ border: 'none', outline: 'none', background: 'transparent', color: 'inherit', font: 'inherit', fontSize: 13, flex: '1 0 60px', minWidth: 60, height: 24 }}
        />
      </div>
      {open && pos && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: 'fixed',
              ...(pos.acima ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
              left: Math.min(pos.left, window.innerWidth - pos.width - 8),
              width: pos.width,
              zIndex: 9999,
              maxHeight: 280,
              overflowY: 'auto',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 10,
              boxShadow: 'var(--shadow-lg)',
              padding: 4,
            }}
          >
            {lista.length === 0 ? (
              <div className="text-xs text-secondary" style={{ padding: '10px 12px' }}>Nada encontrado.</div>
            ) : (
              lista.map((o) => {
                const on = marcado(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(o.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      width: '100%',
                      padding: '8px 10px',
                      border: 'none',
                      borderRadius: 8,
                      background: on ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                      font: 'inherit',
                      fontSize: 13,
                      fontWeight: on ? 700 : 400,
                      color: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { if (!on) (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
                    onMouseLeave={(e) => { if (!on) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                    {on && <Icon name="check" size={13} />}
                  </button>
                );
              })
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
