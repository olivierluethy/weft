import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PAGE_WIDTH } from '@weft/shared';
import { usePage, useInvalidate } from '@/lib/queries';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/features/app/workspace';
import { GlobalStyles } from '@/features/app/GlobalStyles';
import { Spinner } from '@/components/ui/Spinner';
import { Editor } from './Editor';
import { PageHeader } from './PageHeader';
import { computeStats, type DocStats } from './stats';

export function PageView() {
  const { pageId } = useParams();
  const { data, isLoading, refetch } = usePage(pageId);
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const invalidate = useInvalidate();
  const [stats, setStats] = useState<DocStats>(() => computeStats([]));
  const contentRef = useRef<unknown>(null);

  const page = data?.page;
  const role = data?.role ?? 'viewer';
  const editable = role !== 'viewer' && !(page?.isLocked ?? false);

  useEffect(() => {
    if (page) setStats(computeStats(page.content));
    contentRef.current = page?.content ?? null;
  }, [page]);

  const saveContent = useCallback(
    (doc: unknown) => {
      if (!pageId) return;
      contentRef.current = doc;
      void api.patch(`/pages/${pageId}`, { content: doc }).catch(() => undefined);
    },
    [pageId],
  );

  const update = useCallback(
    async (partial: Record<string, unknown>) => {
      if (!pageId) return;
      await api.patch(`/pages/${pageId}`, partial).catch(() => undefined);
      await refetch();
      // Title/icon changes should reflect in the sidebar tree.
      if ('title' in partial || 'icon' in partial || 'isFavorite' in partial || 'isLocked' in partial) {
        void invalidate.tree(workspaceId);
      }
    },
    [pageId, refetch, invalidate, workspaceId],
  );

  if (isLoading || !page || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const maxWidth = page.isFullWidth ? '100%' : `${page.width || PAGE_WIDTH.default}px`;

  return (
    <div
      className="relative h-full overflow-y-auto"
      style={
        page.backgroundUrl
          ? {
              backgroundImage: `url(${page.backgroundUrl})`,
              backgroundSize: 'cover',
              backgroundAttachment: 'fixed',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {/* Page-scoped custom CSS applied live to the content area. */}
      <GlobalStyles css={page.customCss} scope="page" />

      <PageHeader
        key={pageId}
        page={page}
        breadcrumbs={data?.breadcrumbs ?? []}
        role={role}
        editable={editable}
        stats={stats}
        currentContent={contentRef.current ?? page.content}
        onUpdate={update}
        onRestored={() => void refetch()}
      />

      <div className="mx-auto px-12 pb-40" style={{ maxWidth, width: '100%' }}>
        <Editor
          key={pageId}
          pageId={pageId!}
          workspaceId={page.workspaceId}
          initialContent={page.content}
          editable={editable}
          user={{ id: user.id, name: user.name }}
          onSave={saveContent}
          onStats={setStats}
        />
      </div>
    </div>
  );
}
