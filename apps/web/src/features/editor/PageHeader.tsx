import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  ChevronRight,
  Wallpaper,
  MessageSquare,
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
  const navigate = useNavigate();
  const [title, setTitle] = useState(page.title);
  const [showHistory, setShowHistory] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showCss, setShowCss] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const blocks = (Array.isArray(currentContent) ? currentContent : page.content) as any[];

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
      <div className="sticky top-0 z-20 flex items-center gap-1 border-b border-line/60 bg-paper/80 px-4 py-2 backdrop-blur">
        <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm text-ink-muted">
          {breadcrumbs.slice(0, -1).map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <Link to={`/p/${c.id}`} className="flex items-center gap-1 truncate rounded px-1.5 py-0.5 hover:bg-sunk">
                <span className="text-[13px]">{c.icon && <PageIcon icon={c.icon} size={15} />}</span>
                <span className="max-w-[160px] truncate">{c.title || 'Untitled'}</span>
              </Link>
              <ChevronRight size={13} className="text-ink-faint" />
            </span>
          ))}
          <span className="flex items-center gap-1 truncate font-medium text-ink">
            {page.icon && <PageIcon icon={page.icon} size={15} />}
            <span className="max-w-[220px] truncate">{page.title || 'Untitled'}</span>
          </span>
        </nav>

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
        className={cn(
          'mx-auto px-12',
          page.isFullWidth ? 'max-w-none' : '',
        )}
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
              <Popover trigger={<button className="mb-2 flex items-center gap-1.5 rounded px-2 py-1 text-sm text-ink-faint opacity-0 transition hover:bg-sunk hover:text-ink group-hover:opacity-100 [.pageheader:hover_&]:opacity-100"><Smile size={15} /> Add icon</button>}>
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
            value={title}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
            onBlur={() => title !== page.title && onUpdate({ title })}
            disabled={!editable}
            rows={1}
            placeholder="Untitled"
            spellCheck={false}
            className="w-full resize-none overflow-hidden border-none bg-transparent font-display text-[40px] font-semibold leading-tight tracking-tight text-ink outline-none placeholder:text-ink-faint disabled:cursor-default"
          />

          {page.tags && page.tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {page.tags.map((t) => (
                <span key={t.id} className="rounded-sm bg-thread-soft px-2 py-0.5 text-xs text-thread">
                  {t.name}
                </span>
              ))}
            </div>
          )}
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
  if (!page.coverUrl) {
    return (
      <div className="group relative">
        {editable && (
          <div className="mx-auto flex px-12" style={{ maxWidth: (page.width || 720) + 96 }}>
            <Popover
              trigger={
                <button
                  id="weft-cover-trigger"
                  className="mt-3 flex items-center gap-1.5 rounded px-2 py-1 text-sm text-ink-faint opacity-0 transition hover:bg-sunk hover:text-ink group-hover:opacity-100"
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
        )}
      </div>
    );
  }

  return (
    <div className="group relative w-full" style={{ height: COVER_HEIGHT }}>
      <img
        src={page.coverUrl}
        alt="Cover"
        className="h-full w-full object-cover"
        style={{ objectPosition: `center ${page.coverOffsetY ?? 50}%` }}
      />
      {editable && (
        <div className="absolute bottom-3 right-3 opacity-0 transition group-hover:opacity-100">
          <Popover
            align="end"
            trigger={
              <button id="weft-cover-trigger" className="rounded bg-surface/90 px-2.5 py-1 text-xs font-medium text-ink shadow-sm backdrop-blur hover:bg-surface">
                Change cover
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
        </div>
      )}
    </div>
  );
}
