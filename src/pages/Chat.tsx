import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Topbar } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { initials, timeAgo } from '../lib/format';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useSSE } from '../lib/useSSE';
import { humanizeErrorReasonFull } from '../lib/meta-errors';
import { isNativeApp, currentPlatform } from '../lib/platform';

import './chat.css';

type Tab = 'pendente' | 'atendendo';

// Respostas rápidas padrão do atendimento (corretor insere e revisa antes de enviar).
const RESPOSTAS_RAPIDAS = [
  'Estamos entrando em contato referente ao seu interesse no lançamento imobiliário em Porto Belo que anunciamos no Instagram.',
  'Somos o Grupo Pons Imobiliário, uma das maiores imobiliárias do litoral de Santa Catarina, especializados em imóveis na planta com alta valorização.',
  'Este empreendimento que você gostou é o Conecta Tower, da construtora Maxes, referência e pioneira na construção de flats em Santa Catarina, com várias obras entregues e com alto padrão de acabamento.',
  'No Conecta Tower temos Studios e apartamentos com 2 suítes, com uma área de lazer bem completa, com 2.200m², com piscina adulto e infantil aquecida, quadra poliesportiva, área gourmet, espaço kids, espaço pet e muito mais.',
  'Vou te mandar um material prévio para você ir dando uma olhada, mas deixa eu te perguntar: você está procurando algo para investimento ou para futura moradia? Isso vai me ajudar a ser mais assertiva no fluxo de pagamento que vou te enviar.',
];

const STATUS_OPTIONS: Array<{ codigo: string; label: string; desc: string }> = [
  { codigo: 'NOVO', label: 'Tentando Contato', desc: 'Lead do tráfego, ainda tentando o primeiro contato' },
  { codigo: 'NAO_RESPONDE', label: 'Não responde', desc: 'Sem retorno do lead às tentativas de contato' },
  { codigo: 'LISTA_VIP', label: 'Lista VIP', desc: 'Lead prioritário / lista VIP' },
  { codigo: 'EM_ATENDIMENTO', label: 'Em atendimento', desc: 'Corretor atendendo e qualificando o lead' },
  { codigo: 'FLUXO', label: 'Fluxo', desc: 'Lead dentro do fluxo de atendimento' },
  { codigo: 'PAROU_RESPONDER', label: 'Parou de responder', desc: 'Respondia no fluxo e parou de responder' },
  { codigo: 'POS_FLUXO', label: 'Atendimento Pós Fluxo', desc: 'Acompanhamento após o fluxo' },
  { codigo: 'VISITA', label: 'Vídeo/Visita', desc: 'Vídeo, visita ou reunião marcada com o lead' },
  { codigo: 'NEGOCIANDO', label: 'Em Negociação', desc: 'Conversa ativa de negociação' },
  { codigo: 'FECHADO', label: 'Venda', desc: 'Negócio ganho / venda' },
  { codigo: 'PERDIDO', label: 'Perdido', desc: 'Negócio perdido' },
];

const statusLabel = (codigo?: string) =>
  STATUS_OPTIONS.find((s) => s.codigo === codigo)?.label || codigo || 'Novo';

