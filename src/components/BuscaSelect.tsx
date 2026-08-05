import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

// Seletor genérico com BUSCA por nome — substitui <select> gigantes (ex.:
// empreendimentos no registro de venda). Mesmo padrão do CorretorPicker:
// lista filtrada em dropdown via portal; selecionado vira chip com X.
export function BuscaSelect({
  itens,
  value,
  onChange,
  placeholder = 'Buscar pelo nome…',
  vazio = 'Nenhum resultado.',
}: {
  itens: { id: number | string; label: string; sub?: string }[];
  value: number | string | '';
  onChange: (id: number | string | '') => void;
  placeholder?: string;
  vazio?: string;
}) {
  const [busca, setBusca] = useState('');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; acima: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const abrir = () => {
    const r = inputRef.current?.getBoundingClientRect();
    if (r) {
      const abaixo = window.innerHeight - r.bottom;
      const acima = abaixo < 280 && r.top > abaixo;
      setPos({ top: acima ? r.top - 4 : r.bottom + 4, left: r.left, width: Math.max(r.width, 280), acima });
    }
    setOpen(true);
  };

  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const lista = itens
    .filter((i) => !busca.trim() || norm(i.label).includes(norm(busca)) || norm(i.sub || '').includes(norm(busca)))
    .slice(0, 40);

  const selecionado = itens.find((i) => String(i.id) === String(value));

  if (selecionado) {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          border: '1px solid var(--pons-blue)', borderRadius: 8, background: 'var(--bg-card)',
          fontSize: 13, fontWeight: 600, maxWidth: '100%',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selecionado.label}
          {selecionado.sub ? <span className="text-secondary" style={{ fontWeight: 400 }}> · {selecionado.sub}</span> : null}
        </span>
        <button type="button" className="btn btn--ghost btn--sm" style={{ padding: '2px 6px' }} onClick={() => { onChange(''); setBusca(''); }} title="Trocar">
          <Icon name="x" size={12} />
        </button>
      </span>
    );
  }

  return (
    <span style={{ position: 'relative', display: 'block', width: '100%' }}>
      <input
        ref={inputRef}
        className="field__input"
        style={{ width: '100%' }}
        placeholder={placeholder}
        value={busca}
        onChange={(e) => { setBusca(e.target.value); abrir(); }}
        onFocus={abrir}
      />
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
              maxHeight: 260,
              overflowY: 'auto',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 10,
              boxShadow: 'var(--shadow-lg)',
              padding: 4,
            }}
          >
            {lista.length === 0 ? (
              <div className="text-xs text-secondary" style={{ padding: '10px 12px' }}>{vazio}</div>
            ) : (
              lista.map((i) => (
                <button
                  key={String(i.id)}
                  type="button"
                  onClick={() => { onChange(i.id); setOpen(false); }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%',
                    padding: '8px 10px', border: 'none', borderRadius: 8, background: 'transparent',
                    font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{i.label}</span>
                  {i.sub ? <span className="text-xs text-secondary">{i.sub}</span> : null}
                </button>
              ))
            )}
          </div>
        </>,
        document.body,
      )}
    </span>
  );
}
