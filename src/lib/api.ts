import { Auth } from './auth';

// API base. Em prod (Vercel), o domínio do front faz proxy '/api' → Railway via vercel.json.
// Em build standalone (app nativo, etc.), set VITE_API_BASE_URL pra URL absoluta do backend.
const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '');
const BASE = envBase ? `${envBase}/api` : '/api';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: Method;
  body?: unknown;
  auth?: boolean;
}

export class ApiError extends Error {
  status: number;
  details: unknown;
  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const qs = (params: Record<string, unknown> = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  ) as Record<string, string>;
  const s = new URLSearchParams(clean).toString();
  return s ? '?' + s : '';
};

async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth && Auth.token) headers.Authorization = `Bearer ${Auth.token}`;

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError('network_error', 0, err);
  }

  if (res.status === 401) {
    Auth.clear();
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError('unauthorized', 401, null);
  }

  if (!res.ok) {
    const details = await res.json().catch(() => ({}));
    // Mensagens amigáveis por status — antes mostrava "unknown" quando body vinha vazio
    const fallback =
      res.status === 403 ? 'Você não tem permissão pra acessar isso' :
      res.status === 404 ? 'Não encontrado' :
      res.status === 401 ? 'Sessão expirada — faça login de novo' :
      res.status >= 500 ? 'Erro no servidor — tente em instantes' :
      `Erro HTTP ${res.status}`;
    const msg = details.error || details.message || fallback;
    throw new ApiError(msg, res.status, details);
  }

  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

