import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { diffWords } from 'diff';
import { format, isToday, isYesterday } from 'date-fns';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Pencil,
  RotateCcw,
  FileText,
  Activity as ActivityIcon,
  ExternalLink,
  Link2,
  CornerDownRight,
  CalendarRange,
  Filter,
} from 'lucide-react';
import type { ActivityEvent } from '@weft/shared';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/features/app/workspace';
import { useActivity, useTree } from '@/lib/queries';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Menu } from '@/components/ui/Menu';
import { Popover } from '@/components/ui/Popover';
import { PageIcon } from '@/features/editor/pickers/IconPicker';
import { summarizeChange, docLines } from './changeSummary';
import {
  type ActivityView as View,
  type ActivityType,
  type DensityBucket,
  ACTIVITY_TYPE_LABELS,
  viewParams,
  viewTitle,
  densityMode,
  buildDensity,
  datePresets,
  eventType,
  buildPath,
  yearRange,
} from './activityUtils';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const ALL_TYPES: ActivityType[] = ['created', 'edited', 'restored'];

function dayLabel(d: Date): string {
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMMM d');
}

function kindVerb(e: ActivityEvent): { label: string; icon: JSX.Element } {
  if (e.type === 'created') return { label: 'Created page', icon: <FilePlus2 size={13} /> };
  if (e.kind === 'restore') return { label: 'Restored a version', icon: <RotateCcw size={13} /> };
  return { label: 'Edited', icon: <Pencil size={13} /> };
}

