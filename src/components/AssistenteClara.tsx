// Clara — assistente do Paulo DENTRO do app (pedido Elison 17/10: "tipo ChatGPT",
// por texto e por voz, com personalidade). Mesma cabeça do assessor do WhatsApp:
// agenda (sistema + Google), lembrete no app, demanda para outra pessoa com aviso,
// aviso à equipe (só com SIM) e números da operação. Se ele fala, ela responde em voz.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { Api } from '../lib/api';
import { useToast } from '../lib/toast';
import { isNativeApp, currentPlatform } from '../lib/platform';
import { aoAbrirClara } from '../lib/clara';
import { TextoWhatsapp } from './TextoWhatsapp';
import './clara.css';

type Msg = { id: string | number; de: 'eu' | 'clara'; texto: string; voz?: boolean; em: number };

const SUGESTOES = [
  'O que tenho hoje?',
  'Como estão as vendas do mês?',
  'Marca uma reunião amanhã às 10h com a equipe',
  'Quem lidera o ranking?',
];

const fmtSeg = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function AssistenteClara() {
  const location = useLocation();
  const toast = useToast();
  const [aberta, setAberta] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [carregou, setCarregou] = useState(false);
  const [rascunho, setRascunho] = useState('');
  const [pensando, setPensando] = useState<null | 'ouvindo' | 'pensando'>(null);
  const [gravando, setGravando] = useState(false);
  const [segs, setSegs] = useState(0);
  const [falando, setFalando] = useState<string | number | null>(null);
  const [micOk, setMicOk] = useState(() => !isNativeApp());
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const fonte = useRef<AudioBufferSourceNode | null>(null);

  // App nativo: microfone só nos builds que declaram a permissão (mesma regra do Atendimento).
  useEffect(() => {
    if (!isNativeApp()) return;
    import('@capacitor/app').then(({ App }) => App.getInfo()).then((info) => {
      const build = parseInt(info.build, 10) || 0;
      if (build >= (currentPlatform() === 'ios' ? 11 : 7)) setMicOk(true);
    }).catch(() => {});
  }, []);
  useEffect(() => aoAbrirClara(() => setAberta(true)), []);
  // Com a Clara aberta, o botão flutuante de reportar erro sai da frente do campo.
  useEffect(() => { document.body.classList.toggle('clara-aberta', aberta); return () => document.body.classList.remove('clara-aberta'); }, [aberta]);
  useEffect(() => {
    if (!aberta || carregou) return;
    Api.claraConversa().then((ms) => {
      setMsgs(ms.map((m) => ({ id: m.id, de: m.direcao === 'IN' ? 'eu' : 'clara', texto: m.texto, voz: m.tipo === 'audio', em: new Date(m.createdAt).getTime() })));
      setCarregou(true);
    }).catch(() => setCarregou(true));
  }, [aberta, carregou]);
  useEffect(() => { if (aberta) fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, pensando, aberta]);
  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !gravando) setAberta(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aberta, gravando]);

  // Áudio: o contexto é "destravado" no toque da pessoa; depois a voz da Clara toca sozinha.
  const destravarAudio = () => {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.current.state === 'suspended') audioCtx.current.resume();
    } catch { /* sem áudio: segue só com texto */ }
  };
  const pararVoz = () => { try { fonte.current?.stop(); } catch { /* já parou */ } fonte.current = null; setFalando(null); };
  const tocar = useCallback(async (base64: string, id: string | number) => {
    const ctx = audioCtx.current;
    if (!ctx || !base64) return;
    pararVoz();
    try {
      const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const buf = await ctx.decodeAudioData(bin.buffer.slice(0));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = () => { if (fonte.current === src) { fonte.current = null; setFalando(null); } };
      fonte.current = src;
      setFalando(id);
      src.start();
    } catch { setFalando(null); }
  }, []);

  const juntar = (m: Msg) => setMsgs((cur) => [...cur, m]);
  const enviarTexto = async (txt?: string) => {
    const t = (txt ?? rascunho).trim();
    if (!t || pensando) return;
    destravarAudio();
    pararVoz();
    juntar({ id: `eu-${Date.now()}`, de: 'eu', texto: t, em: Date.now() });
    setRascunho('');
    setPensando('pensando');
    try {
      const r = await Api.claraMensagem(t);
      juntar({ id: `cl-${Date.now()}`, de: 'clara', texto: r.resposta, em: Date.now() });
    } catch (e: any) {
      juntar({ id: `cl-${Date.now()}`, de: 'clara', texto: e?.details?.message || 'Tive um problema agora. Tenta de novo em instantes?', em: Date.now() });
    } finally { setPensando(null); }
  };

  const pararStream = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; if (timer.current) { window.clearInterval(timer.current); timer.current = null; } };
  const comecarGravacao = async () => {
    if (gravando || pensando) return;
    destravarAudio();
    pararVoz();
    if (!navigator.mediaDevices?.getUserMedia) { toast.error('Este navegador não libera o microfone. Abra o sistema no Chrome ou no Safari.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      pedacos.current = [];
      const tipos = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mime = tipos.find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) || '';
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size > 0) pedacos.current.push(e.data); };
      recRef.current = mr;
      mr.start(1000);
      setSegs(0);
      setGravando(true);
      timer.current = window.setInterval(() => setSegs((s) => s + 1), 1000);
    } catch (e: any) {
      pararStream();
      const n = e?.name || '';
      toast.error(n === 'NotAllowedError' ? 'Microfone bloqueado. Libere o microfone para o app nas configurações do celular.' : 'Não consegui usar o microfone agora.');
    }
  };
  const cancelarGravacao = () => {
    const mr = recRef.current;
    if (mr && mr.state !== 'inactive') { mr.onstop = null; mr.stop(); }
    recRef.current = null; pedacos.current = []; pararStream(); setGravando(false); setSegs(0);
  };
  const enviarGravacao = async () => {
    const mr = recRef.current;
    if (!mr) return;
    recRef.current = null;
    destravarAudio();
    const tipo = mr.mimeType || 'audio/webm';
    const blob: Blob = await new Promise((resolve) => {
      mr.onstop = () => resolve(new Blob(pedacos.current, { type: tipo }));
      if (mr.state !== 'inactive') mr.stop(); else resolve(new Blob(pedacos.current, { type: tipo }));
    });
    pararStream();
    setGravando(false);
    if (blob.size < 1200) { toast.info('Áudio muito curto. Segure um pouquinho mais.'); return; }
    const idEu = `eu-${Date.now()}`;
    juntar({ id: idEu, de: 'eu', texto: 'Áudio enviado…', voz: true, em: Date.now() });
    setPensando('ouvindo');
    try {
      const ext = /mp4/.test(tipo) ? 'm4a' : 'webm';
      const r = await Api.claraAudio(blob, `audio.${ext}`);
      setMsgs((cur) => cur.map((m) => (m.id === idEu ? { ...m, texto: r.transcricao || '(áudio)' } : m)));
      const idCl = `cl-${Date.now()}`;
      juntar({ id: idCl, de: 'clara', texto: r.resposta, voz: !!r.audio, em: Date.now() });
      if (r.audio) tocar(r.audio, idCl);
    } catch (e: any) {
      setMsgs((cur) => cur.map((m) => (m.id === idEu ? { ...m, texto: 'Áudio não enviado' } : m)));
      toast.error(e?.message || 'Não consegui enviar o áudio.');
    } finally { setPensando(null); }
  };

  // Limite de 3 minutos por áudio: envia sozinho.
  useEffect(() => { if (gravando && segs >= 180) void enviarGravacao(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [segs, gravando]);

  const ouvir = async (m: Msg) => {
    destravarAudio();
    if (falando === m.id) { pararVoz(); return; }
    setFalando(m.id);
    try { const r = await Api.claraOuvir(m.texto); await tocar(r.audio, m.id); }
    catch { setFalando(null); toast.error('A voz não está disponível agora.'); }
  };
  const novaConversa = async () => {
    pararVoz();
    try { await Api.claraNova(); setMsgs([]); } catch { toast.error('Não consegui começar uma nova conversa.'); }
  };

  const ocultarBotao = location.pathname.startsWith('/chat');

  return (
    <>
      {!aberta && !ocultarBotao && (
        <button className="clara-fab" onClick={() => setAberta(true)} aria-label="Falar com a Ellen, sua assistente">
          <span className="clara-fab__avatar">E</span>
          <span className="clara-fab__txt">Falar com a Ellen</span>
        </button>
      )}
      {aberta && (
        <div className="clara" role="dialog" aria-label="Ellen, sua assistente">
          <header className="clara__topo">
            <span className="clara__avatar">E</span>
            <div className="clara__id">
              <strong>Ellen</strong>
              <span>{pensando === 'ouvindo' ? 'ouvindo seu áudio…' : pensando ? 'pensando…' : gravando ? 'gravando…' : 'sua assistente · agenda, equipe e números'}</span>
            </div>
            <button className="clara__acao" onClick={novaConversa} title="Nova conversa"><Icon name="plus" size={16} /></button>
            <button className="clara__acao" onClick={() => { cancelarGravacao(); pararVoz(); setAberta(false); }} title="Fechar"><Icon name="x" size={18} /></button>
          </header>

          <div className="clara__corpo">
            {carregou && msgs.length === 0 && (
              <div className="clara__vazio">
                <span className="clara__avatar clara__avatar--g">E</span>
                <h3>Oi! Eu sou a Ellen.</h3>
                <p>Fale ou escreva: eu agendo, lembro, passo demandas para a equipe e te conto como estão os números.</p>
                <div className="clara__sugestoes">
                  {SUGESTOES.map((s) => <button key={s} onClick={() => enviarTexto(s)}>{s}</button>)}
                </div>
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={`clara__msg clara__msg--${m.de}`}>
                {m.de === 'eu' && m.voz && <span className="clara__voz"><Icon name="play" size={10} /> áudio</span>}
                <div className="clara__balao"><TextoWhatsapp texto={m.texto} /></div>
                {m.de === 'clara' && (
                  <button className="clara__ouvir" onClick={() => ouvir(m)}>
                    <Icon name={falando === m.id ? 'x' : 'play'} size={11} /> {falando === m.id ? 'Parar' : 'Ouvir'}
                  </button>
                )}
              </div>
            ))}
            {pensando && (
              <div className="clara__msg clara__msg--clara"><div className="clara__balao clara__digitando"><i /><i /><i /></div></div>
            )}
            <div ref={fimRef} />
          </div>

          <footer className="clara__rodape">
            {gravando ? (
              <div className="clara__gravando">
                <button className="clara__cancelar" onClick={cancelarGravacao}>Cancelar</button>
                <span className="clara__rec"><i /> {fmtSeg(segs)}</span>
                <button className="clara__enviar-audio" onClick={enviarGravacao}><Icon name="send" size={16} /> Enviar</button>
              </div>
            ) : (
              <div className="clara__compor">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={rascunho}
                  placeholder="Escreva para a Ellen…"
                  onChange={(e) => { setRascunho(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(140, e.target.scrollHeight)}px`; }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarTexto(); } }}
                />
                {rascunho.trim() ? (
                  <button className="clara__botao" onClick={() => enviarTexto()} disabled={!!pensando} aria-label="Enviar"><Icon name="send" size={18} /></button>
                ) : (
                  <button className="clara__botao clara__botao--mic" onClick={comecarGravacao} disabled={!!pensando || !micOk} aria-label="Falar com a Ellen" title={micOk ? 'Toque para falar' : 'Atualize o app para usar o microfone'}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="17" x2="12" y2="22" /></svg>
                  </button>
                )}
              </div>
            )}
          </footer>
        </div>
      )}
    </>
  );
}
