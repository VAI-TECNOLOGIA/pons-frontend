import { useEffect, useMemo, useState } from 'react';
import { Api } from '../lib/api';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { PageWrap } from '../components/PageWrap';
import { useToast } from '../lib/toast';

type Category = 'bug' | 'performance' | 'outro';

const TIPO_LABEL: Record<Category, string> = {
  bug: 'Bug',
  performance: 'Performance',
  outro: 'Outro',
};

const TIPO_COLOR: Record<Category, string> = {
  bug: '#DC2626',
  performance: '#EA580C',
  outro: '#6B7280',
};

interface Item {
  id: number;
  type: Category;
  description: string;
  descriptionLen: number;
  screenshotUrl?: string | null;
  currentUrl?: string | null;
  userAgent?: string | null;
  sender?: { id?: number; name?: string; email?: string; role?: string } | null;
  actorEmail?: string;
  createdAt: string;
}

export default function DevFeedback() {
  const [list, setList] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<Record<number, string>>({});
  const toast = useToast();

  async function load() {
    setLoading(true);
    try {
      const r = await Api.devFeedback(200);
      setList((r.data as Item[]) ?? []);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar relatos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return list;
    return list.filter((i) => i.type === filter);
  }, [list, filter]);

  async function analyze(item: Item) {
    setAnalyzing(item.id);
    try {
      const r = await Api.devFeedbackAnalyze({
        description: item.description,
        type: item.type,
        currentUrl: item.currentUrl || undefined,
        userAgent: item.userAgent || undefined,
      });
      setAnalysis((p) => ({ ...p, [item.id]: r.analysis }));
    } catch (e: any) {
      toast.error('Análise falhou: ' + (e.message || 'erro'));
    } finally {
      setAnalyzing(null);
    }
  }

  return (
    <PageWrap>
      <PageHeader
        breadcrumb="DEV"
        title="Bug Reports"
        subtitle={`${list.length} relatos enviados pelos usuários`}
        actions={
          <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
            <Icon name="refresh" size={14} /> {loading ? ' Carregando…' : ' Atualizar'}
          </button>
        }
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={`Todos (${list.length})`} />
        {(['bug', 'performance', 'outro'] as Category[]).map((c) => (
          <FilterChip
            key={c}
            active={filter === c}
            color={TIPO_COLOR[c]}
            onClick={() => setFilter(c)}
            label={`${TIPO_LABEL[c]} (${list.filter((i) => i.type === c).length})`}
          />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((item) => (
          <article key={item.id} className="card" style={{ padding: 18 }}>
            <header style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <Icon name="bug" size={18} style={{ color: TIPO_COLOR[item.type], flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: TIPO_COLOR[item.type] + '20',
                      color: TIPO_COLOR[item.type],
                      border: `1px solid ${TIPO_COLOR[item.type]}40`,
                    }}
                  >
                    {TIPO_LABEL[item.type]}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {new Date(item.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                  Por: <strong>{item.sender?.name ?? item.actorEmail ?? '—'}</strong>
                  {item.sender?.role && <span> · {item.sender.role}</span>}
                </p>
                {item.currentUrl && (
                  <p
                    style={{
                      fontSize: 11,
                      color: 'var(--text-tertiary, var(--text-secondary))',
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={item.currentUrl}
                  >
                    URL: {item.currentUrl}
                  </p>
                )}
              </div>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => void analyze(item)}
                disabled={analyzing === item.id}
                style={{ flexShrink: 0 }}
              >
                <Icon name="sparkles" size={12} />
                {analyzing === item.id ? ' Analisando…' : ' Analisar IA'}
              </button>
            </header>

            <p
              style={{
                fontSize: 14,
                whiteSpace: 'pre-wrap',
                background: 'var(--bg-elevated)',
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border-light)',
                marginBottom: 12,
              }}
            >
              {item.description}
              {item.descriptionLen > item.description.length && <em style={{ opacity: 0.6 }}> … (truncado)</em>}
            </p>

            {item.screenshotUrl && (
              <a href={item.screenshotUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                <img
                  src={item.screenshotUrl}
                  alt="screenshot"
                  style={{
                    maxWidth: 460,
                    maxHeight: 240,
                    borderRadius: 8,
                    border: '1px solid var(--border-light)',
                  }}
                />
              </a>
            )}

            {analysis[item.id] && (
              <div
                style={{
                  marginTop: 12,
                  background: 'rgba(245,158,11,.08)',
                  border: '1px solid rgba(245,158,11,.3)',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 14,
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    color: '#B45309',
                    marginTop: 0,
                    marginBottom: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="sparkles" size={11} /> Análise IA
                </p>
                <p style={{ whiteSpace: 'pre-wrap', margin: 0, color: 'var(--text-primary)' }}>{analysis[item.id]}</p>
              </div>
            )}
          </article>
        ))}
        {filtered.length === 0 && (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
            {loading ? 'Carregando…' : 'Nenhum relato no filtro atual.'}
          </div>
        )}
      </div>
    </PageWrap>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: '6px 12px',
        borderRadius: 6,
        border: active
          ? `1px solid ${color || 'var(--blue-500)'}`
          : '1px solid var(--border-light)',
        background: active ? (color ? color + '20' : 'rgba(18,88,202,.1)') : 'transparent',
        color: active ? color || 'var(--blue-600)' : 'var(--text-secondary)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
