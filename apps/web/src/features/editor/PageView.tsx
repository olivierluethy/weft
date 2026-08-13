import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { flashBlock } from '@/features/search/jump';
import { Link2 } from 'lucide-react';
import { PAGE_WIDTH } from '@weft/shared';
import { usePage, useInvalidate } from '@/lib/queries';
import { PageIcon } from './pickers/IconPicker';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/features/app/workspace';
import { GlobalStyles } from '@/features/app/GlobalStyles';
import { Spinner } from '@/components/ui/Spinner';
import { Editor, type ReorderSection } from './Editor';
import { PageHeader } from './PageHeader';
import { Outline } from './Outline';
import type { OutlineHeading } from './outline';
import { computeStats, type DocStats } from './stats';

export function PageView() {
  const { pageId } = useParams();
  const [searchParams] = useSearchParams();
  const { data, isLoading, refetch } = usePage(pageId);
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const invalidate = useInvalidate();
  const [stats, setStats] = useState<DocStats>(() => computeStats([]));
  const [headings, setHeadings] = useState<OutlineHeading[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const contentRef = useRef<unknown>(null);
  const reorderRef = useRef<ReorderSection | null>(null);

  const page = data?.page;
  const role = data?.role ?? 'viewer';
  const editable = role !== 'viewer' && !(page?.isLocked ?? false);

  // Close the history panel when switching pages so its read-only guard never
  // leaks onto the next page's editor.
  useEffect(() => {
    setHistoryOpen(false);
  }, [pageId]);

  useEffect(() => {
    if (page) setStats(computeStats(page.content));
    contentRef.current = page?.content ?? null;
  }, [page]);

  // Jump to (and flash) a searched block once the editor has rendered.
  useEffect(() => {
    if (!page) return;
    const block = searchParams.get('b');
    if (!block) return;
    const timer = setTimeout(() => flashBlock(block), 300);
    return () => clearTimeout(timer);
  }, [page, searchParams]);

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
      data-page-scroll
      data-page-font={page.fontFamily ?? 'serif'}
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
        historyOpen={historyOpen}
        onHistoryOpenChange={setHistoryOpen}
        onUpdate={update}
        onRestored={() => void refetch()}
      />

      <div className="mx-auto px-4 pb-40 sm:px-8 md:px-12" style={{ maxWidth, width: '100%' }}>
        <Editor
          key={pageId}
          pageId={pageId!}
          workspaceId={page.workspaceId}
          initialContent={page.content}
          editable={editable && !historyOpen}
          user={{ id: user.id, name: user.name }}
          onSave={saveContent}
          onStats={setStats}
          onHeadings={setHeadings}
          reorderRef={reorderRef}
        />

        <Backlinks pageId={pageId!} />
      </div>

      <Outline
        headings={headings}
        canReorder={editable && !historyOpen}
        onReorder={(draggedId, beforeId) => reorderRef.current?.(draggedId, beforeId)}
      />
    </div>
  );
}

/** Pages that @mention this one. */
function Backlinks({ pageId }: { pageId: string }) {
  const { data } = useQuery({
    queryKey: ['backlinks', pageId],
    queryFn: () =>
      api.get<{ backlinks: { id: string; title: string; icon: string | null }[] }>(
        `/pages/${pageId}/backlinks`,
      ),
  });
  const links = data?.backlinks ?? [];
  if (links.length === 0) return null;

  return (
    <div className="mt-10 border-t border-line pt-5">
      <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
        <Link2 size={13} /> Linked references
      </p>
      <div className="flex flex-col gap-0.5">
        {links.map((l) => (
          <Link
            key={l.id}
            to={`/p/${l.id}`}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-ink-muted transition hover:bg-sunk hover:text-ink"
          >
            {l.icon ? <PageIcon icon={l.icon} size={16} /> : '📄'}
            {l.title || 'Untitled'}
          </Link>
        ))}
      </div>
    </div>
  );
}
