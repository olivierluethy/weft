import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { diffWords } from 'diff';
import { format } from 'date-fns';
import { History, RotateCcw, Download } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
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
  blur: 'On leave',
  restore: 'Before restore',
};

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

  const { data } = useQuery({
    queryKey: ['versions', pageId],
    queryFn: () => api.get<{ versions: VersionMeta[] }>(`/pages/${pageId}/versions`),
  });
  const versions = data?.versions ?? [];

  // The list is newest-first, so the "previous" snapshot is the next one down.
  const selectedIndex = versions.findIndex((v) => v.id === selected);
  const selectedMeta = selectedIndex >= 0 ? versions[selectedIndex] : null;
  const previousMeta = selectedIndex >= 0 ? versions[selectedIndex + 1] : undefined;
  const hasPrevious = !!previousMeta;
  const effectiveMode = compareMode === 'previous' && !hasPrevious ? 'previous' : compareMode;

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
    <Modal open onClose={onClose} title="Version history" width="lg">
      <div className="flex gap-4" style={{ minHeight: 380 }}>
        {/* Timeline */}
        <div className="w-[240px] shrink-0 space-y-1 overflow-y-auto border-r border-line pr-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">
              {versions.length} snapshots
            </span>
            <button onClick={exportHistory} className="text-ink-faint hover:text-thread" title="Export history">
              <Download size={14} />
            </button>
          </div>
          {versions.length === 0 && <p className="text-sm text-ink-faint">No snapshots yet.</p>}
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelected(v.id)}
              className={cn(
                'w-full rounded px-2.5 py-2 text-left transition',
                selected === v.id ? 'bg-thread-soft' : 'hover:bg-sunk',
              )}
            >
              <div className="flex items-center gap-1.5 text-sm text-ink">
                <History size={13} className="text-ink-faint" />
                {format(new Date(v.createdAt), 'd MMM, HH:mm')}
              </div>
              <div className="mt-0.5 pl-5 text-xs text-ink-faint">
                {KIND_LABEL[v.kind] ?? v.kind} · {v.wordCount} words
              </div>
            </button>
          ))}
        </div>

        {/* Diff */}
        <div className="flex min-w-0 flex-1 flex-col">
          {!selected || !selectedMeta ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-ink-faint">
              Select a snapshot on the left to see what changed.
            </div>
          ) : (
            <>
              {/* Selected snapshot meta */}
              <div className="mb-3 flex items-start justify-between gap-3">
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
              <div className="mb-2 flex items-center gap-2">
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
              </div>

              <p className="mb-2 flex items-center gap-3 text-xs text-ink-faint">
                {effectiveMode === 'previous'
                  ? hasPrevious
                    ? 'What this snapshot changed (previous → this).'
                    : 'The earliest snapshot — shown as its initial content.'
                  : 'What changed since this snapshot (this → current).'}
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--diff-add-bg)' }} />
                    added
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--diff-del-bg)' }} />
                    removed
                  </span>
                </span>
              </p>

              <div className="max-h-[360px] flex-1 overflow-y-auto whitespace-pre-wrap rounded-md border border-line bg-paper p-4 font-serif text-[15px] leading-relaxed">
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
    </Modal>
  );
}
