import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { diffWords } from 'diff';
import { format, isToday, isYesterday } from 'date-fns';
import {
  ArrowLeft,
  FilePlus2,
  Pencil,
  RotateCcw,
  ChevronRight,
  FileText,
  Activity as ActivityIcon,
} from 'lucide-react';
import type { ActivityEvent } from '@weft/shared';
import { useWorkspace } from '@/features/app/workspace';
import { useActivity } from '@/lib/queries';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageIcon } from '@/features/editor/pickers/IconPicker';
import { summarizeChange, docLines } from './changeSummary';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function dayLabel(d: Date): string {
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMMM d');
}

function kindVerb(e: ActivityEvent): { label: string; icon: JSX.Element } {
  if (e.type === 'created')
    return { label: 'Created page', icon: <FilePlus2 size={13} /> };
  if (e.kind === 'restore')
    return { label: 'Restored a version', icon: <RotateCcw size={13} /> };
  return { label: 'Edited', icon: <Pencil size={13} /> };
}

export default function ActivityView() {
  const { workspaceId } = useWorkspace();
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(now.getMonth() + 1);

  const { data, isLoading } = useActivity(workspaceId, year, month);
  const events = data?.events ?? [];

  // Year navigator range: earliest activity → this year.
  const years = useMemo(() => {
    const earliest = data?.range
      ? new Date(data.range.earliest).getFullYear()
      : now.getFullYear();
    const latest = now.getFullYear();
    const out: number[] = [];
    for (let y = latest; y >= Math.min(earliest, latest); y--) out.push(y);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.range]);

  // Group events under Today / Yesterday / date headers.
  const groups = useMemo(() => {
    const out: { label: string; items: ActivityEvent[] }[] = [];
    for (const e of events) {
      const label = dayLabel(new Date(e.at));
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(e);
      else out.push({ label, items: [e] });
    }
    return out;
  }, [events]);

  const windowLabel = month ? `${MONTHS[month - 1]} ${year}` : `${year}`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-12 sm:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-muted transition hover:bg-sunk hover:text-ink"
            title="Back to workspace"
            aria-label="Back to workspace"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <ActivityIcon size={20} className="text-thread" />
            <h1 className="font-display text-xl font-semibold tracking-tight text-ink">Activity</h1>
          </div>
        </div>

        {/* Year + month navigator */}
        <div className="mb-6 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => {
                  setYear(y);
                  // Whole-year default when switching to a past year keeps the
                  // month picker meaningful; land on the current month for now.
                  setMonth(y === now.getFullYear() ? now.getMonth() + 1 : null);
                }}
                className={cn(
                  'rounded-md px-2.5 py-1 text-sm font-medium transition',
                  y === year
                    ? 'bg-thread text-white'
                    : 'text-ink-muted hover:bg-sunk hover:text-ink',
                )}
              >
                {y}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setMonth(null)}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition',
                month === null
                  ? 'bg-thread-soft text-thread'
                  : 'text-ink-faint hover:bg-sunk hover:text-ink',
              )}
            >
              All year
            </button>
            {MONTHS.map((m, i) => {
              const isFuture = year === now.getFullYear() && i > now.getMonth();
              return (
                <button
                  key={m}
                  disabled={isFuture}
                  onClick={() => setMonth(i + 1)}
                  className={cn(
                    'rounded-md px-2 py-1 text-xs font-medium transition',
                    month === i + 1
                      ? 'bg-thread-soft text-thread'
                      : 'text-ink-faint hover:bg-sunk hover:text-ink',
                    isFuture && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {data?.truncated && (
          <p className="mb-3 rounded-md bg-sunk px-3 py-1.5 text-xs text-ink-faint">
            Showing the most recent activity for {windowLabel}. Narrow to a single month to see
            everything.
          </p>
        )}

        {/* Feed */}
        {isLoading ? (
          <p className="px-1 py-6 text-sm text-ink-faint">Loading activity…</p>
        ) : groups.length === 0 ? (
          <p className="px-1 py-10 text-center text-sm text-ink-faint">
            No activity in {windowLabel}.
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.label}>
                <h2 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
                  {g.label}
                </h2>
                <div className="flex flex-col">
                  {g.items.map((e) => (
                    <ActivityRow key={e.id} e={e} onOpen={() => navigate(`/p/${e.pageId}`)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function deltaChip(e: ActivityEvent): string | null {
  if (e.type !== 'edited' || e.prevWordCount == null) return null;
  const d = e.wordCount - e.prevWordCount;
  if (d === 0) return null;
  return `${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString()} words`;
}

function ActivityRow({ e, onOpen }: { e: ActivityEvent; onOpen: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const verb = kindVerb(e);
  const chip = deltaChip(e);
  const expandable = e.type === 'edited' && !!e.versionId;
  const time = format(new Date(e.at), 'HH:mm');

  return (
    <div className="border-l border-line pl-3">
      <div className="group flex items-center gap-2.5 py-2">
        <span className="w-11 shrink-0 text-2xs tabular-nums text-ink-faint">{time}</span>
        <button
          onClick={onOpen}
          className="flex h-6 w-6 shrink-0 items-center justify-center text-base"
          title="Open page"
        >
          {e.pageIcon ? (
            <PageIcon icon={e.pageIcon} size={16} />
          ) : (
            <FileText size={15} className="text-ink-faint" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
          <button
            onClick={onOpen}
            className="truncate text-sm font-medium text-ink hover:text-thread"
            title={e.pageTitle || 'Untitled'}
          >
            {e.pageTitle || 'Untitled'}
          </button>
          <span className="flex items-center gap-1 text-2xs text-ink-faint">
            {verb.icon} {verb.label}
          </span>
          {chip && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-2xs font-medium tabular-nums',
                e.wordCount - (e.prevWordCount ?? 0) > 0
                  ? 'bg-ok-soft text-ok'
                  : 'bg-danger-soft text-danger',
              )}
            >
              {chip}
            </span>
          )}
        </div>
        {expandable && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-faint opacity-0 transition hover:bg-sunk hover:text-ink group-hover:opacity-100 aria-expanded:opacity-100"
            aria-expanded={expanded}
            title={expanded ? 'Hide changes' : 'Show changes'}
          >
            <ChevronRight size={15} className={cn('transition-transform', expanded && 'rotate-90')} />
          </button>
        )}
      </div>
      {expanded && expandable && (
        <div className="mb-2 ml-[3.75rem]">
          <ChangeDetail versionId={e.versionId!} prevVersionId={e.prevVersionId} />
        </div>
      )}
    </div>
  );
}

/** Lazily fetch the snapshot (and its predecessor) and describe what changed.
 * Only mounted when a row is expanded, so we never load content for the whole
 * feed at once. */
function ChangeDetail({
  versionId,
  prevVersionId,
}: {
  versionId: string;
  prevVersionId: string | null;
}) {
  const { data: cur, isLoading: curLoading } = useQuery({
    queryKey: ['version', versionId],
    queryFn: () => api.get<{ version: { content: unknown } }>(`/versions/${versionId}`),
  });
  const { data: prev } = useQuery({
    queryKey: ['version', prevVersionId],
    enabled: !!prevVersionId,
    queryFn: () => api.get<{ version: { content: unknown } }>(`/versions/${prevVersionId}`),
  });

  if (curLoading) return <p className="text-2xs text-ink-faint">Loading changes…</p>;
  if (!cur) return null;

  const beforeContent = prevVersionId ? prev?.version.content : [];
  if (prevVersionId && !prev) return <p className="text-2xs text-ink-faint">Loading changes…</p>;

  const summary = summarizeChange(beforeContent, cur.version.content);
  const parts = diffWords(docLines(beforeContent), docLines(cur.version.content));

  // Compact preview: render the diff but stop after a character budget so a big
  // rewrite doesn't blow up the row.
  const preview: JSX.Element[] = [];
  let budget = 600;
  for (let i = 0; i < parts.length && budget > 0; i++) {
    const part = parts[i]!;
    const text = part.value.length > budget ? part.value.slice(0, budget) + '…' : part.value;
    budget -= text.length;
    if (part.added)
      preview.push(
        <span key={i} className="rounded-sm bg-ok-soft text-ok">
          {text}
        </span>,
      );
    else if (part.removed)
      preview.push(
        <span key={i} className="rounded-sm bg-danger-soft text-danger line-through">
          {text}
        </span>,
      );
    else
      preview.push(
        <span key={i} className="text-ink-muted">
          {text}
        </span>,
      );
  }

  return (
    <div className="rounded-md border border-line bg-surface p-3 text-xs">
      {summary.bullets.length > 0 ? (
        <ul className="mb-2 space-y-0.5">
          {summary.bullets.map((b, i) => (
            <li key={i} className="flex items-center gap-1.5 text-ink">
              <span className="h-1 w-1 shrink-0 rounded-full bg-ink-faint" /> {b}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-ink-faint">No textual changes in this snapshot.</p>
      )}
      {preview.length > 0 && (
        <p className="whitespace-pre-wrap break-words leading-relaxed">{preview}</p>
      )}
    </div>
  );
}
