// Hook para Server-Sent Events autenticado. Reconecta automaticamente com
// backoff exponencial e expõe um pequeno bus de eventos por nome.
//
// Uso:
//   useSSE({
//     'message.inbound': (d) => { ... },
//     'message.outbound': (d) => { ... },
//     'message.status': (d) => { ... },
//   });
//
// Quando o usuário desloga (Auth.token vira null), o stream fecha sozinho.

import { useEffect, useRef } from 'react';
import { Auth } from './auth';
import { streamUrl } from './api';

type Handler = (data: any) => void;
type HandlerMap = Record<string, Handler>;

export function useSSE(handlers: HandlerMap, deps: unknown[] = []) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!Auth.token) return;
    let es: EventSource | null = null;
    let retryMs = 1_000;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled || !Auth.token) return;
      es = new EventSource(streamUrl(Auth.token));

      es.addEventListener('open', () => {
        retryMs = 1_000;
      });

      // Bind cada evento conhecido
      for (const name of Object.keys(handlersRef.current)) {
        es.addEventListener(name, (ev: MessageEvent) => {
          try {
            const data = JSON.parse(ev.data);
            handlersRef.current[name]?.(data);
          } catch (err) {
            console.warn('[sse] failed to parse', name, err);
          }
        });
      }

      es.addEventListener('error', () => {
        es?.close();
        if (cancelled) return;
        reconnectTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 30_000);
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
