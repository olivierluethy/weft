/**
 * Small, dependency-free fuzzy matcher with relevance scoring.
 *
 * One engine, reused wherever the app filters a list by a typed query — the
 * block-action menu (six-dots) and the "Add block" menu today, and any future
 * command/element search. It does three things, in order of confidence:
 *
 *   1. Ordered subsequence match ("dupl" → "Duplicate"), scored so that
 *      contiguous runs, matches at the start of a word, and shorter targets
 *      rank higher. This is the common, high-precision path.
 *   2. A whole-word / prefix bonus so an exact word ("move" → "Move to") beats
 *      an incidental subsequence.
 *   3. A bounded Levenshtein fallback so a typo that breaks the subsequence
 *      ("delte" → "Delete") is still found, at a deliberately lower score than
 *      any clean subsequence hit.
 *
 * `fuzzyScore` returns a number (higher is better) or `null` for no match.
 * `fuzzyFilter` scores each item across one or more strings (e.g. a title plus
 * aliases), keeps its best-scoring string, and returns the survivors sorted by
 * descending relevance. A blank query returns the items unchanged.
 */

/** Levenshtein edit distance, capped: returns `max + 1` once it's clearly over. */
function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0]!;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      if (curr[j]! < rowMin) rowMin = curr[j]!;
    }
    // Whole row already exceeds the budget — no path back under it.
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length]!;
}

const isBoundary = (ch: string | undefined): boolean =>
  ch === undefined || ch === ' ' || ch === '-' || ch === '_' || ch === '/';

/**
 * Score how well `query` matches `target`. Higher is better; `null` means no
 * match. Scores are only comparable within a single query, not across queries.
 */
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();
  if (q.length === 0) return 0;
  if (t.length === 0) return null;

  // Fast wins: exact and prefix matches always outrank a subsequence.
  if (t === q) return 1000;
  if (t.startsWith(q)) return 900 - (t.length - q.length);

  // A whole-word hit ("move" inside "move to") ranks just below a prefix.
  const words = t.split(/[\s\-_/]+/);
  if (words.includes(q)) return 820;
  for (const w of words) if (w.startsWith(q)) return 780 - (w.length - q.length);

  // Ordered subsequence with contiguity / word-boundary bonuses.
  let score = 0;
  let qi = 0;
  let run = 0;
  let matched = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      matched++;
      let inc = 8;
      run += 1;
      inc += run * 6; // reward contiguous runs
      if (isBoundary(t[ti - 1])) inc += 14; // reward start-of-word hits
      score += inc;
      qi++;
    } else {
      run = 0;
    }
  }
  if (qi === q.length) {
    // Shorter targets and denser matches score higher.
    return 400 + score - (t.length - matched);
  }

  // Typo tolerance: fall back to a bounded edit distance against the whole
  // string and each word. Deliberately weak so it never outranks a clean
  // subsequence hit above.
  const budget = q.length <= 4 ? 1 : q.length <= 7 ? 2 : 3;
  let best = budget + 1;
  best = Math.min(best, levenshtein(q, t, budget));
  for (const w of words) best = Math.min(best, levenshtein(q, w, budget));
  if (best <= budget) return 200 - best * 40;

  return null;
}

/** The best score of `query` over several candidate strings (or `null`). */
export function fuzzyScoreMany(query: string, targets: string[]): number | null {
  let best: number | null = null;
  for (const target of targets) {
    const s = fuzzyScore(query, target);
    if (s !== null && (best === null || s > best)) best = s;
  }
  return best;
}

/**
 * Filter and rank `items` by how well `query` matches the strings returned by
 * `getStrings` (e.g. `(item) => [item.title, ...item.aliases]`). A blank query
 * returns the items in their original order. Sort is stable for equal scores.
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getStrings: (item: T) => string | string[],
): T[] {
  if (!query.trim()) return items;
  const scored: { item: T; score: number; index: number }[] = [];
  items.forEach((item, index) => {
    const raw = getStrings(item);
    const strings = Array.isArray(raw) ? raw : [raw];
    const score = fuzzyScoreMany(query, strings);
    if (score !== null) scored.push({ item, score, index });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((s) => s.item);
}
