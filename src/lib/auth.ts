// Auth e User — preserva os mesmos shapes do shared/api.js original
// localStorage keys idênticas ao sistema antigo para compatibilidade quando o backend for plugado.
import { capStorageGet, capStorageSet, capStorageRemove } from './capStorage';

export type Role =
  | 'CEO'
  | 'DIRETOR_COMERCIAL'
  | 'DIRETOR_FINANCEIRO'
  | 'FINANCEIRO'
  | 'DIRETOR_JURIDICO'
  | 'MARKETING'
  | 'ASSESSORA'
  | 'ASSESSORA_MARKETING'
  | 'GESTOR_TRAFEGO'
  | 'GESTOR_MARKETING'
  | 'CORRETOR'
  | 'GERENTE_EQUIPE'
  | 'SOCIO_UNIDADE'
  | 'GESTOR'
  | 'ADMINISTRATIVO'
  | 'DEV';

export interface User {
  id?: number;
  name: string;
  email?: string;
  role: Role;
  initials?: string;
  phone?: string | null;
  dataNascimento?: string | null;
  avatarUrl?: string | null;
  onboardingStatus?: string | null; // null/ATIVO = sem gating; PENDENTE_DOCS, AGUARDANDO_* prendem em /onboarding
  modalidade?: string | null; // ESTAGIARIO | CORRETOR
  unidade?: { id: number; nome: string } | null;
  corretor?: {
    id: number;
    scoreAtual?: number;
    scoreMes?: number;
    scoreAno?: number;
    lidera?: boolean; // é líder formal de alguma equipe (libera tela Equipes pro corretor)
  } | null;
}

const TOKEN_KEY = 'pons.token';
const USER_KEY = 'pons.user';

export const Auth = {
  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  get user(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },
  set(token: string, user: User) {
    const userStr = JSON.stringify(user);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, userStr);
    // Dual-write: espelha no storage nativo (sobrevive à limpeza da WebView).
    capStorageSet(TOKEN_KEY, token);
    capStorageSet(USER_KEY, userStr);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    capStorageRemove(TOKEN_KEY);
    capStorageRemove(USER_KEY);
  },
};

// ── Hidratação no boot ──────────────────────────────────────────────────────
// Se a WebView zerou o localStorage mas o token ainda está no Preferences nativo,
// re-popula o localStorage ANTES de qualquer decisão de auth (evita o relogin
// fantasma ao reabrir o app). Também faz backfill: sessão já logada que nunca
// gravou no Preferences passa a gravar agora (fica resiliente na 1ª reabertura).
// No navegador é no-op (capStorage* retorna null / não faz nada).
let _hydrating: Promise<void> | null = (async () => {
  try {
    for (const key of [TOKEN_KEY, USER_KEY]) {
      const ls = localStorage.getItem(key);
      if (!ls) {
        const cap = await capStorageGet(key);
        if (cap) localStorage.setItem(key, cap);
      } else {
        capStorageSet(key, ls);
      }
    }
  } finally {
    _hydrating = null;
  }
})();

// Todos os fluxos de boot devem aguardar isto antes de ler Auth.token.
export function awaitAuthHydration(): Promise<void> {
  return _hydrating ?? Promise.resolve();
}

export function formatRole(role: Role | string): string {
  const map: Record<string, string> = {
    CEO: 'CEO Executivo',
    DIRETOR_COMERCIAL: 'Diretor Comercial',
    DIRETOR_FINANCEIRO: 'Diretor Financeiro',
    FINANCEIRO: 'Financeiro',
    DIRETOR_JURIDICO: 'Diretor Jurídico/Admin',
    MARKETING: 'Diretor de Marketing',
    ASSESSORA: 'Assessora',
    ASSESSORA_MARKETING: 'Assessoria & Marketing',
    GESTOR_TRAFEGO: 'Gestor de Tráfego',
    GESTOR_MARKETING: 'Gestor de Marketing',
    CORRETOR: 'Corretor',
    GERENTE_EQUIPE: 'Gerente de Equipe',
    SOCIO_UNIDADE: 'Sócio de Filial',
    GESTOR: 'Gestor',
    ADMINISTRATIVO: 'Administrativo de Vendas',
    DEV: 'Desenvolvedor',
  };
  return map[role] || role;
}
