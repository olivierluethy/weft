import { useEffect, useRef, useState } from 'react';
import {
  Star,
  Share2,
  History,
  MoreHorizontal,
  ImagePlus,
  Smile,
  Lock,
  BarChart3,
  MessageSquare,
  Move,
  Trash2,
  Type,
  Copy,
  Pencil,
} from 'lucide-react';
import type { PageDetail, Breadcrumb } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { COVER_HEIGHT } from '@weft/shared';
import { Popover } from '@/components/ui/Popover';
import { Tooltip } from '@/components/ui/Tooltip';
import { IconButton } from '@/components/ui/Button';
import { IconPicker, PageIcon } from './pickers/IconPicker';
import { CoverPicker } from './pickers/CoverPicker';
import { StatsPanel } from './StatsPanel';
import { CustomCssModal } from './CustomCssModal';
import { CoverReposition } from './CoverReposition';
import { coverImageStyle } from './cover';
import { PathBar } from './PathBar';
import { TagEditor } from './TagEditor';
import { HistoryPanel } from '@/features/history/HistoryPanel';
import { ShareDialog } from '@/features/share/ShareDialog';
import { CommentsPanel } from '@/features/comments/CommentsPanel';
import type { DocStats } from './stats';
import {
  exportMarkdown,
  exportHtmlFile,
  exportJson,
  exportDocx,
  exportPdf,
  exportText,
  toMarkdown,
} from '@/features/export/exporters';
import { toast } from '@/lib/toast';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useInvalidate } from '@/lib/queries';
import { MovePageDialog } from './MovePageDialog';
import { ImportDialog } from './ImportDialog';
import { PageOptionsPanel, type PageOptionsHandlers } from './PageOptionsPanel';
import { FontList } from './FontList';
import { DEFAULT_PAGE_FONT } from './pageFonts';

/** Shared style for the horizontal page-header meta actions (Add cover / Add
 * icon / Add tag). Kept in sync with `META_PILL` in TagEditor.tsx (§13-14). */
const META_PILL =
  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-faint transition hover:bg-sunk hover:text-ink';

