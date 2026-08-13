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
import { toMarkdown, download } from '@/features/export/exporters';

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

  const { data } = useQuery({
    queryKey: ['versions', pageId],
    queryFn: () => api.get<{ versions: VersionMeta[] }>(`/pages/${pageId}/versions`),
  });
  const versions = data?.versions ?? [];

  const { data: selectedVersion } = useQuery({
    queryKey: ['version', selected],
    enabled: !!selected,
    queryFn: () => api.get<{ version: { content: unknown; createdAt: string } }>(`/versions/${selected}`),
  });

  // Diff selected version → current content (Git-style word diff on plain text).
  const diff = useMemo(() => {
    if (!selectedVersion) return null;
    const before = docText(selectedVersion.version.content);
    const after = docText(currentContent);
    return diffWords(before, after);
  }, [selectedVersion, currentContent]);

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
        <div className="min-w-0 flex-1">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-ink-faint">
              Select a snapshot to see what changed since then.
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-ink-muted">
                  Changes from this version <span className="text-ink-faint">→ current</span>
                </p>
                {editable && (
                  <Button variant="secondary" size="sm" onClick={restore}>
                    <RotateCcw size={14} /> Restore
                  </Button>
                )}
              </div>
              <div className="max-h-[340px] overflow-y-auto whitespace-pre-wrap rounded-md border border-line bg-paper p-4 font-serif text-[15px] leading-relaxed">
                {diff?.map((part, i) => (
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
                {diff && diff.every((p) => !p.added && !p.removed) && (
                  <span className="text-ink-faint">No text differences.</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
