// Auth e User — preserva os mesmos shapes do shared/api.js original
// localStorage keys idênticas ao sistema antigo para compatibilidade quando o backend for plugado.

export type Role =
  | 'CEO'
  | 'DIRETOR_COMERCIAL'
  | 'DIRETOR_FINANCEIRO'
  | 'DIRETOR_JURIDICO'
  | 'MARKETING'
  | 'ASSESSORA'
  | 'CORRETOR'
  | 'GERENTE_EQUIPE'
  | 'SOCIO_UNIDADE'
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
  unidade?: { id: number; nome: string } | null;
  corretor?: {
    id: number;
    scoreAtual?: number;
    scoreMes?: number;
    scoreAno?: number;
  } | null;
}

const TOKEN_KEY = 'pons.token';
const USER_KEY = 'pons.user';
const GATE_KEY = 'vai.gate';

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
  get gatePassed(): boolean {
    return localStorage.getItem(GATE_KEY) === '1';
  },
  setGate() {
    localStorage.setItem(GATE_KEY, '1');
  },
  set(token: string, user: User) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export function formatRole(role: Role | string): string {
  const map: Record<string, string> = {
    CEO: 'CEO Executivo',
    DIRETOR_COMERCIAL: 'Diretor Comercial',
    DIRETOR_FINANCEIRO: 'Diretor Financeiro',
    DIRETOR_JURIDICO: 'Diretor Jurídico/Admin',
    MARKETING: 'Diretor de Marketing',
    ASSESSORA: 'Assessora',
    CORRETOR: 'Corretor',
    GERENTE_EQUIPE: 'Gerente de Equipe',
    SOCIO_UNIDADE: 'Sócio de Filial',
    DEV: 'Desenvolvedor',
  };
  return map[role] || role;
}
