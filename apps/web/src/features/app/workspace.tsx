import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface WorkspaceContextValue {
  workspaceId: string | null;
  setWorkspaceId: (id: string) => void;
}

const Ctx = createContext<WorkspaceContextValue | null>(null);
const KEY = 'weft-active-workspace';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { workspaces } = useAuth();
  const [workspaceId, setId] = useState<string | null>(() => localStorage.getItem(KEY));

  // Default to the first workspace, and heal a stale stored id.
  useEffect(() => {
    if (workspaces.length === 0) return;
    const valid = workspaceId && workspaces.some((w) => w.id === workspaceId);
    if (!valid) {
      const next = workspaces[0]!.id;
      setId(next);
      localStorage.setItem(KEY, next);
    }
  }, [workspaces, workspaceId]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaceId,
      setWorkspaceId: (id) => {
        setId(id);
        localStorage.setItem(KEY, id);
      },
    }),
    [workspaceId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
