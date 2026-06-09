import { useEffect, useMemo, useRef, useState } from 'react';
import { Topbar } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { initials, timeAgo } from '../lib/format';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useSSE } from '../lib/useSSE';
import { humanizeErrorReason } from '../lib/meta-errors';

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
  telefoneLiberado?: boolean;
  classificacao?: string;
  iaAtendendo?: boolean;
  iaRespostasCount?: number;
  iaLimiteAtingido?: boolean;
  origem: string;
  vaiConectado: boolean;
  vaiConvId?: string | null;
  reservado: boolean;
  vip: boolean;
  status: string;
  lastInboundAt?: string | null;
  windowOpen?: boolean;
  _redistribution?: {
    count: number;
    previousCorretorName: string | null;
    redistributedAt: string;
    motivo: string;
  } | null;
  mensagens: Mensagem[];
};

export default function Chat() {
  const [tab, setTab] = useState<Tab>('atendendo');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [liberarOpen, setLiberarOpen] = useState(false);
  const [liberarJustif, setLiberarJustif] = useState('');
  const [liberarSending, setLiberarSending] = useState(false);
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

  // Refetch inbox ao voltar pra aba (resolve banner fantasma "Configure
  // WhatsApp" e estados stales depois de algum tempo fora). Sem polling
  // periódico — o SSE (useSSE abaixo) já atualiza ao vivo via push do
  // backend. Polling redundante causava flicker visual ruim.
  useEffect(() => {
    const onFocus = () => reloadInbox();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reloadInbox]);

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

  const aceitarLead = async () => {
    if (!activeId) return;
    try {
      await Api.leadAceitar(activeId);
      toast.success('Lead aceito — IA pausada, atendimento agora é seu');
      reloadConv();
      reloadInbox();
      setTab('atendendo');
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    }
  };

  const liberarContato = () => {
    if (!activeId) return;
    setLiberarJustif('');
    setLiberarOpen(true);
  };

  const confirmarLiberar = async () => {
    if (!activeId || liberarSending) return;
    setLiberarSending(true);
    try {
      const r = await Api.leadLiberarContato(activeId, liberarJustif.trim() || undefined);
      toast.success(`Telefone liberado: ${r.telefone}`);
      setLiberarOpen(false);
      reloadConv();
      reloadInbox();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setLiberarSending(false);
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
              className={'inbox__tab ' + (tab === 'atendendo' ? 'inbox__tab--active' : '')}
              onClick={() => setTab('atendendo')}
            >
              Atendendo <span className="badge badge--signed">{atendendo.length}</span>
            </div>
            <div
              className={'inbox__tab ' + (tab === 'pendente' ? 'inbox__tab--active' : '')}
              onClick={() => setTab('pendente')}
            >
              Pendente <span className="badge badge--analysis">{pendente.length}</span>
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
                        {conv.telefone || 'Telefone protegido'} · {conv.origem}
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
                    {(conv as any).iaAtendendo && !conv.reservado && !(conv as any).iaLimiteAtingido && (
                      <span className="badge" style={{ background: 'rgba(96,165,250,0.15)', color: 'var(--blue-600)' }}>
                        <Icon name="bot" size={10} /> IA respondendo · {(conv as any).iaRespostasCount || 0}/3
                      </span>
                    )}
                    {(conv as any).iaLimiteAtingido && !conv.reservado && (
                      <span className="badge" style={{ background: 'rgba(245,158,11,0.18)', color: '#B45309' }}>
                        <Icon name="warn" size={10} /> IA esgotou (3/3) — aceite p/ continuar
                      </span>
                    )}
                    {(conv as any).classificacao === 'QUENTE' && (
                      <span className="badge" style={{ background: 'rgba(220,38,38,0.15)', color: '#DC2626' }}>
                        <Icon name="fire" size={10} /> QUENTE
                      </span>
                    )}
                    <Janela24h conv={conv} />
                    {!conv.reservado && (
                      <button className="btn btn--primary btn--sm" onClick={aceitarLead}>
                        <Icon name="check" size={12} /> Aceitar
                      </button>
                    )}
                    {!(conv as any).telefoneLiberado && conv.reservado && (
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={liberarContato}
                        title="Mostra o telefone do lead, marca como QUENTE e contabiliza no seu perfil"
                      >
                        <Icon name="phone" size={12} /> Liberar contato
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
              <BannerRedistribuicao info={(conv as any)._redistribution} />
              <div className="thread__messages" ref={messagesContainerRef}>
                {mensagens.map((m) => (
                  <MessageBubble key={m.id} m={m} />
                ))}
                <div ref={messagesEndRef} />
              </div>
              {!conv?.reservado ? (
                <ComposerPendenteIA
                  onAceitar={aceitarLead}
                  respostasUsadas={(conv as any).iaRespostasCount || 0}
                  limiteAtingido={!!(conv as any).iaLimiteAtingido}
                />
              ) : conv?.windowOpen === false ? (
                <ComposerJanelaFechada
                  onAbrirTemplates={() => setTemplatePickerOpen(true)}
                  hasInbound={!!conv?.lastInboundAt}
                />
              ) : (
                <div className="composer">
                  <button
                    className="btn btn--secondary btn--sm"
                    title="IA responder"
                    onClick={iaResponder}
                    disabled={sending}
                  >
                    IA
                  </button>
                  <button
                    className="btn btn--secondary btn--sm"
                    title="Enviar template Meta aprovado"
                    onClick={() => setTemplatePickerOpen(true)}
                    disabled={sending}
                  >
                    <Icon name="doc" size={14} /> Template
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
              )}
              {templatePickerOpen && conv && (
                <TemplatePickerModal
                  leadId={conv.id}
                  leadName={conv.nome}
                  onClose={() => setTemplatePickerOpen(false)}
                  onSent={() => {
                    setTemplatePickerOpen(false);
                    reloadConv();
                    reloadInbox();
                  }}
                />
              )}
              <Modal
                open={liberarOpen}
                onClose={() => !liberarSending && setLiberarOpen(false)}
                title="Liberar contato do lead"
                subtitle={`O telefone de ${conv?.nome || 'lead'} será exibido pra você. Lead vira QUENTE e contará na sua estatística "leads chamados externamente". Ação auditada.`}
                size="sm"
                footer={
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn--ghost" onClick={() => setLiberarOpen(false)} disabled={liberarSending}>
                      Cancelar
                    </button>
                    <button className="btn btn--primary" onClick={confirmarLiberar} disabled={liberarSending}>
                      {liberarSending ? 'Liberando…' : 'Liberar contato'}
                    </button>
                  </div>
                }
              >
                <label className="field__label" style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>
                  Motivo (opcional)
                </label>
                <textarea
                  className="field__textarea"
                  rows={3}
                  placeholder="Ex: cliente pediu retorno por ligação, vou fechar a proposta"
                  value={liberarJustif}
                  onChange={(e) => setLiberarJustif(e.target.value)}
                  style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
                />
                <p className="text-xs text-secondary" style={{ marginTop: 8 }}>
                  Motivo entra no audit log e na notificação enviada aos admins.
                </p>
              </Modal>
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

// Indicador da janela de 24h da Meta. Backend agora envia `lastInboundAt` e
// `windowOpen` já calculados, mas a gente faz fallback derivando do array de
// mensagens. Tick a cada segundo pra contagem regressiva ao vivo (padrão
// herdado do MODULO-CHAT-CALEBE/WindowBadge).
function Janela24h({ conv }: { conv: any }) {
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const lastInboundAt = conv?.lastInboundAt
    ? new Date(conv.lastInboundAt).getTime()
    : (() => {
        const ms: any[] = conv?.mensagens || [];
        const li = [...ms].reverse().find((m) => m.direction === 'inbound' || m.autor === 'LEAD');
        return li ? new Date(li.createdAt).getTime() : 0;
      })();

  if (!lastInboundAt) {
    return (
      <span
        className="badge"
        style={{ background: 'rgba(148,163,184,0.18)', color: '#64748B' }}
        title="Lead ainda não respondeu — só template Meta pra abrir conversa"
      >
        <Icon name="warn" size={10} /> Sem inbound
      </span>
    );
  }

  const expiry = lastInboundAt + 24 * 60 * 60 * 1000;
  const restante = expiry - tick;
  const aberta = restante > 0;

  if (aberta) {
    const horas = Math.floor(restante / 3_600_000);
    const minutos = Math.floor((restante % 3_600_000) / 60_000);
    const segundos = Math.floor((restante % 60_000) / 1000);
    // Quando faltam < 1h, mostra mm:ss; senão xh ymin
    const txt = horas > 0 ? `${horas}h ${minutos}m` : `${minutos}:${String(segundos).padStart(2, '0')}`;
    return (
      <span
        className="badge"
        style={{ background: 'rgba(34,197,94,0.15)', color: '#16A34A' }}
        title="Janela de 24h aberta — pode enviar texto livre"
      >
        <Icon name="clock" size={10} /> Aberta · {txt}
      </span>
    );
  }

  // Fechada — quantos dias?
  const fechadaHaMs = -restante;
  const dias = Math.floor(fechadaHaMs / 86_400_000);
  return (
    <span
      className="badge"
      style={{ background: 'rgba(245,158,11,0.15)', color: '#D97706' }}
      title="Janela 24h fechada — envie um template HSM pra reabrir"
    >
      <Icon name="warn" size={10} /> Fechada {dias > 0 ? `· ${dias}d` : ''}
    </span>
  );
}

// Banner amarelo mostrando que esta conversa foi recebida via redistribuição.
// Aparece SÓ quando histórico veio junto (lead já tinha respondido) — caso
// contrário o histórico foi descartado e não há por que sinalizar.
function BannerRedistribuicao({ info }: { info: any }) {
  if (!info) return null;
  const data = info.redistributedAt ? new Date(info.redistributedAt).toLocaleDateString('pt-BR') : '—';
  const previo = info.previousCorretorName || 'corretor anterior';
  return (
    <div
      style={{
        background: 'rgba(234,179,8,0.10)',
        color: '#854D0E',
        border: '1px solid rgba(234,179,8,0.30)',
        borderRadius: 8,
        padding: '8px 12px',
        margin: '8px 12px 0',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Icon name="bell" size={14} />
      <span>
        Lead reatribuído a você em {data}. Mensagens anteriores foram enviadas por <b>{previo}</b>.
      </span>
    </div>
  );
}

function StatusTicks({ m }: { m: Mensagem }) {
  if (m.errorReason) {
    const human = humanizeErrorReason(m.errorReason);
    return <span title={human || m.errorReason} style={{ color: 'var(--money-negative)', fontSize: 11 }}>! {human || 'falha'}</span>;
  }
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

// ─── Composer quando janela 24h está fechada ───────────────────────────────
// Texto livre desabilitado; só template Meta aprovado pode reabrir a conversa.
// ─── Composer quando lead ainda está PENDENTE ──────────────────────────────
// A IA cuida do atendimento (limite 3 respostas). Corretor só consegue mandar
// texto após Aceitar. Quando a IA esgota as 3 respostas, o card vira ÂMBAR
// com tom mais urgente — esse lead precisa do humano AGORA.
function ComposerPendenteIA({
  onAceitar,
  respostasUsadas,
  limiteAtingido,
}: {
  onAceitar: () => void;
  respostasUsadas: number;
  limiteAtingido: boolean;
}) {
  const cor = limiteAtingido ? '#B45309' : 'var(--blue-600)';
  const bg = limiteAtingido ? 'rgba(245, 158, 11, 0.10)' : 'rgba(96, 165, 250, 0.06)';
  const border = limiteAtingido ? 'rgba(245, 158, 11, 0.32)' : 'rgba(96, 165, 250, 0.20)';
  const titulo = limiteAtingido
    ? 'IA esgotou as 3 respostas — assume agora'
    : 'IA está atendendo este lead';
  const sub = limiteAtingido
    ? 'Cliente continuou conversando, mas a IA pausou pra evitar respostas mecânicas. Você assume.'
    : `IA respondeu ${respostasUsadas} de 3 vezes. Após o limite, aceite pra continuar.`;
  return (
    <div
      className="composer"
      style={{
        background: bg,
        borderTop: '1px solid ' + border,
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: cor }}>
        <Icon name={limiteAtingido ? 'warn' : 'bot'} size={18} />
        <div style={{ fontSize: 13, lineHeight: 1.4 }}>
          <div style={{ fontWeight: 700 }}>{titulo}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{sub}</div>
        </div>
      </div>
      <button className="btn btn--primary btn--sm" onClick={onAceitar}>
        <Icon name="check" size={14} /> Aceitar lead
      </button>
    </div>
  );
}

function ComposerJanelaFechada({
  onAbrirTemplates,
  hasInbound,
}: {
  onAbrirTemplates: () => void;
  hasInbound: boolean;
}) {
  return (
    <div
      className="composer"
      style={{
        background: 'rgba(245,158,11,0.06)',
        borderTop: '1px solid rgba(245,158,11,0.20)',
        padding: '12px',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92400E' }}>
        <Icon name="warn" size={16} />
        <span style={{ fontSize: 13 }}>
          {hasInbound
            ? 'Janela de 24h fechou. Use um template Meta pra reabrir a conversa.'
            : 'Cliente ainda não respondeu. Use um template Meta pra iniciar a conversa.'}
        </span>
      </div>
      <button className="btn btn--primary btn--sm" onClick={onAbrirTemplates}>
        <Icon name="doc" size={14} /> Escolher template
      </button>
    </div>
  );
}

// ─── Modal de templates: lista + preview WhatsApp Web look + envio ─────────
// Padrão herdado do MODULO-CHAT-CALEBE/PreviewChatV2. Renderiza o texto final
// com os {{1}}, {{2}} substituídos pelos params digitados.
function TemplatePickerModal({
  leadId,
  leadName,
  onClose,
  onSent,
}: {
  leadId: number;
  leadName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const toast = useToast();

  useEffect(() => {
    Api.whatsappTemplates()
      .then((r) => setItems(r.items || []))
      .catch((e) => toast.error('Erro ao carregar templates: ' + e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickTemplate(t: any) {
    setSelected(t);
    const defaults: string[] = [];
    for (let i = 0; i < (t.varCount || 0); i++) {
      if (i === 0) defaults[i] = leadName;
      else defaults[i] = '';
    }
    setParams(defaults);
  }

  function renderPreview(): string {
    if (!selected) return '';
    return String(selected.bodyText || '').replace(/\{\{(\d+)\}\}/g, (_: any, idx: any) => {
      const i = Number(idx) - 1;
      return params[i] || `{{${idx}}}`;
    });
  }

  async function enviar() {
    if (!selected) return;
    setSending(true);
    try {
      await Api.whatsappSendTemplate(leadId, {
        name: selected.name,
        language: selected.language,
        bodyParams: params,
      });
      toast.success('Template enviado.');
      onSent();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || 'falha'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="tpl-modal__backdrop" onClick={onClose}>
      <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tpl-modal__header">
          <div className="tpl-modal__title">
            <Icon name="doc" size={16} /> Templates Meta aprovados
          </div>
          <button
            className="tpl-modal__close"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar (Esc)"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body: 2 colunas (lista + preview) */}
        <div className="tpl-modal__body">
          {/* Lista de templates */}
          <div className="tpl-modal__list">
            {loading ? (
              <div className="tpl-modal__empty">Carregando templates…</div>
            ) : items.length === 0 ? (
              <div className="tpl-modal__empty">
                Nenhum template aprovado encontrado.<br/>
                Configure no WhatsApp Manager e aguarde aprovação Meta (24–48h).
              </div>
            ) : (
              items.map((t) => (
                <div
                  key={t.name + ':' + t.language}
                  className={'tpl-item' + (selected?.name === t.name ? ' tpl-item--active' : '')}
                  onClick={() => pickTemplate(t)}
                >
                  <div className="tpl-item__name">{t.name}</div>
                  <div className="tpl-item__meta">
                    <span>{t.language}</span>
                    <span className="tpl-dot">·</span>
                    <span>{t.category}</span>
                    {t.varCount > 0 && (
                      <>
                        <span className="tpl-dot">·</span>
                        <span>{t.varCount} var{t.varCount > 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                  <div className="tpl-item__body">
                    {(t.bodyText || '').slice(0, 90)}{(t.bodyText || '').length > 90 ? '…' : ''}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Preview + form */}
          <div className="tpl-modal__preview">
            {!selected ? (
              <div className="tpl-modal__placeholder">
                <Icon name="doc" size={40} />
                <div>Selecione um template à esquerda<br/>pra ver o preview e configurar.</div>
              </div>
            ) : (
              <>
                <div className="tpl-preview__label">Pré-visualização · WhatsApp Web</div>
                <div className="tpl-preview__chat">
                  <div className="tpl-preview__bubble">{renderPreview()}</div>
                </div>
                {(selected.varCount || 0) > 0 && (
                  <div className="tpl-preview__params">
                    <div className="tpl-preview__params-title">Parâmetros</div>
                    {Array.from({ length: selected.varCount }).map((_: any, i: number) => (
                      <div key={i} className="field" style={{ marginBottom: 8 }}>
                        <label className="field__label">{`{{${i + 1}}}`}</label>
                        <input
                          type="text"
                          className="field__input"
                          value={params[i] || ''}
                          onChange={(e) => {
                            const next = [...params];
                            next[i] = e.target.value;
                            setParams(next);
                          }}
                          placeholder={i === 0 ? leadName : `Valor da variável ${i + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="tpl-modal__actions">
                  <button className="btn btn--ghost" onClick={onClose} disabled={sending}>
                    Cancelar
                  </button>
                  <button
                    className="btn btn--primary"
                    onClick={enviar}
                    disabled={sending || params.some((p, i) => i < selected.varCount && !String(p).trim())}
                  >
                    {sending ? 'Enviando…' : <><Icon name="send" size={14} /> Enviar template</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