type Mensagem = {
  id: number;
  autor: 'LEAD' | 'IA' | 'CORRETOR' | 'SISTEMA' | 'NOTA';
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
  // Deep-link: /chat?lead=123 abre direto a conversa daquele lead (botão
  // "Abrir conversa" no funil e afins).
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const leadParam = Number(searchParams.get('lead'));
    if (leadParam) setActiveId(leadParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  const [notaMode, setNotaMode] = useState(false); // composer em modo NOTA interna (não envia pro lead)
  const [acoesOpen, setAcoesOpen] = useState(false); // menu de ações do header (compacto no mobile)
  const [recording, setRecording] = useState(false); // gravando áudio
  const [recSecs, setRecSecs] = useState(0);
  const [recSending, setRecSending] = useState(false);
  // Gravação de áudio: liberada na web; no app nativo SÓ a partir dos builds que
  // declaram a permissão de microfone (iOS build 11+ / Android versionCode 7+) —
  // nos anteriores o iOS mata o app ao chamar getUserMedia.
  const [micDisponivel, setMicDisponivel] = useState(() => !isNativeApp());
  useEffect(() => {
    if (!isNativeApp()) return;
    import('@capacitor/app')
      .then(({ App }) => App.getInfo())
      .then((info) => {
        const build = parseInt(info.build, 10) || 0;
        const minimo = currentPlatform() === 'ios' ? 11 : 7;
        if (build >= minimo) setMicDisponivel(true);
      })
      .catch(() => {});
  }, []);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tapRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [busca, setBusca] = useState('');
  const [limite, setLimite] = useState(80);
  const [buscaDeb, setBuscaDeb] = useState('');
  useEffect(() => { const t = setTimeout(() => setBuscaDeb(busca.trim()), 350); return () => clearTimeout(t); }, [busca]);
  const { data: inbox, reload: reloadInbox } = useApi<any>(() => Api.conversations({ q: buscaDeb || undefined, limit: limite }), [buscaDeb, limite]);
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
  // Só uma mensagem REAL do lead (autor LEAD + inbound) reabre a janela de 24h.
  // Não vale `|| direction==='inbound'`: logs de SISTEMA/formulário são criados
  // sem `direction` e o schema default é 'inbound' — abririam a janela à toa.
  const lastInboundMs = (() => {
    for (let i = mensagens.length - 1; i >= 0; i--) {
      const m = mensagens[i];
      if (m.autor === 'LEAD' && m.direction === 'inbound') return new Date(m.createdAt).getTime();
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

  // Deriva o tipo de mídia do WhatsApp a partir do MIME do arquivo.
  const tipoMedia = (mime: string): 'image' | 'video' | 'audio' | 'document' => {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const onSelecionarArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reescolher o mesmo arquivo
    if (!file) return;
    // Limites REAIS do WhatsApp Cloud por tipo — validar aqui, com mensagem clara,
    // evita o chamado clássico "mandei a foto/vídeo e não foi" (falhava lá no Meta
    // com erro genérico). Imagem grande PASSA: o backend comprime antes de enviar.
    const MB = 1024 * 1024;
    const tamanho = (file.size / MB).toFixed(1).replace('.', ',');
    const tipo = tipoMedia(file.type);
    if (tipo === 'video' && file.size > 16 * MB) {
      toast.error(`O WhatsApp limita vídeos a 16 MB — este tem ${tamanho} MB. Grave um trecho mais curto ou comprima o vídeo antes de enviar.`, 10000);
      return;
    }
    if (tipo === 'audio' && file.size > 16 * MB) {
      toast.error(`O WhatsApp limita áudios a 16 MB — este tem ${tamanho} MB.`, 8000);
      return;
    }
    if (tipo === 'image' && file.size > 30 * MB) {
      toast.error(`Imagem muito grande (${tamanho} MB — máximo 30 MB).`, 8000);
      return;
    }
    if (tipo === 'document' && file.size > 30 * MB) {
      toast.error(`Documento muito grande (${tamanho} MB — máximo 30 MB).`, 8000);
      return;
    }
    if (tipo === 'image' && file.size > 4.5 * MB) {
      toast.info(`Imagem de ${tamanho} MB — vai ser comprimida automaticamente antes do envio.`, 6000);
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
    // Modo NOTA: registra na conversa e NÃO envia nada pro lead.
    if (notaMode) {
      if (!texto) return;
      setDraft('');
      setSending(true);
      try {
        await Api.conversationNota(activeId, texto);
        reloadConv();
      } catch (err: any) {
        setDraft(texto);
        toast.error('Erro ao salvar nota: ' + (err?.message || 'falha'));
      } finally {
        setSending(false);
      }
      return;
    }
    const media = anexo
      ? { mediaUrl: anexo.url, mediaType: tipoMedia(anexo.contentType), fileName: anexo.fileName }
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
    if (!activeId || liberarSending || !liberarJustif.trim()) return;
    setLiberarSending(true);
    try {
      const r = await Api.leadLiberarContato(activeId, liberarJustif.trim());
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
  // Texto pronto do imóvel (nome, localização, detalhes e descrição)
  const descricaoImovel = (emp: any) => {
    const loc = [emp.bairro, emp.cidade].filter(Boolean).join(' · ');
    const det = [
      emp.dormitorios ? `🛏️ ${emp.dormitorios} dorm.` : '',
      emp.suites ? `🛁 ${emp.suites} suíte(s)` : '',
      emp.vagas ? `🚗 ${emp.vagas} vaga(s)` : '',
      emp.area ? `📐 ${emp.area} m²` : '',
    ].filter(Boolean).join('   ');
    return [
      `🏢 *${emp.nome}*`,
      loc,
      det,
      // Mantém as quebras de linha da descrição (formatação do WhatsApp);
      // limite de 900 chars pra caber como legenda de foto (teto Meta: 1024).
      emp.descricao ? `\n${String(emp.descricao).replace(/\r\n/g, '\n').trim().slice(0, 900)}` : '',
      `\nPosso te enviar a *tabela de valores* e as *plantas*. Quer que eu agende uma visita? 📅`,
    ].filter(Boolean).join('\n');
  };

  const enviarImovel = async (emp: any) => {
    if (!activeId || !emp) return;
    setDraft(descricaoImovel(emp));
  };

  // ── Compositor de imóvel: fotos selecionáveis + mensagem editável ─────────
  const [imovelSel, setImovelSel] = useState<any>(null);
  const [fotosSel, setFotosSel] = useState<Set<number>>(new Set());
  const [imovelMsg, setImovelMsg] = useState('');
  const [enviandoFotos, setEnviandoFotos] = useState(false);

  const abrirImovel = (emp: any) => {
    setImovelSel(emp);
    // Nada pré-selecionado: o corretor marca só as fotos que quer mandar.
    setFotosSel(new Set());
    setImovelMsg(`*${emp.nome}*`);
  };

  const enviarFotosImovel = async () => {
    if (!activeId || !imovelSel || enviandoFotos) return;
    const fotos = (imovelSel.fotos || []).filter((f: any) => fotosSel.has(f.id));
    const texto = imovelMsg.trim();
    if (!fotos.length && !texto) { toast.error('Selecione fotos ou escreva uma mensagem.'); return; }
    setEnviandoFotos(true);
    try {
      if (fotos.length) {
        // A mensagem vai como legenda da PRIMEIRA foto; as demais seguem sem texto.
        for (let i = 0; i < fotos.length; i++) {
          await Api.conversationSend(
            activeId,
            i === 0 ? texto : '',
            'CORRETOR',
            { mediaUrl: fotos[i].url, mediaType: 'image' },
          );
        }
      } else {
        await Api.conversationSend(activeId, texto, 'CORRETOR');
      }
      toast.success(fotos.length ? `${fotos.length} foto(s) enviada(s).` : 'Mensagem enviada.');
      setImovelSel(null);
      reloadConv();
      reloadInbox();
    } catch (err: any) {
      toast.error('Erro ao enviar: ' + (err?.message || 'falha'));
    } finally {
      setEnviandoFotos(false);
    }
  };

  // Respostas rápidas — insere o texto no compositor (corretor revisa e envia).
  const inserirRapida = (txt: string) => {
    setDraft((d) => (d.trim() ? d.trim() + '\n' : '') + txt);
    setQuickOpen(false);
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

          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-light)' }}>
            <input
              className="field__input"
              style={{ width: '100%', height: 34 }}
              placeholder="Buscar por nome, telefone ou e-mail…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {inbox?.totalConversas != null && (
              <div className="text-xs text-secondary" style={{ marginTop: 4 }}>
                {buscaDeb ? `${inbox.carregadas} resultado(s)` : `${inbox.carregadas} de ${inbox.totalConversas} conversas`}
              </div>
            )}
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
                // iOS: o click sintético pós-toque às vezes se perde (hover
                // emulado / re-render entre touchend e click) e exigia DOIS
                // toques. Abre direto no touchend quando foi um tap de fato
                // (sem arrasto) e suprime o click fantasma via preventDefault.
                onTouchStart={(e) => {
                  tapRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, id: c.id };
                }}
                onTouchEnd={(e) => {
                  const t = tapRef.current;
                  tapRef.current = null;
                  if (!t || t.id !== c.id) return;
                  const dx = Math.abs(e.changedTouches[0].clientX - t.x);
                  const dy = Math.abs(e.changedTouches[0].clientY - t.y);
                  if (dx < 12 && dy < 12) {
                    e.preventDefault();
                    setActiveId(c.id);
                  }
                }}
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
          {!buscaDeb && inbox?.totalConversas > (inbox?.carregadas || 0) && (
            <div style={{ padding: 12, textAlign: 'center' }}>
              {(inbox?.carregadas || 0) < 1000 ? (
                <button className="btn btn--ghost btn--sm" onClick={() => setLimite((n) => Math.min(1000, n + 150))}>
                  Carregar mais ({inbox.totalConversas - inbox.carregadas} restantes)
                </button>
              ) : (
                <div className="text-xs text-secondary">
                  {inbox.totalConversas - inbox.carregadas} conversas a mais — use a <strong>busca</strong> acima pra achar uma específica.
                </div>
              )}
            </div>
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
                {/* Linha 1 — identidade compacta + toggle de ações (padrão mobile) */}
                <div className="thread__hd-main">
                  <button
                    className="thread__back"
                    onClick={() => setActiveId(null)}
                    title="Voltar para a lista"
                    aria-label="Voltar"
                  >
                    <Icon name="arrow_left" size={16} />
                  </button>
                  <div className="avatar">{initials(conv.nome)}</div>
                  <div className="thread__hd-id">
                    <div className="thread__hd-name">
                      {conv.nome} {conv.vip && <Icon name="star" size={12} style={{ color: '#EAB308', verticalAlign: 'middle' }} />}
                    </div>
                    <div className="thread__hd-meta">
                      {conv.telefone || 'Telefone protegido'} · {conv.origem} · {mensagens.length} msg{mensagens.length === 1 ? '' : 's'}
                      {conv.vaiConectado && ' · WhatsApp ativo'}
                    </div>
                  </div>
                  <button
                    className="btn btn--ghost btn--sm thread__acoes-toggle"
                    onClick={() => setAcoesOpen((o) => !o)}
                    aria-expanded={acoesOpen}
                    title="Ações do atendimento"
                  >
                    Ações <Icon name="chevron-down" size={12} style={{ transform: acoesOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                  </button>
                </div>

                {/* Linha 2 — status, janela 24h e badges de IA */}
                <div className="thread__hd-sub">
                  <span className={'badge ' + (conv.reservado ? 'badge--signed' : 'badge--analysis')}>
                    {conv.reservado ? 'ATENDENDO' : 'PENDENTE'}
                  </span>
                  {(conv as any).classificacao === 'QUENTE' && (
                    <span className="badge" style={{ background: 'rgba(220,38,38,0.15)', color: '#DC2626' }}>
                      <Icon name="fire" size={10} /> QUENTE
                    </span>
                  )}
                  {(conv as any).iaAtendendo && !conv.reservado && !(conv as any).iaLimiteAtingido && (
                    <span className="badge" style={{ background: 'rgba(96,165,250,0.15)', color: 'var(--blue-600)' }}>
                      <Icon name="bot" size={10} /> IA respondendo · {(conv as any).iaRespostasCount || 0}/3
                    </span>
                  )}
                  {(conv as any).iaLimiteAtingido && !conv.reservado && (
                    <span className="badge" style={{ background: 'rgba(245,158,11,0.18)', color: '#B45309' }}>
                      <Icon name="warn" size={10} /> IA esgotou (3/3)
                    </span>
                  )}
                  <Janela24h conv={conv} />
                  <button className="btn btn--ghost btn--sm" onClick={abrirStatus} title="Atualizar o status da negociação">
                    <Icon name="flag" size={12} /> {statusLabel(conv.status)}
                  </button>
                </div>

                {/* Ações (recolhível) — some do fluxo até o usuário abrir */}
                {acoesOpen && (
                  <div className="thread__acoes">
                    <button className="btn btn--ghost btn--sm" onClick={sincronizar} disabled={syncing} title="Buscar mensagens novas na VAI">
                      <Icon name="speed" size={14} /> {syncing ? 'Sincronizando…' : 'Sync'}
                    </button>
                    {!conv.reservado && (
                      <button className="btn btn--primary btn--sm" onClick={aceitarLead}>
                        <Icon name="check" size={12} /> Aceitar
                      </button>
                    )}
                    {!(conv as any).telefoneLiberado && conv.reservado && (
                      <button className="btn btn--ghost btn--sm" onClick={liberarContato} title="Mostra o telefone do lead, marca como QUENTE e contabiliza no seu perfil">
                        <Icon name="phone" size={12} /> Liberar contato
                      </button>
                    )}
                    {conv.reservado && (
                      <>
                        <button className="btn btn--ghost btn--sm" onClick={abrirTabular} title="Registrar desfecho do lead (motivo). Pode devolver à base.">
                          <Icon name="warn" size={12} /> Tabular
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
                )}
              </div>
              <div className="thread__tools">
                <span className="text-xs text-secondary" style={{ fontWeight: 700 }}>
                  Enviar imóvel:
                </span>
                {(empreendimentos || []).map((e: any) => (
                  <button
                    className="imovel-chip"
                    key={e.id}
                    style={!janelaAberta || !conv?.reservado ? { opacity: 0.45 } : undefined}
                    onClick={() => {
                      // Mesma regra do composer: fora da janela de 24h (ou lead não
                      // aceito) o Meta rejeita mídia/texto — bloqueia na origem em
                      // vez de deixar o envio falhar depois.
                      if (!conv?.reservado) { toast.error('Aceite o lead antes de enviar imóveis.'); return; }
                      if (!janelaAberta) { toast.error('Janela de 24h fechada — envie um template pra reabrir antes de mandar fotos.'); return; }
                      (e.fotos || []).length ? abrirImovel(e) : enviarImovel(e);
                    }}
                    title={(e.fotos || []).length ? `Fotos e descrição de ${e.nome}` : `Inserir descrição de ${e.nome}`}
                  >
                    {e.nome}{(e.fotos || []).length ? ` (${e.fotos.length})` : ''}
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
                        <span className="text-xs text-secondary">Enviando arquivo…</span>
                      ) : (
                        <>
                          {anexo!.contentType.startsWith('image/') ? (
                            <img
                              src={anexo!.url}
                              alt={anexo!.fileName}
                              style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                            />
                          ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-subtle, rgba(255,255,255,0.06))' }}>
                              <Icon name={anexo!.contentType.startsWith('video/') ? 'video' : 'doc'} size={20} />
                            </div>
                          )}
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
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
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
                        <button
                          className={'btn btn--sm' + (notaMode ? ' composer__nota-btn--on' : ' btn--secondary')}
                          title={notaMode ? 'Modo nota ativo — o lead NÃO recebe. Clique pra voltar ao envio normal.' : 'Escrever nota interna (o lead não recebe)'}
                          onClick={() => setNotaMode((v) => !v)}
                          disabled={sending}
                        >
                          <Icon name="pencil" size={14} /> Nota
                        </button>
                        <textarea
                          className={notaMode ? 'composer__input--nota' : undefined}
                          placeholder={notaMode ? 'Nota interna — o lead NÃO recebe…' : anexo ? 'Legenda (opcional)…' : 'Escreva como corretor…'}
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
                        {/* Nos apps nativos publicados falta a permissão de microfone
                            (NSMicrophoneUsageDescription / RECORD_AUDIO) — no iOS o
                            getUserMedia MATA o app. micDisponivel reexibe quando o
                            build nativo instalado já declara a permissão. */}
                        {micDisponivel && (
                        <button
                          className="btn btn--secondary btn--sm composer__mic"
                          title="Gravar áudio"
                          onClick={iniciarGravacao}
                          disabled={sending || uploadingAnexo}
                        >
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" /></svg>
                        </button>
                        )}
                        <button
                          className={'btn ' + (notaMode ? 'composer__nota-send' : 'btn--primary')}
                          onClick={enviar}
                          disabled={sending || uploadingAnexo || (notaMode ? !draft.trim() : (!draft.trim() && !anexo))}
                        >
                          {sending ? 'Salvando…' : notaMode ? 'Salvar nota' : 'Enviar'}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
              {imovelSel && (
                <Modal
                  open
                  onClose={() => !enviandoFotos && setImovelSel(null)}
                  title={`Enviar imóvel · ${imovelSel.nome}`}
                  subtitle="Monte a mensagem: escolha as fotos e edite o texto. Nada é enviado até você clicar em Enviar."
                  size="md"
                  footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button className="btn btn--ghost" onClick={() => setImovelSel(null)} disabled={enviandoFotos}>Cancelar</button>
                      <button
                        className="btn btn--primary"
                        onClick={enviarFotosImovel}
                        disabled={enviandoFotos || (fotosSel.size === 0 && !imovelMsg.trim())}
                      >
                        {enviandoFotos
                          ? 'Enviando…'
                          : fotosSel.size > 0
                            ? `Enviar ${fotosSel.size} foto${fotosSel.size === 1 ? '' : 's'} + mensagem`
                            : 'Enviar mensagem'}
                      </button>
                    </div>
                  }
                >
                  <div className="uppercase-tag" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span>1 · Fotos ({fotosSel.size} de {(imovelSel.fotos || []).length} selecionadas)</span>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      disabled={enviandoFotos}
                      onClick={() => setFotosSel((cur) =>
                        cur.size === (imovelSel.fotos || []).length
                          ? new Set()
                          : new Set((imovelSel.fotos || []).map((f: any) => f.id)))}
                    >
                      {fotosSel.size === (imovelSel.fotos || []).length ? 'Limpar seleção' : 'Selecionar todas'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                    {(imovelSel.fotos || []).map((f: any) => {
                      const on = fotosSel.has(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFotosSel((cur) => { const n = new Set(cur); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n; })}
                          style={{
                            position: 'relative',
                            padding: 0,
                            border: on ? '2px solid var(--pons-blue)' : '2px solid transparent',
                            borderRadius: 10,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            aspectRatio: '4/3',
                            background: 'var(--bg-card-hover)',
                            opacity: on ? 1 : 0.5,
                          }}
                          title={on ? 'Desmarcar' : 'Marcar'}
                        >
                          <img src={f.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          {on && (
                            <span style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'var(--pons-blue)', color: '#fff', display: 'grid', placeItems: 'center' }}>
                              <Icon name="check" size={12} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="uppercase-tag" style={{ margin: '16px 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span>2 · Mensagem {fotosSel.size > 0 ? '(vai como legenda da primeira foto)' : ''}</span>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setImovelMsg(descricaoImovel(imovelSel))}
                      disabled={enviandoFotos}
                      title="Preenche com nome, localização, detalhes e descrição do imóvel"
                    >
                      <Icon name="sparkles" size={12} /> Usar descrição completa
                    </button>
                  </div>
                  <textarea
                    className="field__textarea"
                    rows={5}
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                    placeholder="Escreva a mensagem que acompanha as fotos…"
                    value={imovelMsg}
                    onChange={(e) => setImovelMsg(e.target.value)}
                    disabled={enviandoFotos}
                  />
                </Modal>
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
                    <button className="btn btn--primary" onClick={confirmarLiberar} disabled={liberarSending || !liberarJustif.trim()}>
                      {liberarSending ? 'Liberando…' : 'Liberar contato'}
                    </button>
                  </div>
                }
              >
                <label className="field__label" style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>
                  Motivo (obrigatório)
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
                  Obrigatório: sem descrever o motivo não dá pra liberar. O texto entra no audit log e na notificação enviada aos admins.
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
  if (m.autor === 'NOTA') {
    return (
      <div className="bubble bubble--NOTA">
        <div className="bubble__nota-tag"><Icon name="pencil" size={10} /></div>
        {m.texto}
        <div className="bubble__meta">{timeAgo(m.createdAt)}</div>
      </div>
    );
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
    const li = [...ms].reverse().find((m) => m.autor === 'LEAD' && m.direction === 'inbound');
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
    <div className="tpl-modal__backdrop">
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
