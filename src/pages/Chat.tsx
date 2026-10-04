import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Topbar } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { CorretorPicker } from '../components/CorretorPicker';
import { DestinoPicker, type DestinoTransf } from '../components/DestinoPicker';
import { initials, timeAgo } from '../lib/format';
import { Api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useToast } from '../lib/toast';
import { useSSE } from '../lib/useSSE';
import { humanizeErrorReasonFull } from '../lib/meta-errors';
import { isNativeApp, currentPlatform } from '../lib/platform';
import { Auth } from '../lib/auth';

import './chat.css';

// Gestor (qualquer papel que não seja corretor comum) vê quem está atendendo cada
// lead — o corretor comum só enxerga os próprios, então seria redundante pra ele.
const ehGestorAtendimento = () => Auth.user?.role !== 'CORRETOR';
// Papéis que liberam o contato DIRETO (mesma lista que aprova na aba Liberações)
const PAPEIS_LIBERAM_DIRETO = ['GESTOR', 'GERENTE_EQUIPE', 'SOCIO_UNIDADE', 'CEO', 'DIRETOR_COMERCIAL', 'GESTOR_MARKETING'];
const liberaDireto = () => PAPEIS_LIBERAM_DIRETO.includes(Auth.user?.role || '');

// No celular a tecla de retorno do teclado dispara "Enter" — se enviar aqui, o
// corretor que só quer pular linha manda a mensagem pela metade pro cliente.
// Enter-envia fica restrito ao desktop (teclado físico); no touch envia só no ✈️.
const teclaEnterEnvia = !(isNativeApp() || (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches));

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

// Etiqueta de temperatura do lead — localização rápida por cor no Atendimento.
const TEMPERATURAS = [
  { key: 'NOVO', label: 'Novo', cor: '#16A34A', bg: 'rgba(22,163,74,0.15)' },
  { key: 'QUENTE', label: 'Quente', cor: '#DC2626', bg: 'rgba(220,38,38,0.15)' },
  { key: 'MORNO', label: 'Morno', cor: '#D97706', bg: 'rgba(245,158,11,0.18)' },
  { key: 'FRIO', label: 'Frio', cor: '#2563EB', bg: 'rgba(37,99,235,0.15)' },
] as const;
// Sem classificação = NOVO (padrão verde de todo lead que entra).
const tempInfo = (c?: string) => TEMPERATURAS.find((t) => t.key === c) || TEMPERATURAS[0];

// Como o lead chegou ao corretor atual — calculado no backend (lib/atendimento-info.js).
const CHEGADA: Record<string, { label: string; cls: string; title: string }> = {
  roleta: { label: 'Roleta', cls: 'chegada--roleta', title: 'Chegou pela roleta (distribuição automática)' },
  gestor: { label: 'Gestor', cls: 'chegada--gestor', title: 'Direcionado pelo gestor' },
  bolsao: { label: 'Bolsão', cls: 'chegada--bolsao', title: 'Pego no bolsão' },
  site: { label: 'Site', cls: 'chegada--site', title: 'Veio direto do site' },
};
// Nome legível da origem do lead (gestão). Valor desconhecido aparece como veio.
const ORIGEM_LABEL: Record<string, string> = {
  META_ADS: 'Meta Ads', SITE: 'Site', LANDING_PAGE: 'Landing page', IMPORTACAO_MANUAL: 'Importação manual',
  MANUAL: 'Manual', WHATSAPP: 'WhatsApp', ZAP: 'ZAP Imóveis', SIMULADOR: 'Simulador', AVALIACAO: 'Avaliação',
};
const origemLabel = (o?: string | null) => (o ? ORIGEM_LABEL[String(o).toUpperCase()] || o : '');

function ChegadaChip({ c }: { c?: string | null }) {
  const d = c ? CHEGADA[c] : null;
  if (!d) return null;
  return <span className={'chegada ' + d.cls} title={d.title}>{d.label}</span>;
}

