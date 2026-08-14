import {
  startOfDay,
  startOfMonth,
  startOfYear,
  addDays,
  addMonths,
  subDays,
  subMonths,
  getDaysInMonth,
  format,
} from 'date-fns';
import type { ActivityEvent, PageTreeNode } from '@weft/shared';

/** What the user is currently looking at. Everything the navigator needs — the
 * fetch window, the density granularity, the header label — derives from this. */
export type ActivityView =
  | { kind: 'month'; year: number; month: number } // month is 1..12
  | { kind: 'year'; year: number }
  | { kind: 'range'; from: number; to: number; label: string };

export type DensityMode = 'day' | 'month';

/** Fetch params for `useActivity` — a calendar selection or an explicit range. */
export function viewParams(v: ActivityView): {
  year?: number | null;
  month?: number | null;
  from?: string;
  to?: string;
} {
  if (v.kind === 'month') return { year: v.year, month: v.month };
  if (v.kind === 'year') return { year: v.year, month: null };
  return { from: new Date(v.from).toISOString(), to: new Date(v.to).toISOString() };
}

/** [from, to) bounds of a view, in ms. */
export function viewBounds(v: ActivityView): { from: number; to: number } {
  if (v.kind === 'month') {
    const from = new Date(v.year, v.month - 1, 1).getTime();
    const to = new Date(v.year, v.month, 1).getTime();
    return { from, to };
  }
  if (v.kind === 'year') {
    return { from: new Date(v.year, 0, 1).getTime(), to: new Date(v.year + 1, 0, 1).getTime() };
  }
  return { from: v.from, to: v.to };
}

/** Human label for the current window, e.g. "August 2026", "2026", "Last 7 days". */
export function viewTitle(v: ActivityView): string {
  if (v.kind === 'month') return format(new Date(v.year, v.month - 1, 1), 'MMMM yyyy');
  if (v.kind === 'year') return String(v.year);
  return v.label;
}

/** Density buckets shrink to per-day for spans up to ~2 months, else per-month. */
export function densityMode(v: ActivityView): DensityMode {
  if (v.kind === 'month') return 'day';
  if (v.kind === 'year') return 'month';
  return v.to - v.from <= 62 * 24 * 3600 * 1000 ? 'day' : 'month';
}

export interface DateRangePreset {
  key: string;
  label: string;
  build: () => ActivityView;
}

/** The quick date presets (spec §20). Each resolves against "now" at click time. */
export function datePresets(now: Date): DateRangePreset[] {
  return [
    {
      key: 'today',
      label: 'Today',
      build: () => ({ kind: 'range', from: startOfDay(now).getTime(), to: addDays(startOfDay(now), 1).getTime(), label: 'Today' }),
    },
    {
      key: 'yesterday',
      label: 'Yesterday',
      build: () => ({ kind: 'range', from: subDays(startOfDay(now), 1).getTime(), to: startOfDay(now).getTime(), label: 'Yesterday' }),
    },
    {
      key: '7d',
      label: 'Last 7 days',
      build: () => ({ kind: 'range', from: subDays(startOfDay(now), 6).getTime(), to: addDays(startOfDay(now), 1).getTime(), label: 'Last 7 days' }),
    },
    {
      key: '30d',
      label: 'Last 30 days',
      build: () => ({ kind: 'range', from: subDays(startOfDay(now), 29).getTime(), to: addDays(startOfDay(now), 1).getTime(), label: 'Last 30 days' }),
    },
    {
      key: 'this-month',
      label: 'This month',
      build: () => ({ kind: 'month', year: now.getFullYear(), month: now.getMonth() + 1 }),
    },
    {
      key: 'prev-month',
      label: 'Previous month',
      build: () => {
        const d = subMonths(startOfMonth(now), 1);
        return { kind: 'month', year: d.getFullYear(), month: d.getMonth() + 1 };
      },
    },
    {
      key: 'this-year',
      label: 'This year',
      build: () => ({ kind: 'year', year: now.getFullYear() }),
    },
  ];
}