export function PageHeader({
  page,
  breadcrumbs,
  role,
  editable,
  stats,
  currentContent,
  getLiveContent,
  historyOpen,
  onHistoryOpenChange,
  onUpdate,
  onRestored,
  onTitleEnter,
  onImportFile,
}: {
  page: PageDetail;
  breadcrumbs: Breadcrumb[];
  role: string;
  editable: boolean;
  stats: DocStats;
  currentContent: unknown;
  /** Reads the freshest editor content at call time (refs don't re-render). */
  getLiveContent?: () => unknown;
  historyOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  onUpdate: (partial: Record<string, unknown>) => void;
  onRestored: () => void;
  /** Enter in the title jumps the caret into the editor body (Notion-style). */
  onTitleEnter?: () => void;
  /** Parse + append an uploaded file to the page (wired to the editor). Absent
   * when the page isn't editable — the Import entry hides in that case. */
  onImportFile?: (file: File) => Promise<number>;
}) {
  const [title, setTitle] = useState(page.title);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const compactTitleRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  // True once the big title has scrolled up behind the sticky bar — then the
  // sticky bar shows a compact, still-editable copy of the title.
  const [scrolled, setScrolled] = useState(false);

  // Keep the field in sync when the title changes elsewhere (sidebar rename,
  // a restored version) — but never while the user is mid-edit typing in
  // either the big title or its compact copy.
  useEffect(() => {
    const active = document.activeElement;
    if (active !== titleRef.current && active !== compactTitleRef.current) setTitle(page.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.title]);

  // Watch the big title; once it slips above the sticky bar, reveal the compact
  // one. rootMargin nudges the trigger line just below the bar's height.
  useEffect(() => {
    const el = titleRef.current;
    const root = el?.closest('[data-page-scroll]') as HTMLElement | null;
    if (!el || !root) return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!(entry?.isIntersecting ?? true)), {
      root,
      rootMargin: '-52px 0px 0px 0px',
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [page.id]);

  const commitTitle = () => {
    if (cancelRef.current) {
      cancelRef.current = false;
      setTitle(page.title);
      return;
    }
    if (title !== page.title) onUpdate({ title });
  };

  const onTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur(); // commit via onBlur
      onTitleEnter?.(); // …then jump the caret into the body (Notion-style)
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelRef.current = true;
      e.currentTarget.blur(); // revert via onBlur guard
    }
  };
  const [showShare, setShowShare] = useState(false);
  const [showCss, setShowCss] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Path-edit mode is owned here (not inside PathBar) so the "Edit path" control
  // can live in the persistent header cluster and open it at any scroll depth.
  const [pathEditing, setPathEditing] = useState(false);
  const pathString = breadcrumbs.map((c) => c.title || 'Untitled').join(' / ');
  const copyPath = () => {
    void navigator.clipboard.writeText(pathString);
    toast.success('Path copied');
  };

  const navigate = useNavigate();
  const invalidate = useInvalidate();

  // ── "…" menu actions ───────────────────────────────────────────────────────
  const copyLink = () => {
    void navigator.clipboard.writeText(`${location.origin}/p/${page.id}`);
    toast.success('Link copied');
  };
  const copyContents = () => {
    void navigator.clipboard.writeText(toMarkdown(getBlocks()));
    toast.success('Page contents copied');
  };
  const duplicatePage = async () => {
    try {
      const { page: dup } = await api.post<{ page: { id: string } }>(`/pages/${page.id}/duplicate`);
      await invalidate.tree(page.workspaceId);
      toast.success('Page duplicated');
      navigate(`/p/${dup.id}`);
    } catch {
      toast.error('Could not duplicate page');
    }
  };
  const trashPage = async () => {
    try {
      await api.del(`/pages/${page.id}`);
      await invalidate.tree(page.workspaceId);
      toast.success('Moved to Trash');
      navigate('/');
    } catch {
      toast.error('Could not move to Trash');
    }
  };

  // Read the freshest content at call time — `currentContent` is a stale ref
  // snapshot from the last render, so live edits (for Copy contents / export)
  // must come through the getter.
  const getBlocks = (): any[] => {
    const live = getLiveContent?.();
    if (Array.isArray(live)) return live;
    return (Array.isArray(currentContent) ? currentContent : page.content) as any[];
  };

  // A freshly created (Untitled) page opens with the title focused, ready to type.
  useEffect(() => {
    if (editable && !page.title) titleRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);

  const font = page.fontFamily ?? DEFAULT_PAGE_FONT;

  // Export targets, in the order a writer reaches for them. Each carries the
  // format its icon draws (components/ui/FileFormatIcon.tsx) rather than a
  // generic download glyph, so PDF and Word are told apart before reading.
  const exportItems: PageOptionsHandlers['exports'] = [
    { id: 'md', label: 'Markdown', format: 'md', run: () => exportMarkdown(page.title, getBlocks()) },
    { id: 'txt', label: 'Plain text', format: 'txt', run: () => exportText(page.title, getBlocks()) },
    { id: 'json', label: 'JSON', format: 'json', run: () => exportJson(page.title, page) },
    { id: 'docx', label: 'Word', format: 'docx', run: () => void exportDocx(page.title, getBlocks(), font) },
    { id: 'pdf', label: 'PDF', format: 'pdf', run: () => exportPdf(page.title, getBlocks(), font) },
    { id: 'html', label: 'HTML', format: 'html', run: () => exportHtmlFile(page.title, getBlocks(), font) },
  ];

  const optionHandlers: PageOptionsHandlers = {
    changeCover: () => setCoverOpen(true),
    setBackground: () => {
      const url = prompt('Background image URL');
      if (url) onUpdate({ backgroundUrl: url });
    },
    removeBackground: () => onUpdate({ backgroundUrl: null }),
    customCss: () => setShowCss(true),
    copyLink,
    copyContents,
    duplicate: () => void duplicatePage(),
    moveTo: () => setMoveOpen(true),
    trash: () => void trashPage(),
    importFile: editable && onImportFile ? () => setImportOpen(true) : undefined,
    exports: exportItems,
  };

  return (
    // NB: no wrapping element here. A wrapper <div> would become the sticky
    // bar's containing block and unpin it as soon as the header scrolls past,
    // so the bar must be a direct child of the [data-page-scroll] container.
    <>
      {/* Sticky action bar. On scroll it "lifts": the translucent, near-borderless
          resting bar becomes a solid surface plate with a hairline, a whisper-soft
          shadow, and icons that firm from muted to full ink for contrast. The
          `:not(.bg-thread-soft)` guard keeps toggled (thread-coloured) icons their
          own colour. Everything transitions so the change reads as a smooth lift. */}
      <div
        className={cn(
          'wf-page-header-bar sticky top-0 z-20 flex items-center gap-1 py-2 pl-12 pr-3 backdrop-blur md:px-4',
          'transition-[background-color,box-shadow,border-color] duration-200 ease-out',
          scrolled
            ? 'border-b border-line shadow-[0_4px_14px_-10px_rgba(33,31,28,0.35)] [&_button:not(.bg-thread-soft)]:text-ink'
            : 'border-b border-line/40',
        )}
        // The semantic colour tokens are full `var(--x)` values, so Tailwind's
        // `/opacity` modifier can't tint them (it emits an invalid rgb() and the
        // background silently drops to transparent — the real cause of the old
        // "grey on grey"). color-mix gives a genuine, theme-aware translucent
        // plate: a light frost at rest, a near-solid surface once scrolled.
        style={{
          backgroundColor: scrolled
            ? 'color-mix(in srgb, var(--surface) 94%, transparent)'
            : 'color-mix(in srgb, var(--paper) 72%, transparent)',
        }}
      >
        {/* Left region. Path-edit mode wins at any scroll depth (so "Edit path"
            works from the compact header too); otherwise breadcrumb at rest,
            compact editable title once scrolled. */}
        {pathEditing ? (
          <PathBar
            breadcrumbs={breadcrumbs}
            editable={editable}
            editing
            onEditingChange={setPathEditing}
            onRenameCurrent={(t) => onUpdate({ title: t })}
          />
        ) : scrolled ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {page.icon && <PageIcon icon={page.icon} size={18} />}
            <input
              ref={compactTitleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
              onKeyDown={onTitleKeyDown}
              onBlur={commitTitle}
              disabled={!editable}
              placeholder="Untitled"
              spellCheck={false}
              title={editable ? 'Edit title' : undefined}
              className="weft-title-compact min-w-0 flex-1 truncate rounded-md border-none bg-transparent px-1 text-base font-semibold text-ink outline-none transition-colors placeholder:text-ink-faint focus:bg-sunk/60 focus-visible:shadow-none focus-visible:outline-none disabled:cursor-default disabled:bg-transparent"
            />
          </div>
        ) : (
          <PathBar
            breadcrumbs={breadcrumbs}
            editable={editable}
            editing={false}
            onEditingChange={setPathEditing}
            onRenameCurrent={(t) => onUpdate({ title: t })}
          />
        )}

        {/* Persistent path actions — part of the page navigation, so they must
            stay reachable whatever the scroll depth (report §16–20). Hidden only
            while actively editing the path (PathBar shows its own Go/Cancel). */}
        {!pathEditing && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Tooltip label="Copy path">
              <IconButton label="Copy path" title={undefined} onClick={copyPath}>
                <Copy size={15} />
              </IconButton>
            </Tooltip>
            <Tooltip label="Edit path">
              <IconButton label="Edit path" title={undefined} onClick={() => setPathEditing(true)}>
                <Pencil size={15} />
              </IconButton>
            </Tooltip>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-0.5">
          {page.isLocked && (
            <span className="mr-1 flex items-center gap-1 rounded bg-sunk px-2 py-0.5 text-xs text-ink-muted">
              <Lock size={11} /> Locked
            </span>
          )}
          <Tooltip label="Page stats">
            <Popover
              align="end"
              trigger={<IconButton label="Page stats" title={undefined}><BarChart3 size={16} /></IconButton>}
            >
              <StatsPanel stats={stats} updatedAt={page.updatedAt} />
            </Popover>
          </Tooltip>
          <Tooltip label="Font family">
            <Popover
              align="end"
              trigger={<IconButton label="Font family" title={undefined}><Type size={16} /></IconButton>}
            >
              {/* Live, like everywhere else: picking a face re-faces the page
                  and leaves the list open so the next one is one click away. */}
              <FontList
                value={page.fontFamily}
                editable={editable}
                onPick={(f) => onUpdate({ fontFamily: f })}
                className="max-h-[min(460px,70vh)] w-72 rounded-xl border border-line bg-surface shadow-lg"
              />
            </Popover>
          </Tooltip>
          <Tooltip label={page.isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
            <IconButton
              label={page.isFavorite ? 'Unfavorite' : 'Favorite'}
              title={undefined}
              active={page.isFavorite}
              onClick={() => onUpdate({ isFavorite: !page.isFavorite })}
            >
              <Star size={16} className={page.isFavorite ? 'fill-madder text-madder' : ''} />
            </IconButton>
          </Tooltip>
          <Tooltip label="Comments">
            <IconButton label="Comments" title={undefined} active={showComments} onClick={() => setShowComments((v) => !v)}>
              <MessageSquare size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip label="Share">
            <IconButton label="Share" title={undefined} onClick={() => setShowShare(true)}>
              <Share2 size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip label="Version history">
            <IconButton label="Version history" title={undefined} active={historyOpen} onClick={() => onHistoryOpenChange(true)}>
              <History size={16} />
            </IconButton>
          </Tooltip>

          {/* More options. A Popover, not a Menu: `Menu` closes on every item
              click, which would make every live setting a one-shot (§6.7). */}
          <Tooltip label="More options">
            <Popover
              align="end"
              className="z-overlay"
              trigger={
                <IconButton label="More" title={undefined} data-weft-more-options>
                  <MoreHorizontal size={16} />
                </IconButton>
              }
            >
              {(close) => (
                <PageOptionsPanel
                  page={page}
                  role={role}
                  editable={editable}
                  onUpdate={onUpdate}
                  handlers={optionHandlers}
                  close={close}
                />
              )}
            </Popover>
          </Tooltip>
        </div>
      </div>

      {/* Cover + page meta share one hover scope (`group`) so the meta row
          (Add cover / icon / tag) reveals when the pointer is anywhere over the
          header — including the cover image itself, not only the title. Without
          this the row was gated to the title block and appeared to hide "behind"
          a cover, forcing pixel-hunting (§13-14). */}
      <div className="group relative">
      {/* Cover */}
      <CoverArea page={page} editable={editable} onUpdate={onUpdate} />

      {/* Icon + title */}
      <div
        className={cn('mx-auto px-4 sm:px-8 md:px-12', page.isFullWidth ? 'max-w-none' : '')}
        style={{ maxWidth: page.isFullWidth ? '100%' : (page.width || 720) + 96 }}
      >
        <div className={cn('relative', page.coverUrl ? '-mt-8' : 'pt-12')}>
          {/* Horizontal meta actions — Add cover · Add icon · Add tag. Equal-weight
              ghost pills on one row above the title; each drops out the moment its
              item is set. Revealed on hover/focus of the header (Notion), but always
              shown on a brand-new (untitled) page so first-run users see them. */}
          {editable &&
            (!page.coverUrl || !page.icon || (page.tags?.length ?? 0) === 0) && (
              <div
                className={cn(
                  'mb-2 flex flex-wrap items-center gap-0.5 transition-opacity duration-150',
                  page.title
                    ? 'opacity-0 focus-within:opacity-100 group-hover:opacity-100'
                    : 'opacity-100',
                )}
              >
                {!page.coverUrl && (
                  <Popover
                    trigger={
                      <button id="weft-cover-trigger" className={META_PILL}>
                        <ImagePlus size={13} /> Add cover
                      </button>
                    }
                  >
                    {(close) => (
                      <CoverPicker
                        workspaceId={page.workspaceId}
                        onPick={(url) => {
                          onUpdate({ coverUrl: url });
                          close();
                        }}
                      />
                    )}
                  </Popover>
                )}
                {!page.icon && (
                  <Popover
                    trigger={
                      <button className={META_PILL}>
                        <Smile size={13} /> Add icon
                      </button>
                    }
                  >
                    {(close) => (
                      <IconPicker
                        workspaceId={page.workspaceId}
                        onPick={(v) => {
                          onUpdate({ icon: v });
                          close();
                        }}
                      />
                    )}
                  </Popover>
                )}
                <TagEditor page={page} editable={editable} mode="bar" />
              </div>
            )}

          {page.icon && (
            <Popover trigger={<button className="mb-1 inline-block rounded-md p-1 transition hover:bg-sunk"><PageIcon icon={page.icon} size={64} /></button>}>
              {(close) => (
                <IconPicker
                  workspaceId={page.workspaceId}
                  onPick={(v) => {
                    onUpdate({ icon: v });
                    close();
                  }}
                  onRemove={() => {
                    onUpdate({ icon: null });
                    close();
                  }}
                />
              )}
            </Popover>
          )}

          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
            onKeyDown={onTitleKeyDown}
            onBlur={commitTitle}
            disabled={!editable}
            rows={1}
            placeholder="Untitled"
            spellCheck={false}
            className="weft-title w-full cursor-text resize-none overflow-hidden border-none bg-transparent text-[40px] font-semibold leading-tight tracking-tight text-ink outline-none placeholder:text-ink-faint focus:shadow-none focus-visible:shadow-none focus-visible:outline-none disabled:cursor-default"
          />

          <TagEditor page={page} editable={editable} />
        </div>
      </div>
      </div>

      {historyOpen && (
        <HistoryPanel
          pageId={page.id}
          title={page.title}
          currentContent={currentContent}
          editable={editable}
          onRestored={onRestored}
          onClose={() => onHistoryOpenChange(false)}
        />
      )}
      {showShare && <ShareDialog pageId={page.id} onClose={() => setShowShare(false)} />}
      {showComments && <CommentsPanel pageId={page.id} onClose={() => setShowComments(false)} />}
      {showCss && (
        <CustomCssModal
          initial={page.customCss}
          onSave={(css) => {
            onUpdate({ customCss: css });
            toast.success('Custom CSS applied');
          }}
          onClose={() => setShowCss(false)}
        />
      )}
      {moveOpen && (
        <MovePageDialog pageId={page.id} workspaceId={page.workspaceId} onClose={() => setMoveOpen(false)} />
      )}
      {onImportFile && (
        <ImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImport={onImportFile}
        />
      )}
    </>
  );

  function setCoverOpen(_: boolean) {
    // handled inside CoverArea via its own popover; this menu item focuses it.
    document.getElementById('weft-cover-trigger')?.click();
  }
}

function CoverArea({
  page,
  editable,
  onUpdate,
}: {
  page: PageDetail;
  editable: boolean;
  onUpdate: (partial: Record<string, unknown>) => void;
}) {
  const [reposition, setReposition] = useState(false);

  // No cover: the "Add cover" affordance lives in the header meta row (§13-14),
  // so the cover slot itself renders nothing until an image is chosen.
  if (!page.coverUrl) return null;

  return (
    <div className="group relative w-full overflow-hidden" style={{ height: COVER_HEIGHT }}>
      <img
        src={page.coverUrl}
        alt="Cover"
        draggable={false}
        style={coverImageStyle(page.coverOffsetX, page.coverOffsetY, page.coverScale)}
      />
      {editable && (
        <div
          className="absolute right-3 top-3 flex items-center gap-1 rounded p-1 opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100"
          style={{ background: 'var(--scrim)' }}
        >
          <Popover
            align="end"
            trigger={
              <button
                id="weft-cover-trigger"
                className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition hover:bg-black/5"
                style={{ color: 'var(--scrim-ink)' }}
              >
                <ImagePlus size={13} /> Change
              </button>
            }
          >
            {(close) => (
              <CoverPicker
                workspaceId={page.workspaceId}
                onPick={(url) => {
                  onUpdate({ coverUrl: url });
                  close();
                }}
                onRemove={() => {
                  onUpdate({ coverUrl: null });
                  close();
                }}
              />
            )}
          </Popover>
          <span className="h-4 w-px" style={{ background: 'var(--line)' }} />
          <button
            onClick={() => setReposition(true)}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition hover:bg-black/5"
            style={{ color: 'var(--scrim-ink)' }}
          >
            <Move size={13} /> Reposition
          </button>
          <span className="h-4 w-px" style={{ background: 'var(--line)' }} />
          <button
            onClick={() => onUpdate({ coverUrl: null })}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition hover:bg-black/5"
            style={{ color: 'var(--scrim-ink)' }}
          >
            <Trash2 size={13} /> Remove
          </button>
        </div>
      )}

      {reposition && (
        <CoverReposition
          url={page.coverUrl}
          offsetX={page.coverOffsetX ?? 50}
          offsetY={page.coverOffsetY ?? 50}
          scale={page.coverScale ?? 1}
          onSave={(v) => {
            onUpdate(v);
            setReposition(false);
          }}
          onCancel={() => setReposition(false)}
        />
      )}
    </div>
  );
}
