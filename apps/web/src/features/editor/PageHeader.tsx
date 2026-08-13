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
} from 'lucide-react';
import { PAGE_WIDTH } from '@weft/shared';
import type { PageDetail, Breadcrumb } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { COVER_HEIGHT } from '@weft/shared';
import { Popover } from '@/components/ui/Popover';
import { Menu } from '@/components/ui/Menu';
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
  onUpdate,
  onRestored,
}: {
  page: PageDetail;
  breadcrumbs: Breadcrumb[];
  role: string;
  editable: boolean;
  stats: DocStats;
  currentContent: unknown;
  onUpdate: (partial: Record<string, unknown>) => void;
  onRestored: () => void;
}) {
  const [title, setTitle] = useState(page.title);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showCss, setShowCss] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const blocks = (Array.isArray(currentContent) ? currentContent : page.content) as any[];

  // A freshly created (Untitled) page opens with the title focused, ready to type.
  useEffect(() => {
    if (editable && !page.title) titleRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);

  const exportItems = [
    { label: 'Markdown (.md)', onClick: () => exportMarkdown(page.title, blocks) },
    { label: 'HTML (.html)', onClick: () => exportHtmlFile(page.title, blocks) },
    { label: 'JSON (.json)', onClick: () => exportJson(page.title, page) },
    { label: 'Word (.docx)', onClick: () => void exportDocx(page.title, blocks) },
    { label: 'PDF (print)', onClick: () => exportPdf(page.title, blocks) },
  ];

  const setWidth = (delta: number) =>
    onUpdate({ width: Math.min(PAGE_WIDTH.max, Math.max(PAGE_WIDTH.min, (page.width || 720) + delta)) });

  return (
    <div>
      {/* Sticky action bar */}
      <div className="sticky top-0 z-20 flex items-center gap-1 border-b border-line/60 bg-paper/80 py-2 pl-12 pr-3 backdrop-blur md:px-4">
        <PathBar breadcrumbs={breadcrumbs} />

        <div className="flex shrink-0 items-center gap-0.5">
          {page.isLocked && (
            <span className="mr-1 flex items-center gap-1 rounded bg-sunk px-2 py-0.5 text-xs text-ink-muted">
              <Lock size={11} /> Locked
            </span>
          )}
          <Popover
            align="end"
            trigger={<IconButton label="Page stats"><BarChart3 size={16} /></IconButton>}
          >
            <StatsPanel stats={stats} updatedAt={page.updatedAt} />
          </Popover>
          <IconButton
            label={page.isFavorite ? 'Unfavorite' : 'Favorite'}
            active={page.isFavorite}
            onClick={() => onUpdate({ isFavorite: !page.isFavorite })}
          >
            <Star size={16} className={page.isFavorite ? 'fill-madder text-madder' : ''} />
          </IconButton>
          <IconButton label="Comments" active={showComments} onClick={() => setShowComments((v) => !v)}>
            <MessageSquare size={16} />
          </IconButton>
          <IconButton label="Share" onClick={() => setShowShare(true)}>
            <Share2 size={16} />
          </IconButton>
          <IconButton label="Version history" onClick={() => setShowHistory(true)}>
            <History size={16} />
          </IconButton>

          <Menu
            align="end"
            trigger={<IconButton label="More"><MoreHorizontal size={16} /></IconButton>}
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
                    onRemove={close}
                  />
                )}
              </Popover>
            )
          )}

          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
            onBlur={() => title !== page.title && onUpdate({ title })}
            disabled={!editable}
            rows={1}
            placeholder="Untitled"
            spellCheck={false}
            className="w-full resize-none overflow-hidden border-none bg-transparent font-display text-[40px] font-semibold leading-tight tracking-tight text-ink outline-none placeholder:text-ink-faint disabled:cursor-default"
          />

          <TagEditor page={page} editable={editable} />
        </div>
      </div>

      {showHistory && (
        <HistoryPanel
          pageId={page.id}
          title={page.title}
          currentContent={currentContent}
          editable={editable}
          onRestored={onRestored}
          onClose={() => setShowHistory(false)}
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
    </div>
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
              onRemove={close}
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
