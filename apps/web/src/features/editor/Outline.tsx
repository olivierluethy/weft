import { useEffect, useState } from 'react';
import { flashBlock } from '@/features/search/jump';
import { cn } from '@/lib/utils';
import type { OutlineHeading } from './outline';

/** Right-side outline / table of contents.
 *
 * Lists the current page's headings in document order, indented by level.
 * Clicking a row scrolls to (and flashes) the heading; the heading currently in
 * view is highlighted as the user scrolls, tracked with an IntersectionObserver.
 * Hidden below `xl` so it never crowds narrow layouts. See STYLEGUIDE.md §6. */
export function Outline({ headings }: { headings: OutlineHeading[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const els = headings
      .map((h) => document.querySelector<HTMLElement>(`[data-id="${CSS.escape(h.id)}"]`))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;

    // The heading whose top has just crossed below the sticky header is active.
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute('data-id');
          if (!id) continue;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        // Pick the first heading (document order) that is currently in the band.
        const firstVisible = headings.find((h) => visible.has(h.id));
        if (firstVisible) setActiveId(firstVisible.id);
      },
      { rootMargin: '-80px 0px -65% 0px', threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav
      aria-label="Page outline"
      className="pointer-events-auto fixed right-4 top-24 z-10 hidden max-h-[calc(100vh-8rem)] w-52 overflow-y-auto overscroll-contain xl:block"
    >
      <p className="mb-1 px-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
        On this page
      </p>
      <ul className="flex flex-col">
        {headings.map((h) => {
          const active = h.id === activeId;
          return (
            <li key={h.id}>
              <button
                onClick={() => {
                  setActiveId(h.id);
                  flashBlock(h.id);
                }}
                title={h.text}
                className={cn(
                  'relative block w-full truncate rounded py-1 pr-2 text-left text-sm transition',
                  active ? 'text-ink' : 'text-ink-faint hover:text-ink-muted',
                )}
                style={{ paddingLeft: (h.level - 1) * 12 + 10 }}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-thread" />
                )}
                {h.text}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
