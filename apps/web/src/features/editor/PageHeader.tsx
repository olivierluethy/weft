import { useEffect, useRef, useState } from 'react';
import {
  Star,
  Share2,
  History,
  MoreHorizontal,
  ImagePlus,
  Smile,
  Lock,
  Unlock,
  BarChart3,
  Code2,
  Maximize2,
  Minimize2,
  Download,
  Wallpaper,
  MessageSquare,
  Move,
  Trash2,
  Type,
  Check,
} from 'lucide-react';
import { PAGE_WIDTH } from '@weft/shared';
import type { PageDetail, Breadcrumb } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { COVER_HEIGHT } from '@weft/shared';
import { Popover } from '@/components/ui/Popover';
import { Menu } from '@/components/ui/Menu';
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
} from '@/features/export/exporters';
import { toast } from '@/lib/toast';

export function PageHeader({
  page,
  breadcrumbs,
  role,
  editable,
  stats,
  currentContent,
  historyOpen,
  onHistoryOpenChange,
  onUpdate,
  onRestored,
}: {
  page: PageDetail;
  breadcrumbs: Breadcrumb[];
  role: string;
  editable: boolean;
  stats: DocStats;
  currentContent: unknown;
  historyOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  onUpdate: (partial: Record<string, unknown>) => void;
  onRestored: () => void;
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
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelRef.current = true;
      e.currentTarget.blur(); // revert via onBlur guard
    }
  };
  const [showShare, setShowShare] = useState(false);
  const [showCss, setShowCss] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const blocks = (Array.isArray(currentContent) ? currentContent : page.content) as any[];

  // A freshly created (Untitled) page opens with the title focused, ready to type.
  useEffect(() => {
    if (editable && !page.title) titleRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);

  const font = page.fontFamily ?? 'serif';
  const exportItems = [
    { label: 'Markdown (.md)', onClick: () => exportMarkdown(page.title, blocks) },
    { label: 'HTML (.html)', onClick: () => exportHtmlFile(page.title, blocks, font) },
    { label: 'JSON (.json)', onClick: () => exportJson(page.title, page) },
    { label: 'Word (.docx)', onClick: () => void exportDocx(page.title, blocks, font) },
    { label: 'PDF (print)', onClick: () => exportPdf(page.title, blocks, font) },
  ];

  const setWidth = (delta: number) =>
    onUpdate({ width: Math.min(PAGE_WIDTH.max, Math.max(PAGE_WIDTH.min, (page.width || 720) + delta)) });

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
          'sticky top-0 z-20 flex items-center gap-1 py-2 pl-12 pr-3 backdrop-blur md:px-4',
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
        {scrolled ? (
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
              className="min-w-0 flex-1 truncate rounded-md border-none bg-transparent px-1 font-display text-base font-semibold text-ink outline-none transition-colors placeholder:text-ink-faint focus:bg-sunk/60 focus-visible:shadow-none focus-visible:outline-none disabled:cursor-default disabled:bg-transparent"
            />
          </div>
        ) : (
          <PathBar
            breadcrumbs={breadcrumbs}
            editable={editable}
            onRenameCurrent={(t) => onUpdate({ title: t })}
          />
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
              {(close) => (
                <FontPicker
                  value={page.fontFamily ?? 'serif'}
                  editable={editable}
                  onPick={(f) => {
                    onUpdate({ fontFamily: f });
                    close();
                  }}
                />
              )}
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

          <Tooltip label="More options">
          <Menu
            align="end"
            trigger={<IconButton label="More" title={undefined}><MoreHorizontal size={16} /></IconButton>}
            items={[
              {
                label: page.coverUrl ? 'Change cover' : 'Add cover',
                icon: <ImagePlus size={15} />,
                onClick: () => setCoverOpen(true),
                disabled: !editable,
              },
              {
                label: page.isFullWidth ? 'Fixed width' : 'Full width',
                icon: page.isFullWidth ? <Minimize2 size={15} /> : <Maximize2 size={15} />,
                onClick: () => onUpdate({ isFullWidth: !page.isFullWidth }),
                disabled: !editable,
              },
              { label: 'Narrower', icon: <Minimize2 size={15} />, onClick: () => setWidth(-60), disabled: !editable || page.isFullWidth },
              { label: 'Wider', icon: <Maximize2 size={15} />, onClick: () => setWidth(60), disabled: !editable || page.isFullWidth },
              {
                label: page.isLocked ? 'Unlock page' : 'Lock page',
                icon: page.isLocked ? <Unlock size={15} /> : <Lock size={15} />,
                onClick: () => onUpdate({ isLocked: !page.isLocked }),
                disabled: role === 'viewer',
              },
              {
                label: page.backgroundUrl ? 'Remove background' : 'Set page background',
                icon: <Wallpaper size={15} />,
                onClick: () =>
                  page.backgroundUrl
                    ? onUpdate({ backgroundUrl: null })
                    : (() => {
                        const url = prompt('Background image URL');
                        if (url) onUpdate({ backgroundUrl: url });
                      })(),
                disabled: !editable,
              },
              { label: 'Custom CSS', icon: <Code2 size={15} />, onClick: () => setShowCss(true), disabled: !editable },
              { divider: true, label: '' },
              ...exportItems.map((e) => ({ label: e.label, icon: <Download size={15} />, onClick: e.onClick })),
            ]}
          />
          </Tooltip>
        </div>
      </div>

      {/* Cover */}
      <CoverArea page={page} editable={editable} onUpdate={onUpdate} />

      {/* Icon + title */}
      <div
        className={cn('mx-auto px-4 sm:px-8 md:px-12', page.isFullWidth ? 'max-w-none' : '')}
        style={{ maxWidth: page.isFullWidth ? '100%' : (page.width || 720) + 96 }}
      >
        <div className={cn('relative', page.coverUrl ? '-mt-8' : 'pt-12')}>
          {page.icon ? (
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
          ) : (
            editable && (
              <Popover
                trigger={
                  <button className="mb-2 inline-flex items-center gap-1.5 rounded border border-line-strong bg-surface px-2.5 py-1 text-sm font-medium text-ink-muted transition hover:border-thread hover:text-thread">
                    <Smile size={15} /> Add icon
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
            )
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
            className="weft-title w-full cursor-text resize-none overflow-hidden border-none bg-transparent font-display text-[40px] font-semibold leading-tight tracking-tight text-ink outline-none placeholder:text-ink-faint focus:shadow-none focus-visible:shadow-none focus-visible:outline-none disabled:cursor-default"
          />

          <TagEditor page={page} editable={editable} />
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
    </>
  );

  function setCoverOpen(_: boolean) {
    // handled inside CoverArea via its own popover; this menu item focuses it.
    document.getElementById('weft-cover-trigger')?.click();
  }
}

const FONT_OPTIONS: {
  key: 'serif' | 'sans' | 'mono';
  label: string;
  face: string;
  desc: string;
  css: string;
}[] = [
  { key: 'serif', label: 'Serif', face: 'Newsreader', desc: 'Editorial, classic', css: 'Newsreader, Georgia, serif' },
  { key: 'sans', label: 'Sans', face: 'Inter', desc: 'Clean, modern', css: 'Inter, system-ui, sans-serif' },
  { key: 'mono', label: 'Mono', face: 'JetBrains Mono', desc: 'Fixed-width, code', css: "'JetBrains Mono', ui-monospace, monospace" },
];

/** Page-level font family picker (Notion-style). Persisted via onUpdate. */
function FontPicker({
  value,
  editable,
  onPick,
}: {
  value: string;
  editable: boolean;
  onPick: (font: 'serif' | 'sans' | 'mono') => void;
}) {
  return (
    <div className="w-72 rounded-md border border-line bg-surface p-1.5 shadow-md">
      <p className="px-2 pb-1.5 pt-1 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
        Page font
      </p>
      <div className="flex flex-col gap-0.5">
        {FONT_OPTIONS.map((opt) => {
          const active = value === opt.key;
          return (
            <button
              key={opt.key}
              disabled={!editable}
              onClick={() => onPick(opt.key)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60',
                active ? 'bg-thread-soft ring-1 ring-thread/30' : 'hover:bg-sunk',
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-xl leading-none',
                  active ? 'border-thread/40 bg-surface text-thread' : 'border-line-strong bg-paper text-ink',
                )}
                style={{ fontFamily: opt.css }}
                aria-hidden
              >
                Ag
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={cn('truncate text-[15px] font-semibold', active ? 'text-thread' : 'text-ink')}
                  style={{ fontFamily: opt.css }}
                >
                  {opt.label}
                </span>
                <span className="truncate text-2xs text-ink-faint">
                  {opt.face} · {opt.desc}
                </span>
              </span>
              {active && <Check size={16} className="shrink-0 text-thread" />}
            </button>
          );
        })}
      </div>
    </div>
  );
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

  if (!page.coverUrl) {
    if (!editable) return null;
    return (
      <div className="mx-auto flex px-12 pt-3" style={{ maxWidth: (page.width || 720) + 96 }}>
        <Popover
          trigger={
            <button
              id="weft-cover-trigger"
              className="inline-flex items-center gap-1.5 rounded border border-line-strong bg-surface px-2.5 py-1 text-sm font-medium text-ink-muted transition hover:border-thread hover:text-thread"
            >
              <ImagePlus size={15} /> Add cover
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
      </div>
    );
  }

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
