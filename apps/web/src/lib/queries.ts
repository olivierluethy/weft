import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PageTreeNode, WorkspaceOverviewPage, ActivityFeed } from '@weft/shared';
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
  fontFamily: 'serif' | 'sans' | 'mono';
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

/** Workspace overview: every live page with created/edited dates + word count.
 * Heavier than the tree (reads content server-side), so only fetch it when the
 * overview is actually shown. */
export function useWorkspaceOverview(workspaceId: string | null) {
  return useQuery({
    queryKey: ['overview', workspaceId],
    enabled: !!workspaceId,
    queryFn: () =>
      api.get<{ pages: WorkspaceOverviewPage[] }>(`/workspaces/${workspaceId}/overview`),
    select: (d) => d.pages,
  });
}

/** Activity feed for a window. `month` null → whole year; both null → current
 * month (server default). Keyed by window so navigation caches each view. */
export function useActivity(
  workspaceId: string | null,
  year: number | null,
  month: number | null,
) {
  return useQuery({
    queryKey: ['activity', workspaceId, year, month],
    enabled: !!workspaceId,
    queryFn: () => {
      const params = new URLSearchParams();
      if (year != null) params.set('year', String(year));
      if (month != null) params.set('month', String(month));
      const qs = params.toString();
      return api.get<ActivityFeed>(`/workspaces/${workspaceId}/activity${qs ? `?${qs}` : ''}`);
    },
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