export const Api = {
  // Gate
  gateVerificar: (token: string) =>
    request<{ ok: boolean }>('/gate/verificar', { method: 'POST', body: { token }, auth: false }),

  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: import('./auth').User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),
  me: () => request<{ user: import('./auth').User }>('/auth/me'),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  verifyPassword: (password: string) =>
    request<{ ok: boolean }>('/auth/verify-password', { method: 'POST', body: { password } }),

  // Warmup (acorda Neon)
  warmup: () => request<{ ok: boolean; ms: number }>('/warmup', { auth: false }),

  // Dashboard
  dashboard: () => request<any>('/dashboard'),

  // Equipes
  equipes: () => request<any[]>('/equipes'),
  equipeCreate: (data: any) => request<any>('/equipes', { method: 'POST', body: data }),
  equipeUpdate: (id: number, data: any) => request<any>(`/equipes/${id}`, { method: 'PATCH', body: data }),
  equipeDelete: (id: number) => request<{ ok: boolean }>(`/equipes/${id}`, { method: 'DELETE' }),
  equipesResultados: (params: any = {}) => request<any>(`/equipes/resultados${qs(params)}`),

  // Corretores
  corretores: () => request<any[]>('/corretores'),
  corretor: (id: number) => request<any>(`/corretores/${id}`),
  corretorCreate: (data: any) => request<any>('/corretores', { method: 'POST', body: data }),
  corretorUpdate: (id: number, data: any) => request<any>(`/corretores/${id}`, { method: 'PATCH', body: data }),
  corretorDesativar: (id: number) => request<any>(`/corretores/${id}/desativar`, { method: 'POST' }),
  corretorJornada: (id: number) => request<any>(`/corretores/${id}/jornada`),
  corretorScoreEventos: (id: number) => request<{ eventos: any[]; porTipo: Record<string, number> }>(`/corretores/${id}/score-eventos`),

  // Leads
  leads: (params: any = {}) => request<any[]>(`/leads${qs(params)}`),
  leadStats: () => request<any>('/leads/stats'),
  leadCreate: (data: any) => request<any>('/leads', { method: 'POST', body: data }),
  leadUpdate: (id: number, data: any) => request<any>(`/leads/${id}`, { method: 'PATCH', body: data }),
  leadConversas: (id: number) => request<any>(`/leads/${id}/conversas`),
  inbox: () => request<any>('/leads/inbox'),
  tracking: () => request<any>('/leads/tracking'),
  leadsSourcesStats: () =>
    request<{
      total: number;
      ultimoLead: { createdAt: string; origem: string; nome: string } | null;
      origens: Array<{ origem: string; total: number; ultimos30d: number; ultimoEm: string | null }>;
      tokenStatus: { configurado: boolean; preview?: string };
    }>('/leads/sources-stats'),
  leadsTestWebhook: (origem = 'TESTE') =>
    request<{ ok?: boolean; leadId?: number; distribuido?: boolean; corretor?: string | null; error?: string }>(
      '/leads/test-webhook',
      { method: 'POST', body: { origem } },
    ),
  leadEnviarMensagem: (id: number, texto: string, autor = 'CORRETOR') =>
    request<any>(`/leads/${id}/mensagens`, { method: 'POST', body: { texto, autor } }),
  leadIaResponder: (id: number) => request<any>(`/leads/${id}/ia-responder`, { method: 'POST' }),
  leadAtivarNegociacao: (id: number) => request<any>(`/leads/${id}/ativar-negociacao`, { method: 'POST' }),
  leadObservacao: (id: number, texto: string) =>
    request<any>(`/leads/${id}/observacao`, { method: 'POST', body: { texto } }),

  // Empreendimentos
  empreendimentos: () => request<any[]>('/empreendimentos'),
  empreendimento: (id: number) => request<any>(`/empreendimentos/${id}`),
  empreendimentoCreate: (data: any) => request<any>('/empreendimentos', { method: 'POST', body: data }),
  empreendimentoUpdate: (id: number, data: any) =>
    request<any>(`/empreendimentos/${id}`, { method: 'PATCH', body: data }),
  empreendimentoFotoDelete: (id: number, fotoId: number) =>
    request<any>(`/empreendimentos/${id}/fotos/${fotoId}`, { method: 'DELETE' }),
  empreendimentoFotoCapa: (id: number, fotoId: number) =>
    request<any>(`/empreendimentos/${id}/fotos/${fotoId}/capa`, { method: 'POST' }),
  construtoras: () => request<any[]>('/empreendimentos/construtoras'),

  // Vendas
  vendas: () => request<any[]>('/vendas'),
  venda: (id: number) => request<any>(`/vendas/${id}`),
  vendaCreate: (data: any) => request<any>('/vendas', { method: 'POST', body: data }),
  vendaUpdateStatus: (id: number, status: string) =>
    request<any>(`/vendas/${id}`, { method: 'PATCH', body: { status } }),

  // Tarefas
  tarefas: (params: any = {}) => request<any[]>(`/tarefas${qs(params)}`),
  tarefaCreate: (data: any) => request<any>('/tarefas', { method: 'POST', body: data }),
  tarefaUpdate: (id: number, data: any) => request<any>(`/tarefas/${id}`, { method: 'PATCH', body: data }),

  // Roletas
  roletas: () => request<any[]>('/roletas'),
  roletaCreate: (data: any) => request<any>('/roletas', { method: 'POST', body: data }),
  roletaUpdate: (id: number, data: any) => request<any>(`/roletas/${id}`, { method: 'PATCH', body: data }),
  roletaAddParticipante: (id: number, corretorId: number, peso = 1) =>
    request<any>(`/roletas/${id}/participantes`, { method: 'POST', body: { corretorId, peso } }),
  roletaParticipanteUpdate: (pid: number, data: any) =>
    request<any>(`/roletas/participantes/${pid}`, { method: 'PATCH', body: data }),
  roletaParticipanteRemove: (pid: number) =>
    request<any>(`/roletas/participantes/${pid}`, { method: 'DELETE' }),
  roletaBolsao: () => request<any[]>('/roletas/bolsao'),
  roletaSimular: (data: any) => request<any>('/roletas/simular', { method: 'POST', body: data }),
  roletaRedistribuirSla: () => request<any>('/roletas/redistribuir-sla', { method: 'POST' }),
  funilEmpresa: () => request<any>('/roletas/funil-empresa'),

  // Vídeos
  videos: (categoria?: string) => request<any[]>(`/videos${categoria ? '?categoria=' + categoria : ''}`),
  videoCreate: (data: any) => request<any>('/videos', { method: 'POST', body: data }),
  videoDelete: (id: number) => request<any>(`/videos/${id}`, { method: 'DELETE' }),

  // Avisos
  avisos: () => request<any[]>('/avisos'),
  avisoCreate: (data: any) => request<any>('/avisos', { method: 'POST', body: data }),
  avisoDelete: (id: number) => request<any>(`/avisos/${id}`, { method: 'DELETE' }),

  // Configurações
  settings: () => request<Record<string, string>>('/config/settings'),
  settingsSave: (obj: Record<string, string>) => request<any>('/config/settings', { method: 'PUT', body: obj }),
  construtoraCreate: (data: any) => request<any>('/config/construtoras', { method: 'POST', body: data }),
  politicas: () => request<any[]>('/config/politicas'),
  politicaCreate: (data: any) => request<any>('/config/politicas', { method: 'POST', body: data }),

  // Financeiro
  finLancamentos: (params: any = {}) => request<any[]>(`/financeiro/lancamentos${qs(params)}`),
  finLancamentoCreate: (data: any) => request<any>('/financeiro/lancamentos', { method: 'POST', body: data }),
  finLancamentoUpdate: (id: number, data: any) =>
    request<any>(`/financeiro/lancamentos/${id}`, { method: 'PATCH', body: data }),
  finAprovar: (id: number) => request<any>(`/financeiro/lancamentos/${id}/aprovar`, { method: 'POST' }),
  finExtrato: () => request<any>('/financeiro/extrato'),
  finResumo: () => request<any>('/financeiro/resumo'),
  finDre: (params: any = {}) => request<any>(`/financeiro/dre${qs(params)}`),
  finFluxoCaixa: (meses = 6) => request<any>(`/financeiro/fluxo-caixa?meses=${meses}`),
  finContas: (tipo = 'PAGAR') => request<any>(`/financeiro/contas?tipo=${tipo}`),
  finSicrediStatus: () => request<any>('/financeiro/sicredi/status'),
  finSicrediEnviar: () => request<any>('/financeiro/sicredi/enviar', { method: 'POST' }),

  // Relatórios
  relKpis: (params: any = {}) => request<any>(`/relatorios/kpis${qs(params)}`),
  relSeries: (meses = 6) => request<any>(`/relatorios/series?meses=${meses}`),
  relFunil: (params: any = {}) => request<any>(`/relatorios/funil${qs(params)}`),
  relOrigem: (params: any = {}) => request<any>(`/relatorios/origem${qs(params)}`),
  relRanking: (params: any = {}) => request<any>(`/relatorios/ranking${qs(params)}`),
  relEmpreendimentos: () => request<any[]>('/relatorios/empreendimentos'),

  // Acessos
  acessosResumo: () => request<any>('/acessos/resumo'),

  // Agenda
  agenda: (params: any = {}) => request<any[]>(`/agenda${qs(params)}`),
  agendaExecutivos: () => request<any[]>('/agenda/executivos'),
  agendaCreate: (data: any) => request<any>('/agenda', { method: 'POST', body: data }),
  agendaUpdate: (id: number, data: any) => request<any>(`/agenda/${id}`, { method: 'PATCH', body: data }),
  agendaDelete: (id: number) => request<any>(`/agenda/${id}`, { method: 'DELETE' }),
  agendaLimparConcluidos: () => request<{ removidos: number }>('/agenda/limpar-concluidos', { method: 'POST' }),

  // IA
  iaStatus: () => request<any>('/ia/status'),
  iaAssistente: (pergunta: string) => request<any>('/ia/assistente', { method: 'POST', body: { pergunta } }),

  // Users
  users: () => request<any[]>('/users'),
  meProfile: () => request<import('./auth').User & { aniversarioHoje?: boolean }>('/users/me'),
  meUpdate: (data: { name?: string; phone?: string | null; dataNascimento?: string | null; avatarUrl?: string | null }) =>
    request<any>('/users/me', { method: 'PATCH', body: data }),
  mePassword: (senhaAtual: string, novaSenha: string) =>
    request<{ ok: boolean }>('/users/me/password', { method: 'POST', body: { senhaAtual, novaSenha } }),
  meAniversarioSaudado: () =>
    request<{ ok: boolean }>('/users/me/aniversario-saudado', { method: 'POST' }),

  // Google Calendar
  googleCalendarStart: () =>
    request<{ authUrl?: string; faltaConfig?: boolean }>('/integracoes/google/start'),
  googleCalendarStatus: () =>
    request<{ conectado: boolean; email?: string; calendarioId?: string }>('/integracoes/google/status'),
  googleCalendarDisconnect: () =>
    request<{ ok: boolean }>('/integracoes/google/disconnect', { method: 'POST' }),
  googleCalendarSync: () =>
    request<{ importados: number; enviados: number }>('/integracoes/google/sync', { method: 'POST' }),

  // Conversations (VAI WhatsApp)
  conversations: () =>
    request<{ pendente: any[]; atendendo: any[]; vaiConfigured: boolean; metaConfigured: boolean }>(
      '/conversations',
    ),
  conversationGet: (leadId: number) => request<any>(`/conversations/${leadId}`),
  conversationSend: (leadId: number, texto: string, autor: 'CORRETOR' | 'IA' = 'CORRETOR') =>
    request<{
      mensagem: any;
      delivery: 'enviado' | 'simulado' | 'falha';
      canal: 'meta' | 'vai' | 'simulado';
      meta?: any;
      vai?: any;
    }>(`/conversations/${leadId}/messages`, { method: 'POST', body: { texto, autor } }),
  conversationSync: (leadId: number) =>
    request<{ importados: number }>(`/conversations/${leadId}/sync`, { method: 'POST' }),
  vaiHealth: () =>
    request<{ ok: boolean; configured: boolean; reason?: string; apiBaseUrl?: string }>(
      '/conversations/_vai/health',
    ),
  metaHealth: () =>
    request<{
      ok: boolean;
      configured: boolean;
      reason?: string;
      phoneId?: string;
      displayNumber?: string;
      verifiedName?: string;
      qualityRating?: string;
      wabaId?: string;
    }>('/conversations/_meta/health'),

  // ─── Fase A — BM (Business Managers) ─────────────────────────────
  bmList:    () => request<any[]>('/bm'),
  bmGet:     (id: number) => request<any>(`/bm/${id}`),
  bmCreate:  (data: any) => request<any>('/bm', { method: 'POST', body: data }),
  bmUpdate:  (id: number, data: any) => request<any>(`/bm/${id}`, { method: 'PATCH', body: data }),
  bmDelete:  (id: number) => request<{ ok: boolean }>(`/bm/${id}`, { method: 'DELETE' }),
  bmDashboard: (id: number) => request<any>(`/bm/${id}/dashboard`),

  // ─── Fase A — Ranking ────────────────────────────────────────────
  ranking:       (params: any = {}) => request<any>(`/ranking${qs(params)}`),
  rankingFiliais: (params: any = {}) => request<any>(`/ranking/filiais${qs(params)}`),
  rankingEquipes: (params: any = {}) => request<any>(`/ranking/equipes${qs(params)}`),
  rankingMe:     (params: any = {}) => request<any>(`/ranking/me${qs(params)}`),

  // ─── Fase A — Painel TV ──────────────────────────────────────────
  painelTvState:   (params: any = {}) => request<any>(`/painel-tv/state${qs(params)}`, { auth: false }),
  painelTvEventos: (params: any = {}) => request<any[]>(`/painel-tv/eventos${qs(params)}`, { auth: false }),
  painelTvEquipes: () => request<any[]>('/painel-tv/equipes', { auth: false }),
  painelTvUnidades: () => request<any[]>('/painel-tv/unidades', { auth: false }),
  painelTvTeste:   (data: any) => request<any>('/painel-tv/teste', { method: 'POST', body: data }),

  // ─── Fase B — Distribuição Agendada ──────────────────────────────
  distribuicaoList:    () => request<any[]>('/distribuicao'),
  distribuicaoCreate:  (data: any) => request<any>('/distribuicao', { method: 'POST', body: data }),
  distribuicaoUpdate:  (id: number, data: any) => request<any>(`/distribuicao/${id}`, { method: 'PATCH', body: data }),
  distribuicaoDelete:  (id: number) => request<{ ok: boolean }>(`/distribuicao/${id}`, { method: 'DELETE' }),
  distribuicaoExecutar:(id: number) => request<any>(`/distribuicao/${id}/executar`, { method: 'POST' }),

  // ─── Fase B — Import Big Data ────────────────────────────────────
  importLeadsPreview:  (file: File) => {
    const fd = new FormData(); fd.append('arquivo', file);
    return fetch(`${BASE}/import-leads/preview`, { method: 'POST', headers: { Authorization: `Bearer ${Auth.token}` }, body: fd }).then((r) => r.json());
  },
  importLeadsExecutar: (file: File) => {
    const fd = new FormData(); fd.append('arquivo', file);
    return fetch(`${BASE}/import-leads/executar`, { method: 'POST', headers: { Authorization: `Bearer ${Auth.token}` }, body: fd }).then((r) => r.json());
  },
  importLeadsFiltrar:  (params: any = {}) => request<any>(`/import-leads/filtrar${qs(params)}`),

  // ─── Fase C — Remarketing ────────────────────────────────────────
  remarketingList:    () => request<any[]>('/remarketing'),
  remarketingGet:     (id: number) => request<any>(`/remarketing/${id}`),
  remarketingCreate:  (data: any) => request<any>('/remarketing', { method: 'POST', body: data }),
  remarketingUpdate:  (id: number, data: any) => request<any>(`/remarketing/${id}`, { method: 'PATCH', body: data }),
  remarketingAgendar: (id: number, quando?: string) => request<any>(`/remarketing/${id}/agendar`, { method: 'POST', body: { quando } }),
  remarketingCancelar:(id: number) => request<any>(`/remarketing/${id}/cancelar`, { method: 'POST' }),
  remarketingPreview: (id: number) => request<{ total: number; custoEstimado: number }>(`/remarketing/${id}/preview-segmento`),
  remarketingEnvios:  (id: number) => request<any[]>(`/remarketing/${id}/envios`),

  // ─── Fase C — Custos Meta ────────────────────────────────────────
  metaCustosResumo: (dias = 30) => request<any>(`/meta-custos/resumo?dias=${dias}`),
  metaCustosSerie:  (dias = 30) => request<any[]>(`/meta-custos/serie?dias=${dias}`),

  // ─── Fase D — Landing Pages ──────────────────────────────────────
  lpList:    () => request<any[]>('/lp'),
  lpCreate:  (data: any) => request<any>('/lp', { method: 'POST', body: data }),
  lpUpdate:  (id: number, data: any) => request<any>(`/lp/${id}`, { method: 'PATCH', body: data }),
  lpDelete:  (id: number) => request<{ ok: boolean }>(`/lp/${id}`, { method: 'DELETE' }),

  // ─── Fase E — Painel Executivo ───────────────────────────────────
  execEmpresa:    (params: any = {}) => request<any>(`/executivo/empresa${qs(params)}`),
  execCorretores: (params: any = {}) => request<any>(`/executivo/corretores${qs(params)}`),
  execFiliais:    (params: any = {}) => request<any>(`/executivo/filiais${qs(params)}`),
  execCidades:    (params: any = {}) => request<any>(`/executivo/cidades${qs(params)}`),

  // ─── Fase F — Verificação Meta ───────────────────────────────────
  metaAuditar: (url: string, cnpjEsperado?: string, razaoSocialEsperada?: string) =>
    request<any>('/meta-verificacao/auditar', { method: 'POST', body: { url, cnpjEsperado, razaoSocialEsperada } }),
  metaAuditoriaUltima: () => request<any>('/meta-verificacao/ultima'),

  // ─── Fase B — SLA visibility ─────────────────────────────────────
  slaStatus: () => request<{
    alerta: any[]; fila: any[]; redistribuir: any[]; historico: any[];
  }>('/roletas/sla'),

  // ─── Fase D — Heatmap viewer ─────────────────────────────────────
  heatmapPagina: (pagina: string, dias = 7) => request<any>(`/heatmap/pagina/${encodeURIComponent(pagina)}?dias=${dias}`),

  // ─── Sprint 1 (Imobilead parity) ──────────────────────────────────
  // M15: Transferências
  transferenciasList: (params: any = {}) => request<any[]>(`/transferencias${qs(params)}`),
  transferenciasLead: (leadId: number) => request<any[]>(`/transferencias/lead/${leadId}`),
  transferir: (data: { leadId: number; paraCorretorId?: number | null; motivo?: string; observacao?: string | null }) =>
    request<any>('/transferencias', { method: 'POST', body: data }),
  // M16: KPIs Agendamento
  agendaKpis: () => request<{ hoje: number; semana: number; atrasados: number; concluidos: number; proximos: number }>('/agenda/kpis'),
  // M21: Preferences
  preferencesMe: () => request<any>('/preferences/me'),
  preferencesUpdate: (data: any) => request<any>('/preferences/me', { method: 'PUT', body: data }),
  // ─── Sprint 2 ─────────────────────────────────────────────────────
  // M7: Mappings
  mappingsList:   (params: any = {}) => request<any[]>(`/mappings${qs(params)}`),
  mappingCreate:  (data: any) => request<any>('/mappings', { method: 'POST', body: data }),
  mappingUpdate:  (id: number, data: any) => request<any>(`/mappings/${id}`, { method: 'PATCH', body: data }),
  mappingDelete:  (id: number) => request<{ ok: boolean }>(`/mappings/${id}`, { method: 'DELETE' }),
  // M17: Hierarquia diretor→corretor
  corretorAtribuirDiretor: (id: number, diretorId: number | null) =>
    request<any>(`/corretores/${id}/diretor`, { method: 'PATCH', body: { diretorId } }),
  meusCorretores: () => request<any[]>('/corretores/meus-corretores'),
  // M19: Auditoria de exclusões
  auditoriaExclusoes: (params: any = {}) => request<any[]>(`/auditoria/exclusoes${qs(params)}`),
  auditoriaEntidades: () => request<{ entidade: string; total: number }[]>('/auditoria/entidades'),

  // ─── Sprint 3-5 ───────────────────────────────────────────────────
  // H1: FB OAuth
  fbHealth:   () => request<{ configured: boolean }>('/fb-oauth/health'),
  fbAuthUrl:  () => request<{ url: string }>('/fb-oauth/auth-url'),
  fbCallback: (code: string) => request<any>('/fb-oauth/callback', { method: 'POST', body: { code } }),
  fbLinkBM:   (data: any) => request<any>('/fb-oauth/link-bm', { method: 'POST', body: data }),
  fbForms:    (bmId: number) => request<any[]>(`/fb-oauth/forms/${bmId}`),
  fbSync:     (bmId: number, formId: string) => request<any>(`/fb-oauth/sync/${bmId}`, { method: 'POST', body: { formId } }),
  // M8: CAPI
  capiList:   () => request<any[]>('/capi'),
  capiCreate: (data: any) => request<any>('/capi', { method: 'POST', body: data }),
  capiUpdate: (id: number, data: any) => request<any>(`/capi/${id}`, { method: 'PATCH', body: data }),
  capiDelete: (id: number) => request<{ ok: boolean }>(`/capi/${id}`, { method: 'DELETE' }),
  // M4: Bolsões múltiplos
  bolsoesList:   () => request<any[]>('/bolsoes'),
  bolsaoCreate:  (data: any) => request<any>('/bolsoes', { method: 'POST', body: data }),
  bolsaoUpdate:  (id: number, data: any) => request<any>(`/bolsoes/${id}`, { method: 'PATCH', body: data }),
  bolsaoDelete:  (id: number) => request<{ ok: boolean }>(`/bolsoes/${id}`, { method: 'DELETE' }),
  // M5: Cadências
  cadenciasList:    () => request<any[]>('/cadencias'),
  cadenciaCreate:   (data: any) => request<any>('/cadencias', { method: 'POST', body: data }),
  cadenciaUpdate:   (id: number, data: any) => request<any>(`/cadencias/${id}`, { method: 'PATCH', body: data }),
  cadenciaDelete:   (id: number) => request<{ ok: boolean }>(`/cadencias/${id}`, { method: 'DELETE' }),
  cadenciaExecs:    (id: number) => request<any[]>(`/cadencias/${id}/execucoes`),
  // M9: Webhook outbound
  webhookSaidas:   () => request<any[]>('/webhook-saidas'),
  wsCreate:        (data: any) => request<any>('/webhook-saidas', { method: 'POST', body: data }),
  wsUpdate:        (id: number, data: any) => request<any>(`/webhook-saidas/${id}`, { method: 'PATCH', body: data }),
  wsDelete:        (id: number) => request<{ ok: boolean }>(`/webhook-saidas/${id}`, { method: 'DELETE' }),
  // M13: Campos custom
  camposCustom:    () => request<any[]>('/campos-custom'),
  campoCreate:     (data: any) => request<any>('/campos-custom', { method: 'POST', body: data }),
  campoUpdate:     (id: number, data: any) => request<any>(`/campos-custom/${id}`, { method: 'PATCH', body: data }),
  campoDelete:     (id: number) => request<{ ok: boolean }>(`/campos-custom/${id}`, { method: 'DELETE' }),
  // M14: Regras
  regrasList:      () => request<any[]>('/regras'),
  regraCreate:     (data: any) => request<any>('/regras', { method: 'POST', body: data }),
  regraUpdate:     (id: number, data: any) => request<any>(`/regras/${id}`, { method: 'PATCH', body: data }),
  regraDelete:     (id: number) => request<{ ok: boolean }>(`/regras/${id}`, { method: 'DELETE' }),
  // M22: Onboarding
  onboardingStatus: () => request<any>('/onboarding/status'),

  // ─── Financeiro Pons (rateio + sócios + fechamento + lote Sicredi) ───
  rateioSimular: (data: any) => request<any>('/rateio/simular', { method: 'POST', body: data }),
  rateioVenda:   (id: number) => request<any>(`/rateio/venda/${id}`),
  rateioAplicar: (id: number) => request<any>(`/rateio/aplicar/${id}`, { method: 'POST' }),
  rateioPoliticaDefault: () => request<any>('/rateio/politica-default'),
  rateioPoliticas: () => request<any[]>('/rateio/politica'),
  rateioPoliticaCreate: (data: any) => request<any>('/rateio/politica', { method: 'POST', body: data }),
  rateioPoliticaUpdate: (id: number, data: any) => request<any>(`/rateio/politica/${id}`, { method: 'PATCH', body: data }),

  sociosList: () => request<{ socios: any[]; somaParticipacaoAtivos: number }>('/socios'),
  socioCreate: (data: any) => request<any>('/socios', { method: 'POST', body: data }),
  socioUpdate: (id: number, data: any) => request<any>(`/socios/${id}`, { method: 'PATCH', body: data }),
  socioDelete: (id: number) => request<{ ok: boolean }>(`/socios/${id}`, { method: 'DELETE' }),

  fechamentoList: () => request<any[]>('/fechamento'),
  fechamentoMes:  (ano: number, mes: number) => request<any>(`/fechamento/${ano}/${mes}`),
  fechamentoGerar:  (ano: number, mes: number) => request<any>(`/fechamento/${ano}/${mes}/gerar`, { method: 'POST' }),
  fechamentoFechar: (id: number) => request<any>(`/fechamento/${id}/fechar`, { method: 'POST' }),
  fechamentoPagarRateio: (rateioId: number) => request<any>(`/fechamento/rateio/${rateioId}/pagar`, { method: 'POST' }),

  loteSicrediList: () => request<any[]>('/sicredi-lote'),
  loteSicrediProxima: () => request<{ dataExecucao: string; total: number; valor: number; lancamentos: any[] }>('/sicredi-lote/proxima'),
  loteSicrediPreparar: () => request<any>('/sicredi-lote/preparar', { method: 'POST' }),
  loteSicrediEnviar: (id: number) => request<any>(`/sicredi-lote/${id}/enviar`, { method: 'POST' }),
  loteSicrediCancelar: (id: number) => request<{ ok: boolean }>(`/sicredi-lote/${id}/cancelar`, { method: 'POST' }),

  // ─── Fase G — Insights IA do Corretor ────────────────────────────
  insightsMe:        () => request<any[]>('/insights/me'),
  insightsCorretor:  (id: number) => request<any[]>(`/insights/corretor/${id}`),
  insightVisualizado:(id: number) => request<{ ok: boolean }>(`/insights/${id}/visualizado`, { method: 'POST' }),
  insightsRodar:     () => request<{ ok: boolean }>('/insights/rodar', { method: 'POST' }),

  // ─── Agente IA (atendimento de lead) ─────────────────────────────
  agenteIaStatus: () => request<{ configurado: boolean; provider: string; model: string; tom: string; temBaseConhecimento: boolean }>('/ia/agente/status'),
  agenteIaConfig:  () => request<Record<string, string>>('/ia/agente/config'),
  agenteIaSave:    (data: Record<string, string>) => request<{ ok: boolean }>('/ia/agente/config', { method: 'PUT', body: data }),

  // ─── Lead — aceitar / liberar contato ────────────────────────────
  leadAceitar: (id: number) => request<{ ok: boolean; nome: string; estadoAtendimento: string }>(`/leads/${id}/aceitar`, { method: 'POST' }),
  leadLiberarContato: (id: number) =>
    request<{ ok: boolean; telefone: string; classificacao: string; jaLiberado?: boolean }>(
      `/leads/${id}/liberar-contato`,
      { method: 'POST' },
    ),

  // ─── DEV panel ───────────────────────────────────────────────────
  devFeedback:        (limit = 200) => request<{ data: any[]; total: number }>(`/dev/feedback?limit=${limit}`),
  devFeedbackAnalyze: (body: { description: string; type?: string; currentUrl?: string; userAgent?: string }) =>
    request<{ analysis: string }>('/dev/feedback/analyze', { method: 'POST', body }),
  devAudit: (params: { action?: string; userId?: number; since?: string; limit?: number } = {}) =>
    request<{ data: any[]; total: number }>(`/dev/audit${qs(params)}`),
  devDeliveryStats: () =>
    request<{ rows: Array<{ period: string; total: number }>; meta?: { generatedAt: string } }>(
      '/dev/messages/delivery-stats',
    ),
  devNotifications: () => request<{ data: any[]; unread: number }>('/dev/notifications'),
  devNotificationsReadAll: () => request<{ ok: boolean }>('/dev/notifications/read-all', { method: 'POST' }),
  metricsSnapshot: (slow = false) => request<any>(`/_metrics${slow ? '?slow=1' : ''}`),

  // ─── Bug report ──────────────────────────────────────────────────
  // Multipart — usa fetch direto pra preservar Content-Type boundary
  feedbackSubmit: async (form: FormData) => {
    const headers: Record<string, string> = {};
    if (Auth.token) headers.Authorization = `Bearer ${Auth.token}`;
    const res = await fetch(BASE + '/feedback', { method: 'POST', headers, body: form });
    if (!res.ok) {
      const details = await res.json().catch(() => ({}));
      throw new ApiError(details.message || details.error || `Erro HTTP ${res.status}`, res.status, details);
    }
    return res.json() as Promise<{ ok: boolean; adminsNotified: number; screenshotUrl: string | null }>;
  },
};

/**
 * Stream URL para o EventSource. Inclui o JWT como query string porque
 * EventSource não permite headers customizados.
 */
export function streamUrl(token: string) {
  return `${BASE}/stream?access_token=${encodeURIComponent(token)}`;
}
