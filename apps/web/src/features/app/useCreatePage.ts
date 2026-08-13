import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWorkspace } from './workspace';
import { useInvalidate } from '@/lib/queries';

/** Create a page (blank, nested, or from a template) and navigate to it. */
export function useCreatePage() {
  const { workspaceId } = useWorkspace();
  const navigate = useNavigate();
  const invalidate = useInvalidate();

  return useCallback(
    async (opts?: { parentId?: string | null; templateId?: string }) => {
      if (!workspaceId) return;
      const res = await api.post<{ page: { id: string } }>('/pages', { workspaceId, ...opts });
      await invalidate.tree(workspaceId);
      navigate(`/p/${res.page.id}`);
    },
    [workspaceId, navigate, invalidate],
  );
}
