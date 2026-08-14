import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { fuzzyFilter } from '@/lib/fuzzy';

/**
 * "Move to another page" — the fuzzy page picker shared by the six-dots block
 * menu and the selection toolbar's More menu, so relocating a block behaves the
 * same however you got there. Rendering only; the caller owns the panel chrome
 * and decides what "picked" means.
 */
export function MoveToList({
  tree,
  currentPageId,
  onPick,
  autoFocus = true,
}: {
  tree: { id: string; title: string; icon?: string | null }[];
  currentPageId: string;
  onPick: (target: { id: string; title: string }) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const pages = useMemo(() => tree.filter((p) => p.id !== currentPageId), [tree, currentPageId]);
  const filtered = useMemo(
    () => fuzzyFilter(pages, query, (p) => p.title || 'Untitled').slice(0, 50),
    [pages, query],
  );

  return (
    <div className="flex max-h-[340px] flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 focus-within:border-thread/30">
        <Search size={14} className="shrink-0 text-ink-faint" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Move to page…"
          aria-label="Move to page"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:shadow-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-ink-faint">No pages found.</p>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              data-move-target={p.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick({ id: p.id, title: p.title });
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-ink transition hover:bg-sunk"
            >
              <span className="shrink-0 text-sm">{p.icon || '📄'}</span>
              <span className="truncate">{p.title || 'Untitled'}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
