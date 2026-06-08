// Rota /integracoes/fb-callback — landing do OAuth Facebook.
// Recebe ?code=... → posta pra janela pai via window.opener.postMessage e fecha.
// O parent (FacebookBMCard) escuta a mensagem, chama POST /fb-oauth/callback
// pra trocar code por token + lista páginas/contas, e abre o seletor.
import { useEffect } from 'react';

export default function FbCallback() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const errorDesc = url.searchParams.get('error_description');

    const msg = error
      ? { kind: 'fb-oauth-error', error, description: errorDesc }
      : code
        ? { kind: 'fb-oauth-success', code }
        : { kind: 'fb-oauth-error', error: 'no_code' };

    try {
      if (window.opener) {
        window.opener.postMessage(msg, window.location.origin);
      }
    } catch {}
    setTimeout(() => window.close(), 600);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F172A',
        color: '#fff',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div
        style={{
          background: '#1E293B',
          padding: '32px 40px',
          borderRadius: 12,
          textAlign: 'center',
          maxWidth: 380,
          boxShadow: '0 10px 40px rgba(0,0,0,.4)',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Conectado ao Facebook</div>
        <p style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
          Esta janela pode ser fechada — voltando ao VAI Sistema.
        </p>
      </div>
    </div>
  );
}
