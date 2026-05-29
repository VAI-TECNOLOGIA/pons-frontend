import { useState } from 'react';
import { Topbar, PageHeader } from '../components/PageHeader';
import { Api } from '../lib/api';
import { ErrorBlock, LoadingBlock, useApi } from '../lib/useApi';

// Fase D3 — Heatmap viewer (visualiza cliques em uma página)
export default function Heatmap() {
  const [pagina, setPagina] = useState('/');
  const [dias, setDias] = useState(7);
  const [carregar, setCarregar] = useState(false);

  const { data, loading, error } = useApi<any>(
    () => carregar ? Api.heatmapPagina(pagina, dias) : Promise.resolve(null),
    [carregar, pagina, dias],
  );

  return (
    <>
      <Topbar title="Heatmap" />
      <div className="main__content">
        <PageHeader
          breadcrumb="Marketing · Análise"
          title="Heatmap de páginas"
          subtitle="Veja onde os visitantes clicam, scrollam e abandonam. Útil pra otimizar LPs."
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="form-grid">
            <div className="field">
              <label className="field__label">Página (path)</label>
              <input
                className="field__input"
                value={pagina}
                onChange={(e) => setPagina(e.target.value)}
                placeholder="/ ou /lp/promo-itapema"
              />
            </div>
            <div className="field">
              <label className="field__label">Últimos N dias</label>
              <select className="field__select" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
                <option value={1}>1 dia</option>
                <option value={7}>7 dias</option>
                <option value={30}>30 dias</option>
              </select>
            </div>
            <div className="field" style={{ alignSelf: 'end' }}>
              <button className="btn btn--primary" onClick={() => setCarregar(true)}>Carregar</button>
            </div>
          </div>
        </div>

        {loading && <LoadingBlock />}
        {error && <ErrorBlock error={error} />}

        {data && (
          <>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 16 }}>
              <Stat label="Sessões únicas" value={data.sessoesUnicas} />
              <Stat label="Cliques" value={data.clicks} />
              <Stat label="Scrolls" value={data.scrolls} />
              <Stat label="Tempo médio" value={Math.round(data.tempoMedioMs / 1000) + 's'} />
            </div>

            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Mapa de cliques</h3>
              <ClickHeatCanvas pontos={data.pontosClick || []} />
              <div className="text-xs text-secondary" style={{ marginTop: 6 }}>
                Cada ponto é um clique normalizado pelo viewport do visitante. Cores mais quentes = mais cliques na mesma região.
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="text-xs text-secondary">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

// Canvas simples — desenha gradiente radial em cada clique normalizado
function ClickHeatCanvas({ pontos }: { pontos: any[] }) {
  const W = 800, H = 600;
  if (!pontos || pontos.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Sem cliques registrados nesse período.</div>;
  }

  const setRef = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f7f7f7';
    ctx.fillRect(0, 0, W, H);
    for (const p of pontos) {
      if (p.x == null || p.y == null) continue;
      const vx = (p.x / (p.viewportW || 1280)) * W;
      const vy = (p.y / (p.viewportH || 800)) * H;
      const grad = ctx.createRadialGradient(vx, vy, 0, vx, vy, 30);
      grad.addColorStop(0, 'rgba(225, 6, 0, 0.55)');
      grad.addColorStop(0.5, 'rgba(242, 181, 68, 0.25)');
      grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(vx, vy, 30, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  return (
    <canvas
      ref={setRef}
      width={W}
      height={H}
      style={{ width: '100%', maxWidth: W, border: '1px solid var(--border-light)', borderRadius: 6, background: '#f7f7f7' }}
    />
  );
}
