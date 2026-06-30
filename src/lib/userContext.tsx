import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Auth, type User } from './auth';
import { Api } from './api';

interface UserCtx {
  user: User | null;
  setUser: (u: User | null) => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<UserCtx | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => Auth.user);

  const setUser = useCallback((u: User | null) => {
    if (u) {
      Auth.set(Auth.token || '', u);
      setUserState(u);
    } else {
      Auth.clear();
      setUserState(null);
    }
  }, []);

  const reload = useCallback(async () => {
    if (!Auth.token) return;
    try {
      const fresh = (await Api.meProfile()) as User;
      setUser(fresh);
    } catch {
      // sem rede ou 401 — Api já cuida do logout
    }
  }, [setUser]);

  // Ao montar, carrega perfil fresco do backend — assim mudança de PAPEL/permissão
  // já reflete no F5 (antes só recarregava quando faltava dataNascimento, então
  // trocar o cargo de alguém só valia depois de deslogar/logar).
  // Colaborador em onboarding é bloqueado em /users/me pelo gate — não busca.
  useEffect(() => {
    const onb = user?.onboardingStatus;
    const gated = !!onb && onb !== 'ATIVO';
    if (Auth.token && user && !gated) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Ctx.Provider value={{ user, setUser, reload }}>{children}</Ctx.Provider>;
}

export function useUser(): UserCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useUser deve estar dentro de UserProvider');
  return c;
}
