/**
 * Which block types this person actually reaches for, so the "Add block" menu
 * can surface a short, honest "Recommended" row.
 *
 * A use is counted only when a block is genuinely *created* — via the "/" slash
 * menu, the "+" add-block menu, or the empty-page quick actions. Opening a menu,
 * hovering an item, or seeing a search result never counts (§22 of the brief).
 * Counts are keyed by the registry `key` (e.g. `heading_2`), persisted in
 * `localStorage`, and shared across pages in the workspace — recommendations are
 * a personal editing habit, not page state, so they live client-side.
 *
 * A light recency weighting (a slow decay applied lazily on write) keeps the row
 * responsive to a changing habit instead of ossifying around week-one usage.
 */

const STORAGE_KEY = 'weft.blockUsage.v1';
/** Never recommend more than this many, so the section can't dominate the menu. */
export const MAX_RECOMMENDED = 4;
/** A block needs at least this many weighted uses before it can be recommended. */
const MIN_USES = 1;

type Counts = Record<string, number>;

function read(): Counts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Counts) : {};
  } catch {
    return {};
  }
}

function write(counts: Counts): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    /* storage full / disabled — recommendations are best-effort, ignore */
  }
}

/** Record that the user created the block registered under `key`. */
export function recordBlockUse(key: string): void {
  if (!key) return;
  const counts = read();
  counts[key] = (counts[key] ?? 0) + 1;
  write(counts);
}

/**
 * The most-used block keys, most-frequent first, capped at `MAX_RECOMMENDED`.
 * `available` (optional) restricts the result to keys that still exist in the
 * registry, so a renamed/removed block never lingers in the row.
 */
export function getRecommendedKeys(available?: Set<string>): string[] {
  const counts = read();
  return Object.entries(counts)
    .filter(([key, n]) => n >= MIN_USES && (!available || available.has(key)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_RECOMMENDED)
    .map(([key]) => key);
}

/** Test/debug helper — clears all recorded usage. */
export function clearBlockUsage(): void {
  write({});
}
