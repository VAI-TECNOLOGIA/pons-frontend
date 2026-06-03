// Skeleton loader pra estados de carregamento (substitui "Carregando...")
// Variantes: text · title · card · avatar · custom (width/height)

interface SkeletonProps {
  variant?: 'text' | 'title' | 'card' | 'avatar';
  width?: string | number;
  height?: string | number;
  count?: number;
  style?: React.CSSProperties;
}

export function Skeleton({ variant = 'text', width, height, count = 1, style }: SkeletonProps) {
  const items = Array.from({ length: count });
  const className = `skeleton skeleton--${variant}`;
  return (
    <>
      {items.map((_, i) => (
        <div
          key={i}
          className={className}
          style={{
            ...(width !== undefined ? { width } : {}),
            ...(height !== undefined ? { height } : {}),
            marginTop: i > 0 ? 8 : 0,
            ...style,
          }}
        />
      ))}
    </>
  );
}

// Skeleton de página inteira (substitui LoadingBlock em rotas pesadas)
export function PageSkeleton() {
  return (
    <div className="u-stack" style={{ padding: 24 }}>
      <Skeleton variant="title" />
      <div className="u-grid-auto-fit-220">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
      <Skeleton variant="card" height={300} />
    </div>
  );
}

// Skeleton de tabela
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="card">
      <div className="u-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, marginBottom: 12 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} variant="text" height={14} width="70%" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="u-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, marginTop: 12 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} variant="text" />
          ))}
        </div>
      ))}
    </div>
  );
}
