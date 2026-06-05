import { useEffect, useMemo, useRef, useState } from 'react';
import { Topbar } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { initials, timeAgo } from '../lib/format';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useSSE } from '../lib/useSSE';

import './chat.css';

type Tab = 'pendente' | 'atendendo';

type Mensagem = {
  id: number;
  autor: 'LEAD' | 'IA' | 'CORRETOR' | 'SISTEMA';
  texto: string;
  direction?: 'inbound' | 'outbound';
  contentType?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  vaiMessageId?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  errorReason?: string | null;
  createdAt: string;
};

type ConversationDetail = {
  id: number;
  nome: string;
  telefone: string | null;
  telefoneOculto: boolean;
  origem: string;
  vaiConectado: boolean;
  vaiConvId?: string | null;
  reservado: boolean;
  vip: boolean;
  status: string;
  mensagens: Mensagem[];
};

export default function Chat() {
  const [tab, setTab] = useState<Tab>('pendente');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { data: inbox, reload: reloadInbox } = useApi<any>(() => Api.conversations());
  const { data: empreendimentos } = useApi<any[]>(() => Api.empreendimentos());
  const { data: conv, reload: reloadConv } = useApi<ConversationDetail>(
    () => (activeId ? Api.conversationGet(activeId) : Promise.resolve(null as any)),
    [activeId],
  );

  const toast = useToast();

  const pendente: any[] = inbox?.pendente || [];
  const atendendo: any[] = inbox?.atendendo || [];
  const vaiConfigured: boolean = !!inbox?.vaiConfigured;
  const metaConfigured: boolean = !!inbox?.metaConfigured;
  const anyConfigured = vaiConfigured || metaConfigured;
  const lista = tab === 'pendente' ? pendente : atendendo;
  const mensagens: Mensagem[] = conv?.mensagens || [];

  // Auto-scroll ao receber novas mensagens: rola direto via scrollTop (mais robusto
  // que scrollIntoView dentro de overflow:auto). Depende do id da última msg pra
  // capturar caso o length não muda mas o conteúdo sim. Sem smooth: smooth chega
  // depois da próxima msg em conversas movimentadas e dá efeito de "quebrar".
  const lastMsgId = mensagens.length ? mensagens[mensagens.length - 1]?.id : null;
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastMsgId, activeId]);

  // Sync sob demanda ao abrir uma conversa com binding VAI
  useEffect(() => {
    if (!activeId || !conv?.vaiConvId) return;
    setSyncing(true);
    Api.conversationSync(activeId)
      .catch(() => {})
      .finally(() => {
        setSyncing(false);
        reloadConv();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, conv?.vaiConvId]);

  // SSE — atualizações ao vivo
  useSSE(
    {
      'message.inbound': (d: any) => {
        if (d.leadId === activeId) reloadConv();
        reloadInbox();
      },
      'message.outbound': (d: any) => {
        if (d.leadId === activeId) reloadConv();
        reloadInbox();
      },
      'message.status': (d: any) => {
        if (d.leadId === activeId) reloadConv();
      },
      'conv.created': () => reloadInbox(),
      'conv.messages_ingested': (d: any) => {
        if (d.leadId === activeId) reloadConv();
        reloadInbox();
      },
    },
    [activeId],
  );

  const enviar = async () => {
    if (!activeId || !draft.trim() || sending) return;
    const texto = draft.trim();
    setDraft('');
    setSending(true);
    try {
      const r = await Api.conversationSend(activeId, texto, 'CORRETOR');
      if (r.delivery === 'simulado') {
        if (!anyConfigured) toast.info('Mensagem registrada — configure Meta ou VAI pra enviar de verdade.');
        else toast.info('Mensagem registrada em modo simulado.');
      } else if (r.delivery === 'falha') {
        toast.error(`Falha no envio (${r.canal}). Mensagem registrada localmente.`);
      }
      // Sucesso silencioso — SSE atualiza a UI
      reloadConv();
      reloadInbox();
    } catch (err: any) {
      setDraft(texto);
      toast.error('Erro ao enviar: ' + (err?.message || 'falha'));
    } finally {
      setSending(false);
    }
  };

  const iaResponder = async () => {
    if (!activeId) return;
    try {
      await Api.leadIaResponder(activeId);
      reloadConv();
    } catch (err: any) {
      toast.error('Erro IA: ' + (err?.message || 'falha'));
    }
  };

  const ativarNegociacao = async () => {
    if (!activeId) return;
    try {
      const r: any = await Api.leadAtivarNegociacao(activeId);
      toast.success(`Negociação ativada · telefone: ${r?.telefone || '—'}`);
      reloadConv();
      reloadInbox();
      setTab('atendendo');
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    }
  };

  const enviarImovel = async (nome: string) => {
    if (!activeId) return;
    setDraft(
      `Olha esse empreendimento que separei pra você: *${nome}*. Posso te enviar a tabela e as plantas?`,
    );
  };

  const sincronizar = async () => {
    if (!activeId || syncing) return;
    setSyncing(true);
    try {
      const r = await Api.conversationSync(activeId);
      if (r.importados > 0) toast.success(`${r.importados} mensagens importadas`);
      else toast.info('Conversa atualizada.');
      reloadConv();
    } catch (err: any) {
      const status = err?.status;
      if (status === 503) toast.info('VAI não configurado.');
      else if (status === 409) toast.info('Conversa ainda sem binding VAI. Aguarde o lead responder.');
      else toast.error('Sync falhou: ' + (err?.message || 'erro'));
    } finally {
      setSyncing(false);
    }
  };

  const headerRight = useMemo(() => {
    const label = metaConfigured && vaiConfigured
      ? 'Meta + VAI conectados'
      : metaConfigured
        ? 'WhatsApp Meta conectado'
        : vaiConfigured
          ? 'WhatsApp VAI conectado'
          : null;
    return (
      <span className="text-sm text-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {anyConfigured ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-success-border)' }}>
            <Icon name="checkCircle" size={14} /> {label}
          </span>
        ) : (
          <a
            href="/configuracoes?secao=integracoes"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--pons-accent-red)', textDecoration: 'none' }}
          >
            <Icon name="warn" size={14} /> Configure WhatsApp (Meta ou VAI)
          </a>
        )}
      </span>
    );
  }, [vaiConfigured, metaConfigured, anyConfigured]);

  return (
    <>
      <Topbar title="Atendimento" right={headerRight} />

      <div className={'inbox ' + (activeId ? 'inbox--thread-open' : '')}>
        <div className="inbox__list">
          <div className="inbox__tabs">
            <div
              className={'inbox__tab ' + (tab === 'pendente' ? 'inbox__tab--active' : '')}
              onClick={() => setTab('pendente')}
            >
              Pendente <span className="badge badge--analysis">{pendente.length}</span>
            </div>
            <div
              className={'inbox__tab ' + (tab === 'atendendo' ? 'inbox__tab--active' : '')}
              onClick={() => setTab('atendendo')}
            >
              Atendendo <span className="badge badge--signed">{atendendo.length}</span>
            </div>
          </div>

          {lista.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
              {tab === 'pendente'
                ? 'Nenhum lead pendente. A IA está cuidando.'
                : 'Nenhum lead em atendimento ativo ainda.'}
            </div>
          ) : (
            lista.map((c: any) => (
              <div
                className={'conv ' + (c.id === activeId ? 'conv--active' : '')}
                key={c.id}
                onClick={() => setActiveId(c.id)}
              >
                <div className="avatar avatar--sm">{initials(c.nome)}</div>
                <div className="conv__main">
                  <div className="conv__name">
                    <span>
                      {c.nome}
                      {c.vip && <Icon name="star" size={11} style={{ marginLeft: 4, color: '#EAB308', verticalAlign: 'middle' }} />}
                      {c.vaiConectado && (
                        <span title="WhatsApp ativo" style={{ marginLeft: 4, color: 'var(--color-success-border)', display: 'inline-flex', alignItems: 'center' }}>
                          <Icon name="circle" size={8} />
                        </span>
                      )}
                    </span>
                    <span className="conv__time">
                      {c.ultimaMensagem ? timeAgo(c.ultimaMensagem.createdAt) : timeAgo(c.createdAt)}
                    </span>
                  </div>
                  <div className="conv__last">
                    {c.ultimaMensagem ? (
                      <>
                        {c.ultimaMensagem.direction === 'outbound' && (
                          <Icon name="arrowRight" size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                        )}
                        {(c.ultimaMensagem.texto || '').slice(0, 40)}
                      </>
                    ) : (
                      c.origem + ' · ' + (c.interesse || '—')
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="thread">
          {!conv ? (
            <div className="empty-thread">
              <Icon name="chat" size={48} style={{ color: 'var(--gray-300)' }} />
              <div>Selecione uma conversa</div>
            </div>
          ) : (
            <>
              <div className="thread__header">
                <div className="flex-between">
                  <div className="flex gap-3" style={{ alignItems: 'center' }}>
                    <button
                      className="thread__back"
                      onClick={() => setActiveId(null)}
                      title="Voltar para a lista"
                      aria-label="Voltar"
                    >
                      <Icon name="arrow_left" size={16} />
                    </button>
                    <div className="avatar">{initials(conv.nome)}</div>
                    <div>
                      <div className="font-bold">
                        {conv.nome} {conv.vip && <Icon name="star" size={12} style={{ color: '#EAB308', verticalAlign: 'middle' }} />}
                      </div>
                      <div className="text-xs text-secondary">
                        {conv.reservado
                          ? `${conv.telefone || '—'} · ${conv.origem}`
                          : `Telefone protegido — ative a negociação para liberar · ${conv.origem}`}
                        {conv.vaiConectado && ' · WhatsApp ativo'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2" style={{ alignItems: 'center' }}>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={sincronizar}
                      disabled={syncing}
                      title="Buscar mensagens novas na VAI"
                    >
                      <Icon name="speed" size={14} /> {syncing ? 'Sincronizando…' : 'Sync'}
                    </button>
                    <span className={'badge ' + (conv.reservado ? 'badge--signed' : 'badge--analysis')}>
                      {conv.reservado ? 'ATENDENDO' : 'PENDENTE'}
                    </span>
                    {!conv.reservado && (
                      <button className="btn btn--primary btn--sm" onClick={ativarNegociacao}>
                        Ativar Negociação
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="thread__tools">
                <span className="text-xs text-secondary" style={{ fontWeight: 700 }}>
                  Enviar imóvel:
                </span>
                {(empreendimentos || []).map((e: any) => (
                  <button className="imovel-chip" key={e.id} onClick={() => enviarImovel(e.nome)}>
                    {e.nome}
                  </button>
                ))}
              </div>
              <div className="thread__messages" ref={messagesContainerRef}>
                {mensagens.map((m) => (
                  <MessageBubble key={m.id} m={m} />
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="composer">
                <button
                  className="btn btn--secondary btn--sm"
                  title="IA responder"
                  onClick={iaResponder}
                  disabled={sending}
                >
                  IA
                </button>
                <textarea
                  placeholder="Escreva como corretor…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      enviar();
                    }
                  }}
                  disabled={sending}
                />
                <button className="btn btn--primary" onClick={enviar} disabled={sending || !draft.trim()}>
                  {sending ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function MessageBubble({ m }: { m: Mensagem }) {
  if (m.autor === 'SISTEMA') {
    return <div className="bubble bubble--SISTEMA">{m.texto}</div>;
  }
  const who = m.autor === 'IA' ? 'SDR Pons IA' : m.autor === 'CORRETOR' ? 'Você' : 'Lead';
  const isOutbound = m.direction === 'outbound' || m.autor === 'CORRETOR' || m.autor === 'IA';
  return (
    <div className={`bubble bubble--${m.autor}`}>
      <MessageBody m={m} />
      <div className="bubble__meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span>
          {who} · {timeAgo(m.createdAt)}
        </span>
        {isOutbound && <StatusTicks m={m} />}
      </div>
    </div>
  );
}

function MessageBody({ m }: { m: Mensagem }) {
  const ct = (m.contentType || 'text').toLowerCase();
  if (ct === 'image' && m.fileUrl) {
    return (
      <div>
        <a href={m.fileUrl} target="_blank" rel="noopener" style={{ display: 'block' }}>
          <img
            src={m.fileUrl}
            alt={m.fileName || 'imagem'}
            style={{ maxWidth: 240, borderRadius: 8, display: 'block' }}
          />
        </a>
        {m.texto && <div style={{ marginTop: 4 }}>{m.texto}</div>}
      </div>
    );
  }
  if (ct === 'audio' && m.fileUrl) {
    return <audio src={m.fileUrl} controls preload="none" style={{ maxWidth: 260 }} />;
  }
  if (ct === 'video' && m.fileUrl) {
    return <video src={m.fileUrl} controls preload="none" style={{ maxWidth: 280, borderRadius: 8 }} />;
  }
  if ((ct === 'document' || ct === 'file') && m.fileUrl) {
    return (
      <a
        href={m.fileUrl}
        target="_blank"
        rel="noopener"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'inherit' }}
      >
        <Icon name="doc" size={14} /> {m.fileName || 'Anexo'}
      </a>
    );
  }
  return <>{m.texto}</>;
}

function StatusTicks({ m }: { m: Mensagem }) {
  if (m.errorReason) return <span title={m.errorReason} style={{ color: 'var(--money-negative)', fontSize: 11 }}>! falha</span>;
  if (m.readAt) {
    return (
      <span title={`Lido às ${new Date(m.readAt).toLocaleTimeString()}`} style={{ color: 'var(--text-link)', display: 'inline-flex' }}>
        <Icon name="check" size={11} /><Icon name="check" size={11} style={{ marginLeft: -5 }} />
      </span>
    );
  }
  if (m.deliveredAt) return (
    <span title="Entregue" style={{ opacity: 0.7, display: 'inline-flex' }}>
      <Icon name="check" size={11} /><Icon name="check" size={11} style={{ marginLeft: -5 }} />
    </span>
  );
  if (m.vaiMessageId) return <span title="Enviado" style={{ opacity: 0.5 }}><Icon name="check" size={11} /></span>;
  return <span title="Aguardando envio" style={{ opacity: 0.4 }}><Icon name="clock" size={11} /></span>;
}
