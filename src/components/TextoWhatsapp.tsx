// Mostra texto no estilo do WhatsApp: *negrito* e _itálico_ (sem os símbolos).
export function TextoWhatsapp({ texto }: { texto: string }) {
  const partes = String(texto || '').split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return <>{partes.map((p, i) => (/^\*[^*]+\*$/.test(p) ? <strong key={i}>{p.slice(1, -1)}</strong> : /^_[^_]+_$/.test(p) ? <em key={i}>{p.slice(1, -1)}</em> : <span key={i}>{p}</span>))}</>;
}
