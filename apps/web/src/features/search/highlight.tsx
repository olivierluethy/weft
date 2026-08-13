import { type ReactNode } from 'react';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wrap occurrences of `query` in `text` with a <mark>, honouring the match mode. */
export function highlight(
  text: string,
  query: string,
  opts: { wholeWord: boolean; caseSensitive: boolean },
): ReactNode {
  if (!query.trim()) return text;
  const core = escapeRe(query.trim());
  const pattern = opts.wholeWord ? `(?<![\\p{L}\\p{N}_])${core}(?![\\p{L}\\p{N}_])` : core;
  let re: RegExp;
  try {
    re = new RegExp(pattern, `g${opts.caseSensitive ? '' : 'i'}u`);
  } catch {
    return text;
  }
  const parts: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (m[0].length === 0) break;
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(
      <mark key={i++} className="weft-mark">
        {m[0]}
      </mark>,
    );
    last = idx + m[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}
