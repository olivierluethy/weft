import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PageTreeNode } from '@weft/shared';
import { api } from './api';

export interface PageDetail {
  id: string;
  workspaceId: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  coverUrl: string | null;
  coverOffsetX: number;
  coverOffsetY: number;
  coverScale: number;
  backgroundUrl: string | null;
  content: unknown;
  customCss: string | null;
  isLocked: boolean;
  isFullWidth: boolean;
  width: number;
  isFavorite: boolean;
  updatedAt: string;
  tags: { id: string; name: string; color: string }[];
}
export interface Breadcrumb {
  id: string;
  title: string;
  icon: string | null;
}

export function useTree(workspaceId: string | null) {
  return useQuery({
    queryKey: ['tree', workspaceId],
    enabled: !!workspaceId,
    queryFn: () => api.get<{ tree: PageTreeNode[] }>(`/workspaces/${workspaceId}/tree`),
    select: (d) => d.tree,
  });
}

export function usePage(pageId: string | undefined) {
  return useQuery({
    queryKey: ['page', pageId],
    enabled: !!pageId,
    queryFn: () =>
      api.get<{ page: PageDetail; role: string; breadcrumbs: Breadcrumb[] }>(`/pages/${pageId}`),
  });
}

export function useWorkspaceMeta(workspaceId: string | null) {
  return useQuery({
    queryKey: ['workspace', workspaceId],
    enabled: !!workspaceId,
    queryFn: () =>
      api.get<{ workspace: { id: string; name: string; globalCss: string | null }; role: string }>(
        `/workspaces/${workspaceId}`,
      ),
  });
}

/** Invalidate the sidebar tree after structural changes. */
export function useInvalidate() {
  const qc = useQueryClient();
  return {
    tree: (workspaceId: string | null) => qc.invalidateQueries({ queryKey: ['tree', workspaceId] }),
    page: (pageId: string) => qc.invalidateQueries({ queryKey: ['page', pageId] }),
  };
}
