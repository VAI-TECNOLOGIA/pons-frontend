import { useEffect, useRef, useState } from 'react';

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Hook genérico pra chamar Api.* com loading/error/reload.
 * Use deps para refazer a chamada quando filtros mudarem.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetcherRef
      .current()
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}

export function ErrorBlock({ error, label = 'Erro ao carregar' }: { error: Error; label?: string }) {
  return (
    <div
      className="card"
      style={{
        background: 'var(--color-danger-bg)',
        borderColor: '#F2A0A8',
        color: '#8B0712',
        padding: 16,
      }}
    >
      <strong>{label}</strong>
      <div className="text-sm" style={{ marginTop: 4 }}>
        {error.message}
      </div>
    </div>
  );
}

export function LoadingBlock({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>
      {label}
    </div>
  );
}
