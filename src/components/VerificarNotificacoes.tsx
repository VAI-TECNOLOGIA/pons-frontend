import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Api } from '../lib/api';
import { Icon } from './Icon';
import './verificar-notificacoes.css';

// Diagnóstico de notificações NO APARELHO (Android, app nativo). Pedido do Elison
// 21/09: "pop-up e vibrou, mas sem som". O plugin lê a permissão e o estado real
// dos canais (importância / som). Mostra o que está errado, o caminho pra ajustar
// no celular e um botão "Testar agora" (push de teste pro próprio aparelho).
//
// Abre: (1) sozinho quando detecta problema; (2) UMA vez após a atualização,
// mesmo sem problema (o corretor confere e testa — modo vibrar o app não lê);
// (3) a qualquer hora pelo atalho "Notificações do celular" no pé do menu
// (evento window 'pons:notificacoes:abrir'). iOS: não mostra nada.

type Estado = {
  permissao: string;
  canal: { encontrado: boolean; importancia: number; som: string | null } | null;
  problemas: string[];
};

const CHAVE_ADIAR = 'pons.notif-check-adiado-ate';
const CHAVE_APRESENTADO = 'pons.notif-check-apresentado';
export const EVENTO_ABRIR = 'pons:notificacoes:abrir';
const CANAIS = ['leads_alerta', 'leads_high'];

async function diagnosticar(): Promise<Estado> {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const perm = await PushNotifications.checkPermissions().catch(() => ({ receive: 'desconhecido' as string }));
  let canal: Estado['canal'] = null;
  try {
    const { channels } = await PushNotifications.listChannels();
    const c = CANAIS.map((id) => channels.find((x) => x.id === id)).find(Boolean);
    if (c) {
      const som = (c as { sound?: string | null }).sound ?? null;
      canal = { encontrado: true, importancia: Number(c.importance ?? 0), som: som && String(som).trim() ? String(som) : null };
    } else {
      canal = { encontrado: false, importancia: 0, som: null };
    }
  } catch { /* plugin antigo sem listChannels: não dá pra ler */ }

  const problemas: string[] = [];
  if (perm.receive !== 'granted') problemas.push('A permissão de notificações está desligada para o Grupo Pons.');
  if (canal?.encontrado) {
    if (canal.importancia < 4) problemas.push('As notificações de lead estão sem destaque (não aparecem como pop-up).');
    if (!canal.som) problemas.push('As notificações de lead estão SEM SOM neste aparelho.');
  }
  return { permissao: String(perm.receive), canal, problemas };
}

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* noop */ } },
};

export function VerificarNotificacoes() {
  const nativoAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  const [estado, setEstado] = useState<Estado | null>(null);
  const [aberto, setAberto] = useState(false);
  const [testando, setTestando] = useState(false);
  const [msgTeste, setMsgTeste] = useState<string | null>(null);

  const adiado = () => Number(ls.get(CHAVE_ADIAR) || 0) > Date.now();

  const rodar = useCallback(async (forcarAbrir = false) => {
    if (!nativoAndroid) return;
    try {
      const e = await diagnosticar();
      setEstado(e);
      if (forcarAbrir) { setAberto(true); return; }
      if (e.problemas.length > 0 && !adiado()) { setAberto(true); return; }
      // Primeira vez após a atualização: mostra uma vez, mesmo sem problema.
      if (!ls.get(CHAVE_APRESENTADO)) { ls.set(CHAVE_APRESENTADO, '1'); setAberto(true); }
    } catch { /* sem plugin: silencioso */ }
  }, [nativoAndroid]);

  useEffect(() => {
    rodar();
    const onVisible = () => { if (document.visibilityState === 'visible') rodar(); };
    const onAbrir = () => { rodar(true); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(EVENTO_ABRIR, onAbrir);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(EVENTO_ABRIR, onAbrir);
    };
  }, [rodar]);

  if (!nativoAndroid || !estado) return null;

  const fechar = () => {
    if (estado.problemas.length > 0) ls.set(CHAVE_ADIAR, String(Date.now() + 24 * 3600 * 1000));
    setAberto(false);
  };

  async function testar() {
    setTestando(true);
    setMsgTeste(null);
    try {
      const r = await Api.pushTest();
      setMsgTeste(r.devicesRegistrados > 0
        ? 'Push de teste enviado para este aparelho. Bloqueie a tela e aguarde alguns segundos: deve aparecer, vibrar e tocar.'
        : 'Este aparelho ainda não está registrado para receber notificações. Feche e reabra o app e tente de novo.');
    } catch {
      setMsgTeste('Não foi possível enviar o teste agora. Tente de novo em instantes.');
    } finally {
      setTestando(false);
    }
  }

  const detalhe = estado.canal
    ? (estado.canal.encontrado
      ? `canal: importância ${estado.canal.importancia} · som: ${estado.canal.som ? 'ativo' : 'nenhum'}`
      : 'canal de lead ainda não criado neste aparelho')
    : 'não foi possível ler o canal';

  if (!aberto) {
    return estado.problemas.length > 0 ? (
      <button type="button" className="vnotif-pill" onClick={() => setAberto(true)} aria-label="Ajustar notificações">
        <Icon name="bell" size={14} /> Notificações precisam de ajuste
      </button>
    ) : null;
  }

  const temProblema = estado.problemas.length > 0;

  return (
    <div className="vnotif" role="dialog" aria-label="Notificações de lead">
      <div className="vnotif__head">
        <Icon name="bell" size={18} />
        <b>{temProblema ? 'Notificações de lead precisam de ajuste' : 'Confira as notificações de lead'}</b>
        <button type="button" className="vnotif__x" onClick={fechar} aria-label="Fechar">&times;</button>
      </div>

      {temProblema ? (
        <ul className="vnotif__lista">
          {estado.problemas.map((p) => <li key={p}>{p}</li>)}
        </ul>
      ) : (
        <p className="vnotif__ok">
          Permissão e canal estão certos neste aparelho. Se mesmo assim o lead chega sem som, é o
          <b> volume de notificações / modo vibrar</b> do celular — o app não consegue ler isso. Siga os passos e teste.
        </p>
      )}

      <div className="vnotif__passos">
        <b>Para ativar som e vibração no celular:</b>
        <ol>
          <li>Suba o <b>volume de notificações</b> (não é o de mídia) e tire do modo vibrar; desligue o <b>Não perturbe</b>.</li>
          <li>Configurações → Apps → <b>Grupo Pons</b> → Notificações → <b>Leads e avisos importantes</b> → ative, com <b>som "Padrão"</b> e <b>vibração</b>, importância alta / pop-up.</li>
          <li>Xiaomi/Redmi: em Notificações do app, ative também <b>"Notificações flutuantes"</b> e <b>"Som"</b>. Samsung: Sons e vibração → Som de notificação não pode estar em "Silencioso".</li>
        </ol>
      </div>

      <div className="vnotif__acoes">
        <button type="button" className="vnotif__btn vnotif__btn--primario" onClick={testar} disabled={testando}>
          {testando ? 'Enviando…' : 'Testar agora'}
        </button>
        <button type="button" className="vnotif__btn" onClick={() => rodar(true)}>Já ajustei, verificar de novo</button>
        <button type="button" className="vnotif__btn vnotif__btn--link" onClick={fechar}>{temProblema ? 'Depois' : 'Fechar'}</button>
      </div>
      {msgTeste && <p className="vnotif__msg">{msgTeste}</p>}
      <p className="vnotif__detalhe">{detalhe} · permissão: {estado.permissao}</p>
    </div>
  );
}
