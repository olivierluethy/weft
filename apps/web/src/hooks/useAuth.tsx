import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PublicUser } from '@weft/shared';
import { api } from '@/lib/api';

interface WorkspaceRef {
  id: string;
  name: string;
  icon: string | null;
  role: string;
}

interface AuthContextValue {
  user: PublicUser | null;
  workspaces: WorkspaceRef[];
  loading: boolean;
  refresh: () => Promise<void>;
  setUser: (u: PublicUser | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface MeResponse {
  user: PublicUser;
  workspaces: WorkspaceRef[];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRef[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const me = await api.get<MeResponse>('/auth/me');
      setUser(me.user);
      setWorkspaces(me.workspaces);
    } catch {
      setUser(null);
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setUser(null);
    setWorkspaces([]);
  };

  return (
    <AuthContext.Provider value={{ user, workspaces, loading, refresh, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
