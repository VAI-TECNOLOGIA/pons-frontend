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
    const details = await res.json().catch(() => ({ error: 'unknown' }));
    throw new ApiError(details.error || `HTTP ${res.status}`, res.status, details);
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
  equipesResultados: (params: any = {}) => request<any>(`/equipes/resultados${qs(params)}`),

  // Corretores
  corretores: () => request<any[]>('/corretores'),
  corretor: (id: number) => request<any>(`/corretores/${id}`),
  corretorCreate: (data: any) => request<any>('/corretores', { method: 'POST', body: data }),
  corretorUpdate: (id: number, data: any) => request<any>(`/corretores/${id}`, { method: 'PATCH', body: data }),
  corretorDesativar: (id: number) => request<any>(`/corretores/${id}/desativar`, { method: 'POST' }),
  corretorJornada: (id: number) => request<any>(`/corretores/${id}/jornada`),

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
};

/**
 * Stream URL para o EventSource. Inclui o JWT como query string porque
 * EventSource não permite headers customizados.
 */
export function streamUrl(token: string) {
  return `${BASE}/stream?access_token=${encodeURIComponent(token)}`;
}
