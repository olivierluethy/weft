import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2, X, ExternalLink } from 'lucide-react';
import { usePage } from '@/lib/queries';
import { Portal } from '@/components/ui/Portal';
import { Tooltip } from '@/components/ui/Tooltip';
import { Spinner } from '@/components/ui/Spinner';
import { PageIcon } from './pickers/IconPicker';
import { coverImageStyle } from './cover';
import { toHtml } from '@/features/export/exporters';

/** A docked, read-only preview of a page shown beside the current one, so the
 * user can glance at another page without losing their place. Non-modal on
 * desktop (the main view stays visible and scrollable); a tap-scrim closes it
 * on small screens. Content is rendered statically via `toHtml` — the same
 * read-only renderer the public share view uses — so it never opens a second
 * collaborative editor session against the page. */
export function SidePeek({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const { data, isLoading } = usePage(pageId);
  const navigate = useNavigate();
  const page = data?.page;

  const html = useMemo(
    () => (page ? toHtml((Array.isArray(page.content) ? page.content : []) as never) : ''),
    [page],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const openFull = () => {
    if (page) navigate(`/p/${page.id}`);
    onClose();
  };

  return (
    <Portal>
      {/* Tap-scrim: closes on small screens; on desktop the peek is non-modal. */}
      <div
        className="fixed inset-0 z-peek bg-[rgba(33,31,28,.28)] backdrop-blur-[1px] md:hidden"
        onMouseDown={onClose}
        aria-hidden
      />
      <aside
        className="fixed right-0 top-0 z-peek flex h-full w-full flex-col border-l border-line bg-paper shadow-lg animate-[slidein_.2s_ease] sm:w-[92vw] md:w-[46vw] md:min-w-[440px] md:max-w-[760px]"
        role="dialog"
        aria-label="Page side peek"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {page?.icon && <PageIcon icon={page.icon} size={18} />}
            <span className="truncate font-display text-sm font-semibold text-ink">
              {page?.title || 'Untitled'}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Tooltip label="Open as full page">
              <button
                onClick={openFull}
                aria-label="Open as full page"
                className="flex h-7 w-7 items-center justify-center rounded text-ink-faint transition hover:bg-sunk hover:text-ink"
              >
                <Maximize2 size={15} />
              </button>
            </Tooltip>
            <Tooltip label="Open in new tab">
              <button
                onClick={() => window.open(`/p/${pageId}`, '_blank', 'noopener')}
                aria-label="Open in new tab"
                className="flex h-7 w-7 items-center justify-center rounded text-ink-faint transition hover:bg-sunk hover:text-ink"
              >
                <ExternalLink size={15} />
              </button>
            </Tooltip>
            <Tooltip label="Close (Esc)">
              <button
                onClick={onClose}
                aria-label="Close side peek"
                className="flex h-7 w-7 items-center justify-center rounded text-ink-faint transition hover:bg-sunk hover:text-ink"
              >
                <X size={17} />
              </button>
            </Tooltip>
          </div>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto"
          data-page-font={page?.fontFamily ?? 'serif'}
        >
          {isLoading || !page ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              {page.coverUrl && (
                <div className="h-[160px] w-full overflow-hidden">
                  <img
                    src={page.coverUrl}
                    alt=""
                    draggable={false}
                    style={coverImageStyle(
                      page.coverOffsetX ?? 50,
                      page.coverOffsetY ?? 50,
                      page.coverScale ?? 1,
                    )}
                  />
                </div>
              )}
              <article className="weft-page-content mx-auto max-w-[680px] px-6 py-8 sm:px-10">
                <div className="mb-4 flex items-center gap-3">
                  {page.icon && <PageIcon icon={page.icon} size={44} />}
                  <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
                    {page.title || 'Untitled'}
                  </h1>
                </div>
                <div dangerouslySetInnerHTML={{ __html: html }} />
              </article>
            </>
          )}
        </div>
      </aside>
    </Portal>
  );
}
