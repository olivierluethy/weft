import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { diffWords } from 'diff';
import { format, isToday, isYesterday } from 'date-fns';
import { History, RotateCcw, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Portal } from '@/components/ui/Portal';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { docText } from '@/features/editor/stats';
import { download } from '@/features/export/exporters';

interface VersionMeta {
  id: string;
  kind: string;
  label: string | null;
  wordCount: number;
  createdAt: string;
  author: { name: string } | null;
}

const KIND_LABEL: Record<string, string> = {
  manual: 'Manual save',
  auto: 'Autosave',
  blur: 'Edited',
  restore: 'Before restore',
};

/** Group label for a day: Today / Yesterday / weekday + date. */
function dayLabel(d: Date): string {
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, d MMM yyyy');
}

/** Block-separated plain text — one line per top-level block — so the word diff
 * keeps paragraph boundaries instead of collapsing the document into one run. */
function docLines(content: unknown): string {
  const blocks = Array.isArray(content) ? content : (content as { content?: unknown[] })?.content;
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((b) => docText([b]))
    .filter((t) => t.length > 0)
    .join('\n');
}

export function HistoryPanel({
  pageId,
  title,
  currentContent,
  editable,
  onRestored,
  onClose,
}: {
  pageId: string;
  title: string;
  currentContent: unknown;
  editable: boolean;
  onRestored: () => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<'previous' | 'current'>('previous');

  // Close on Escape (matches the app's other dialogs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { data } = useQuery({
    queryKey: ['versions', pageId],
    queryFn: () => api.get<{ versions: VersionMeta[] }>(`/pages/${pageId}/versions`),
  });
  const versions = data?.versions ?? [];

  // Default to the newest snapshot so the panel opens showing something.
  useEffect(() => {
    if (!selected && versions.length) setSelected(versions[0]!.id);
  }, [versions, selected]);

  // The list is newest-first, so the "previous" snapshot is the next one down.
  const selectedIndex = versions.findIndex((v) => v.id === selected);
  const selectedMeta = selectedIndex >= 0 ? versions[selectedIndex] : null;
  const previousMeta = selectedIndex >= 0 ? versions[selectedIndex + 1] : undefined;
  const hasPrevious = !!previousMeta;
  const effectiveMode = compareMode === 'previous' && !hasPrevious ? 'previous' : compareMode;

  // Entries grouped under Today / Yesterday / date headers (Notion-style).
  const groups = useMemo(() => {
    const out: { label: string; items: VersionMeta[] }[] = [];
    for (const v of versions) {
      const label = dayLabel(new Date(v.createdAt));
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(v);
      else out.push({ label, items: [v] });
    }
    return out;
  }, [versions]);

  const { data: selectedVersion } = useQuery({
    queryKey: ['version', selected],
    enabled: !!selected,
    queryFn: () => api.get<{ version: { content: unknown; createdAt: string } }>(`/versions/${selected}`),
  });

  const { data: previousVersion } = useQuery({
    queryKey: ['version', previousMeta?.id],
    enabled: !!previousMeta && effectiveMode === 'previous',
    queryFn: () =>
      api.get<{ version: { content: unknown; createdAt: string } }>(`/versions/${previousMeta!.id}`),
  });

  // Git-style word diff on block-separated plain text. When comparing with the
  // previous snapshot we show what *this* version changed (before → after);
  // when comparing with current we show what changed since then (then → now).
  const diff = useMemo(() => {
    if (!selectedVersion) return null;
    const selectedText = docLines(selectedVersion.version.content);
    if (effectiveMode === 'current') {
      return diffWords(selectedText, docLines(currentContent));
    }
    // 'previous': previous → selected (empty base for the very first snapshot).
    if (previousMeta && !previousVersion) return null; // still loading the base
    const beforeText = previousVersion ? docLines(previousVersion.version.content) : '';
    return diffWords(beforeText, selectedText);
  }, [selectedVersion, previousVersion, previousMeta, currentContent, effectiveMode]);

  const restore = async () => {
    if (!selected) return;
    await api.post(`/versions/${selected}/restore`);
    toast.success('Version restored');
    onRestored();
    onClose();
  };

  const exportHistory = () => {
    const lines = [`# Version history — ${title || 'Untitled'}`, ''];
    for (const v of versions) {
      lines.push(
        `- **${format(new Date(v.createdAt), "d MMM yyyy 'at' HH:mm")}** · ${KIND_LABEL[v.kind] ?? v.kind}` +
          ` · ${v.wordCount} words${v.author ? ` · ${v.author.name}` : ''}`,
      );
    }
    download(`${(title || 'untitled').toLowerCase()}-history.md`, lines.join('\n'), 'text/markdown');
  };

  return (
    <Portal>
    <div
      className="fixed inset-0 z-scrim flex items-center justify-center bg-[rgba(33,31,28,.36)] p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Fixed-height panel: header stays pinned, the two panes scroll internally. */}
      <div
        className="card flex h-[min(84vh,660px)] w-full max-w-[880px] animate-[fade_.18s_ease] flex-col overflow-hidden shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Version history"
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-thread-soft text-thread">
              <History size={16} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-semibold leading-tight text-ink">
                Version history
              </h2>
              <p className="truncate text-xs text-ink-faint">
                {versions.length} {versions.length === 1 ? 'snapshot' : 'snapshots'}
                {title ? ` · ${title}` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={exportHistory}
              disabled={versions.length === 0}
              title="Export history as Markdown"
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-sunk hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={14} /> Export
            </button>
            <button
              onClick={onClose}
              aria-label="Close version history"
              title="Close"
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-faint transition hover:bg-sunk hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Body: two panes, each scrolls on its own; the panel itself never grows. */}
        <div className="flex min-h-0 flex-1">
          {/* Timeline */}
          <div className="flex w-[264px] shrink-0 flex-col border-r border-line bg-sunk/40">
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {versions.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                  <History size={22} className="mb-2 text-ink-faint" />
                  <p className="text-sm font-medium text-ink-muted">No versions yet</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    A snapshot is saved when you edit this page and switch away.
                  </p>
                </div>
              ) : (
                groups.map((group) => (
                  <div key={group.label} className="mb-1">
                    <p className="sticky top-0 z-10 bg-sunk/90 px-2 py-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-faint backdrop-blur">
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map((v) => {
                        const active = selected === v.id;
                        return (
                          <button
                            key={v.id}
                            onClick={() => setSelected(v.id)}
                            className={cn(
                              'w-full rounded-md border-l-2 px-2.5 py-2 text-left transition',
                              active
                                ? 'border-thread bg-thread-soft'
                                : 'border-transparent hover:bg-sunk',
                            )}
                          >
                            <div
                              className={cn(
                                'font-display text-sm font-medium',
                                active ? 'text-thread' : 'text-ink',
                              )}
                            >
                              {format(new Date(v.createdAt), 'HH:mm')}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-ink-faint">
                              {KIND_LABEL[v.kind] ?? v.kind} · {v.wordCount} words
                              {v.author ? ` · ${v.author.name}` : ''}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Diff */}
          <div className="flex min-w-0 flex-1 flex-col bg-surface">
            {!selected || !selectedMeta ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-faint">
                Select a snapshot on the left to see what changed.
              </div>
            ) : (
              <>
                {/* Selected snapshot meta + controls (pinned above the scrolling diff) */}
                <div className="shrink-0 border-b border-line px-5 pb-3 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold text-ink">
                        {format(new Date(selectedMeta.createdAt), "d MMM yyyy 'at' HH:mm")}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {KIND_LABEL[selectedMeta.kind] ?? selectedMeta.kind} · {selectedMeta.wordCount} words
                        {selectedMeta.author ? ` · ${selectedMeta.author.name}` : ''}
                      </p>
                    </div>
                    {editable && (
                      <Button variant="secondary" size="sm" onClick={restore}>
                        <RotateCcw size={14} /> Restore
                      </Button>
                    )}
                  </div>

                  {/* Compare-against toggle */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">
                      Compare with
                    </span>
                    <div className="inline-flex overflow-hidden rounded border border-line-strong text-xs">
                      <button
                        onClick={() => setCompareMode('previous')}
                        disabled={!hasPrevious}
                        title={hasPrevious ? undefined : 'This is the earliest snapshot'}
                        className={cn(
                          'px-2 py-1 transition disabled:cursor-not-allowed disabled:opacity-50',
                          effectiveMode === 'previous' ? 'bg-thread-soft text-thread' : 'text-ink-muted hover:bg-sunk',
                        )}
                      >
                        Previous snapshot
                      </button>
                      <button
                        onClick={() => setCompareMode('current')}
                        className={cn(
                          'border-l border-line-strong px-2 py-1 transition',
                          effectiveMode === 'current' ? 'bg-thread-soft text-thread' : 'text-ink-muted hover:bg-sunk',
                        )}
                      >
                        Current document
                      </button>
                    </div>
                    <span className="ml-auto inline-flex items-center gap-2 text-xs text-ink-faint">
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--diff-add-bg)' }} />
                        added
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--diff-del-bg)' }} />
                        removed
                      </span>
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-ink-faint">
                    {effectiveMode === 'previous'
                      ? hasPrevious
                        ? 'What this snapshot changed (previous → this).'
                        : 'The earliest snapshot — shown as its initial content.'
                      : 'What changed since this snapshot (this → current).'}
                  </p>
                </div>

                {/* The diff itself scrolls; the meta above stays put. */}
                <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap bg-paper px-5 py-4 font-serif text-[15px] leading-relaxed">
                  {!diff ? (
                    <span className="text-ink-faint">Loading…</span>
                  ) : diff.length === 0 || diff.every((p) => !p.value.trim()) ? (
                    <span className="text-ink-faint">This snapshot has no text content.</span>
                  ) : (
                    <>
                      {diff.map((part, i) => (
                        <span
                          key={i}
                          style={{
                            background: part.added
                              ? 'var(--diff-add-bg)'
                              : part.removed
                                ? 'var(--diff-del-bg)'
                                : 'transparent',
                            color: part.added
                              ? 'var(--diff-add)'
                              : part.removed
                                ? 'var(--diff-del)'
                                : 'var(--ink)',
                            textDecoration: part.removed ? 'line-through' : 'none',
                          }}
                        >
                          {part.value}
                        </span>
                      ))}
                      {diff.every((p) => !p.added && !p.removed) && (
                        <div className="mt-3 border-t border-line pt-2 text-xs text-ink-faint">
                          No differences —{' '}
                          {effectiveMode === 'previous'
                            ? 'identical to the previous snapshot.'
                            : 'identical to the current document.'}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
}
