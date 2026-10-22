import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

// Seletor com BUSCA pelo nome — mesmo padrão da busca de campanhas na criação
// de fila: a lista de opções aparece INLINE logo abaixo do campo (ao focar já
// mostra tudo; digitando filtra). Só seleciona CLICANDO numa opção — texto
// digitado nunca "passa" como valor. Selecionado vira chip; clicar no chip reabre
// a lista pra trocar (serve de filtro E de seletor obrigatório tipo status).
//   limpavel=false → sem o "X" de limpar (pra campos que sempre têm um valor).
export function BuscaSelect({
  itens,
  value,
  onChange,
  placeholder = 'Digite pra buscar…',
  vazio = 'Nenhum resultado encontrado.',
  limpavel = true,
}: {
  itens: { id: number | string; label: string; sub?: string }[];
  value: number | string | '';
  onChange: (id: number | string | '') => void;
  placeholder?: string;
  vazio?: string;
  limpavel?: boolean;
}) {
  const [busca, setBusca] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ao abrir (inclusive reabrindo pelo chip), foca o campo pra já digitar/ver a lista.
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const q = norm(busca.trim());
  const lista = itens
    .filter((i) => !q || norm(i.label).includes(q) || norm(i.sub || '').includes(q))
    .slice(0, 30);

  const selecionado = itens.find((i) => String(i.id) === String(value));

  // Fechado e com valor → chip. O corpo reabre a lista; o X (se limpável) limpa.
  if (selecionado && !open) {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 8px 6px 10px',
          border: '1px solid var(--pons-blue)', borderRadius: 8, background: 'var(--bg-card)',
          fontSize: 13, fontWeight: 600, maxWidth: '100%',
        }}
      >
        <button
          type="button"
          onClick={() => { setBusca(''); setOpen(true); }}
          title="Trocar"
          style={{ background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selecionado.label}
            {selecionado.sub ? <span className="text-secondary" style={{ fontWeight: 400 }}> · {selecionado.sub}</span> : null}
          </span>
          <Icon name="chevron-down" size={13} />
        </button>
        {limpavel && (
          <button type="button" className="btn btn--ghost btn--sm" style={{ padding: '2px 5px', flexShrink: 0 }} onClick={() => { onChange(''); setBusca(''); setOpen(true); }} title="Limpar">
            <Icon name="x" size={12} />
          </button>
        )}
      </span>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <input
        ref={inputRef}
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
                  background: String(i.id) === String(value) ? 'var(--bg-card-hover)' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--border-light)',
                  cursor: 'pointer', color: 'var(--text-primary)', font: 'inherit',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = String(i.id) === String(value) ? 'var(--bg-card-hover)' : 'transparent'; }}
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
