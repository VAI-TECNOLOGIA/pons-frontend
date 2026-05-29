import { useEffect, useState } from 'react';
import { Api, streamUrl } from '../lib/api';
import { Auth } from '../lib/auth';

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ OVERLAY DE EVENTO TV — animação celebração (Fase A4)                     ║
// ╠══════════════════════════════════════════════════════════════════════════╣
// ║ Conecta no SSE em event=tv.event e mostra fullscreen overlay durante 6s: ║
// ║   • VENDA_FECHADA      → carro + fogos + confetes + som                  ║
// ║   • CONTRATO_ASSINADO  → notificação destaque                            ║
// ║                                                                          ║
// ║ Som via Audio API simples (tom comemorativo curto). Confetes em CSS.     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

type Evento = {
  id: number;
  tipo: string;
  titulo: string;
  subtitulo?: string | null;
  payload?: any;
};

export function TvEventoOverlay() {
  const [evento, setEvento] = useState<Evento | null>(null);

  useEffect(() => {
    // Painel TV abre sem login às vezes — só conecta SSE se houver token
    const token = Auth.token;
    if (!token) {
      // Fallback: polling a cada 10s
      const t = setInterval(async () => {
        try {
          const evs = await Api.painelTvEventos({ limite: 1 });
          if (evs && evs[0] && evs[0].id !== (evento?.id || 0)) tocar(evs[0]);
        } catch {}
      }, 10_000);
      return () => clearInterval(t);
    }

    const url = streamUrl(token);
    const es = new EventSource(url, { withCredentials: false });
    es.addEventListener('tv.event', (e: any) => {
      try { tocar(JSON.parse(e.data)); } catch {}
    });
    return () => es.close();
  }, []);

  function tocar(ev: Evento) {
    setEvento(ev);
    bipComemoracao();
    setTimeout(() => setEvento(null), 6000);
  }

  if (!evento) return null;

  const isVenda = evento.tipo === 'VENDA_FECHADA';

  return (
    <div className="tv-event-overlay" style={overlayStyle}>
      {isVenda && <Confetes />}
      <div style={cardStyle}>
        {isVenda && <CarroAnim />}
        <div style={{ fontSize: 64, fontWeight: 900, color: '#fff', textShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
          {isVenda ? '🚗💨🎆' : '✍️📜'}
        </div>
        <div style={{ fontSize: 42, fontWeight: 800, color: '#fff', marginTop: 12, textAlign: 'center' }}>
          {evento.titulo}
        </div>
        {evento.subtitulo && (
          <div style={{ fontSize: 22, color: '#FFD700', marginTop: 8, fontWeight: 600 }}>
            {evento.subtitulo}
          </div>
        )}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'radial-gradient(circle at center, rgba(229, 6, 0, 0.85), rgba(0, 0, 0, 0.95))',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  animation: 'tvEventFadeIn 300ms ease',
  pointerEvents: 'none',
};

const cardStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: 48, animation: 'tvEventScale 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
};

function CarroAnim() {
  return (
    <div style={{ position: 'absolute', bottom: '20%', left: '-200px', animation: 'tvEventCar 5s linear forwards', fontSize: 96 }}>
      🏎️💨
    </div>
  );
}

function Confetes() {
  const cores = ['#E10600', '#FFD700', '#88C559', '#5D8FE0', '#F2B544', '#fff'];
  return (
    <>
      {Array.from({ length: 60 }).map((_, i) => (
        <span key={i} style={{
          position: 'absolute',
          left: `${Math.random() * 100}%`,
          top: '-20px',
          width: 10, height: 14,
          background: cores[i % cores.length],
          opacity: 0.9,
          animation: `tvEventConfetti ${2 + Math.random() * 3}s linear ${Math.random() * 0.5}s forwards`,
          transform: `rotate(${Math.random() * 360}deg)`,
        }} />
      ))}
    </>
  );
}

// Bip comemorativo simples via WebAudio (sem precisar de arquivo mp3)
function bipComemoracao() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const notas = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notas.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
      o.start(ctx.currentTime + i * 0.12);
      o.stop(ctx.currentTime + i * 0.12 + 0.3);
    });
  } catch {}
}
