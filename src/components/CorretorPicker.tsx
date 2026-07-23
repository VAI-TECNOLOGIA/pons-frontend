import { useState } from 'react';
import { Icon } from './Icon';

// Seletor de corretor com BUSCA (nome, equipe ou telefone) — substitui os
// <select> gigantes das ações de transferir lead. Mostra lista clicável
// filtrada; selecionado vira um chip com X pra trocar.
export function CorretorPicker({
  corretores,
  value,
  onChange,
  placeholder = 'Buscar corretor por nome, equipe ou telefone…',
}: {
  corretores: any[] | null | undefined;
  value: number | '';
  onChange: (id: number | '') => void;
  placeholder?: string;
}) {
  const [busca, setBusca] = useState('');
  const [open, setOpen] = useState(false);

  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const dig = busca.replace(/\D/g, '');
  const ativos = (corretores || []).filter((c: any) => c.ativo !== false);
  const lista = ativos
    .filter((c: any) => {
      if (!busca.trim()) return true;
      const q = norm(busca);
      return (
        norm(c.nome || c.user?.name || '').includes(q) ||
        norm(c.equipe?.nome || '').includes(q) ||
        (dig.length >= 4 && String(c.phone || '').replace(/\D/g, '').includes(dig))
      );
    })
    .slice(0, 30);

  const selecionado = ativos.find((c: any) => c.id === value);

  if (selecionado) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          border: '1px solid var(--pons-blue)',
          borderRadius: 8,
          background: 'var(--bg-card)',
          fontSize: 13,
          fontWeight: 600,
          maxWidth: 260,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selecionado.nome || selecionado.user?.name}
          {selecionado.equipe?.nome ? <span className="text-secondary" style={{ fontWeight: 400 }}> · {selecionado.equipe.nome}</span> : null}
        </span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          style={{ padding: '2px 6px' }}
          onClick={() => { onChange(''); setBusca(''); }}
          title="Trocar corretor"
        >
          <Icon name="x" size={12} />
        </button>
      </span>
    );
  }

  return (
    <span style={{ position: 'relative', display: 'inline-block', minWidth: 220, flex: '0 1 260px' }}>
      <input
        className="field__input"
        style={{ height: 34, fontSize: 13, width: '100%' }}
        placeholder={placeholder}
        value={busca}
        onChange={(e) => { setBusca(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              zIndex: 61,
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
              <div className="text-xs text-secondary" style={{ padding: '10px 12px' }}>Nenhum corretor encontrado.</div>
            ) : (
              lista.map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c.id); setOpen(false); }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    borderRadius: 8,
                    background: 'transparent',
                    font: 'inherit',
                    color: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{c.nome || c.user?.name}</span>
                  <span className="text-xs text-secondary">{c.equipe?.nome || 'Sem equipe'}{c.phone ? ` · ${c.phone}` : ''}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </span>
  );
}
