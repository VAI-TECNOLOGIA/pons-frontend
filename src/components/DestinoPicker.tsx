import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

// Seletor de DESTINO da transferência de leads: Corretor, Equipe, Fila
// (de atendimento) ou Bolsão — com busca em cada aba. Dropdown via portal
// (nunca é cortado). O selecionado vira chip com X.
export type DestinoTransf =
  | { tipo: 'CORRETOR'; id: number; nome: string }
  | { tipo: 'EQUIPE'; id: number; nome: string }
  | { tipo: 'FILA'; id: number; nome: string }
  | { tipo: 'BASE'; id: number; nome: string }
  | { tipo: 'BOLSAO'; nome: string };

const TIPO_LABEL: Record<string, string> = { CORRETOR: 'Corretor', EQUIPE: 'Equipe', FILA: 'Fila', BASE: 'Base', BOLSAO: 'Bolsão' };

export function DestinoPicker({
  corretores,
  equipes,
  filas,
  bases,
  value,
  onChange,
}: {
  corretores?: any[] | null;
  equipes?: any[] | null;
  filas?: any[] | null;
  bases?: any[] | null;
  value: DestinoTransf | null;
  onChange: (d: DestinoTransf | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [aba, setAba] = useState<'CORRETOR' | 'EQUIPE' | 'FILA' | 'BASE'>('CORRETOR');
  const [busca, setBusca] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; acima: boolean } | null>(null);

  const abrir = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const abaixo = window.innerHeight - r.bottom;
      const acima = abaixo < 360 && r.top > abaixo;
      // Painel confortável: até 480px, sempre com 12px de respiro das bordas da janela
      setPos({ top: acima ? r.top - 6 : r.bottom + 6, left: r.left, width: Math.min(Math.max(r.width, 480), window.innerWidth - 24), acima });
    }
    setBusca('');
    setOpen(true);
  };

  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const q = norm(busca);

  const listaCorretores = (corretores || [])
    .filter((c: any) => c.ativo !== false)
    .filter((c: any) => !q || norm(c.nome || c.user?.name || '').includes(q) || norm(c.equipe?.nome || '').includes(q))
    .slice(0, 30);
  const listaEquipes = (equipes || []).filter((e: any) => !q || norm(e.nome || '').includes(q)).slice(0, 30);
  const listaFilas = (filas || []).filter((f: any) => !q || norm(f.nome || '').includes(q)).slice(0, 30);
  const listaBases = (bases || []).filter((b: any) => !q || norm(b.nome || '').includes(q)).slice(0, 30);

  if (value) {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          border: '1px solid var(--pons-blue)', borderRadius: 8, background: 'var(--bg-card)',
          fontSize: 13, fontWeight: 600, maxWidth: 280,
        }}
      >
        <span className="text-secondary" style={{ fontWeight: 400 }}>{TIPO_LABEL[value.tipo]}:</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value.nome}</span>
        <button type="button" className="btn btn--ghost btn--sm" style={{ padding: '2px 6px' }} onClick={() => onChange(null)} title="Trocar destino">
          <Icon name="x" size={12} />
        </button>
      </span>
    );
  }

  const linha = (key: string, principal: string, secundario: string, onClick: () => void) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%', padding: '10px 12px', border: 'none', borderRadius: 10, background: 'transparent', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span style={{ fontSize: 13, fontWeight: 600 }}>{principal}</span>
      {secundario && <span className="text-xs text-secondary">{secundario}</span>}
    </button>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="field__select"
        onClick={() => (open ? setOpen(false) : abrir())}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, cursor: 'pointer', textAlign: 'left', minWidth: 220, flex: '0 1 260px' }}
      >
        <span className="text-secondary">Escolher destino…</span>
        <Icon name="menu" size={11} />
      </button>
      {open && pos && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: 'fixed',
              ...(pos.acima ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
              left: Math.max(12, Math.min(pos.left, window.innerWidth - pos.width - 12)),
              width: pos.width,
              zIndex: 9999,
              maxHeight: 440,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 14,
              boxShadow: 'var(--shadow-xl, var(--shadow-lg))',
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, flexShrink: 0 }}>
              {(['CORRETOR', 'EQUIPE', 'FILA', 'BASE'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={'btn btn--sm ' + (aba === t ? 'btn--primary' : 'btn--secondary')}
                  style={{ flex: '1 1 84px', minWidth: 84, justifyContent: 'center', paddingTop: 8, paddingBottom: 8 }}
                  onClick={() => { setAba(t); setBusca(''); }}
                >
                  {TIPO_LABEL[t]}
                </button>
              ))}
              <button
                type="button"
                className="btn btn--sm btn--secondary"
                style={{ flex: '1 1 84px', minWidth: 84, justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 8 }}
                title="Devolver os leads pro bolsão (sem dono)"
                onClick={() => { onChange({ tipo: 'BOLSAO', nome: 'Devolver ao bolsão' }); setOpen(false); }}
              >
                <Icon name="database" size={12} /> Bolsão
              </button>
            </div>
            <input
              autoFocus
              className="field__input"
              style={{ height: 44, minHeight: 44, flexShrink: 0, fontSize: 14, padding: '0 14px', marginBottom: 10 }}
              placeholder={aba === 'CORRETOR' ? 'Buscar corretor por nome ou equipe…' : aba === 'EQUIPE' ? 'Buscar equipe…' : aba === 'FILA' ? 'Buscar fila…' : 'Buscar base…'}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {aba === 'CORRETOR' && (listaCorretores.length === 0
                ? <div className="text-xs text-secondary" style={{ padding: '10px 12px' }}>Nenhum corretor encontrado.</div>
                : listaCorretores.map((c: any) => linha(`c${c.id}`, c.nome || c.user?.name, `${c.equipe?.nome || 'Sem equipe'}${c.phone ? ` · ${c.phone}` : ''}`, () => { onChange({ tipo: 'CORRETOR', id: c.id, nome: c.nome || c.user?.name }); setOpen(false); })))}
              {aba === 'EQUIPE' && (listaEquipes.length === 0
                ? <div className="text-xs text-secondary" style={{ padding: '10px 12px' }}>Nenhuma equipe encontrada.</div>
                : listaEquipes.map((e: any) => linha(`e${e.id}`, e.nome, `${e.totalCorretores ?? e.membros?.length ?? 0} corretor(es) — divide igualmente entre os ativos`, () => { onChange({ tipo: 'EQUIPE', id: e.id, nome: e.nome }); setOpen(false); })))}
              {aba === 'FILA' && (listaFilas.length === 0
                ? <div className="text-xs text-secondary" style={{ padding: '10px 12px' }}>Nenhuma fila disponível.</div>
                : listaFilas.map((f: any) => linha(`f${f.id}`, f.nome, `${f.ativa === false ? 'inativa · ' : ''}rodízio entre os corretores da fila`, () => { onChange({ tipo: 'FILA', id: f.id, nome: f.nome }); setOpen(false); })))}
              {aba === 'BASE' && (listaBases.length === 0
                ? <div className="text-xs text-secondary" style={{ padding: '10px 12px' }}>Nenhuma base criada — crie em Bases de Leads.</div>
                : listaBases.map((b: any) => linha(`b${b.id}`, b.nome, `${b.totalLeads ?? 0} lead(s) · só categoriza, não muda o corretor`, () => { onChange({ tipo: 'BASE', id: b.id, nome: b.nome }); setOpen(false); })))}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
