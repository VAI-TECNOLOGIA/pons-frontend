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

  // Ao montar (e ao receber novo token), carrega perfil fresco do backend
  useEffect(() => {
    if (Auth.token && !user?.dataNascimento && user) {
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
