import { useState } from 'react';
import { Icon } from './Icon';

// Seletor com BUSCA pelo nome — mesmo padrão da busca de campanhas na criação
// de fila: a lista de opções aparece INLINE logo abaixo do campo (ao focar já
// mostra tudo; digitando filtra). Só seleciona CLICANDO numa opção — texto
// digitado nunca "passa" como valor. Selecionado vira chip com X pra trocar.
export function BuscaSelect({
  itens,
  value,
  onChange,
  placeholder = 'Digite pra buscar…',
  vazio = 'Nenhum resultado encontrado.',
}: {
  itens: { id: number | string; label: string; sub?: string }[];
  value: number | string | '';
  onChange: (id: number | string | '') => void;
  placeholder?: string;
  vazio?: string;
}) {
  const [busca, setBusca] = useState('');
  const [open, setOpen] = useState(false);

  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const q = norm(busca.trim());
  const lista = itens
    .filter((i) => !q || norm(i.label).includes(q) || norm(i.sub || '').includes(q))
    .slice(0, 30);

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
        <button type="button" className="btn btn--ghost btn--sm" style={{ padding: '2px 6px', flexShrink: 0 }} onClick={() => { onChange(''); setBusca(''); setOpen(true); }} title="Trocar">
          <Icon name="x" size={12} />
        </button>
      </span>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <input
        className="field__input"
        style={{ width: '100%' }}
        placeholder={placeholder}
        value={busca}
        onChange={(e) => { setBusca(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div style={{ marginTop: 4, border: '1px solid var(--border-light)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)', maxHeight: 240, overflowY: 'auto' }}>
          {lista.length === 0 ? (
            <div className="text-xs text-secondary" style={{ padding: '10px 12px' }}>{vazio}</div>
          ) : (
            lista.map((i) => (
              <button
                key={String(i.id)}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(i.id); setOpen(false); setBusca(''); }}
                style={{
                  width: '100%', textAlign: 'left', display: 'block', padding: '8px 10px',
                  background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-light)',
                  cursor: 'pointer', color: 'var(--text-primary)', font: 'inherit',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.label}</div>
                {i.sub ? <div className="text-xs text-secondary">{i.sub}</div> : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
