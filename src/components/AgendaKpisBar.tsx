import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';

// Sprint 1 M16 — 5 cards de KPI da agenda (Imobilead-style)
export function AgendaKpisBar() {
  const { data } = useApi<any>(() => Api.agendaKpis().catch(() => null));
  if (!data) return null;

  const cards = [
    { label: 'Hoje',       value: data.hoje,       cor: 'var(--color-info, #1258CA)' },
    { label: 'Esta semana', value: data.semana,    cor: 'var(--text-primary)' },
    { label: 'Atrasados',  value: data.atrasados,  cor: 'var(--color-danger)' },
    { label: 'Concluídos', value: data.concluidos, cor: 'var(--color-success)' },
    { label: 'Próximos 30d', value: data.proximos, cor: 'var(--text-secondary)' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
      gap: 12, marginBottom: 16,
    }}>
      {cards.map((c) => (
        <div key={c.label} className="card" style={{ padding: 12 }}>
          <div className="text-xs text-secondary">{c.label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: c.cor }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
