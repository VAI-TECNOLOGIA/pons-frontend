import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';

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
  const isMountedRef = useRef(false);

  // Effect 1: deps mudaram (ex: activeId trocou) → LIMPA data pra não renderizar
  // shape stale, mostra loading, refetch.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    if (isMountedRef.current) {
      // Só limpa em troca de deps real (não na primeira montagem nem em reload).
      setData(null);
    }
    isMountedRef.current = true;
    fetcherRef
      .current()
      .then((res) => { if (alive) setData(res); })
      .catch((err) => { if (alive) setError(err instanceof Error ? err : new Error(String(err))); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Effect 2: reload via tick → REFETCH SILENCIOSO (sem limpar data, sem
  // mostrar loading). Evita flicker do banner "Configure WhatsApp" quando
  // chega mensagem nova via SSE.
  useEffect(() => {
    if (tick === 0) return; // skip primeiro render
    let alive = true;
    setError(null);
    fetcherRef
      .current()
      .then((res) => { if (alive) setData(res); })
      .catch((err) => { if (alive) setError(err instanceof Error ? err : new Error(String(err))); });
    return () => { alive = false; };
  }, [tick]);

  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}

export function ErrorBlock({ error, label = 'Erro ao carregar' }: { error: Error; label?: string }) {
  // Trata erros 403 com tom suave — não é erro do app, é só permissão
  const isForbidden = (error as any)?.status === 403;
  const isNotFound  = (error as any)?.status === 404;
  const bg   = isForbidden ? 'var(--bg-elevated)' : 'var(--color-danger-bg)';
  const cor  = isForbidden ? 'var(--text-primary)' : '#8B0712';
  const iconName = isForbidden ? 'lock' : isNotFound ? 'search' : 'warn';
  const titulo = isForbidden ? 'Sem permissão' : isNotFound ? 'Não encontrado' : label;
  return (
    <div className="card" style={{ background: bg, color: cor, padding: 16 }}>
      <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Icon name={iconName} size={14} /> {titulo}
      </strong>
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