// Contagem até o lead PULAR pra outro corretor (prazo vem do backend: `puloEm`).
// O worker do pulo roda a cada 60s — ao zerar mostra "pulando…"; fora do horário
// de pulo da fila o lead fica seguro até a fila abrir.
function Contagem({ ate, pausado }: { ate: string; pausado?: boolean }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.ceil((new Date(ate).getTime() - Date.now()) / 1000));
  if (s === 0) return <>{pausado ? 'fora do horário' : 'pulando…'}</>;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return <>{h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`}</>;
}

// Ícones que não existem no <Icon/> do sistema (traço igual ao resto).
const Svg = ({ d, size = 18, fill }: { d: string; size?: number; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const IcoKebab = () => (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></svg>
);
const IcoFiltro = () => <Svg d="M4 6h16M7 12h10M10 18h4" />;
const IcoCasa = ({ size = 20 }: { size?: number }) => <Svg size={size} d="M3 11 12 4l9 7M5 10v10h14V10" />;
const IcoMic = () => <Svg size={21} d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />;
const IcoInfo = ({ size = 14 }: { size?: number }) => <Svg size={size} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01" />;

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
  assumido?: boolean;
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
  const [fichaCorretorId, setFichaCorretorId] = useState<number | null>(null);
  // Gestor clica no nome do corretor → abre um modal leve com a ficha dele.
  const abrirFichaCorretor = (corretorId?: number) => {
    if (corretorId) setFichaCorretorId(corretorId);
  };
  useEffect(() => {
    const leadParam = Number(searchParams.get('lead'));
    if (leadParam) setActiveId(leadParam);
    // Deep-link do aviso de follow-up: /chat?filtro=parados|aguardando
    const f = searchParams.get('filtro');
    if (f === 'parados' || f === 'aguardando') setFiltroFollowup(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [draft, setDraft] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  // Regra (14/08): CORRETOR não dispara template — só gestor e marketing.
  // Mesma allow-list do backend (POST /leads/:id/send-template).
  const ROLES_TEMPLATE = ['CEO', 'DIRETOR_COMERCIAL', 'DIRETOR_FINANCEIRO', 'DIRETOR_JURIDICO', 'MARKETING', 'GERENTE_EQUIPE', 'SOCIO_UNIDADE', 'DEV', 'GESTOR'];
  const podeTemplate = ROLES_TEMPLATE.includes(Auth.user?.role || '');
  const abrirTemplates = () => {
    if (!podeTemplate) { toast.error('Só gestor e marketing podem enviar template.'); return; }
    setTemplatePickerOpen(true);
  };
  const [liberarOpen, setLiberarOpen] = useState(false);
  const [liberarJustif, setLiberarJustif] = useState('');
  const [liberarSending, setLiberarSending] = useState(false);
  const [tabularOpen, setTabularOpen] = useState(false);
  const [tabularMotivo, setTabularMotivo] = useState('');
  const [tabularObs, setTabularObs] = useState('');
  const [tabularSending, setTabularSending] = useState(false);
  // Direcionar (transferir de dentro da conversa) — só gestão, NUNCA corretor.
  // Mesma allow-list do backend POST /roletas/transferir-massa.
  const ROLES_DIRECIONAR = ['CEO', 'DIRETOR_COMERCIAL', 'MARKETING', 'GERENTE_EQUIPE'];
  const podeDirecionar = ROLES_DIRECIONAR.includes(Auth.user?.role || '');
  const [direcionarOpen, setDirecionarOpen] = useState(false);
  const [alvoDir, setAlvoDir] = useState<DestinoTransf | null>(null);
  const [dirTelefoneVisivel, setDirTelefoneVisivel] = useState(false);
  const [direcionando, setDirecionando] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusValor, setStatusValor] = useState('');
  const [statusSending, setStatusSending] = useState(false);
  const [anexo, setAnexo] = useState<{ url: string; fileName: string; contentType: string } | null>(null);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false); // popover de respostas rápidas
  const [filtroTemp, setFiltroTemp] = useState<string>(''); // filtro de temperatura no inbox
  const [filtroCorretor, setFiltroCorretor] = useState<number | ''>(''); // filtro por corretor (gestor)
  const [filtroEquipe, setFiltroEquipe] = useState<number | ''>(''); // filtro por equipe (gestor que vê +1 equipe)
  const [filtroFollowup, setFiltroFollowup] = useState<'' | 'aguardando' | 'parados'>(''); // follow-up
  const [tempOpen, setTempOpen] = useState(false); // popover pra trocar a temperatura do lead
  const [traduzOpen, setTraduzOpen] = useState(false); // popover do tradutor (saída)
  const [traduzindo, setTraduzindo] = useState(false);
  const [draftPreTraducao, setDraftPreTraducao] = useState<string | null>(null); // p/ desfazer a tradução
  // IA do corretor: corrigir/melhorar a mensagem (2 opções em amarelo) e resumir a conversa.
  const [iaSug, setIaSug] = useState<{ leadId: number; modo: string; opcoes: Array<{ rotulo: string; texto: string }> } | null>(null);
  const [iaCarregando, setIaCarregando] = useState<'' | 'corrigir' | 'melhorar'>('');
  const [resumo, setResumo] = useState<{ leadId: number; itens: string[]; proximo: string } | null>(null);
  const [resumindo, setResumindo] = useState(false);
  // Layout novo do atendimento (demo aprovada 04/10): filtros recolhidos, menu ⋮,
  // menu + do compositor, seletor de imóvel com busca e painel "Dados do lead".
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [painelOpen, setPainelOpen] = useState(false);
  const [maisOpen, setMaisOpen] = useState(false);
  const [imovelPickerOpen, setImovelPickerOpen] = useState(false);
  const [imovelBusca, setImovelBusca] = useState('');
  const [sysAbertos, setSysAbertos] = useState<Set<string>>(new Set());
  const [notaMode, setNotaMode] = useState(false); // composer em modo NOTA interna (não envia pro lead)
  const [acoesOpen, setAcoesOpen] = useState(false); // menu de ações do header (compacto no mobile)
  const [retornoOpen, setRetornoOpen] = useState(false); // popover "agendar retorno"
  const [recording, setRecording] = useState(false); // gravando áudio
  const [recSecs, setRecSecs] = useState(0);
  const [recSending, setRecSending] = useState(false);
  // Gravação de áudio: liberada na web; no app nativo SÓ a partir dos builds que
  // declaram a permissão de microfone (iOS build 11+ / Android versionCode 7+) —
  // nos anteriores o iOS mata o app ao chamar getUserMedia.
  const [enviandoBolha, setEnviandoBolha] = useState<{ texto: string; nota: boolean; anexoNome?: string } | null>(null); // bolha otimista "enviando…"
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
  const { data: inbox, reload: reloadInbox } = useApi<any>(() => Api.conversations({ q: buscaDeb || undefined, limit: limite, classificacao: filtroTemp || undefined, corretorId: filtroCorretor || undefined, equipeId: filtroEquipe || undefined, filtro: filtroFollowup || undefined }), [buscaDeb, limite, filtroTemp, filtroCorretor, filtroEquipe, filtroFollowup]);
  // Lista de corretores (pro filtro do gestor) — só carrega pra quem não é corretor comum.
  const { data: corretoresFiltro } = useApi<any[]>(() => (ehGestorAtendimento() ? Api.corretores() : Promise.resolve([])), []);
  // Equipes no escopo do usuário (pro filtro por equipe). Só mostra o filtro se vê +1.
  const { data: equipesFiltro } = useApi<any[]>(() => (ehGestorAtendimento() ? Api.equipes() : Promise.resolve([])), []);
  // Destinos pro "Direcionar" — só carrega pra quem pode transferir (gestão).
  const { data: filasDir } = useApi<any[]>(() => (ehGestorAtendimento() ? Api.roletas().catch(() => [] as any) : Promise.resolve([])), []);
  const { data: basesDir } = useApi<any[]>(() => (ehGestorAtendimento() ? Api.basesLead().catch(() => [] as any) : Promise.resolve([])), []);
  const { data: bolsoesDir } = useApi<any[]>(() => (ehGestorAtendimento() ? Api.bolsoes().catch(() => [] as any) : Promise.resolve([])), []);
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
  const nFiltros = (filtroFollowup ? 1 : 0) + (filtroTemp ? 1 : 0) + (filtroEquipe ? 1 : 0) + (filtroCorretor ? 1 : 0);
  // Alerta do topo: leads ainda NÃO aceitos com prazo de pulo correndo.
  const alertaPulo = (() => {
    const comPrazo = pendente.filter((c: any) => c.puloEm);
    if (!comPrazo.length) return null;
    const prox = comPrazo.reduce((a: any, b: any) => (new Date(a.puloEm).getTime() <= new Date(b.puloEm).getTime() ? a : b));
    return { qtd: comPrazo.length, prox };
  })();
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
  useEffect(() => {
    setIaSug(null); setResumo(null); setIaCarregando('');
    setPainelOpen(false); setMaisOpen(false); setAcoesOpen(false); setImovelPickerOpen(false); setSysAbertos(new Set());
  }, [activeId]);

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
  // WhatsApp" e estados stales depois de algum tempo fora). O SSE atualiza ao
  // vivo o que emite evento; mas transferências/distribuições feitas pelo
  // gestor (ou ajustes diretos) NÃO emitem — e no app nativo o 'focus' não
  // dispara de forma confiável (leads novos não apareciam pro Rafael, 02/09).
  // Por isso: focus + visibilitychange (resume do app) + polling leve de 60s
  // só com a aba visível (barato; a rota do inbox é otimizada).
  useEffect(() => {
    // Ao voltar pro app recarrega o inbox E a conversa aberta — assim o telefone
    // liberado enquanto o app estava em background aparece sem precisar reabrir.
    const atualiza = () => { reloadInbox(); if (activeId) reloadConv(); };
    const onFocus = () => atualiza();
    const onVis = () => { if (document.visibilityState === 'visible') atualiza(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') atualiza();
    }, 60_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(id);
    };
  }, [reloadInbox, reloadConv, activeId]);

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
      // Telefone liberado (no aceite ou liberação do gestor): recarrega a conversa
      // aberta pra o número aparecer na hora, sem o corretor/gestor ter que sair e
      // voltar. Antes a tela ficava presa em "Telefone protegido" (Ademar 03/10).
      'phone.released': (d: any) => {
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
      toast.error(`Vídeo acima do limite do WhatsApp: ${tamanho} MB (máx. 16 MB).`);
      return;
    }
    if (tipo === 'audio' && file.size > 16 * MB) {
      toast.error(`Áudio acima do limite do WhatsApp: ${tamanho} MB (máx. 16 MB).`);
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
      toast.info(`Imagem grande (${tamanho} MB) — compressão automática no envio.`);
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

  // Salva uma nota interna (não vai pro lead) — usável em QUALQUER estado do
  // composer, inclusive janela de 24h fechada / lead pendente. Pedido do cliente.
  const salvarNota = async (texto: string) => {
    const t = (texto || '').trim();
    if (!activeId || !t || sending) return;
    setSending(true);
    setEnviandoBolha({ texto: t, nota: true });
    try {
      await Api.conversationNota(activeId, t);
      reloadConv();
    } catch (err: any) {
      toast.error('Erro ao salvar nota: ' + (err?.message || 'falha'));
    } finally {
      setSending(false);
      setEnviandoBolha(null);
    }
  };

  // textoForcado: envio de uma sugestão da IA (onClick passa o evento — por isso o typeof).
  const enviar = async (textoForcado?: unknown) => {
    if (!activeId || sending || uploadingAnexo) return;
    const texto = (typeof textoForcado === 'string' ? textoForcado : draft).trim();
    setIaSug(null);
    if (!texto && !anexo) return;
    setDraftPreTraducao(null); // enviou → não faz mais sentido "voltar ao original"
    // Modo NOTA: registra na conversa e NÃO envia nada pro lead.
    if (notaMode) {
      if (!texto) return;
      setDraft('');
      setSending(true);
      setEnviandoBolha({ texto, nota: true });
      try {
        await Api.conversationNota(activeId, texto);
        reloadConv();
      } catch (err: any) {
        setDraft(texto);
        toast.error('Erro ao salvar nota: ' + (err?.message || 'falha'));
      } finally {
        setSending(false);
        setEnviandoBolha(null);
      }
      return;
    }
    const media = anexo
      ? { mediaUrl: anexo.url, mediaType: tipoMedia(anexo.contentType), fileName: anexo.fileName }
      : undefined;
    setDraft('');
    setAnexo(null);
    setSending(true);
    setEnviandoBolha({ texto: texto || '', nota: false, anexoNome: anexo?.fileName });
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
      setEnviandoBolha(null);
    }
  };

  // Corrigir / melhorar: a IA devolve 2 opções; o corretor toca numa e ela é enviada
  // pelo MESMO enviar() (mesmas travas: aceite, janela 24h, anexo).
  const pedirIaTexto = async (modo: 'corrigir' | 'melhorar') => {
    const texto = draft.trim();
    const id = activeId;
    if (!id || !texto || iaCarregando) return;
    setIaSug(null);
    setIaCarregando(modo);
    try {
      const r = await Api.iaTexto(texto, modo, id);
      setIaSug({ leadId: id, modo, opcoes: r.opcoes || [] });
    } catch (err: any) {
      toast.error(err?.message || 'Não consegui agora. Tente de novo.');
    } finally {
      setIaCarregando('');
    }
  };
  const resumirConversa = async () => {
    const id = activeId;
    if (!id || resumindo) return;
    setResumindo(true);
    try {
      const r = await Api.conversationResumo(id);
      setResumo({ leadId: id, itens: r.itens || [], proximo: r.proximo || '' });
    } catch (err: any) {
      toast.error(err?.message || 'Não consegui resumir agora. Tente de novo.');
    } finally {
      setResumindo(false);
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
      if (r.jaLiberado && r.telefone) toast.success(`Telefone: ${r.telefone}`);
      else toast.success(r.message || 'Solicitação enviada ao gestor pra aprovação.');
      setLiberarOpen(false);
      reloadConv();
      reloadInbox();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setLiberarSending(false);
    }
  };

  const agendarRetorno = async (horas: number, label: string) => {
    if (!activeId) return;
    setRetornoOpen(false);
    try {
      await Api.agendarRetorno(activeId, horas);
      toast.success(`Retorno agendado ${label}. Você recebe um lembrete no WhatsApp.`);
      reloadConv();
    } catch (e: any) {
      toast.error('Erro ao agendar: ' + (e?.message || 'falha'));
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

  const abrirDirecionar = () => {
    if (!activeId || !podeDirecionar) return;
    setAlvoDir(null);
    setDirTelefoneVisivel(false);
    setDirecionarOpen(true);
  };

  const confirmarDirecionar = async () => {
    if (!activeId || !alvoDir || direcionando) return;
    setDirecionando(true);
    try {
      const r = await Api.leadsTransferirDestino([activeId], alvoDir, dirTelefoneVisivel);
      toast.success(`Lead direcionado para ${r.corretor}.`);
      setDirecionarOpen(false);
      setActiveId(null); // sai da conversa: o lead deixa de ser do usuário atual
      reloadConv();
      reloadInbox();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setDirecionando(false);
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
      emp.dormitorios ? `${emp.dormitorios} dormitório(s)` : '',
      emp.suites ? `${emp.suites} suíte(s)` : '',
      emp.vagas ? `${emp.vagas} vaga(s)` : '',
      emp.area ? `${emp.area} m²` : '',
    ].filter(Boolean).join(' · ');
    return [
      `*${emp.nome}*`,
      loc,
      det,
      // Mantém as quebras de linha da descrição (formatação do WhatsApp). Vai
      // como mensagem de texto (teto 4096), então cabe a descrição completa.
      emp.descricao ? `\n${String(emp.descricao).replace(/\r\n/g, '\n').trim().slice(0, 2000)}` : '',
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

  // Seletor de imóvel (substitui os ~40 botões que ocupavam o topo da conversa).
  // Mesmas travas dos botões antigos: lead aceito e janela de 24h aberta.
  const abrirSeletorImovel = () => {
    if (!conv?.reservado) { toast.error('Aceite o lead antes de enviar imóveis.'); return; }
    if (!janelaAberta) { toast.error('Janela de 24h fechada — envie um template pra reabrir antes de mandar fotos.'); return; }
    setImovelBusca('');
    setImovelPickerOpen(true);
  };
  const escolherImovel = (emp: any) => {
    setImovelPickerOpen(false);
    setPainelOpen(false);
    if ((emp.fotos || []).length) abrirImovel(emp);
    else enviarImovel(emp);
  };

  const enviarFotosImovel = async () => {
    if (!activeId || !imovelSel || enviandoFotos) return;
    const fotos = (imovelSel.fotos || []).filter((f: any) => fotosSel.has(f.id));
    const texto = imovelMsg.trim();
    if (!fotos.length && !texto) { toast.error('Selecione fotos ou escreva uma mensagem.'); return; }
    setEnviandoFotos(true);
    try {
      if (fotos.length) {
        // O texto/descrição vai como mensagem SEPARADA (nunca como legenda de
        // foto) e as fotos seguem TODAS sem legenda.
        if (texto) await Api.conversationSend(activeId, texto, 'CORRETOR');
        for (let i = 0; i < fotos.length; i++) {
          await Api.conversationSend(
            activeId,
            '',
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
  // ── Etiqueta de temperatura (Quente/Morno/Frio) ────────────────────────────
  const trocarTemperatura = async (leadId: number, key: 'NOVO' | 'QUENTE' | 'MORNO' | 'FRIO') => {
    setTempOpen(false);
    try {
      await Api.setClassificacao(leadId, key);
      reloadConv();
      reloadInbox();
    } catch {
      toast.error('Não consegui atualizar a etiqueta. Tente de novo.');
    }
  };

  // ── Tradutor de saída (PT → inglês/espanhol) ───────────────────────────────
  const traduzirDraft = async (idioma: 'en' | 'es') => {
    const texto = draft.trim();
    if (!texto || traduzindo) return;
    setTraduzOpen(false);
    setTraduzindo(true);
    try {
      const r = await Api.traduzir(texto, idioma);
      // Guarda só o PRIMEIRO original: traduzir de novo (ex.: PT→ES→EN) não pode
      // sobrescrever com a tradução intermediária, senão "Voltar ao original" volta
      // pro idioma errado.
      setDraftPreTraducao((prev) => (prev == null ? texto : prev));
      setDraft(r.traducao);
    } catch {
      toast.error('Não consegui traduzir agora. Tente de novo.');
    } finally {
      setTraduzindo(false);
    }
  };
  const desfazerTraducao = () => {
    if (draftPreTraducao == null) return;
    setDraft(draftPreTraducao);
    setDraftPreTraducao(null);
    setTraduzOpen(false);
  };

  const iniciarGravacao = async () => {
    if (recording) return;
    // Navegador de dentro de app (WhatsApp/Instagram/Facebook) e contexto sem HTTPS
    // não expõem getUserMedia — o prompt de microfone nunca aparece. Detecta antes
    // de chamar pra dar uma orientação certa em vez de erro genérico.
    if (!navigator.mediaDevices?.getUserMedia) {
      if (!window.isSecureContext) {
        toast.error('Gravar áudio exige conexão segura (https). Abra o app em app.grupopons.com.br.');
      } else {
        toast.error('Este navegador não libera microfone. Abra o link no Chrome/Safari — não pelo navegador de dentro do WhatsApp/Instagram.');
      }
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      recChunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mr.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      mediaRecRef.current = mr;
      // timeslice de 1s: o MediaRecorder faz flush do buffer a cada 1s em vez de
      // segurar tudo pra entregar só no stop(). Em gravação longa (ou se a aba é
      // suspensa no meio, comum no navegador do celular), sem timeslice o áudio
      // chegava cortado/pela metade — com flush periódico não perde o que já gravou.
      mr.start(1000);
      setRecSecs(0);
      setRecording(true);
      recTimerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch (e: any) {
      const nome = e?.name || '';
      if (nome === 'NotAllowedError' || nome === 'SecurityError') {
        toast.error('Microfone bloqueado pra este site. Toque no ícone à esquerda do endereço (cadeado) → Permissões → Microfone → Permitir, e tente de novo.');
      } else if (nome === 'NotFoundError' || nome === 'OverconstrainedError') {
        toast.error('Nenhum microfone encontrado no aparelho.');
      } else if (nome === 'NotReadableError' || nome === 'AbortError') {
        toast.error('O microfone está em uso por outro app. Feche o outro app e tente de novo.');
      } else {
        toast.error(`Não consegui acessar o microfone${nome ? ` (${nome})` : ''}. Confira a permissão de microfone do navegador.`);
      }
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
          {/* Topo da lista: abas, busca + botão Filtros (recolhidos), alerta de prazo. */}
          <div className="inbox__top">
            <div className="inbox__tabs">
              <button
                type="button"
                className={'inbox__tab ' + (tab === 'atendendo' ? 'inbox__tab--active' : '')}
                onClick={() => setTab('atendendo')}
              >
                Atendendo <span className="inbox__n">{atendendo.length}</span>
              </button>
              <button
                type="button"
                className={'inbox__tab ' + (tab === 'pendente' ? 'inbox__tab--active' : '')}
                onClick={() => setTab('pendente')}
              >
                Pendente <span className="inbox__n">{pendente.length}</span>
              </button>
            </div>
            <div className="inbox__busca">
              <label className="inbox__busca-campo">
                <Icon name="search" size={15} />
                <input
                  placeholder="Buscar nome, telefone ou e-mail"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  aria-label="Buscar conversa"
                />
              </label>
              <button
                type="button"
                className="ico-btn inbox__filtro-btn"
                onClick={() => setFiltrosAbertos((v) => !v)}
                aria-expanded={filtrosAbertos}
                title="Filtros"
                aria-label="Filtros"
              >
                <IcoFiltro />
                {nFiltros > 0 && <span className="inbox__filtro-n">{nFiltros}</span>}
              </button>
            </div>
            {alertaPulo && (
              <button type="button" className="inbox__alerta" onClick={() => { setTab('pendente'); setActiveId(alertaPulo.prox.id); }}>
                <Icon name="bell" size={16} />
                <span>
                  <b>{alertaPulo.qtd} {alertaPulo.qtd > 1 ? 'leads novos' : 'lead novo'} aguardando aceite</b>
                  <span>O próximo pula em <b><Contagem ate={alertaPulo.prox.puloEm} pausado={alertaPulo.prox.puloPausado} /></b> · {alertaPulo.prox.nome}</span>
                </span>
              </button>
            )}
            {filtrosAbertos && (
              <div className="inbox__filtros">
                <div className="inbox__filtros-tit">Situação</div>
                <div className="inbox__chips">
                  <button
                    type="button"
                    className={'fchip' + (filtroFollowup === 'aguardando' ? ' fchip--on' : '')}
                    onClick={() => setFiltroFollowup(filtroFollowup === 'aguardando' ? '' : 'aguardando')}
                    title="Leads onde o cliente falou por último e espera sua resposta"
                  >
                    <Icon name="clock" size={11} /> Aguardando resposta{inbox?.countAguardando ? ` (${inbox.countAguardando})` : ''}
                  </button>
                  <button
                    type="button"
                    className={'fchip' + (filtroFollowup === 'parados' ? ' fchip--on' : '')}
                    onClick={() => setFiltroFollowup(filtroFollowup === 'parados' ? '' : 'parados')}
                    title="Leads sem nenhuma interação há mais de 1 dia — precisam de retorno"
                  >
                    <Icon name="warn" size={11} /> Parados +1d{inbox?.countParados ? ` (${inbox.countParados})` : ''}
                  </button>
                </div>
                <div className="inbox__filtros-tit">Etiqueta</div>
                <div className="inbox__chips">
                  <button type="button" className={'fchip' + (filtroTemp === '' ? ' fchip--on' : '')} onClick={() => setFiltroTemp('')}>Todas</button>
                  {TEMPERATURAS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className={'fchip' + (filtroTemp === t.key ? ' fchip--on' : '')}
                      onClick={() => setFiltroTemp(filtroTemp === t.key ? '' : t.key)}
                    >
                      <span className="dot" style={{ background: t.cor }} /> {t.label}
                    </button>
                  ))}
                </div>
                {ehGestorAtendimento() && (
                  <>
                    <div className="inbox__filtros-tit">Equipe e corretor</div>
                    {/* Filtro por equipe — só pra quem vê MAIS DE UMA equipe. */}
                    {(equipesFiltro?.length || 0) > 1 && (
                      <select
                        className="field__input"
                        style={{ width: '100%', height: 36 }}
                        value={filtroEquipe}
                        onChange={(e) => { setFiltroEquipe(e.target.value ? Number(e.target.value) : ''); setFiltroCorretor(''); }}
                      >
                        <option value="">Todas as equipes</option>
                        {(equipesFiltro || []).map((eq: any) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
                      </select>
                    )}
                    <CorretorPicker
                      corretores={filtroEquipe ? (corretoresFiltro || []).filter((c: any) => (c.equipe?.id ?? c.equipeId) === filtroEquipe) : corretoresFiltro}
                      value={filtroCorretor}
                      onChange={(id) => setFiltroCorretor(typeof id === 'number' ? id : '')}
                      placeholder="Filtrar por corretor…"
                    />
                  </>
                )}
                {nFiltros > 0 && (
                  <button type="button" className="link-btn" onClick={() => { setFiltroFollowup(''); setFiltroTemp(''); setFiltroEquipe(''); setFiltroCorretor(''); }}>
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
            {inbox?.totalConversas != null && (
              <div className="inbox__contagem">
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
                className={'conv ' + (c.id === activeId ? 'conv--active' : '') + (c.puloEm && !c.reservado ? ' conv--novo' : '')}
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
                <div className="conv__av">
                  <div className="avatar">{initials(c.nome)}</div>
                  <span className="conv__temp" style={{ background: tempInfo(c.classificacao).cor }} title={`Etiqueta: ${tempInfo(c.classificacao).label}`} />
                </div>
                <div className="conv__main">
                  <div className="conv__name">
                    <span className="conv__nome-l">
                      <span className="conv__nome">{c.nome}</span>
                      {c.vip && <Icon name="star" size={11} style={{ color: '#7c3aed', flexShrink: 0 }} />}
                      <ChegadaChip c={c.chegada} />
                    </span>
                    <span className="conv__time">
                      {c.ultimaMensagem ? timeAgo(c.ultimaMensagem.createdAt) : timeAgo(c.createdAt)}
                    </span>
                  </div>
                  <div className="conv__linha">
                    <div className="conv__last">
                      {c.ultimaMensagem ? (
                        <>
                          {/* Nossa msg (outbound): ticks de entregue/lido igual WhatsApp */}
                          {(c.ultimaMensagem.direction === 'outbound' || c.ultimaMensagem.autor === 'CORRETOR' || c.ultimaMensagem.autor === 'IA') && (
                            <span style={{ marginRight: 3, verticalAlign: 'middle' }}><StatusTicks m={c.ultimaMensagem} /></span>
                          )}
                          {(c.ultimaMensagem.texto || '').slice(0, 60)}
                        </>
                      ) : (
                        c.interesse || '—'
                      )}
                    </div>
                    {c.puloEm && !c.reservado ? (
                      <span className="mini mini--pula" title="Tempo até o lead pular para outro corretor">pula <Contagem ate={c.puloEm} pausado={c.puloPausado} /></span>
                    ) : !c.reservado && c.iaAtendendo ? (
                      <span className={'mini ' + (c.iaLimiteAtingido ? 'mini--esg' : 'mini--ia')}>IA {c.iaLimiteAtingido ? 3 : c.iaRespostasCount || 0}/3</span>
                    ) : null}
                  </div>
                  {/* Só gestor: corretor que atende (abre a ficha) e a origem do lead */}
                  {ehGestorAtendimento() && (c.corretor?.nome || c.origem) && (
                    <div className="conv__quem">
                      {c.corretor?.nome && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); abrirFichaCorretor(c.corretor?.id); }}
                          title="Abrir ficha do corretor"
                        >
                          <Icon name="users" size={10} /> {c.corretor.nome}
                        </button>
                      )}
                      {c.origem && <span>{c.corretor?.nome ? ' · ' : ''}{origemLabel(c.origem)}</span>}
                    </div>
                  )}
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
                {/* Linha 1 — voltar · avatar+nome+contato (abre Dados do lead) · Aceitar · Resumir · ⋮ */}
                <div className="thread__hd-main">
                  <button
                    className="thread__back"
                    onClick={() => setActiveId(null)}
                    title="Voltar para a lista"
                    aria-label="Voltar"
                  >
                    <Icon name="arrow_left" size={18} />
                  </button>
                  <button type="button" className="thread__quem" onClick={() => setPainelOpen(true)} title="Dados do lead">
                    <div className="avatar">{initials(conv.nome)}</div>
                    <div className="thread__hd-id">
                      <div className="thread__hd-name">
                        <span className="thread__hd-nome">{conv.nome}</span>
                        {conv.vip && <Icon name="star" size={12} style={{ color: '#7c3aed', flexShrink: 0 }} />}
                        <ChegadaChip c={(conv as any).chegada} />
                      </div>
                      <div className="thread__hd-meta">
                        {(conv as any).telefoneLiberado && conv.telefone ? (
                          <span className="thread__tel-ok">{conv.telefone}</span>
                        ) : (
                          <span className="thread__tel-prot">
                            {conv.telefone
                              ? (conv as any).liberacaoStatus === 'PENDENTE' ? 'Liberação pedida · aguardando o gestor' : 'Telefone protegido'
                              // Lead que chegou SEM número: não é bloqueio — não há o que liberar.
                              : conv.telefoneOculto ? 'Telefone protegido' : 'Sem telefone — o lead veio sem número'}
                          </span>
                        )}
                        {(conv as any).email ? ` · ${(conv as any).email}` : ''}
                      </div>
                    </div>
                  </button>
                  <div className="thread__hd-dir">
                    {!conv.reservado && (
                      <button className="btn btn--sm thread__aceitar-topo" onClick={aceitarLead} title="Assumir o atendimento deste lead">
                        <Icon name="check" size={13} /> Aceitar<span className="thread__aceitar-txt"> lead</span>
                        {(conv as any).puloEm && <> · <Contagem ate={(conv as any).puloEm} pausado={(conv as any).puloPausado} /></>}
                      </button>
                    )}
                    <button type="button" className="ico-btn ico-btn--ia" onClick={resumirConversa} disabled={resumindo} title="Resumir conversa (IA) — não envia nada" aria-label="Resumir conversa">
                      <IconeIA size={18} />
                    </button>
                    <div className="pop-wrap">
                      <button
                        type="button"
                        className="ico-btn"
                        onClick={() => setAcoesOpen((o) => !o)}
                        aria-expanded={acoesOpen}
                        title="Ações do atendimento"
                        aria-label="Ações do atendimento"
                      >
                        <IcoKebab />
                      </button>
                      {acoesOpen && (
                        <>
                          <div className="quick-backdrop" onClick={() => { setAcoesOpen(false); setRetornoOpen(false); }} />
                          <div className="menu-pop menu-pop--dir" role="menu">
                            {/* Liberação de contato: corretor SOLICITA (gestor aprova); gestão LIBERA DIRETO. */}
                            {!(conv as any).telefoneLiberado && conv.telefone && ((conv as any).liberacaoStatus === 'PENDENTE' && !liberaDireto() ? (
                              <button type="button" className="menu-op" disabled>
                                <Icon name="clock" size={15} /><span>Liberação pendente<small>Aguardando aprovação do gestor.</small></span>
                              </button>
                            ) : (
                              <button type="button" className="menu-op" onClick={() => { setAcoesOpen(false); liberarContato(); }}>
                                <Icon name="phone" size={15} /><span>{liberaDireto() ? 'Liberar contato' : 'Solicitar liberação'}<small>{liberaDireto() ? 'Mostra o telefone na hora. Ação auditada.' : 'Vai para o gestor aprovar. Motivo obrigatório.'}</small></span>
                              </button>
                            ))}
                            {conv.reservado && (
                              <>
                                <button type="button" className="menu-op" onClick={() => setRetornoOpen((o) => !o)}>
                                  <Icon name="clock" size={15} /><span>Agendar retorno<small>Lembrete para falar de novo.</small></span>
                                </button>
                                {retornoOpen && (
                                  <div className="menu-sub">
                                    {[{ h: 3, l: 'Em 3 horas' }, { h: 24, l: 'Amanhã' }, { h: 48, l: 'Em 2 dias' }, { h: 168, l: 'Em 1 semana' }].map((o) => (
                                      <button key={o.h} type="button" className="btn btn--secondary btn--sm" onClick={() => { setAcoesOpen(false); agendarRetorno(o.h, o.l.toLowerCase()); }}>{o.l}</button>
                                    ))}
                                  </div>
                                )}
                                <button type="button" className="menu-op" onClick={() => { setAcoesOpen(false); abrirTabular(); }}>
                                  <Icon name="warn" size={15} /><span>Tabular<small>Registra o desfecho. Conforme o motivo, volta para a base.</small></span>
                                </button>
                                <button type="button" className="menu-op" onClick={() => { setAcoesOpen(false); marcarNegociacao(); }}>
                                  <Icon name="flag" size={15} /><span>Negociação<small>Marca como Em Negociação no funil.</small></span>
                                </button>
                              </>
                            )}
                            {/* Direcionar: SÓ gestão (nunca corretor), mesmo com lead não-reservado. */}
                            {podeDirecionar && (
                              <button type="button" className="menu-op" onClick={() => { setAcoesOpen(false); abrirDirecionar(); }}>
                                <Icon name="send" size={15} /><span>Direcionar<small>Para outro corretor, equipe, fila ou base.</small></span>
                              </button>
                            )}
                            <button type="button" className="menu-op" onClick={() => { setAcoesOpen(false); resumirConversa(); }}>
                              <IconeIA size={15} /><span>Resumir conversa<small>A IA resume. Não envia nada.</small></span>
                            </button>
                            <button type="button" className="menu-op" onClick={() => { setAcoesOpen(false); setPainelOpen(true); }}>
                              <IcoInfo size={15} /><span>Dados do lead<small>Contato, interesse{ehGestorAtendimento() ? ', origem, corretor e fila' : ''}.</small></span>
                            </button>
                            {conv.reservado && (
                              <>
                                <div className="menu-sep" />
                                <button type="button" className="menu-op menu-op--perigo" onClick={() => { setAcoesOpen(false); rejeitarLead(); }}>
                                  <Icon name="x" size={15} /><span>Rejeitar<small>Marca como Perdido. Pede confirmação.</small></span>
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Linha 2 — só o essencial: situação, janela 24h, etiqueta, etapa (+ gestão: origem e corretor) */}
                <div className="thread__hd-sub">
                  <span className={'badge ' + (conv.reservado ? 'badge--signed' : 'badge--analysis')}>
                    {conv.reservado ? 'ATENDENDO' : 'PENDENTE'}
                  </span>
                  <Janela24h conv={conv} />
                  {/* Etiqueta de temperatura — clicável pra trocar (popover abre pra baixo) */}
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      type="button"
                      className="badge"
                      onClick={() => setTempOpen((o) => !o)}
                      title="Trocar etiqueta do lead"
                      style={{ background: tempInfo((conv as any).classificacao).bg, color: tempInfo((conv as any).classificacao).cor, cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: tempInfo((conv as any).classificacao).cor, display: 'inline-block' }} />
                      {tempInfo((conv as any).classificacao).label}
                      <Icon name="chevron-down" size={10} />
                    </button>
                    {tempOpen && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setTempOpen(false)} />
                        <div className="menu-pop" style={{ top: 'calc(100% + 6px)', left: 0, minWidth: 150 }}>
                          {TEMPERATURAS.map((t) => (
                            <button key={t.key} type="button" className="menu-op" onClick={() => trocarTemperatura(conv.id, t.key)}>
                              <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.cor, display: 'inline-block' }} />
                              <span>{t.label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <button type="button" className="badge thread__etapa" onClick={abrirStatus} title="Atualizar o status da negociação">
                    <Icon name="flag" size={10} /> {statusLabel(conv.status)}
                  </button>
                  {ehGestorAtendimento() && conv.origem && (
                    <button type="button" className="badge thread__origem" onClick={() => setPainelOpen(true)} title="Ver origem e campanha">
                      <IcoInfo size={10} /> {origemLabel(conv.origem)}{(conv as any).campanha ? ` · ${(conv as any).campanha}` : ''}
                    </button>
                  )}
                  {/* Só gestor: quem atende este lead — clica pra abrir a ficha do corretor */}
                  {ehGestorAtendimento() && (conv as any).corretor?.nome && (
                    <button
                      type="button"
                      className="badge thread__corretor"
                      onClick={() => abrirFichaCorretor((conv as any).corretor?.id)}
                      title="Abrir ficha do corretor"
                    >
                      <Icon name="users" size={10} /> {(conv as any).corretor.nome}
                    </button>
                  )}
                </div>
              </div>
              {/* Prazo de aceite: lead ainda não aceito com pulo correndo. */}
              {!conv.reservado && (conv as any).puloEm ? (
                <div className="prazo" role="status">
                  <Icon name="bell" size={18} />
                  <span>
                    <b>Lead novo · aguardando seu aceite.</b> Se não aceitar em <b><Contagem ate={(conv as any).puloEm} pausado={(conv as any).puloPausado} /></b>, ele vai para o próximo corretor. WhatsApp pessoal não conta.
                  </span>
                  <b className="prazo__relogio"><Contagem ate={(conv as any).puloEm} pausado={(conv as any).puloPausado} /></b>
                </div>
              ) : !conv.reservado && (conv as any).chegada === 'gestor' ? (
                <div className="prazo prazo--calmo">
                  <IcoInfo size={16} />
                  <span>Direcionado pelo gestor: <b>sem prazo de 5 minutos</b>, não pula para outro corretor.</span>
                </div>
              ) : null}
              {resumo && resumo.leadId === conv.id && (
                <div className="ia-card ia-card--resumo" role="status">
                  <div className="ia-card__topo">
                    <span className="ia-card__tit"><IconeIA /> Resumo da conversa</span>
                    <button type="button" className="ia-card__link" onClick={() => setResumo(null)}>Fechar</button>
                  </div>
                  <ul>{resumo.itens.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  {resumo.proximo && <p><b>Próximo passo:</b> {resumo.proximo}</p>}
                </div>
              )}
              {resumindo && (
                <div className="ia-card ia-card--resumo" role="status"><span className="ia-card__tit"><IconeIA /> IA lendo a conversa…</span></div>
              )}
              <BannerRedistribuicao info={(conv as any)._redistribution} leadId={conv.id} />
              <div className="thread__messages" ref={messagesContainerRef}>
                {/* Avisos do SISTEMA em sequência (só a gestão vê) viram um botão "N avisos". */}
                {(() => {
                  const out: React.ReactNode[] = [];
                  for (let i = 0; i < mensagens.length; i++) {
                    const m = mensagens[i];
                    if (m.autor !== 'SISTEMA') { out.push(<MessageBubble key={m.id} m={m} />); continue; }
                    let j = i;
                    while (j < mensagens.length && mensagens[j].autor === 'SISTEMA') j++;
                    const grupo = mensagens.slice(i, j);
                    const chave = String(grupo[0].id);
                    if (grupo.length > 1 && !sysAbertos.has(chave)) {
                      out.push(
                        <button key={'g' + chave} type="button" className="sys-grupo" onClick={() => setSysAbertos((s) => new Set(s).add(chave))}>
                          {grupo.length} avisos do sistema · ver
                        </button>,
                      );
                    } else {
                      grupo.forEach((g) => out.push(<MessageBubble key={g.id} m={g} />));
                      if (grupo.length > 1) {
                        out.push(
                          <button key={'h' + chave} type="button" className="sys-grupo" onClick={() => setSysAbertos((s) => { const n = new Set(s); n.delete(chave); return n; })}>
                            ocultar avisos
                          </button>,
                        );
                      }
                    }
                    i = j - 1;
                  }
                  return out;
                })()}
                {enviandoBolha && (
                  <div className={'bubble ' + (enviandoBolha.nota ? 'bubble--NOTA' : 'bubble--CORRETOR')} style={{ opacity: 0.7 }}>
                    {enviandoBolha.anexoNome && <div style={{ fontSize: 12, fontWeight: 700 }}>{enviandoBolha.anexoNome}</div>}
                    {enviandoBolha.texto}
                    <div className="bubble__meta" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="clock" size={10} /> {enviandoBolha.nota ? 'salvando…' : 'enviando…'}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              {!conv?.reservado ? (
                <ComposerPendenteIA
                  onAceitar={aceitarLead}
                  onAbrirTemplates={podeTemplate ? abrirTemplates : undefined}
                  onSalvarNota={salvarNota}
                  respostasUsadas={(conv as any).iaRespostasCount || 0}
                  limiteAtingido={!!(conv as any).iaLimiteAtingido}
                />
              ) : !janelaAberta ? (
                <ComposerJanelaFechada
                  onAbrirTemplates={podeTemplate ? abrirTemplates : undefined}
                  temEmail={!!(conv as any).email}
                  onSalvarNota={salvarNota}
                  onAceitar={aceitarLead}
                  mostrarAceitar={!(conv as any).assumido}
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
                  {!notaMode && !recording && (iaCarregando || (iaSug && iaSug.leadId === conv.id)) && (
                    <div className="ia-card ia-card--sug" role="group" aria-label="Sugestões da IA">
                      {iaCarregando ? (
                        <span className="ia-card__tit"><IconeIA /> IA analisando sua mensagem…</span>
                      ) : (
                        <>
                          <span className="ia-card__tit"><IconeIA /> {iaSug!.modo === 'corrigir' ? 'Correção' : 'Mensagem melhorada'} · toque numa opção para enviar</span>
                          {iaSug!.opcoes.map((o, i) => (
                            <button key={i} type="button" className="ia-op" onClick={() => enviar(o.texto)} disabled={sending}>
                              <b>{o.rotulo}</b>
                              <span>{o.texto}</span>
                            </button>
                          ))}
                          <button type="button" className="ia-card__link" onClick={() => setIaSug(null)}>Manter o meu texto</button>
                        </>
                      )}
                    </div>
                  )}
                  {notaMode && !recording && (
                    <div className="nota-faixa">
                      <span><Icon name="pencil" size={13} /> Nota interna — o cliente não recebe</span>
                      <button type="button" className="ia-card__link" onClick={() => setNotaMode(false)}>Voltar para mensagem</button>
                    </div>
                  )}
                  {!notaMode && !recording && (!!draft.trim() || draftPreTraducao != null) && (
                    <div className="ia-barra">
                      {!!draft.trim() && (
                        <>
                          <button type="button" className="ia-chip" onClick={() => pedirIaTexto('corrigir')} disabled={!!iaCarregando || sending}>
                            <IconeIA /> Corrigir escrita
                          </button>
                          <button type="button" className="ia-chip" onClick={() => pedirIaTexto('melhorar')} disabled={!!iaCarregando || sending}>
                            <IconeIA /> Melhorar
                          </button>
                        </>
                      )}
                      <div className="quick-wrap">
                        <button
                          type="button"
                          className="ia-chip ia-chip--neutro"
                          title="Traduzir a mensagem antes de enviar (inglês/espanhol)"
                          onClick={() => setTraduzOpen((o) => !o)}
                          disabled={sending || traduzindo}
                        >
                          <Icon name="globe" size={12} /> {traduzindo ? 'Traduzindo…' : 'Traduzir'}
                        </button>
                        {traduzOpen && (
                          <>
                            <div className="quick-backdrop" onClick={() => setTraduzOpen(false)} />
                            <div className="quick-pop">
                              <div className="quick-pop__head">Traduzir mensagem</div>
                              {!!draft.trim() && <button className="quick-item" onClick={() => traduzirDraft('en')}>Inglês (EN)</button>}
                              {!!draft.trim() && <button className="quick-item" onClick={() => traduzirDraft('es')}>Espanhol (ES)</button>}
                              {draftPreTraducao != null && (
                                <button className="quick-item" onClick={desfazerTraducao}>Voltar ao original</button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  <div className={'composer composer--wa' + (notaMode ? ' composer--nota' : '')}>
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
                        {/* Botão + : anexo, imóvel, respostas rápidas, template (gestão), nota interna */}
                        <div className="quick-wrap">
                          <button
                            type="button"
                            className="ico-btn"
                            title="Anexar, imóvel, respostas rápidas, nota"
                            aria-label="Mais opções"
                            aria-expanded={maisOpen || quickOpen}
                            onClick={() => { setQuickOpen(false); setMaisOpen((o) => !o); }}
                            disabled={sending}
                          >
                            <Icon name="plus" size={20} />
                          </button>
                          {maisOpen && (
                            <>
                              <div className="quick-backdrop" onClick={() => setMaisOpen(false)} />
                              <div className="menu-pop menu-pop--cima" role="menu">
                                <button type="button" className="menu-op" onClick={() => { setMaisOpen(false); fileInputRef.current?.click(); }} disabled={uploadingAnexo}>
                                  <Icon name="paperclip" size={15} /><span>Foto ou arquivo<small>Imagem, vídeo ou documento. Imagem grande é comprimida.</small></span>
                                </button>
                                <button type="button" className="menu-op" onClick={() => { setMaisOpen(false); abrirSeletorImovel(); }}>
                                  <IcoCasa size={15} /><span>Enviar imóvel<small>{(empreendimentos || []).length} empreendimentos, com fotos e descrição.</small></span>
                                </button>
                                <button type="button" className="menu-op" onClick={() => { setMaisOpen(false); setQuickOpen(true); }}>
                                  <Icon name="zap" size={15} /><span>Respostas rápidas<small>Insere o texto para você revisar.</small></span>
                                </button>
                                {podeTemplate && (
                                  <button type="button" className="menu-op" onClick={() => { setMaisOpen(false); setTemplatePickerOpen(true); }}>
                                    <Icon name="doc" size={15} /><span>Template<small>Mensagem aprovada pela Meta.</small></span>
                                  </button>
                                )}
                                <button type="button" className="menu-op" onClick={() => { setMaisOpen(false); setNotaMode((v) => !v); }}>
                                  <Icon name="pencil" size={15} /><span>{notaMode ? 'Voltar para mensagem' : 'Nota interna'}<small>{notaMode ? 'Envia ao cliente de novo.' : 'O cliente não recebe.'}</small></span>
                                </button>
                              </div>
                            </>
                          )}
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
                        <button type="button" className="ico-btn" title="Enviar imóvel do portfólio" aria-label="Enviar imóvel do portfólio" onClick={abrirSeletorImovel} disabled={sending}>
                          <IcoCasa />
                        </button>
                        <textarea
                          className={notaMode ? 'composer__input--nota' : undefined}
                          placeholder={sending ? 'Enviando…' : notaMode ? 'Nota interna — o lead NÃO recebe…' : anexo ? 'Legenda (opcional)…' : `Mensagem para ${(conv.nome || '').split(' ')[0] || 'o cliente'}`}
                          value={draft}
                          onChange={(e) => { setDraft(e.target.value); if (iaSug) setIaSug(null); }}
                          onKeyDown={(e) => {
                            if (teclaEnterEnvia && e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              enviar();
                            }
                          }}
                          disabled={sending}
                        />
                        {/* Campo vazio → microfone (estilo WhatsApp); com texto/anexo/nota → enviar.
                            Nos apps nativos antigos falta a permissão de microfone (iOS mata o app):
                            micDisponivel só libera nos builds que declaram a permissão. */}
                        {micDisponivel && !draft.trim() && !anexo && !notaMode ? (
                          <button
                            className="ico-btn composer__mic"
                            title="Gravar áudio"
                            aria-label="Gravar áudio"
                            onClick={iniciarGravacao}
                            disabled={sending || uploadingAnexo}
                          >
                            <IcoMic />
                          </button>
                        ) : (
                          <button
                            className={'composer__enviar ' + (notaMode ? 'composer__nota-send' : '')}
                            onClick={enviar}
                            title={notaMode ? 'Salvar nota interna' : 'Enviar mensagem'}
                            aria-label={notaMode ? 'Salvar nota interna' : 'Enviar mensagem'}
                            disabled={sending || uploadingAnexo || (notaMode ? !draft.trim() : (!draft.trim() && !anexo))}
                          >
                            <Icon name={notaMode ? 'check' : 'send'} size={18} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
              {imovelPickerOpen && (() => {
                const q = imovelBusca.trim().toLowerCase();
                const todos = (empreendimentos || []) as any[];
                const interesse = todos.find((e) => e.nome && (conv as any).interesse && e.nome.toLowerCase() === String((conv as any).interesse).toLowerCase());
                const lista = q ? todos.filter((e) => String(e.nome || '').toLowerCase().includes(q)) : todos;
                return (
                  <Modal
                    open
                    onClose={() => setImovelPickerOpen(false)}
                    title="Enviar imóvel"
                    subtitle="Escolha o empreendimento. Depois você marca as fotos e edita o texto."
                    size="sm"
                  >
                    <input
                      className="field__input"
                      style={{ width: '100%', height: 38, marginBottom: 10 }}
                      placeholder="Buscar empreendimento"
                      value={imovelBusca}
                      onChange={(e) => setImovelBusca(e.target.value)}
                      autoFocus
                      aria-label="Buscar empreendimento"
                    />
                    {!q && interesse && (
                      <>
                        <div className="uppercase-tag" style={{ marginBottom: 6 }}>Sugerido para {(conv.nome || '').split(' ')[0]}</div>
                        <button type="button" className="emp-card emp-card--int" onClick={() => escolherImovel(interesse)}>
                          <b>{interesse.nome}</b>
                          <small>Interesse do cliente{(interesse.fotos || []).length ? ` · ${interesse.fotos.length} fotos` : ''}</small>
                        </button>
                        <div className="uppercase-tag" style={{ margin: '12px 0 6px' }}>Todos os empreendimentos ({todos.length})</div>
                      </>
                    )}
                    <div className="emp-lista">
                      {lista.length ? lista.map((e) => (
                        <button key={e.id} type="button" onClick={() => escolherImovel(e)}>
                          <span>{e.nome}</span>
                          <small>{(e.fotos || []).length ? `${e.fotos.length} fotos` : 'só descrição'}</small>
                        </button>
                      )) : <div className="text-xs text-secondary" style={{ padding: 12 }}>Nenhum empreendimento com esse nome.</div>}
                    </div>
                  </Modal>
                );
              })()}
              {painelOpen && (
                <>
                  <div className="lead-painel__veu" onClick={() => setPainelOpen(false)} />
                  <aside className="lead-painel" aria-label="Dados do lead">
                    <div className="lead-painel__topo">
                      <button type="button" className="ico-btn" onClick={() => setPainelOpen(false)} aria-label="Fechar"><Icon name="x" size={18} /></button>
                      <b>Dados do lead</b>
                    </div>
                    <div className="lead-painel__hero">
                      <div className="avatar avatar--xl">{initials(conv.nome)}</div>
                      <b>{conv.nome}</b>
                      {(conv as any).interesse && <span className="text-secondary">{(conv as any).interesse}</span>}
                    </div>
                    <div className="lead-painel__sec">
                      <h4>Contato</h4>
                      <div className="lead-painel__lin">
                        <span>Telefone</span>
                        <span>
                          {(conv as any).telefoneLiberado && conv.telefone ? (
                            <a href={`https://wa.me/${conv.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{conv.telefone}</a>
                          ) : conv.telefone ? 'Protegido' : conv.telefoneOculto ? 'Protegido' : 'Veio sem número'}
                        </span>
                      </div>
                      <div className="lead-painel__lin">
                        <span>E-mail</span>
                        <span>{(conv as any).email ? <a href={`mailto:${(conv as any).email}`}>{(conv as any).email}</a> : '—'}</span>
                      </div>
                      {!(conv as any).telefoneLiberado && conv.telefone && !((conv as any).liberacaoStatus === 'PENDENTE' && !liberaDireto()) && (
                        <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setPainelOpen(false); liberarContato(); }}>
                          <Icon name="phone" size={13} /> {liberaDireto() ? 'Liberar contato' : 'Solicitar liberação'}
                        </button>
                      )}
                    </div>
                    <div className="lead-painel__sec">
                      <h4>Atendimento</h4>
                      {(conv as any).interesse && (
                        <button type="button" className="btn btn--secondary btn--sm" onClick={() => {
                          const emp = (empreendimentos || []).find((e: any) => String(e.nome || '').toLowerCase() === String((conv as any).interesse).toLowerCase());
                          if (!emp) { abrirSeletorImovel(); return; }
                          if (!conv.reservado) { toast.error('Aceite o lead antes de enviar imóveis.'); return; }
                          if (!janelaAberta) { toast.error('Janela de 24h fechada — envie um template pra reabrir antes de mandar fotos.'); return; }
                          escolherImovel(emp);
                        }}>
                          <IcoCasa size={14} /> Enviar {(conv as any).interesse}
                        </button>
                      )}
                      {(conv as any).chegada && <div className="lead-painel__lin"><span>Como chegou</span><span><ChegadaChip c={(conv as any).chegada} /></span></div>}
                      <div className="lead-painel__lin"><span>Etiqueta</span><span style={{ color: tempInfo((conv as any).classificacao).cor }}>{tempInfo((conv as any).classificacao).label}</span></div>
                      <div className="lead-painel__lin"><span>Etapa</span><span>{statusLabel(conv.status)}</span></div>
                      <div className="lead-painel__lin"><span>Mensagens</span><span>{mensagens.filter((m) => m.autor !== 'SISTEMA').length}</span></div>
                    </div>
                    {ehGestorAtendimento() ? (
                      <div className="lead-painel__sec">
                        <h4>De onde veio</h4>
                        <div className="lead-painel__lin"><span>Origem</span><span>{origemLabel(conv.origem) || '—'}</span></div>
                        <div className="lead-painel__lin"><span>Campanha</span><span>{(conv as any).campanha || '—'}</span></div>
                        {(conv as any).criativo && <div className="lead-painel__lin"><span>Anúncio</span><span>{(conv as any).criativo}</span></div>}
                        <div className="lead-painel__lin"><span>Fila</span><span>{(conv as any).roleta || '—'}</span></div>
                        <div className="lead-painel__lin">
                          <span>Corretor</span>
                          <span>{(conv as any).corretor?.nome ? (
                            <button type="button" className="link-btn" onClick={() => abrirFichaCorretor((conv as any).corretor?.id)}>{(conv as any).corretor.nome}</button>
                          ) : '—'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="lead-painel__sec"><span className="text-xs text-secondary">Origem e campanha ficam só com a gestão.</span></div>
                    )}
                  </aside>
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
              {fichaCorretorId && (
                <FichaCorretorModal id={fichaCorretorId} onClose={() => setFichaCorretorId(null)} />
              )}
              <Modal
                open={liberarOpen}
                onClose={() => !liberarSending && setLiberarOpen(false)}
                title={liberaDireto() ? 'Liberar contato' : 'Solicitar liberação de contato'}
                subtitle={liberaDireto()
                  ? `O telefone de ${conv?.nome || 'lead'} fica visível na hora pra quem atende o lead. Ação auditada.`
                  : `Sua solicitação para ver o telefone de ${conv?.nome || 'lead'} vai pro gestor aprovar. Você é avisado do resultado no app e no WhatsApp. Ação auditada.`}
                size="sm"
                footer={
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn--ghost" onClick={() => setLiberarOpen(false)} disabled={liberarSending}>
                      Cancelar
                    </button>
                    <button className="btn btn--primary" onClick={confirmarLiberar} disabled={liberarSending || !liberarJustif.trim()}>
                      {liberarSending ? 'Enviando…' : liberaDireto() ? 'Liberar contato' : 'Solicitar liberação'}
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
                open={direcionarOpen}
                onClose={() => !direcionando && setDirecionarOpen(false)}
                title="Direcionar lead"
                subtitle={`Repassar ${conv?.nome || 'este lead'} para outro corretor, equipe, fila ou base.`}
                size="sm"
                footer={
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn--ghost" onClick={() => setDirecionarOpen(false)} disabled={direcionando}>
                      Cancelar
                    </button>
                    <button className="btn btn--primary" onClick={confirmarDirecionar} disabled={direcionando || !alvoDir}>
                      {direcionando ? 'Direcionando…' : 'Direcionar'}
                    </button>
                  </div>
                }
              >
                <label className="field__label" style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>
                  Destino
                </label>
                <DestinoPicker
                  corretores={corretoresFiltro}
                  equipes={equipesFiltro}
                  filas={filasDir}
                  bases={basesDir}
                  bolsoes={bolsoesDir}
                  value={alvoDir}
                  onChange={setAlvoDir}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={dirTelefoneVisivel} onChange={(e) => setDirTelefoneVisivel(e.target.checked)} />
                  Liberar o telefone do lead pro corretor que receber
                </label>
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

// Ícone da IA (brilho) — usado nos botões amarelos de corrigir/melhorar/resumir.
function IconeIA({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6zM19 14l.9 2.6L22 17.5l-2.1.9L19 21l-.9-2.6L16 17.5l2.1-.9z" />
    </svg>
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
      {!isOutbound && (m.contentType || 'text').toLowerCase() === 'text' && !!m.texto?.trim() && <TraduzirRecebida texto={m.texto} />}
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
    return <AudioBody m={m} />;
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

// Tradução da mensagem RECEBIDA → português. Autocontido: cada bolha guarda seu
// próprio estado. Clicar de novo esconde. Aparece só em mensagens do lead com texto.
function TraduzirRecebida({ texto }: { texto: string }) {
  const [loading, setLoading] = useState(false);
  const [traducao, setTraducao] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const acionar = async () => {
    if (loading) return;
    if (traducao) { setTraducao(null); return; }
    setLoading(true); setErro(false);
    try {
      const r = await Api.traduzir(texto, 'pt');
      setTraducao(r.traducao);
    } catch { setErro(true); } finally { setLoading(false); }
  };
  return (
    <div style={{ marginTop: 5 }}>
      <button
        type="button"
        onClick={acionar}
        disabled={loading}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--pons-blue)', fontSize: 11, fontWeight: 600, opacity: 0.85 }}
      >
        <Icon name="globe" size={11} /> {loading ? 'Traduzindo…' : traducao ? 'Ocultar tradução' : 'Traduzir'}
      </button>
      {erro && <div style={{ marginTop: 3, fontSize: 12, color: 'var(--text-secondary)' }}>Não consegui traduzir agora.</div>}
      {traducao && (
        <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px dashed var(--border-light)', fontSize: 13, whiteSpace: 'pre-wrap' }}>
          {traducao}
        </div>
      )}
    </div>
  );
}

// Imagem recolhível: por padrão mostra só um chip "Ver imagem" pra não poluir a
// conversa quando há muitas mídias. Ao clicar, expande inline; pode recolher de
// novo. Responsivo: a imagem nunca passa de 75% da largura disponível.
// Ficha leve do corretor — abre em modal no Atendimento (só gestor). Nome, CRECI,
// e-mail e total de leads, sem sair da tela.
function FichaCorretorModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: c, loading, error } = useApi<any>(() => Api.corretor(id), [id]);
  const linha = (rotulo: string, valor: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 2px', borderBottom: '1px solid var(--border-light)' }}>
      <span className="text-secondary" style={{ fontWeight: 700, fontSize: 13 }}>{rotulo}</span>
      <span style={{ fontSize: 14, textAlign: 'right', wordBreak: 'break-word' }}>{valor}</span>
    </div>
  );
  return (
    <Modal open onClose={onClose} title="Ficha do corretor" size="md">
      {loading ? (
        <div style={{ padding: 16, color: 'var(--text-secondary)' }}>Carregando…</div>
      ) : error || !c ? (
        <div style={{ padding: 16, color: 'var(--text-secondary)' }}>Não consegui carregar a ficha.</div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div className="avatar">{c.initials}</div>
            <div>
              <div style={{ fontWeight: 700 }}>{c.nome}</div>
              <div className="text-xs text-secondary">{c.equipe?.nome || 'Sem equipe'} · {c.status}</div>
            </div>
          </div>
          {linha('CRECI', c.creci || '—')}
          {linha('E-mail', c.email || '—')}
          {linha('Telefone', c.phone || '—')}
          {linha('Leads', <strong>{c.leadsCount ?? '—'}</strong>)}
        </div>
      )}
    </Modal>
  );
}

const AUDIO_SPEEDS = [1, 1.25, 1.5, 2];
function AudioBody({ m }: { m: Mensagem }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [transcricao, setTranscricao] = useState<string | null>(null);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [transcErro, setTranscErro] = useState(false);
  const aplicar = (idx: number) => {
    if (audioRef.current) audioRef.current.playbackRate = AUDIO_SPEEDS[idx];
  };
  const ciclar = () => {
    const next = (speedIdx + 1) % AUDIO_SPEEDS.length;
    setSpeedIdx(next);
    aplicar(next);
  };
  const transcrever = async () => {
    if (transcrevendo) return;
    if (transcricao) { setTranscricao(null); return; } // toggle: esconde
    // Cache local: se a mensagem já veio com transcrição, mostra na hora (sem chamar).
    if ((m as any).transcricao != null) { setTranscricao((m as any).transcricao || '(áudio sem fala reconhecível)'); return; }
    if (!m.id) return;
    setTranscrevendo(true); setTranscErro(false);
    try {
      const r = await Api.transcreverAudio(m.id);
      setTranscricao(r.texto || '(áudio sem fala reconhecível)');
    } catch { setTranscErro(true); } finally { setTranscrevendo(false); }
  };
  const label = `${AUDIO_SPEEDS[speedIdx]}x`;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <audio
          ref={audioRef}
          src={m.fileUrl || undefined}
          controls
          preload="none"
          style={{ maxWidth: 260 }}
          onLoadedMetadata={() => aplicar(speedIdx)}
          onPlay={() => aplicar(speedIdx)}
        />
        <button
          type="button"
          onClick={ciclar}
          title="Velocidade de reprodução"
          style={{ flex: '0 0 auto', border: '1px solid var(--border-light)', background: 'var(--bg-card-hover)', color: 'var(--text-secondary)', borderRadius: 14, padding: '3px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer', minWidth: 46, lineHeight: 1.2 }}
        >
          {label}
        </button>
      </div>
      <button
        type="button"
        onClick={transcrever}
        disabled={transcrevendo}
        style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--pons-blue)', fontSize: 11, fontWeight: 600, opacity: 0.85 }}
      >
        <Icon name="doc" size={11} /> {transcrevendo ? 'Transcrevendo…' : transcricao ? 'Ocultar transcrição' : 'Transcrever'}
      </button>
      {transcErro && <div style={{ marginTop: 3, fontSize: 12, color: 'var(--text-secondary)' }}>Não consegui transcrever agora.</div>}
      {transcricao && (
        <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px dashed var(--border-light)', fontSize: 13, whiteSpace: 'pre-wrap' }}>
          {transcricao}
        </div>
      )}
    </div>
  );
}

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

  // Sem resposta do lead: não mostra badge (era confuso/redundante — se não
  // respondeu, é óbvio que está fechada). O composer já convida a enviar template.
  if (!lastInboundAt) return null;

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

  // Fechada: não mostra badge (só o "Aberta · contador" aparece, que é o útil).
  return null;
}

