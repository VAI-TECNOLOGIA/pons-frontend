import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { APP_STORE_URL, PLAY_STORE_URL } from '../lib/appLinks';

// QR code gerado no navegador (lib carregada só quando o modal abre).
function Qr({ url, label }: { url: string; label: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let vivo = true;
    import('qrcode')
      .then((m) => m.toDataURL(url, { margin: 1, width: 168, color: { dark: '#121214', light: '#ffffff' } }))
      .then((d) => { if (vivo) setSrc(d); })
      .catch(() => { /* sem QR: o botão de link continua funcionando */ });
    return () => { vivo = false; };
  }, [url]);
  return src ? <img src={src} width={168} height={168} alt={`QR Code: ${label}`} style={{ borderRadius: 8, background: '#fff' }} /> : <div style={{ width: 168, height: 168 }} aria-hidden />;
}

export function AppsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const itens = [
    { nome: 'Android', loja: 'Google Play', url: PLAY_STORE_URL },
    { nome: 'iPhone', loja: 'App Store', url: APP_STORE_URL },
  ];
  return (
    <Modal open={open} onClose={onClose} title="Aplicativo Grupo Pons" subtitle="Aponte a câmera do celular para o QR Code ou use o botão." size="md">
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        {itens.map((i) => (
          <div key={i.nome} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <strong>{i.nome}</strong>
            {open && <Qr url={i.url} label={i.loja} />}
            <a className="btn btn--secondary btn--sm" href={i.url} target="_blank" rel="noopener noreferrer">Baixar na {i.loja}</a>
          </div>
        ))}
      </div>
    </Modal>
  );
}
