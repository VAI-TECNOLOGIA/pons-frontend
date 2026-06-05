import { useEffect, useState } from 'react';
import { Api } from '../lib/api';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { PageWrap } from '../components/PageWrap';

interface MetricsResp {
  ok: boolean;
  pid: number;
  workerId: number;
  nodeEnv: string;
  nodeVersion?: string;
  uptimeSec: number;
  startedAt: string;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
    arrayBuffersMb: number;
  };
  eventLoop: {
    min: number;
    mean: number;
    max: number;
    p50: number;
    p90: number;
    p99: number;
    stddev: number;
  };
  cpu: {
    loadavg1m: number;
    loadavg5m: number;
    loadavg15m: number;
    cores: number;
  };
  queries: {
    total: number;
    slow: number;
    avgMs: number;
    bufferSize: number;
    threshold: number;
  };
  slowQueries?: Array<{
    model?: string;
    action?: string;
    durationMs?: number;
    ts?: string;
  }>;
}

function fmtUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ${sec % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function loopColor(p99: number): string {
  if (p99 > 100) return '#DC2626';
  if (p99 > 50) return '#F59E0B';
  return '#16A34A';
}

export default function DevMetrics() {
  const [data, setData] = useState<MetricsResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [withSlow, setWithSlow] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await Api.metricsSnapshot(withSlow);
      setData(r as MetricsResp);
    } catch (e: any) {
      setErr(e.message || 'erro');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withSlow]);

  return (
    <PageWrap>
      <PageHeader
        breadcrumb="DEV"
        title="Métricas do sistema"
        subtitle="GET /api/_metrics · em cluster cada call bate num PID aleatório · auto-refresh 30s"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={withSlow} onChange={(e) => setWithSlow(e.target.checked)} />
              Slow queries
            </label>
            <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
              <Icon name="refresh" size={14} /> {loading ? ' …' : ' Atualizar'}
            </button>
          </div>
        }
      />

      {err && (
        <div className="card" style={{ borderColor: 'var(--red-300)', background: 'rgba(239,68,68,.08)', marginBottom: 16 }}>
          <p style={{ color: 'var(--red-600)', margin: 0, fontSize: 13 }}>{err}</p>
        </div>
      )}

      {!data && !err ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
          Carregando snapshot…
        </div>
      ) : data ? (
        <>
          <Section title="Processo" icon="cpu">
            <Stat label="PID" value={String(data.pid)} hint={`worker ${data.workerId >= 0 ? '#' + data.workerId : '?'}`} />
            <Stat label="Ambiente" value={data.nodeEnv} hint={data.nodeVersion} />
            <Stat label="Uptime" value={fmtUptime(data.uptimeSec)} />
            <Stat
              label="CPU load (1m/15m)"
              value={`${data.cpu.loadavg1m.toFixed(2)} / ${data.cpu.loadavg15m.toFixed(2)}`}
              hint={`${data.cpu.cores} cores`}
            />
          </Section>

          <Section title="Memória" icon="database">
            <Stat label="RSS" value={`${data.memory.rssMb} MB`} />
            <Stat label="Heap usado" value={`${data.memory.heapUsedMb} MB`} hint={`${data.memory.heapTotalMb} MB alocado`} />
            <Stat label="External" value={`${data.memory.externalMb} MB`} />
            <Stat label="ArrayBuffers" value={`${data.memory.arrayBuffersMb} MB`} />
          </Section>

          <Section title="Event loop (60s)" icon="activity">
            <Stat label="Mean" value={`${data.eventLoop.mean} ms`} />
            <Stat label="p50" value={`${data.eventLoop.p50} ms`} />
            <Stat label="p90" value={`${data.eventLoop.p90} ms`} />
            <Stat label="p99" value={`${data.eventLoop.p99} ms`} color={loopColor(data.eventLoop.p99)} />
          </Section>

          <Section title="Banco de dados (Prisma)" icon="database">
            <Stat label="Queries" value={data.queries.total.toLocaleString('pt-BR')} />
            <Stat label="Slow" value={String(data.queries.slow)} hint={`>${data.queries.threshold}ms`} />
            <Stat label="Avg" value={`${data.queries.avgMs} ms`} />
            <Stat label="Buffer" value={`${data.queries.bufferSize} / 200`} />
          </Section>

          {withSlow && data.slowQueries && data.slowQueries.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 8 }}>
                Últimas {data.slowQueries.length} slow queries deste worker:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
                {data.slowQueries.map((q, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 6,
                      padding: 8,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#F59E0B', fontWeight: 600 }}>{q.durationMs} ms</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {q.ts ? new Date(q.ts).toLocaleTimeString('pt-BR') : '—'}
                      </span>
                    </div>
                    <code style={{ display: 'block', fontFamily: 'ui-monospace, monospace' }}>
                      {q.model}.{q.action}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </PageWrap>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ marginBottom: 16, padding: 16 }}>
      <p
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          fontWeight: 700,
          color: 'var(--text-secondary)',
          margin: 0,
          marginBottom: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Icon name={icon} size={12} /> {title}
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 16,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Stat({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-secondary)', margin: 0, marginBottom: 4 }}>
        {label}
      </p>
      <p
        style={{
          fontSize: 18,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          margin: 0,
          color: color || 'var(--text-primary)',
        }}
      >
        {value}
      </p>
      {hint && (
        <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0, marginTop: 2 }}>{hint}</p>
      )}
    </div>
  );
}
