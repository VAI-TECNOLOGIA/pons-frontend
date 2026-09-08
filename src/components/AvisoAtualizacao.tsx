// Aviso de atualização do sistema (padrão Breakr, pedido Elison 08/09).
// A cada release, public/versao.json ganha nova `versao` + novidades. O front
// busca (sem cache) no boot, a cada 5 min, ao focar e ao voltar pro app; se a
// versão mudou desde a última vista NESTE navegador, mostra a pílula "Sistema
// atualizado" → modal com o que mudou. Se o build em memória ficou pra trás do
// publicado (deploy com a aba aberta), oferece "Atualizar agora": limpa caches
// (CacheStorage + service worker) e recarrega. Login/dados NÃO são apagados.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Auth } from '../lib/auth';

interface Novidade { titulo: string; itens: string[] }
interface VersaoInfo { versao: string; data?: string; novidades: Novidade[] }

const CHAVE_VISTA = 'pons.versao-vista';
const INTERVALO_MS = 5 * 60 * 1000;
const ROTAS_PUBLICAS = ['/', '/login', '/redefinir-senha', '/privacidade', '/termos', '/excluir-conta', '/excluir-dados', '/painel-tv'];

function bundleAtual(): string | null {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return s?.getAttribute('src') || null;
}
async function bundlePublicado(): Promise<string | null> {
  try {
    const r = await fetch(`/index.html?_=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const m = (await r.text()).match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
    return m ? m[0] : null;
  } catch { return null; }
}

// "Atualizar agora": limpa o que segura versão velha e recarrega. Mantém login.
export async function atualizarSistema() {
  try { if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k); } catch { /* ignore */ }
  try { if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch { /* ignore */ }
  try { sessionStorage.removeItem('pons.chunkReloadAt'); } catch { /* ignore */ }
  window.location.reload();
}

export function AvisoAtualizacao() {
  const loc = useLocation();
  const [info, setInfo] = useState<VersaoInfo | null>(null);
  const [temNovidade, setTemNovidade] = useState(false);
  const [buildAtrasado, setBuildAtrasado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const versaoCarregada = useRef<string | null>(null);
  const chunkCarregado = useRef<string | null>(null);

  const buscar = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const r = await fetch(`/versao.json?t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) {
        const nova: VersaoInfo = await r.json();
        if (nova?.versao) {
          setInfo(nova);
          if (versaoCarregada.current === null) versaoCarregada.current = nova.versao;
          let vista: string | null = null;
          try { vista = localStorage.getItem(CHAVE_VISTA); } catch { /* ignore */ }
          if (vista === null) {
            try { localStorage.setItem(CHAVE_VISTA, nova.versao); } catch { /* ignore */ }
          } else if (vista !== nova.versao) {
            setTemNovidade(true);
          }
          if (versaoCarregada.current !== nova.versao) setBuildAtrasado(true);
        }
      }
    } catch { /* silencioso */ }
    // Deploy sem mudar o versao.json: compara o bundle em memória com o publicado.
    if (chunkCarregado.current) {
      const pub = await bundlePublicado();
      if (pub && pub !== chunkCarregado.current) setBuildAtrasado(true);
    }
  }, []);

  useEffect(() => {
    chunkCarregado.current = bundleAtual();
    buscar();
    const t = window.setInterval(buscar, INTERVALO_MS);
    const onVis = () => { if (document.visibilityState === 'visible') buscar(); };
    window.addEventListener('focus', buscar);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearInterval(t); window.removeEventListener('focus', buscar); document.removeEventListener('visibilitychange', onVis); };
  }, [buscar]);

  if (!Auth.token || ROTAS_PUBLICAS.includes(loc.pathname) || loc.pathname.startsWith('/lp')) return null;
  const mostrar = temNovidade || buildAtrasado;
  if (!mostrar || !info) return null;

  const marcarVisto = () => {
    try { localStorage.setItem(CHAVE_VISTA, info.versao); } catch { /* ignore */ }
    setTemNovidade(false);
    setAberto(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title={`Ver o que mudou · versão ${info.versao}`}
        style={{
          position: 'fixed', right: 24, bottom: 84, zIndex: 8000,
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999,
          background: 'var(--bg-elevated, #111827)', color: 'var(--text-primary, #f3f4f6)',
          border: '1px solid var(--border, rgba(255,255,255,0.14))', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
        }}
      >
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: '#52f7fe', boxShadow: '0 0 0 3px rgba(82,247,254,0.25)' }} />
        {buildAtrasado ? 'Nova versão disponível' : 'Sistema atualizado'}
      </button>
      {aberto && createPortal(
        <div role="dialog" aria-label="Atualizações do sistema" onClick={(e) => { if (e.target === e.currentTarget) marcarVisto(); }}
          style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 480, maxHeight: '82vh', overflowY: 'auto', background: 'var(--bg-elevated, #111827)', color: 'var(--text-primary, #f3f4f6)', border: '1px solid var(--border, rgba(255,255,255,0.14))', borderRadius: 14, padding: 22, boxShadow: '0 18px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#52f7fe" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>{buildAtrasado ? 'Nova versão disponível' : 'Sistema atualizado'}</h3>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 12, opacity: 0.7 }}>versão {info.versao}{info.data ? ` · ${info.data}` : ''}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {info.novidades.map((n, i) => (
                <div key={i}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{n.titulo}</div>
                  <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {n.itens.map((it, j) => <li key={j} style={{ fontSize: 12.5, lineHeight: 1.5, opacity: 0.85 }}>{it}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
              {buildAtrasado && (
                <button type="button" className="btn btn--primary btn--sm" onClick={() => { marcarVisto(); atualizarSistema(); }} title="Limpa o cache e recarrega com a versão nova">
                  Atualizar agora
                </button>
              )}
              <button type="button" className="btn btn--ghost btn--sm" onClick={marcarVisto}>{buildAtrasado ? 'Depois' : 'Entendi'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
