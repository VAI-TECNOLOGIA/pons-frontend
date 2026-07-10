import { Component, type ReactNode } from 'react';
import { Icon } from './Icon';

interface State {
  hasError: boolean;
  err?: Error;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, err };
  }

  componentDidCatch(err: Error, info: { componentStack?: string }) {
    void reportClientError(err, { componentStack: info.componentStack });
  }

  reset = () => {
    this.setState({ hasError: false, err: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-app)',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 12,
            padding: 32,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#FCE8EA',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              color: '#C70A1A',
            }}
          >
            <Icon name="warn" size={28} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
            Algo deu errado
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary)' }}>
            Tivemos um problema ao carregar essa parte do sistema. O erro foi registrado e nossa
            equipe foi notificada.
          </p>
          {/* Detalhe técnico só em dev — em produção NUNCA expomos a mensagem crua
              do erro pro usuário (ex.: "Cannot read properties of undefined ..."). */}
          {import.meta.env.DEV && this.state.err && (
            <pre
              style={{
                background: 'var(--bg-app)',
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                color: 'var(--text-secondary)',
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: 120,
                margin: '0 0 16px',
              }}
            >
              {this.state.err.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={this.reset} className="btn btn--ghost btn--sm">
              Tentar de novo
            </button>
            <button onClick={() => (window.location.href = '/dashboard')} className="btn btn--primary btn--sm">
              Voltar ao dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export async function reportClientError(
  err: Error,
  context: Record<string, unknown> = {},
) {
  try {
    const payload = {
      message: err?.message || String(err),
      stack: err?.stack,
      name: err?.name,
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...context,
    };
    await fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // swallow — não queremos cascatear erros de telemetria
  }
}

// Listeners globais — captura erros que escapam do React (eventos async, promises).
if (typeof window !== 'undefined') {
  window.addEventListener('error', (ev) => {
    void reportClientError(ev.error || new Error(ev.message), {
      source: 'window.error',
      filename: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
    });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason;
    const err = reason instanceof Error ? reason : new Error(String(reason));
    void reportClientError(err, { source: 'unhandledrejection' });
  });
}
