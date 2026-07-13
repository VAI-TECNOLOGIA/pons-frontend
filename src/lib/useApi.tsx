import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

// ── Cache stale-while-revalidate em memória ────────────────────────────────
// Tipo SWR mas inline: ao navegar de volta pra uma página já visitada, o hook
// devolve os dados do cache IMEDIATAMENTE (sem flicker "Carregando…") e
// dispara um refetch silencioso em background pra atualizar. TTL serve só
// pra expirar a entrada (ainda assim, refresh-on-mount sempre fala com a API).
//
// Cache vive enquanto a aba estiver aberta; reload da página limpa.
type CacheEntry = { data: unknown; ts: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60_000; // 5min — após isso, entry é descartada

// Deriva uma cache key estável a partir do fetcher.toString() + deps.
// Funciona pra arrow functions inline tipo `() => Api.dashboard()` —
// duas montagens do mesmo componente geram a mesma string. Pra fetchers
// com closure variável, passe deps explícito que muda quando o fetch muda.
function makeKey(fetcher: () => unknown, deps: unknown[]): string {
  try { return fetcher.toString() + '::' + JSON.stringify(deps); }
  catch { return fetcher.toString() + '::__unserializable_deps__'; }
}

/**
 * Hook genérico pra chamar Api.* com loading/error/reload.
 *
 * Mecânica:
 *  • Primeira visita à página → loading=true → API call → cache pra próxima.
 *  • Volta à mesma página (mesmo fetcher + deps) → data sai do cache na hora
 *    (loading=false), e em paralelo refazemos a call pra atualizar a UI.
 *  • deps mudaram (ex: filtro de busca) → limpa o data, mostra loading,
 *    nova call. Não consulta cache da chamada antiga.
 *
 * Use deps para refazer a chamada quando filtros mudarem.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): UseApiState<T> {
  const cacheKey = makeKey(fetcher, deps);
  const cached = cache.get(cacheKey);
  const hasCache = !!cached && Date.now() - cached.ts < CACHE_TTL_MS;

  const [data, setData] = useState<T | null>(hasCache ? (cached!.data as T) : null);
  const [loading, setLoading] = useState(!hasCache);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const isMountedRef = useRef(false);

  // Effect 1: deps mudaram (ex: activeId trocou) → consulta cache; se hit
  // mostra na hora e revalida em background; se miss, fluxo normal de loading.
  useEffect(() => {
    let alive = true;
    const cached2 = cache.get(cacheKey);
    const hit = !!cached2 && Date.now() - cached2.ts < CACHE_TTL_MS;

    if (hit) {
      setData(cached2!.data as T);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
      if (isMountedRef.current) setData(null);
    }
    isMountedRef.current = true;

    fetcherRef
      .current()
      .then((res) => {
        if (!alive) return;
        cache.set(cacheKey, { data: res, ts: Date.now() });
        setData(res);
      })
      .catch((err) => {
        if (!alive) return;
        // SWR: quando já havia dados em cache exibidos (hit), uma falha na
        // revalidação em background NÃO vira tela de erro — mantém os dados
        // (evita "Erro ao carregar" ao abrir uma página já visitada). O erro
        // só aparece na 1ª carga, quando não há nada pra mostrar.
        if (hit) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Effect 2: reload via tick → REFETCH SILENCIOSO (sem limpar data, sem
  // mostrar loading). Evita flicker do banner "Configure WhatsApp" quando
  // chega mensagem nova via SSE. Também atualiza o cache.
  useEffect(() => {
    if (tick === 0) return; // skip primeiro render
    let alive = true;
    setError(null);
    fetcherRef
      .current()
      .then((res) => {
        if (!alive) return;
        cache.set(cacheKey, { data: res, ts: Date.now() });
        setData(res);
      })
      .catch((err) => { if (alive) setError(err instanceof Error ? err : new Error(String(err))); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
