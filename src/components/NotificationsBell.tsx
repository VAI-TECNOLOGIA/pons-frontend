// Sino de notificações in-app. Lê a tabela Notification (gravada pelos gatilhos
// do backend: lead recebido, venda fora da política → CEO, lead negado → Gestor
// de Tráfego, fases do contrato, comunicados da diretoria…).
// Dois modos: na topbar (PageHeader) e FLUTUANTE (fixo no topo direito de toda
// tela — pedido do Elison 21/09: "um sino na parte superior com a notificação e
// o horário que chegou"). Atualiza: poll 60s, ao abrir, ao voltar pro 1º plano e
// no instante em que chega um push (evento 'pons:notificacoes:atualizar').
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Api } from '../lib/api';
import { Icon } from './Icon';

type Notificacao = {
  id: number;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};

const POLL_MS = 60_000;
export const EVENTO_ATUALIZAR_SINO = 'pons:notificacoes:atualizar';

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

// Horário exato de chegada: "11:37" se foi hoje; "20/09 11:37" se foi outro dia.
function horaChegada(iso: string): string {
  const dt = new Date(iso);
  const hoje = new Date();
  const hm = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const mesmoDia = dt.getDate() === hoje.getDate() && dt.getMonth() === hoje.getMonth() && dt.getFullYear() === hoje.getFullYear();
  return mesmoDia ? hm : `${dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hm}`;
}

export function NotificationsBell({ flutuante = false }: { flutuante?: boolean } = {}) {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [unread, setUnread] = useState(0);
  const [marcando, setMarcando] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await Api.notifications();
      setItens(r.data || []);
      setUnread(r.unread || 0);
    } catch { /* silencioso — sino não pode quebrar a tela */ }
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, POLL_MS);
    // Chegou push (app aberto) ou o app voltou pro primeiro plano → atualiza na hora.
    const onEvento = () => { carregar(); };
    const onVisible = () => { if (document.visibilityState === 'visible') carregar(); };
    window.addEventListener(EVENTO_ATUALIZAR_SINO, onEvento);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      window.removeEventListener(EVENTO_ATUALIZAR_SINO, onEvento);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [carregar]);

  // Fecha o dropdown ao tocar/clicar fora
  useEffect(() => {
    if (!aberto) return;
    const onDown = (e: Event) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [aberto]);

  const abrir = () => {
    const prox = !aberto;
    setAberto(prox);
    if (prox) carregar();
  };

  const marcarTodas = async () => {
    setMarcando(true);
    try {
      await Api.notificationsReadAll();
      await carregar();
    } catch { /* ignore */ } finally {
      setMarcando(false);
    }
  };

  const clicarItem = (n: Notificacao) => {
    setAberto(false);
    let destino = n.link || '';
    // Rota legada: '/atendimento' nunca existiu no router → caía no catch-all e
    // voltava pro login/dashboard. Remapeia pra rota real '/chat' (preservando
    // querystring, ex.: ?lead=123 abre direto a conversa).
    if (destino === '/atendimento' || destino.startsWith('/atendimento?') || destino.startsWith('/atendimento/')) {
      destino = '/chat' + destino.slice('/atendimento'.length);
    }
    if (!destino.startsWith('/')) destino = '/dashboard';
    navigate(destino);
  };

  return (
    <div className={'notif-bell' + (flutuante ? ' notif-bell--flutuante' : '')} ref={wrapRef}>
      <button
        onClick={abrir}
        className={(flutuante ? '' : 'user-chip__theme ') + 'notif-bell__btn'}
        title="Notificações"
        aria-label={unread > 0 ? `Notificações: ${unread} não lidas` : 'Notificações'}
      >
        <Icon name="bell" size={flutuante ? 18 : 16} />
        {unread > 0 && <span className="notif-bell__badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {aberto && (
        <div className="notif-bell__dropdown">
          <div className="notif-bell__head">
            <span className="notif-bell__title">Notificações</span>
            {unread > 0 && (
              <button className="notif-bell__readall" onClick={marcarTodas} disabled={marcando}>
                {marcando ? 'Marcando…' : 'Marcar todas como lidas'}
              </button>
            )}
          </div>
          <div className="notif-bell__list">
            {itens.length === 0 && <div className="notif-bell__empty">Nenhuma notificação por aqui.</div>}
            {itens.map((n) => (
              <button key={n.id} className={`notif-bell__item${n.readAt ? '' : ' notif-bell__item--unread'}`} onClick={() => clicarItem(n)}>
                <div className="notif-bell__item-top">
                  <span className="notif-bell__item-title">{n.title}</span>
                  <span className="notif-bell__item-time" title={new Date(n.createdAt).toLocaleString('pt-BR')}>
                    {horaChegada(n.createdAt)} · {tempoRelativo(n.createdAt)}
                  </span>
                </div>
                {n.body && <div className="notif-bell__item-body">{n.body}</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
