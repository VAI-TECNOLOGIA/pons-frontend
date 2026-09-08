// Aviso "nova versão disponível". Sair/entrar NÃO recarrega o app — o usuário
// ficava na versão antiga sem saber (Marcelo, 08/09). Compara o bundle em memória
// com o que está publicado (index.html sem cache) e oferece "Atualizar agora".
// Cobre web e o app nativo (o Capacitor carrega a mesma URL remota).
import { useEffect, useState } from 'react';

const INTERVALO_MS = 5 * 60 * 1000;   // checa a cada 5 min
const SONECA_MS = 30 * 60 * 1000;     // "Depois" esconde por 30 min
const KEY_SONECA = 'pons.atualizacao.soneca';

function bundleAtual(): string | null {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return s?.getAttribute('src') || null;
}

async function bundlePublicado(): Promise<string | null> {
  try {
    const r = await fetch(`/index.html?_=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

export function AtualizacaoBanner() {
  const [nova, setNova] = useState(false);

  useEffect(() => {
    const atual = bundleAtual();
    if (!atual) return; // dev server (sem bundle hasheado) — não checa
    let parado = false;
    const verificar = async () => {
      if (parado || document.visibilityState !== 'visible') return;
      try {
        const soneca = Number(sessionStorage.getItem(KEY_SONECA) || '0');
        if (Date.now() < soneca) return;
      } catch { /* sem storage */ }
      const pub = await bundlePublicado();
      if (pub && pub !== atual) setNova(true);
    };
    const id = setInterval(verificar, INTERVALO_MS);
    const onVis = () => { if (document.visibilityState === 'visible') verificar(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', verificar);
    return () => { parado = true; clearInterval(id); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', verificar); };
  }, []);

  if (!nova) return null;

  const atualizar = () => window.location.reload();
  const depois = () => {
    try { sessionStorage.setItem(KEY_SONECA, String(Date.now() + SONECA_MS)); } catch { /* ignore */ }
    setNova(false);
  };

  return (
    <div role="status" style={{
      position: 'fixed', left: '50%', bottom: 18, transform: 'translateX(-50%)', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12,
      background: 'var(--bg-elevated, #111827)', color: 'var(--text-primary, #f3f4f6)',
      border: '1px solid var(--border, rgba(255,255,255,0.12))', boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
      maxWidth: 'calc(100vw - 24px)',
    }}>
      <span style={{ fontSize: 13 }}>Nova versão do sistema disponível.</span>
      <button className="btn btn--primary btn--sm" onClick={atualizar}>Atualizar agora</button>
      <button className="btn btn--ghost btn--sm" onClick={depois} title="Lembrar em 30 minutos">Depois</button>
    </div>
  );
}
