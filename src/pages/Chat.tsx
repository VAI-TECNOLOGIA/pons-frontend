import { useEffect, useMemo, useRef, useState } from 'react';
import { Topbar } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { initials, timeAgo } from '../lib/format';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useSSE } from '../lib/useSSE';
import { humanizeErrorReasonFull } from '../lib/meta-errors';

import './chat.css';

type Tab = 'pendente' | 'atendendo';

// Respostas rápidas padrão do atendimento (corretor insere e revisa antes de enviar).
const RESPOSTAS_RAPIDAS = [
  'Olá! Aqui é da Grupo Pons Imobiliário. Como posso te ajudar?',
  'Você procura imóvel para morar ou para investir?',
  'Qual região te interessa — Itapema, Porto Belo ou Balneário Camboriú?',
  'Posso te enviar a *tabela de valores* e as *plantas*. Pode ser?',
  'Consigo agendar uma visita. Qual o melhor dia e horário pra você?',
  'Esse imóvel tem ótima procura. Quer que eu reserve um horário pra te apresentar?',
  'Perfeito! Vou separar as melhores opções e já te retorno. 👍',
  'Obrigado pelo contato! Qualquer dúvida, estou à disposição. 🙌',
];

const STATUS_OPTIONS: Array<{ codigo: string; label: string; desc: string }> = [
  { codigo: 'NOVO', label: 'Novo', desc: 'Lead recém-chegado, ainda sem contato' },
  { codigo: 'SDR', label: 'SDR / IA', desc: 'Em pré-atendimento automático pela IA' },
  { codigo: 'QUALIFICANDO', label: 'Qualificando', desc: 'Corretor qualificando o interesse e o perfil' },
  { codigo: 'NEGOCIANDO', label: 'Negociando', desc: 'Conversa ativa de negociação' },
  { codigo: 'VISITA', label: 'Visita agendada', desc: 'Visita ou reunião marcada com o lead' },
  { codigo: 'PROPOSTA', label: 'Proposta', desc: 'Proposta enviada, aguardando decisão' },
  { codigo: 'FECHADO', label: 'Fechado', desc: 'Negócio ganho' },
  { codigo: 'PERDIDO', label: 'Perdido', desc: 'Negócio perdido' },
];