// Banner amarelo mostrando que esta conversa foi recebida via redistribuição.
// Aparece SÓ quando histórico veio junto (lead já tinha respondido) — caso
// contrário o histórico foi descartado e não há por que sinalizar.
function BannerRedistribuicao({ info, leadId }: { info: any; leadId?: number }) {
  // Aparece por 5s ao abrir a conversa e some sozinho (pedido 24/07 — poluía a tela).
  const [visivel, setVisivel] = useState(true);
  useEffect(() => {
    setVisivel(true);
    const t = setTimeout(() => setVisivel(false), 5000);
    return () => clearTimeout(t);
  }, [leadId]);
  if (!info || !visivel) return null;
  const data = info.redistributedAt ? new Date(info.redistributedAt).toLocaleDateString('pt-BR') : '—';
  const previo = info.previousCorretorName || 'corretor anterior';
  return (
    <div
      style={{
        background: 'rgba(234,179,8,0.10)',
        color: 'var(--color-warning-fg)',
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
    // WhatsApp. Mostra um indicador NEUTRO e discreto ("não entregue"); o texto
    // "janela 24h fechada" confundia a equipe (fica só no tooltip).
    if (kind === 'reengagement') {
      return (
        <span title={msg} style={{ color: 'var(--text-secondary)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <Icon name="clock" size={11} /> não entregue
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
  onAbrirTemplates,
  onSalvarNota,
  respostasUsadas,
  limiteAtingido,
}: {
  onAceitar: () => void;
  onAbrirTemplates?: () => void; // ausente = papel sem permissão de template (corretor)
  onSalvarNota: (texto: string) => Promise<void> | void;
  respostasUsadas: number;
  limiteAtingido: boolean;
}) {
  const [nota, setNota] = useState('');
  const [salvandoNota, setSalvandoNota] = useState(false);
  const salvarNotaLocal = async () => {
    const t = nota.trim();
    if (!t || salvandoNota) return;
    setSalvandoNota(true);
    try { await onSalvarNota(t); setNota(''); } finally { setSalvandoNota(false); }
  };
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
      style={{ background: bg, borderTop: '1px solid ' + border, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {/* flexWrap: no celular os botões descem pra linha de baixo em vez de sair da tela */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: cor, flex: '1 1 220px', minWidth: 0 }}>
        <Icon name={limiteAtingido ? 'warn' : 'bot'} size={18} />
        <div style={{ fontSize: 13, lineHeight: 1.4 }}>
          <div style={{ fontWeight: 700 }}>{titulo}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{sub}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
        {/* Dispara o template Meta com o lead ainda PENDENTE — o corretor pega o
            lead, manda o template e, se o cliente responder, a IA atende. */}
        {onAbrirTemplates && (
          <button className="btn btn--secondary btn--sm" onClick={onAbrirTemplates} title="Enviar template Meta aprovado (inicia a conversa)">
            <Icon name="doc" size={14} /> Enviar template
          </button>
        )}
        <button className="btn btn--primary btn--sm" onClick={onAceitar}>
          <Icon name="check" size={14} /> Aceitar lead
        </button>
      </div>
      </div>
      {/* Nota interna liberada mesmo com o lead pendente (não vai pro lead). */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border-light)', background: 'rgba(124, 58, 237, 0.09)' }}>
          <Icon name="pencil" size={13} style={{ color: '#7c3aed', flexShrink: 0 }} />
          <input
            style={{ flex: 1, minWidth: 0, width: '100%', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, padding: '9px 0' }}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); salvarNotaLocal(); } }}
            placeholder="Nota interna — o lead não recebe…"
          />
        </div>
        <button className="btn btn--secondary btn--sm" onClick={salvarNotaLocal} disabled={!nota.trim() || salvandoNota} title="Salvar nota interna (o lead não recebe)" style={{ borderRadius: 10, whiteSpace: 'nowrap' }}>
          {salvandoNota ? 'Salvando…' : 'Salvar nota'}
        </button>
      </div>
    </div>
  );
}

function ComposerJanelaFechada({
  onAbrirTemplates,
  onSalvarNota,
  onAceitar,
  mostrarAceitar,
  temEmail,
}: {
  onAbrirTemplates?: () => void; // ausente = papel sem permissão de template (corretor)
  temEmail?: boolean;
  onSalvarNota: (texto: string) => Promise<void> | void;
  onAceitar?: () => void;
  mostrarAceitar?: boolean;
}) {
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    const t = nota.trim();
    if (!t || salvando) return;
    setSalvando(true);
    try { await onSalvarNota(t); setNota(''); } finally { setSalvando(false); }
  };
  return (
    <div
      className="composer"
      style={{ borderTop: '1px solid var(--border-light)', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: '1 1 220px', minWidth: 0 }}>
          {mostrarAceitar
            ? (onAbrirTemplates ? 'Aceite o lead pra assumir o atendimento — ou envie um template pra falar agora.' : 'Aceite o lead pra assumir o atendimento.')
            : onAbrirTemplates
              ? 'Janela de 24h fechada — envie um template pra falar com o contato.'
              : `Janela de 24h fechada — o WhatsApp só libera texto depois que o cliente responde. Peça um template ao gestor${temEmail ? ' ou use o e-mail' : ''}.`}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', marginLeft: 'auto' }}>
          {mostrarAceitar && onAceitar && (
            <button className="btn btn--primary btn--sm" onClick={onAceitar} title="Assumir o atendimento deste lead">
              <Icon name="check" size={14} /> Aceitar lead
            </button>
          )}
          {onAbrirTemplates && (
            <button className={`btn btn--sm ${mostrarAceitar ? 'btn--secondary' : 'btn--primary'}`} onClick={onAbrirTemplates}>
              <Icon name="doc" size={14} /> Enviar template
            </button>
          )}
        </div>
      </div>
      {/* Nota interna liberada mesmo com a janela fechada (não vai pro lead). */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border-light)', background: 'rgba(124, 58, 237, 0.09)' }}>
          <Icon name="pencil" size={13} style={{ color: '#7c3aed', flexShrink: 0 }} />
          <input
            style={{ flex: 1, minWidth: 0, width: '100%', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, padding: '9px 0' }}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); salvar(); } }}
            placeholder="Nota interna — o lead não recebe…"
          />
        </div>
        <button className="btn btn--secondary btn--sm" onClick={salvar} disabled={!nota.trim() || salvando} title="Salvar nota interna (o lead não recebe)" style={{ borderRadius: 10, whiteSpace: 'nowrap' }}>
          {salvando ? 'Salvando…' : 'Salvar nota'}
        </button>
      </div>
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
    // Templates de SISTEMA/interno que não servem pra disparo manual no atendimento.
    const OCULTOS = new Set([
      'redefinir_senha_codigo', 'app_liberado', 'pons_teste', 'sistema_no_ar',
      'cadastro_confirmado', 'lembrete_agenda', 'chegou_lead', 'lead_novo', 'novo_lead',
      'venda_protocolo_p1', 'venda_protocolo_p2', 'venda_aprovada_protocolo',
      // Notificações internas (sistema dispara sozinho pro corretor/gestor):
      'leads_aguardando', 'lead_respondeu', 'liberacao_solicitada', 'liberacao_aprovada', 'liberacao_reprovada',
    ]);
    Api.whatsappTemplates()
      // Esconde AUTENTICAÇÃO + os internos acima (sistema/notificação, não atendimento).
      .then((r) => setItems((r.items || []).filter(
        (t: any) => String(t.category).toUpperCase() !== 'AUTHENTICATION' && !OCULTOS.has(t.name),
      )))
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