/** Broad activity classes we can back with real data (spec §34 — no invented
 * "moved"/"renamed"/"deleted" events, since those aren't durably recorded). */
export type ActivityType = 'created' | 'edited' | 'restored';

export function eventType(e: ActivityEvent): ActivityType {
  if (e.type === 'created') return 'created';
  if (e.kind === 'restore') return 'restored';
  return 'edited';
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  created: 'Created',
  edited: 'Edited',
  restored: 'Restored',
};

export interface DensityBucket {
  key: string;
  label: string; // short axis label
  fullLabel: string; // tooltip / full label
  from: number;
  to: number;
  count: number;
  net: number; // net word delta across the bucket (signed)
  /** For a day-mode bucket in a month view: the day-of-month, for scroll anchors. */
  day?: number;
}

/**
 * Bucketise events into a fixed set of day- or month-cells that spans the view,
 * so the density chart shows every cell (including empty ones) — the intensity
 * metric is the count of real change events per cell (spec §19). Buckets are
 * ordered chronologically (oldest → newest).
 */
export function buildDensity(events: ActivityEvent[], view: ActivityView, mode: DensityMode): DensityBucket[] {
  const buckets: DensityBucket[] = [];
  const { from, to } = viewBounds(view);

  if (mode === 'day') {
    // One cell per calendar day in [from, to).
    let cursor = startOfDay(new Date(from));
    while (cursor.getTime() < to) {
      const next = addDays(cursor, 1);
      buckets.push({
        key: format(cursor, 'yyyy-MM-dd'),
        label: format(cursor, 'd'),
        fullLabel: format(cursor, 'EEE, MMM d'),
        from: cursor.getTime(),
        to: next.getTime(),
        count: 0,
        net: 0,
        day: cursor.getDate(),
      });
      cursor = next;
    }
  } else {
    // One cell per month in [from, to).
    let cursor = startOfMonth(new Date(from));
    while (cursor.getTime() < to) {
      const next = addMonths(cursor, 1);
      buckets.push({
        key: format(cursor, 'yyyy-MM'),
        label: format(cursor, 'MMM'),
        fullLabel: format(cursor, 'MMMM yyyy'),
        from: cursor.getTime(),
        to: next.getTime(),
        count: 0,
        net: 0,
      });
      cursor = next;
    }
  }

  // Guard against a pathological span producing thousands of cells.
  if (buckets.length === 0 || buckets.length > 400) return buckets;

  for (const e of events) {
    const t = new Date(e.at).getTime();
    // Binary-ish linear placement is fine at ≤400 cells / ≤800 events.
    const b = buckets.find((bk) => t >= bk.from && t < bk.to);
    if (!b) continue;
    b.count += 1;
    if (e.type === 'edited' && e.prevWordCount != null) b.net += e.wordCount - e.prevWordCount;
  }
  return buckets;
}

/** Days-in-month helper for the day strip. */
export function daysInMonth(year: number, month1: number): number {
  return getDaysInMonth(new Date(year, month1 - 1, 1));
}

/** Walk the page tree to the workspace root, building an ordered path. Returns
 * `[]` if the page isn't in the tree (e.g. trashed). */
export function buildPath(tree: PageTreeNode[] | undefined, pageId: string): { id: string; title: string }[] {
  if (!tree) return [];
  const byId = new Map(tree.map((n) => [n.id, n]));
  const out: { id: string; title: string }[] = [];
  let cur: PageTreeNode | undefined = byId.get(pageId);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift({ id: cur.id, title: cur.title || 'Untitled' });
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return out;
}

/** Range of selectable years for the navigator (earliest activity → this year). */
export function yearRange(earliest: string | undefined, now: Date): number[] {
  const first = earliest ? new Date(earliest).getFullYear() : now.getFullYear();
  const last = now.getFullYear();
  const out: number[] = [];
  for (let y = last; y >= Math.min(first, last); y--) out.push(y);
  return out;
}