const statusLabel = (codigo?: string) =>
  STATUS_OPTIONS.find((s) => s.codigo === codigo)?.label || codigo || 'Novo';

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
  const [tabularOpen, setTabularOpen] = useState(false);
  const [tabularMotivo, setTabularMotivo] = useState('');
  const [tabularObs, setTabularObs] = useState('');
  const [tabularSending, setTabularSending] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusValor, setStatusValor] = useState('');
  const [statusSending, setStatusSending] = useState(false);
  const [anexo, setAnexo] = useState<{ url: string; fileName: string; contentType: string } | null>(null);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false); // popover de respostas rápidas
  const [recording, setRecording] = useState(false); // gravando áudio
  const [recSecs, setRecSecs] = useState(0);
  const [recSending, setRecSending] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { data: inbox, reload: reloadInbox } = useApi<any>(() => Api.conversations());
  const { data: empreendimentos } = useApi<any[]>(() => Api.empreendimentos());
  const { data: tabMotivos } = useApi<Array<{ codigo: string; label: string; devolveBase?: boolean }>>(() => Api.tabulacaoMotivos());
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

  // Janela de 24h derivada AO VIVO do array de mensagens — não do booleano
  // estático `conv.windowOpen` do fetch. As mensagens atualizam via SSE/refetch,
  // então assim que um inbound novo do lead aparece o compositor reabre, sem
  // depender do windowOpen vir recalculado. Tick lento só pra a janela poder
  // FECHAR sozinha quando os 24h expiram com a tela aberta.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const lastInboundMs = (() => {
    for (let i = mensagens.length - 1; i >= 0; i--) {
      const m = mensagens[i];
      if (m.direction === 'inbound' || m.autor === 'LEAD') return new Date(m.createdAt).getTime();
    }
    return conv?.lastInboundAt ? new Date(conv.lastInboundAt).getTime() : 0;
  })();
  const janelaAberta = lastInboundMs > 0 && nowTick - lastInboundMs < 24 * 60 * 60 * 1000;

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

  const onSelecionarArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reescolher o mesmo arquivo
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Só imagens por enquanto.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem acima de 10MB.');
      return;
    }
    setUploadingAnexo(true);
    try {
      const r = await Api.conversationUploadMedia(file);
      setAnexo({ url: r.url, fileName: file.name, contentType: r.contentType || file.type });
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err?.message || 'falha'));
    } finally {
      setUploadingAnexo(false);
    }
  };

  const enviar = async () => {
    if (!activeId || sending || uploadingAnexo) return;
    const texto = draft.trim();
    if (!texto && !anexo) return;
    const media = anexo
      ? { mediaUrl: anexo.url, mediaType: 'image' as const, fileName: anexo.fileName }
      : undefined;
    setDraft('');
    setAnexo(null);
    setSending(true);
    try {
      const r = await Api.conversationSend(activeId, texto, 'CORRETOR', media);
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
      if (media) setAnexo(anexo);
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

  const abrirTabular = () => {
    if (!activeId) return;
    setTabularMotivo(tabMotivos?.[0]?.codigo || '');
    setTabularObs('');
    setTabularOpen(true);
  };

  const confirmarTabular = async () => {
    if (!activeId || !tabularMotivo || tabularSending) return;
    setTabularSending(true);
    try {
      const r: any = await Api.leadTabular(activeId, tabularMotivo, tabularObs.trim() || undefined);
      toast.success(r?.devolveBase ? 'Lead tabulado e devolvido à base.' : 'Lead tabulado.');
      setTabularOpen(false);
      setActiveId(null);
      reloadConv();
      reloadInbox();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setTabularSending(false);
    }
  };

  const abrirStatus = () => {
    if (!activeId) return;
    setStatusValor(conv?.status || 'NOVO');
    setStatusOpen(true);
  };

  const confirmarStatus = async () => {
    if (!activeId || !statusValor || statusSending) return;
    if (statusValor === conv?.status) {
      setStatusOpen(false);
      return;
    }
    setStatusSending(true);
    try {
      await Api.leadUpdate(activeId, { status: statusValor });
      toast.success(`Status atualizado para ${statusLabel(statusValor)}.`);
      setStatusOpen(false);
      reloadConv();
      reloadInbox();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setStatusSending(false);
    }
  };

  // Monta uma mensagem de imóvel BEM formatada (WhatsApp-style) e joga no
  // compositor pro corretor revisar/enviar. Campos opcionais são ignorados.
  const enviarImovel = async (emp: any) => {
    if (!activeId || !emp) return;
    const loc = [emp.bairro, emp.cidade].filter(Boolean).join(' · ');
    const det = [
      emp.dormitorios ? `🛏️ ${emp.dormitorios} dorm.` : '',
      emp.suites ? `🛁 ${emp.suites} suíte(s)` : '',
      emp.vagas ? `🚗 ${emp.vagas} vaga(s)` : '',
      emp.area ? `📐 ${emp.area} m²` : '',
    ].filter(Boolean).join('   ');
    const linhas = [
      `🏢 *${emp.nome}*`,
      loc,
      det,
      emp.descricao ? `\n${String(emp.descricao).replace(/\s+/g, ' ').trim().slice(0, 240)}` : '',
      `\nPosso te enviar a *tabela de valores* e as *plantas*. Quer que eu agende uma visita? 📅`,
    ].filter(Boolean);
    setDraft(linhas.join('\n'));
  };

  // Respostas rápidas — insere o texto no compositor (corretor revisa e envia).
  const inserirRapida = (txt: string) => {
    setDraft((d) => (d.trim() ? d.trim() + '\n' : '') + txt);
    setQuickOpen(false);
  };

  // Ligar — click-to-call. Exige o lead aceito e o contato liberado (nº real).
  const ligar = () => {
    if (!conv?.reservado) { toast.info('Aceite o lead antes de ligar.'); return; }
    const tel = (conv as any)?.telefone as string | undefined;
    if (!(conv as any)?.telefoneLiberado || !tel) {
      toast.info('Libere o contato para ver o número e ligar.');
      return;
    }
    window.open(`tel:+${tel.replace(/\D/g, '')}`, '_self');
  };

  // Marca a negociação (status NEGOCIANDO) em 1 clique.
  const marcarNegociacao = async () => {
    if (!activeId) return;
    try {
      await Api.leadUpdate(activeId, { status: 'NEGOCIANDO' });
      toast.success('Marcado como Negociação.');
      reloadConv(); reloadInbox();
    } catch (err: any) { toast.error('Erro: ' + (err?.message || 'falha')); }
  };

  // Rejeita o lead (status PERDIDO) com confirmação.
  const rejeitarLead = async () => {
    if (!activeId) return;
    if (!window.confirm('Rejeitar este lead? Ele sai do atendimento ativo.')) return;
    try {
      await Api.leadUpdate(activeId, { status: 'PERDIDO' });
      toast.success('Lead rejeitado.');
      reloadConv(); reloadInbox();
    } catch (err: any) { toast.error('Erro: ' + (err?.message || 'falha')); }
  };

  // ── Áudio (mensagem de voz) ────────────────────────────────────────────────
  const pararStreamRec = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    recStreamRef.current?.getTracks().forEach((t) => t.stop());
    recStreamRef.current = null;
  };
  const iniciarGravacao = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      recChunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mr.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      mediaRecRef.current = mr;
      mr.start();
      setRecSecs(0);
      setRecording(true);
      recTimerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch {
      toast.error('Não consegui acessar o microfone — permita o acesso no navegador.');
    }
  };
  const cancelarGravacao = () => {
    const mr = mediaRecRef.current;
    if (mr && mr.state !== 'inactive') { mr.onstop = null; mr.stop(); }
    mediaRecRef.current = null;
    recChunksRef.current = [];
    pararStreamRec();
    setRecording(false);
    setRecSecs(0);
  };
  const enviarGravacao = async () => {
    const mr = mediaRecRef.current;
    if (!mr || !activeId) { cancelarGravacao(); return; }
    setRecSending(true);
    const blob: Blob = await new Promise((resolve) => {
      mr.onstop = () => resolve(new Blob(recChunksRef.current, { type: 'audio/webm' }));
      if (mr.state !== 'inactive') mr.stop();
      else resolve(new Blob(recChunksRef.current, { type: 'audio/webm' }));
    });
    pararStreamRec();
    try {
      const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
      const up = await Api.conversationUploadMedia(file);
      const r = await Api.conversationSend(activeId, '', 'CORRETOR', { mediaUrl: up.url, mediaType: 'audio', fileName: file.name });
      if (r.delivery === 'falha') toast.error(`Falha no envio do áudio (${r.canal}).`);
      reloadConv(); reloadInbox();
    } catch (err: any) {
      toast.error('Erro ao enviar áudio: ' + (err?.message || 'falha'));
    } finally {
      mediaRecRef.current = null;
      recChunksRef.current = [];
      setRecording(false);
      setRecSecs(0);
      setRecSending(false);
    }
  };
  // Ao trocar de conversa: descarta gravação em andamento e desliga o microfone.
  useEffect(() => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    recStreamRef.current?.getTracks().forEach((t) => t.stop());
    recStreamRef.current = null;
    mediaRecRef.current = null;
    recChunksRef.current = [];
    setRecording(false);
    setRecSecs(0);
  }, [activeId]);

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
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={abrirStatus}
                      title="Atualizar o status da negociação"
                    >
                      <Icon name="flag" size={12} /> Status: {statusLabel(conv.status)}
                    </button>
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
                    {conv.reservado && (
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={abrirTabular}
                        title="Registrar desfecho do lead (motivo). Pode devolver à base."
                      >
                        <Icon name="warn" size={12} /> Tabular
                      </button>
                    )}
                    {conv.reservado && (
                      <>
                        <button className="btn btn--ghost btn--sm" onClick={ligar} title="Ligar para o lead (requer contato liberado)">
                          <Icon name="phone" size={12} /> Ligar
                        </button>
                        <button className="btn btn--ghost btn--sm" onClick={marcarNegociacao} title="Marcar como Negociação">
                          <Icon name="flag" size={12} /> Negociação
                        </button>
                        <button className="btn btn--ghost btn--sm" onClick={rejeitarLead} title="Rejeitar lead (marca como Perdido)">
                          <Icon name="x" size={12} /> Rejeitar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="thread__tools">
                <span className="text-xs text-secondary" style={{ fontWeight: 700 }}>
                  Enviar imóvel:
                </span>
                {(empreendimentos || []).map((e: any) => (
                  <button className="imovel-chip" key={e.id} onClick={() => enviarImovel(e)}>
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
              ) : !janelaAberta ? (
                <ComposerJanelaFechada
                  onAbrirTemplates={() => setTemplatePickerOpen(true)}
                  hasInbound={lastInboundMs > 0}
                />
              ) : (
                <>
                  {(anexo || uploadingAnexo) && (
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', margin: '0 12px',
                        background: 'var(--bg-elevated)', borderRadius: 10,
                        border: '1px solid var(--border-light)',
                      }}
                    >
                      {uploadingAnexo ? (
                        <span className="text-xs text-secondary">Enviando imagem…</span>
                      ) : (
                        <>
                          <img
                            src={anexo!.url}
                            alt={anexo!.fileName}
                            style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                          />
                          <span className="text-xs" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {anexo!.fileName}
                          </span>
                          <button
                            className="btn btn--ghost btn--sm"
                            title="Remover imagem"
                            onClick={() => setAnexo(null)}
                            style={{ color: 'var(--color-danger-fg)' }}
                          >
                            <Icon name="x" size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  <div className="composer">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={onSelecionarArquivo}
                    />
                    {recording ? (
                      <div className="rec-bar">
                        <span className="rec-dot" />
                        <span className="rec-time">
                          {Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, '0')}
                        </span>
                        <span className="rec-hint">Gravando áudio…</span>
                        <button className="btn btn--ghost btn--sm" onClick={cancelarGravacao} disabled={recSending} title="Descartar">
                          <Icon name="trash" size={14} /> Descartar
                        </button>
                        <button className="btn btn--primary btn--sm" onClick={enviarGravacao} disabled={recSending} title="Enviar áudio">
                          {recSending ? 'Enviando…' : (<><Icon name="send" size={14} /> Enviar áudio</>)}
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          className="btn btn--secondary btn--sm"
                          title="Anexar imagem"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={sending || uploadingAnexo}
                        >
                          <Icon name="paperclip" size={14} />
                        </button>
                        <div className="quick-wrap">
                          <button
                            className="btn btn--secondary btn--sm"
                            title="Respostas rápidas"
                            onClick={() => setQuickOpen((o) => !o)}
                            disabled={sending}
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z" /></svg>
                            Rápidas
                          </button>
                          {quickOpen && (
                            <>
                              <div className="quick-backdrop" onClick={() => setQuickOpen(false)} />
                              <div className="quick-pop">
                                <div className="quick-pop__head">Respostas rápidas</div>
                                {RESPOSTAS_RAPIDAS.map((r, i) => (
                                  <button key={i} className="quick-item" onClick={() => inserirRapida(r)}>{r}</button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                        <button
                          className="btn btn--secondary btn--sm"
                          title="Enviar template Meta aprovado"
                          onClick={() => setTemplatePickerOpen(true)}
                          disabled={sending}
                        >
                          <Icon name="doc" size={14} /> Template
                        </button>
                        <textarea
                          placeholder={anexo ? 'Legenda (opcional)…' : 'Escreva como corretor…'}
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
                        <button
                          className="btn btn--secondary btn--sm composer__mic"
                          title="Gravar áudio"
                          onClick={iniciarGravacao}
                          disabled={sending || uploadingAnexo}
                        >
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" /></svg>
                        </button>
                        <button
                          className="btn btn--primary"
                          onClick={enviar}
                          disabled={sending || uploadingAnexo || (!draft.trim() && !anexo)}
                        >
                          {sending ? 'Enviando…' : 'Enviar'}
                        </button>
                      </>
                    )}
                  </div>
                </>
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
              <Modal
                open={tabularOpen}
                onClose={() => !tabularSending && setTabularOpen(false)}
                title="Tabular lead"
                subtitle={`Registrar o desfecho de ${conv?.nome || 'lead'}. Conforme o motivo, o lead volta pra base de marketing.`}
                size="sm"
                footer={
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn--ghost" onClick={() => setTabularOpen(false)} disabled={tabularSending}>
                      Cancelar
                    </button>
                    <button className="btn btn--primary" onClick={confirmarTabular} disabled={tabularSending || !tabularMotivo}>
                      {tabularSending ? 'Tabulando…' : 'Tabular'}
                    </button>
                  </div>
                }
              >
                <label className="field__label" style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>
                  Motivo
                </label>
                <select
                  className="field__select"
                  value={tabularMotivo}
                  onChange={(e) => setTabularMotivo(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {(tabMotivos || []).map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {m.label}{m.devolveBase ? ' (volta à base)' : ''}
                    </option>
                  ))}
                </select>
                <label className="field__label" style={{ fontSize: 12, margin: '12px 0 6px', display: 'block' }}>
                  Observação (opcional)
                </label>
                <textarea
                  className="field__textarea"
                  rows={3}
                  placeholder="Detalhe do desfecho"
                  value={tabularObs}
                  onChange={(e) => setTabularObs(e.target.value)}
                  style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </Modal>
              <Modal
                open={statusOpen}
                onClose={() => !statusSending && setStatusOpen(false)}
                title="Status da negociação"
                subtitle={`Atualize o estágio de ${conv?.nome || 'lead'} no funil.`}
                size="sm"
                footer={
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn--ghost" onClick={() => setStatusOpen(false)} disabled={statusSending}>
                      Cancelar
                    </button>
                    <button className="btn btn--primary" onClick={confirmarStatus} disabled={statusSending || !statusValor}>
                      {statusSending ? 'Salvando…' : 'Salvar'}
                    </button>
                  </div>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {STATUS_OPTIONS.map((s) => {
                    const ativo = statusValor === s.codigo;
                    return (
                      <button
                        key={s.codigo}
                        type="button"
                        onClick={() => setStatusValor(s.codigo)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '1px solid ' + (ativo ? 'var(--pons-blue)' : 'var(--border-color, #334155)'),
                          background: ativo ? 'var(--color-info-bg)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <Icon
                          name={ativo ? 'checkCircle' : 'circle'}
                          size={16}
                          style={{ color: ativo ? 'var(--pons-blue)' : 'var(--text-secondary)', flexShrink: 0 }}
                        />
                        <span style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{s.label}</span>
                          <span className="text-xs text-secondary">{s.desc}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
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
    return <ImageBody m={m} />;
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

// Imagem recolhível: por padrão mostra só um chip "Ver imagem" pra não poluir a
// conversa quando há muitas mídias. Ao clicar, expande inline; pode recolher de
// novo. Responsivo: a imagem nunca passa de 75% da largura disponível.
function ImageBody({ m }: { m: Mensagem }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 999,
          border: '1px solid #14532d',
          background: '#166534',
          color: '#ffffff',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <Icon name={aberta ? 'chevron-down' : 'eye'} size={13} />
        {aberta ? 'Recolher' : 'Ver imagem'}
      </button>
      {aberta && (
        <a
          href={m.fileUrl!}
          target="_blank"
          rel="noopener"
          style={{ display: 'block', marginTop: 6 }}
        >
          <img
            src={m.fileUrl!}
            alt={m.fileName || 'imagem'}
            style={{ width: '100%', maxWidth: 'min(280px, 75vw)', borderRadius: 8, display: 'block' }}
          />
        </a>
      )}
      {m.texto && <div style={{ marginTop: aberta ? 6 : 4 }}>{m.texto}</div>}
    </div>
  );
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

  // Usa o inbound MAIS RECENTE entre o array de mensagens (fonte viva via SSE) e
  // o lastInboundAt do fetch — assim o badge nunca fica defasado do compositor.
  const lastInboundAt = (() => {
    const ms: any[] = conv?.mensagens || [];
    const li = [...ms].reverse().find((m) => m.direction === 'inbound' || m.autor === 'LEAD');
    const fromMsgs = li ? new Date(li.createdAt).getTime() : 0;
    const fromFetch = conv?.lastInboundAt ? new Date(conv.lastInboundAt).getTime() : 0;
    return Math.max(fromMsgs, fromFetch);
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
    const { kind, msg } = humanizeErrorReasonFull(m.errorReason);
    // Janela de 24h fechada / re-engajamento não é falha do sistema — é regra do
    // WhatsApp. Mostra como aviso âmbar discreto em vez de erro vermelho.
    if (kind === 'reengagement') {
      return (
        <span title={msg} style={{ color: '#D97706', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <Icon name="clock" size={11} /> Janela 24h fechada
        </span>
      );
    }
    return <span title={msg || m.errorReason || undefined} style={{ color: 'var(--money-negative)', fontSize: 11 }}>! {msg || 'falha'}</span>;
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
