// Sino de notificações in-app da topbar. Lê a tabela Notification (gravada pelos
// gatilhos do backend: venda fora da política → CEO, lead negado → Gestor de
// Tráfego, fases do contrato → corretor titular…) que antes só era visível no
// painel DEV. Poll leve a cada 60s + refresh ao abrir o dropdown.
import { useEffect, useRef, useState } from 'react';
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

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function NotificationsBell() {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [unread, setUnread] = useState(0);
  const [marcando, setMarcando] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const carregar = async () => {
    try {
      const r = await Api.notifications();
      setItens(r.data || []);
      setUnread(r.unread || 0);
    } catch { /* silencioso — sino não pode quebrar a topbar */ }
  };

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
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
    <div className="notif-bell" ref={wrapRef}>
      <button
        onClick={abrir}
        className="user-chip__theme notif-bell__btn"
        title="Notificações"
        aria-label="Notificações"
      >
        <Icon name="bell" size={16} />
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
                  <span className="notif-bell__item-time">{tempoRelativo(n.createdAt)}</span>
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
