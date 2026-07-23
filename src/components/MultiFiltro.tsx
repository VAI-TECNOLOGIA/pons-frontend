import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

// Filtro multi-seleção (checkboxes) usado no painel de filtros de leads:
// Campanha, Formulário, Equipe, Produto, Origem… O botão mostra o total
// selecionado ("Formulário (2)"); o dropdown abre via PORTAL (nunca é cortado
// por card/modal) com busca quando a lista é grande.
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
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; acima: boolean } | null>(null);

  const abrir = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const abaixo = window.innerHeight - r.bottom;
      const acima = abaixo < 300 && r.top > abaixo;
      setPos({ top: acima ? r.top - 4 : r.bottom + 4, left: r.left, width: Math.max(r.width, 260), acima });
    }
    setBusca('');
    setOpen(true);
  };

  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const lista = opcoes.filter((o) => !busca.trim() || norm(o.label).includes(norm(busca)));
  const marcado = (v: string) => values.includes(v);
  const toggle = (v: string) => onChange(marcado(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="field__select"
        onClick={() => (open ? setOpen(false) : abrir())}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          cursor: 'pointer',
          textAlign: 'left',
          fontWeight: values.length ? 700 : 400,
          color: values.length ? 'var(--pons-blue)' : undefined,
          minWidth: 0,
        }}
        title={values.length ? `${label}: ${values.length} selecionado(s)` : label}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {values.length ? `${label} (${values.length})` : label}
        </span>
        <Icon name="menu" size={11} />
      </button>
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
              maxHeight: 300,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 10,
              boxShadow: 'var(--shadow-lg)',
              padding: 6,
            }}
          >
            {opcoes.length > 8 && (
              <input
                autoFocus
                className="field__input"
                style={{ height: 32, fontSize: 13, marginBottom: 6 }}
                placeholder={`Buscar ${label.toLowerCase()}…`}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            )}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {lista.length === 0 ? (
                <div className="text-xs text-secondary" style={{ padding: '10px 12px' }}>Nada encontrado.</div>
              ) : (
                lista.map((o) => (
                  <label
                    key={o.value}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <input type="checkbox" checked={marcado(o.value)} onChange={() => toggle(o.value)} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                  </label>
                ))
              )}
            </div>
            {values.length > 0 && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ marginTop: 6 }}
                onClick={() => onChange([])}
              >
                Limpar seleção ({values.length})
              </button>
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
