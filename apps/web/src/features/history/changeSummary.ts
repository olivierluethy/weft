import { docText } from '@/features/editor/stats';

/** Block-separated plain text — one line per top-level block — so a word diff
 * keeps paragraph boundaries instead of collapsing the document into one run.
 * (Same shape HistoryPanel uses for its diff.) */
export function docLines(content: unknown): string {
  const blocks = Array.isArray(content) ? content : (content as { content?: unknown[] })?.content;
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((b) => docText([b]))
    .filter((t) => t.length > 0)
    .join('\n');
}

/** Friendly, singular names for the block types Weft can produce. Anything not
 * listed falls back to a de-camelCased form of the raw type, so the summary
 * still reads sensibly for custom blocks without inventing a wrong label. */
const TYPE_LABELS: Record<string, string> = {
  paragraph: 'paragraph',
  heading: 'heading',
  bulletListItem: 'bullet',
  numberedListItem: 'list item',
  checkListItem: 'to-do',
  quote: 'quote',
  highlight: 'highlight',
  toggle: 'toggle',
  codeBlock: 'code block',
  code: 'code block',
  table: 'table',
  image: 'image',
  video: 'video',
  audio: 'audio',
  file: 'file',
  callout: 'callout',
  divider: 'divider',
  equation: 'equation',
  chart: 'chart',
  database: 'database',
  dataView: 'database view',
  columnList: 'column layout',
  column: 'column',
  pageLink: 'sub-page',
};

function typeLabel(type: string): string {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  // de-camelCase / de-kebab a raw type as a readable fallback.
  return type
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .toLowerCase();
}

function plural(label: string, n: number): string {
  if (n === 1) return label;
  if (/(s|x|z|ch|sh)$/.test(label)) return `${label}es`;
  if (/y$/.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

/** Flatten a BlockNote document to a list of blocks (children included), for
 * counting block types. Columns/toggles nest, so we walk children too. */
function flattenBlocks(content: unknown): { type: string }[] {
  const roots = Array.isArray(content)
    ? content
    : (content as { content?: unknown[] })?.content;
  const out: { type: string }[] = [];
  const walk = (b: any): void => {
    if (!b || typeof b !== 'object') return;
    if (typeof b.type === 'string') out.push({ type: b.type });
    if (Array.isArray(b.children)) b.children.forEach(walk);
  };
  if (Array.isArray(roots)) roots.forEach(walk);
  return out;
}

function countByType(blocks: { type: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of blocks) m.set(b.type, (m.get(b.type) ?? 0) + 1);
  return m;
}

export interface ChangeSummary {
  /** Signed change in word count (after − before). */
  wordDelta: number;
  /** Human-readable bullet lines describing the real change. */
  bullets: string[];
  /** True when nothing derivable changed (identical snapshots). */
  empty: boolean;
}

/** Describe what actually changed between two document snapshots, using only
 * facts we can derive from the stored content — block-type counts and word
 * count. We deliberately do NOT guess at moves/reorders (unreliable, and the
 * brief forbids inventing changes). `before` may be null/empty for the first
 * snapshot of a page. */
export function summarizeChange(before: unknown, after: unknown): ChangeSummary {
  const beforeBlocks = countByType(flattenBlocks(before));
  const afterBlocks = countByType(flattenBlocks(after));

  const wordsBefore = docText(before).split(/\s+/).filter(Boolean).length;
  const wordsAfter = docText(after).split(/\s+/).filter(Boolean).length;
  const wordDelta = wordsAfter - wordsBefore;

  const added: string[] = [];
  const removed: string[] = [];
  const types = new Set([...beforeBlocks.keys(), ...afterBlocks.keys()]);
  for (const t of types) {
    if (t === 'column' || t === 'columnList') continue; // layout scaffolding — noisy
    const delta = (afterBlocks.get(t) ?? 0) - (beforeBlocks.get(t) ?? 0);
    if (delta > 0) added.push(`Added ${delta} ${plural(typeLabel(t), delta)}`);
    else if (delta < 0) removed.push(`Removed ${-delta} ${plural(typeLabel(t), -delta)}`);
  }

  const bullets = [...added, ...removed];

  // Text changed but block structure didn't — describe it honestly.
  if (bullets.length === 0 && wordDelta !== 0) {
    bullets.push(wordDelta > 0 ? 'Expanded the text' : 'Trimmed the text');
  } else if (bullets.length === 0 && docText(before) !== docText(after)) {
    bullets.push('Edited text');
  }

  return { wordDelta, bullets, empty: bullets.length === 0 && wordDelta === 0 };
}
