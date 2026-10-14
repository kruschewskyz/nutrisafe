import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, refreshSession, setAccessToken, setAuthLostHandler } from '../lib/api';
import type { Session, User } from '../lib/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; acceptTerms: true }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Ao abrir o app: tenta restaurar a sessão pelo cookie de refresh (o access token só existe em memória).
  useEffect(() => {
    let active = true;
    refreshSession().then((session) => {
      if (active) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });
    setAuthLostHandler(() => setUser(null));
    return () => {
      active = false;
      setAuthLostHandler(null);
    };
  }, []);

  const startSession = (session: Session) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
  };

  const login = useCallback(async (email: string, password: string) => {
    startSession(await api<Session>('/api/auth/login', { method: 'POST', body: { email, password }, auth: false }));
  }, []);

  const register = useCallback(async (data: { name: string; email: string; password: string; acceptTerms: true }) => {
    startSession(await api<Session>('/api/auth/register', { method: 'POST', body: data, auth: false }));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST', auth: false });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
