import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../lib/toast';

// Fase D2 — Landing Page pública (sem auth, com pixels integrados)
export default function LPPublica() {
  const { slug } = useParams();
  const [lp, setLp] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetch(`/api/lp/public/${slug}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('LP não encontrada')))
      .then((data) => {
        setLp(data);
        injetarPixels(data.pixels);
      })
      .catch((e) => setErro(e.message));
  }, [slug]);

  const sessionId = useSessionId();

  // Track heatmap (sessão da LP)
  useEffect(() => {
    if (!lp) return;
    const buffer: any[] = [];
    let started = Date.now();

    const flush = () => {
      if (buffer.length === 0) return;
      fetch('/api/heatmap/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventos: buffer.splice(0, buffer.length) }),
      }).catch(() => {});
    };

    const onClick = (e: MouseEvent) => {
      buffer.push({ pagina: location.pathname, sessao: sessionId, tipo: 'CLICK', x: e.clientX, y: e.clientY, viewportW: window.innerWidth, viewportH: window.innerHeight });
      if (buffer.length >= 10) flush();
    };
    const onExit = () => {
      buffer.push({ pagina: location.pathname, sessao: sessionId, tipo: 'EXIT', tempoMs: Date.now() - started });
      flush();
    };
    window.addEventListener('click', onClick);
    window.addEventListener('beforeunload', onExit);
    const interval = setInterval(flush, 5000);
    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('beforeunload', onExit);
      clearInterval(interval);
      onExit();
    };
  }, [lp, sessionId]);

  const submitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviando(true);
    const fd = new FormData(e.currentTarget);
    try {
      const r = await fetch(`/api/site/lp/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: fd.get('nome'),
          telefone: fd.get('telefone'),
          email: fd.get('email'),
          mensagem: fd.get('mensagem'),
        }),
      });
      if (!r.ok) throw new Error('Erro ao enviar');
      setEnviado(true);
      toast.success('Recebemos seu contato!');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (erro) return <div style={pageStyle}><h1>404 — {erro}</h1></div>;
  if (!lp) return <div style={pageStyle}>Carregando…</div>;

  return (
    <div style={pageStyle}>
      {lp.hero && (
        <div style={{
          width: '100%',
          height: '50vh',
          backgroundImage: `url(${lp.hero})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
      )}
      <div style={containerStyle}>
        <h1 style={{ fontSize: 36, fontWeight: 900, color: '#fff', margin: '24px 0 12px' }}>{lp.headline || lp.titulo}</h1>
        {lp.subheadline && <p style={{ fontSize: 18, color: '#ddd', marginBottom: 24 }}>{lp.subheadline}</p>}

        {lp.blocoTexto && (
          <div style={{ fontSize: 15, color: '#eee', lineHeight: 1.6, marginBottom: 32, whiteSpace: 'pre-wrap' }}>{lp.blocoTexto}</div>
        )}

        {!enviado ? (
          <form onSubmit={submitForm} style={cardStyle}>
            <h3 style={{ color: '#fff', marginBottom: 16, fontSize: 18 }}>{lp.cta}</h3>
            <input name="nome" placeholder="Nome completo *" required style={inputStyle} />
            <input name="telefone" placeholder="WhatsApp *" required style={inputStyle} />
            <input name="email" type="email" placeholder="Email" style={inputStyle} />
            <textarea name="mensagem" placeholder="Mensagem (opcional)" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            <button type="submit" disabled={enviando} style={btnStyle}>{enviando ? 'Enviando…' : lp.cta}</button>
            {lp.whatsappNumber && (
              <a
                href={`https://wa.me/${lp.whatsappNumber.replace(/\D/g, '')}`}
                style={{ ...btnStyle, background: '#25D366', display: 'block', textAlign: 'center', marginTop: 8, textDecoration: 'none' }}
                target="_blank"
                rel="noreferrer"
              >Falar no WhatsApp</a>
            )}
          </form>
        ) : (
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <h2 style={{ fontSize: 24, color: '#fff' }}>Obrigado!</h2>
            <p style={{ color: '#ddd', marginTop: 8 }}>Seu contato foi recebido. Um corretor entrará em contato em breve.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #0A1020 0%, #04060C 100%)',
  color: '#fff',
  fontFamily: 'Inter, sans-serif',
};
const containerStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: '0 auto',
  padding: '0 20px 60px',
};
const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 12,
  padding: 24,
  border: '1px solid rgba(255,255,255,0.1)',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  marginBottom: 10,
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 14,
  boxSizing: 'border-box',
};
const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: 14,
  background: '#E10600',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
};

function useSessionId() {
  const [id] = useState(() => {
    const k = 'lp_session_id';
    let v = sessionStorage.getItem(k);
    if (!v) { v = 'sess_' + Math.random().toString(36).slice(2); sessionStorage.setItem(k, v); }
    return v;
  });
  return id;
}

function injetarPixels(pixels: any) {
  if (!pixels) return;
  // Meta Pixel
  if (pixels.meta) {
    const s = document.createElement('script');
    s.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixels.meta}');fbq('track','PageView');`;
    document.head.appendChild(s);
  }
  // GA4
  if (pixels.ga) {
    const ga = document.createElement('script');
    ga.async = true;
    ga.src = `https://www.googletagmanager.com/gtag/js?id=${pixels.ga}`;
    document.head.appendChild(ga);
    const gaInit = document.createElement('script');
    gaInit.text = `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config','${pixels.ga}');`;
    document.head.appendChild(gaInit);
  }
  // GTM
  if (pixels.gtm) {
    const gtm = document.createElement('script');
    gtm.text = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${pixels.gtm}');`;
    document.head.appendChild(gtm);
  }
  // TikTok
  if (pixels.tiktok) {
    const tt = document.createElement('script');
    tt.text = `!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${pixels.tiktok}');ttq.page();}(window, document, 'ttq');`;
    document.head.appendChild(tt);
  }
}
