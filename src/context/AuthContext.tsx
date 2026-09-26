import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { apiLogin, apiLogout } from '@/lib/apiClient';
import type { AppUser, Role } from '@/lib/types';

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'srp_current_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { user: data } = await apiLogin(email, password);
      setUser(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return { ok: true };
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('No account found')) return { ok: false, error: msg };
      if (msg.includes('Incorrect password')) return { ok: false, error: msg };
      return { ok: false, error: msg || 'Unable to reach the server. Please try again.' };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    apiLogout();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function hasRole(user: AppUser | null, ...roles: Role[]): boolean {
  return !!user && roles.includes(user.role);
}