export default function ActivityView() {
  const { workspaceId } = useWorkspace();
  const { workspaces } = useAuth();
  const navigate = useNavigate();
  const [now] = useState(() => new Date());
  const { data: tree } = useTree(workspaceId);
  const wsName = workspaces.find((w) => w.id === workspaceId)?.name ?? 'Workspace';

  const [view, setView] = useState<View>(() => ({
    kind: 'month',
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  }));
  const [types, setTypes] = useState<Set<ActivityType>>(() => new Set(ALL_TYPES));
  const [pageFilter, setPageFilter] = useState<string | null>(null);

  const { data, isLoading } = useActivity(workspaceId, viewParams(view));
  const events = useMemo(() => data?.events ?? [], [data?.events]);

  // Filters (type + page) apply before grouping AND density, so the chart and
  // the feed always agree.
  const filtered = useMemo(
    () =>
      events.filter(
        (e) => types.has(eventType(e)) && (pageFilter == null || e.pageId === pageFilter),
      ),
    [events, types, pageFilter],
  );

  const mode = densityMode(view);
  const density = useMemo(() => buildDensity(filtered, view, mode), [filtered, view, mode]);
  const densityMax = useMemo(() => Math.max(1, ...density.map((b) => b.count)), [density]);

  // Pages appearing in this window, for the page filter.
  const windowPages = useMemo(() => {
    const seen = new Map<string, { id: string; title: string; icon: string | null }>();
    for (const e of events)
      if (!seen.has(e.pageId)) seen.set(e.pageId, { id: e.pageId, title: e.pageTitle, icon: e.pageIcon });
    return [...seen.values()].sort((a, b) => (a.title || 'Untitled').localeCompare(b.title || 'Untitled'));
  }, [events]);

  // Group into day sections with a stable key for scroll anchoring.
  const groups = useMemo(() => {
    const out: { key: string; date: Date; label: string; items: ActivityEvent[] }[] = [];
    for (const e of filtered) {
      const d = new Date(e.at);
      const key = format(d, 'yyyy-MM-dd');
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(e);
      else out.push({ key, date: d, label: dayLabel(d), items: [e] });
    }
    return out;
  }, [filtered]);

  const years = useMemo(() => yearRange(data?.range?.earliest, now), [data?.range, now]);

  // ── Scroll context: which day is currently at the top of the feed ──────────
  const feedRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [contextKey, setContextKey] = useState<string | null>(null);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const top = feed.getBoundingClientRect().top;
      let best: string | null = null;
      let bestTop = -Infinity;
      for (const [key, el] of groupRefs.current) {
        const t = el.getBoundingClientRect().top - top;
        if (t <= 24 && t > bestTop) {
          bestTop = t;
          best = key;
        }
      }
      setContextKey(best ?? groups[0]?.key ?? null);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    feed.addEventListener('scroll', onScroll, { passive: true });
    measure();
    return () => {
      feed.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [groups]);

  const contextDate = contextKey ? new Date(`${contextKey}T00:00:00`) : null;

  const scrollToKey = (key: string) => {
    const el = groupRefs.current.get(key);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Density bar click: jump to that period.
  const onPickBucket = (b: DensityBucket) => {
    if (mode === 'month') {
      // Day bucket → scroll to that day's section (if any).
      if (groupRefs.current.has(b.key)) scrollToKey(b.key);
      else if (b.count === 0) toast.info('No activity that day');
    } else {
      // Month bucket → drill into that month.
      const d = new Date(b.from);
      setView({ kind: 'month', year: d.getFullYear(), month: d.getMonth() + 1 });
    }
  };

  // Period stepper (‹ August › / ‹ 2026 ›).
  const step = (dir: -1 | 1) => {
    if (view.kind === 'month') {
      const d = new Date(view.year, view.month - 1 + dir, 1);
      if (d.getTime() > now.getTime()) return; // no stepping into the future
      setView({ kind: 'month', year: d.getFullYear(), month: d.getMonth() + 1 });
    } else if (view.kind === 'year') {
      const y = view.year + dir;
      if (y > now.getFullYear()) return;
      setView({ kind: 'year', year: y });
    }
  };

  const activeTypes = types.size === ALL_TYPES.length ? null : [...types];
  const toggleType = (t: ActivityType) => {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      if (next.size === 0) return new Set(ALL_TYPES); // never empty
      return next;
    });
  };

  const selYear = view.kind === 'range' ? null : view.year;
  const selMonth = view.kind === 'month' ? view.month : null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left rail: time navigator + density + filters ─────────────────── */}
      <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface/40 md:flex">
        <div className="flex flex-col gap-5 p-4">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/')}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-muted transition hover:bg-sunk hover:text-ink"
              title="Back to workspace"
              aria-label="Back to workspace"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              <ActivityIcon size={18} className="text-thread" />
              <h1 className="font-display text-lg font-semibold tracking-tight text-ink">Activity</h1>
            </div>
          </div>

          {/* Year selector */}
          <div>
            <RailLabel>Year</RailLabel>
            <div className="flex flex-wrap gap-1">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() =>
                    setView(
                      y === now.getFullYear()
                        ? { kind: 'month', year: y, month: now.getMonth() + 1 }
                        : { kind: 'year', year: y },
                    )
                  }
                  className={cn(
                    'rounded-md px-2.5 py-1 text-sm font-medium tabular-nums transition',
                    selYear === y ? 'bg-thread text-white' : 'text-ink-muted hover:bg-sunk hover:text-ink',
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Month grid (jump within the selected year) */}
          {view.kind !== 'range' && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <RailLabel className="mb-0">Month</RailLabel>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => step(-1)}
                    className="flex h-6 w-6 items-center justify-center rounded text-ink-faint transition hover:bg-sunk hover:text-ink"
                    aria-label="Previous"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    onClick={() => step(1)}
                    disabled={
                      view.kind === 'month'
                        ? view.year === now.getFullYear() && view.month >= now.getMonth() + 1
                        : view.year >= now.getFullYear()
                    }
                    className="flex h-6 w-6 items-center justify-center rounded text-ink-faint transition hover:bg-sunk hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label="Next"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => setView({ kind: 'year', year: selYear! })}
                  className={cn(
                    'col-span-3 rounded-md px-2 py-1 text-xs font-medium transition',
                    view.kind === 'year'
                      ? 'bg-thread-soft text-thread'
                      : 'text-ink-faint hover:bg-sunk hover:text-ink',
                  )}
                >
                  Whole year
                </button>
                {MONTHS.map((m, i) => {
                  const isFuture = selYear === now.getFullYear() && i > now.getMonth();
                  return (
                    <button
                      key={m}
                      disabled={isFuture}
                      onClick={() => setView({ kind: 'month', year: selYear!, month: i + 1 })}
                      className={cn(
                        'rounded-md px-2 py-1 text-xs font-medium transition',
                        selMonth === i + 1
                          ? 'bg-thread-soft text-thread'
                          : 'text-ink-faint hover:bg-sunk hover:text-ink',
                        isFuture && 'cursor-not-allowed opacity-30 hover:bg-transparent',
                      )}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Density chart (also the day/month scrubber) */}
          <div>
            <RailLabel>Activity {mode === 'day' ? '· by day' : '· by month'}</RailLabel>
            <DensityChart
              buckets={density}
              max={densityMax}
              mode={mode}
              activeKey={contextKey}
              onPick={onPickBucket}
            />
          </div>

          {/* Filters */}
          <div>
            <RailLabel>Filters</RailLabel>
            <div className="flex flex-col gap-2">
              <Menu
                align="start"
                trigger={
                  <button className="flex w-full items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-muted transition hover:bg-sunk hover:text-ink">
                    <CalendarRange size={13} /> Quick range
                  </button>
                }
                items={datePresets(now).map((p) => ({ label: p.label, onClick: () => setView(p.build()) }))}
              />

              <div className="flex flex-wrap gap-1">
                {ALL_TYPES.map((t) => {
                  const on = types.has(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleType(t)}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-2xs font-medium transition',
                        on
                          ? 'border-thread/40 bg-thread-soft text-thread'
                          : 'border-line text-ink-faint hover:bg-sunk hover:text-ink',
                      )}
                    >
                      {ACTIVITY_TYPE_LABELS[t]}
                    </button>
                  );
                })}
              </div>

              <Popover
                align="start"
                trigger={
                  <button
                    className={cn(
                      'flex w-full items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition hover:bg-sunk hover:text-ink',
                      pageFilter ? 'border-thread/40 bg-thread-soft text-thread' : 'border-line text-ink-muted',
                    )}
                  >
                    <Filter size={13} />
                    <span className="truncate">
                      {pageFilter
                        ? windowPages.find((p) => p.id === pageFilter)?.title || 'Page'
                        : 'All pages'}
                    </span>
                  </button>
                }
              >
                {(close) => (
                  <PagePicker
                    pages={windowPages}
                    selected={pageFilter}
                    onPick={(id) => {
                      setPageFilter(id);
                      close();
                    }}
                  />
                )}
              </Popover>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Feed ──────────────────────────────────────────────────────────── */}
      <div ref={feedRef} className="flex-1 overflow-y-auto">
        {/* Sticky context bar */}
        <div className="sticky top-0 z-10 border-b border-line bg-paper/90 px-6 py-3 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-sm text-ink-muted">
              {/* Mobile back button (rail is hidden on small screens) */}
              <button
                onClick={() => navigate('/')}
                className="mr-1 flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-muted transition hover:bg-sunk hover:text-ink md:hidden"
                aria-label="Back to workspace"
              >
                <ArrowLeft size={15} />
              </button>
              <Crumb>{contextDate ? contextDate.getFullYear() : viewTitle(view)}</Crumb>
              {contextDate && (
                <>
                  <span className="text-ink-faint">/</span>
                  <Crumb>{format(contextDate, 'MMMM')}</Crumb>
                  <span className="text-ink-faint">/</span>
                  <Crumb strong>{format(contextDate, 'EEE, MMM d')}</Crumb>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-sunk px-2 py-0.5 text-2xs font-medium tabular-nums text-ink-faint">
                {filtered.length}
              </span>
              {/* Mobile quick range */}
              <Menu
                align="end"
                trigger={
                  <button className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-ink-muted transition hover:bg-sunk hover:text-ink md:hidden">
                    <CalendarRange size={13} /> {viewTitle(view)}
                  </button>
                }
                items={datePresets(now).map((p) => ({ label: p.label, onClick: () => setView(p.build()) }))}
              />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-6 py-8 sm:px-8">
          {data?.truncated && (
            <p className="mb-4 rounded-md bg-sunk px-3 py-1.5 text-xs text-ink-faint">
              Showing the most recent {filtered.length} of a very busy window. Narrow the range to
              see everything.
            </p>
          )}

          {isLoading ? (
            <p className="px-1 py-10 text-sm text-ink-faint">Loading activity…</p>
          ) : groups.length === 0 ? (
            <div className="px-1 py-16 text-center">
              <p className="text-sm text-ink-faint">No activity in {viewTitle(view)}.</p>
              {(activeTypes || pageFilter) && (
                <button
                  onClick={() => {
                    setTypes(new Set(ALL_TYPES));
                    setPageFilter(null);
                  }}
                  className="mt-2 text-xs font-medium text-thread hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-7">
              {groups.map((g) => (
                <div
                  key={g.key}
                  ref={(el) => {
                    if (el) groupRefs.current.set(g.key, el);
                    else groupRefs.current.delete(g.key);
                  }}
                  className="scroll-mt-20"
                >
                  <h2 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
                    {g.label}
                  </h2>
                  <div className="flex flex-col">
                    {g.items.map((e) => (
                      <ActivityRow key={e.id} e={e} tree={tree} wsName={wsName} navigate={navigate} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RailLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-faint', className)}>
      {children}
    </div>
  );
}

function Crumb({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span className={cn('truncate', strong ? 'font-medium text-ink' : 'text-ink-muted')}>{children}</span>
  );
}

/** Horizontal activity-density bars — doubles as the day/month scrubber. Each
 * bar's length is the count of real change events in that cell (spec §19). */
function DensityChart({
  buckets,
  max,
  mode,
  activeKey,
  onPick,
}: {
  buckets: DensityBucket[];
  max: number;
  mode: 'day' | 'month';
  activeKey: string | null;
  onPick: (b: DensityBucket) => void;
}) {
  if (buckets.length === 0)
    return <p className="text-2xs text-ink-faint">No period selected.</p>;

  return (
    <div className="flex max-h-[42vh] flex-col gap-0.5 overflow-y-auto pr-1">
      {buckets.map((b) => {
        const pct = b.count === 0 ? 0 : Math.max(6, Math.round((b.count / max) * 100));
        const active = activeKey === b.key;
        return (
          <button
            key={b.key}
            onClick={() => onPick(b)}
            title={`${b.fullLabel} — ${b.count} change${b.count === 1 ? '' : 's'}${
              b.net ? ` · ${b.net > 0 ? '+' : '−'}${Math.abs(b.net).toLocaleString()} words` : ''
            }`}
            className={cn(
              'group flex items-center gap-2 rounded px-1 py-0.5 text-left transition hover:bg-sunk',
              active && 'bg-sunk',
            )}
          >
            <span
              className={cn(
                'w-8 shrink-0 text-right text-2xs tabular-nums',
                active ? 'font-semibold text-ink' : 'text-ink-faint',
              )}
            >
              {mode === 'day' ? b.label : b.label}
            </span>
            <span className="relative h-3 flex-1 overflow-hidden rounded-sm bg-line/50">
              <span
                className={cn(
                  'absolute inset-y-0 left-0 rounded-sm transition-all',
                  b.count === 0 ? '' : active ? 'bg-thread' : 'bg-thread/55 group-hover:bg-thread/80',
                )}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="w-5 shrink-0 text-right text-2xs tabular-nums text-ink-faint">
              {b.count || ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PagePicker({
  pages,
  selected,
  onPick,
}: {
  pages: { id: string; title: string; icon: string | null }[];
  selected: string | null;
  onPick: (id: string | null) => void;
}) {
  const [q, setQ] = useState('');
  const shown = pages.filter((p) => (p.title || 'Untitled').toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="w-64 p-1.5">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter pages…"
        className="input mb-1.5 h-7 w-full text-xs focus-visible:shadow-none"
      />
      <div className="max-h-64 overflow-y-auto">
        <button
          onClick={() => onPick(null)}
          className={cn(
            'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition hover:bg-sunk',
            selected == null ? 'font-medium text-thread' : 'text-ink',
          )}
        >
          All pages
        </button>
        {shown.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            className={cn(
              'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition hover:bg-sunk',
              selected === p.id ? 'font-medium text-thread' : 'text-ink',
            )}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {p.icon ? <PageIcon icon={p.icon} size={14} /> : <FileText size={13} className="text-ink-faint" />}
            </span>
            <span className="truncate">{p.title || 'Untitled'}</span>
          </button>
        ))}
        {shown.length === 0 && <p className="px-2 py-2 text-2xs text-ink-faint">No pages match.</p>}
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

function ActivityRow({
  e,
  tree,
  wsName,
  navigate,
}: {
  e: ActivityEvent;
  tree: ReturnType<typeof useTree>['data'];
  wsName: string;
  navigate: (to: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const verb = kindVerb(e);
  const chip = deltaChip(e);
  const expandable = e.type === 'edited' && !!e.versionId;
  const time = format(new Date(e.at), 'HH:mm');

  const open = () => navigate(`/p/${e.pageId}`);
  const openNewTab = () => window.open(`/p/${e.pageId}`, '_blank', 'noopener');
  const copyPath = () => {
    const path = buildPath(tree, e.pageId);
    const str = [wsName, ...path.map((p) => p.title)].join(' / ');
    void navigator.clipboard?.writeText(str).then(
      () => toast.success('Path copied'),
      () => toast.error('Could not copy path'),
    );
  };

  return (
    <div className="border-l border-line pl-3">
      <div className="group flex items-center gap-2.5 py-2">
        <span className="w-11 shrink-0 text-2xs tabular-nums text-ink-faint">{time}</span>
        <button
          onClick={open}
          className="flex h-6 w-6 shrink-0 items-center justify-center text-base"
          title="Open page"
        >
          {e.pageIcon ? <PageIcon icon={e.pageIcon} size={16} /> : <FileText size={15} className="text-ink-faint" />}
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
          <button
            onClick={open}
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
                e.wordCount - (e.prevWordCount ?? 0) > 0 ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger',
              )}
            >
              {chip}
            </span>
          )}
        </div>

        {/* Hover actions: Open in new tab · Copy path · (expand changes) */}
        <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={openNewTab}
            className="flex h-6 w-6 items-center justify-center rounded text-ink-faint transition hover:bg-sunk hover:text-ink"
            title="Open in new tab"
          >
            <ExternalLink size={14} />
          </button>
          <button
            onClick={copyPath}
            className="flex h-6 w-6 items-center justify-center rounded text-ink-faint transition hover:bg-sunk hover:text-ink"
            title="Copy path"
          >
            <Link2 size={14} />
          </button>
        </div>
        {expandable && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-faint opacity-0 transition hover:bg-sunk hover:text-ink group-hover:opacity-100 aria-expanded:opacity-100"
            aria-expanded={expanded}
            title={expanded ? 'Hide changes' : 'Show changes'}
          >
            <CornerDownRight size={14} className={cn('transition-transform', expanded && 'rotate-90')} />
          </button>
        )}
      </div>
      {expanded && expandable && (
        <div className="mb-2 ml-[3.75rem]">
          <ChangeDetail versionId={e.versionId!} prevVersionId={e.prevVersionId} />
          <div className="mt-2 flex gap-2">
            <button
              onClick={open}
              className="rounded-md border border-line px-2 py-1 text-2xs font-medium text-ink-muted transition hover:bg-sunk hover:text-ink"
            >
              Open page
            </button>
            <button
              onClick={openNewTab}
              className="rounded-md border border-line px-2 py-1 text-2xs font-medium text-ink-muted transition hover:bg-sunk hover:text-ink"
            >
              Open in new tab
            </button>
            <button
              onClick={copyPath}
              className="rounded-md border border-line px-2 py-1 text-2xs font-medium text-ink-muted transition hover:bg-sunk hover:text-ink"
            >
              Copy path
            </button>
          </div>
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

  const preview: JSX.Element[] = [];
  let budget = 600;
  for (let i = 0; i < parts.length && budget > 0; i++) {
    const part = parts[i]!;
    const text = part.value.length > budget ? part.value.slice(0, budget) + '…' : part.value;
    budget -= text.length;
    if (part.added)
      preview.push(<span key={i} className="rounded-sm bg-ok-soft text-ok">{text}</span>);
    else if (part.removed)
      preview.push(<span key={i} className="rounded-sm bg-danger-soft text-danger line-through">{text}</span>);
    else preview.push(<span key={i} className="text-ink-muted">{text}</span>);
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
      {preview.length > 0 && <p className="whitespace-pre-wrap break-words leading-relaxed">{preview}</p>}
    </div>
  );
}
