import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { flashBlock } from '@/features/search/jump';
import { cn } from '@/lib/utils';
import type { OutlineHeading } from './outline';

/** Minimum distance from the top of the viewport the outline is allowed to pin
 * to while scrolling — clears the sticky action bar. */
const OUTLINE_TOP_MIN = 88;

/** Right-side outline / table of contents.
 *
 * Lists the current page's headings in document order, indented by level.
 * Clicking a row scrolls to (and flashes) the heading; the heading currently in
 * view is highlighted as the user scrolls, tracked with an IntersectionObserver.
 *
 * Positioning: the nav is `position: fixed`, but its `top` is derived from the
 * live viewport position of the first content block (`.weft-page-content`) rather
 * than a constant offset. So at the top of the page it lines up with the first
 * body line (below the cover image), and as you scroll it pins at
 * `OUTLINE_TOP_MIN` — it can never drift up over the cover. See STYLEGUIDE.md §6.
 *
 * Reordering: when `canReorder`, each row is draggable; dropping it reorders the
 * corresponding heading *section* in the document via `onReorder` (the document
 * stays the source of truth and the outline re-renders from the new order). */
export function Outline({
  headings,
  canReorder = false,
  onReorder,
}: {
  headings: OutlineHeading[];
  canReorder?: boolean;
  onReorder?: (draggedId: string, beforeId: string | null) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [topPx, setTopPx] = useState<number>(OUTLINE_TOP_MIN);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  // Gap index (0..headings.length) the dragged row would be dropped into.
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Keep the outline aligned to the first content block, clamped so it never
  // rides up into the cover image. Recomputed on scroll / resize (rAF-throttled)
  // and whenever the heading set changes (content above may have shifted).
  useLayoutEffect(() => {
    const anchor = document.querySelector<HTMLElement>('.weft-page-content');
    const scroller = anchor?.closest<HTMLElement>('[data-page-scroll]');
    if (!anchor || !scroller) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const top = anchor.getBoundingClientRect().top;
      setTopPx(Math.max(OUTLINE_TOP_MIN, Math.round(top)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [headings]);

  const observedIds = useRef<string>('');
  useEffect(() => {
    if (headings.length === 0) return;
    observedIds.current = headings.map((h) => h.id).join();

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

  const resetDrag = () => {
    setDraggedId(null);
    setDropIndex(null);
  };

  const handleDrop = () => {
    if (draggedId != null && dropIndex != null && onReorder) {
      const beforeId = dropIndex < headings.length ? headings[dropIndex]!.id : null;
      onReorder(draggedId, beforeId);
    }
    resetDrag();
  };

  const DropLine = () => (
    <li aria-hidden className="pointer-events-none -my-px h-0.5 rounded-full bg-thread" />
  );

  return (
    <nav
      aria-label="Page outline"
      style={{ top: topPx }}
      className="pointer-events-auto fixed right-4 z-10 hidden max-h-[calc(100vh-8rem)] w-52 overflow-y-auto overscroll-contain xl:block"
    >
      <p className="mb-1 px-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
        On this page
      </p>
      <ul className="flex flex-col">
        {headings.map((h, i) => {
          const active = h.id === activeId;
          const dragging = h.id === draggedId;
          return (
            <Fragment key={h.id}>
              {canReorder && dropIndex === i && <DropLine />}
              <li
                draggable={canReorder}
                onDragStart={(e) => {
                  if (!canReorder) return;
                  setDraggedId(h.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', h.id);
                }}
                onDragOver={(e) => {
                  if (!canReorder || draggedId == null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  const r = e.currentTarget.getBoundingClientRect();
                  setDropIndex(e.clientY < r.top + r.height / 2 ? i : i + 1);
                }}
                onDrop={(e) => {
                  if (!canReorder) return;
                  e.preventDefault();
                  handleDrop();
                }}
                onDragEnd={resetDrag}
                className={cn('group/row flex items-center', dragging && 'opacity-40')}
                style={{ paddingLeft: (h.level - 1) * 12 }}
              >
                {canReorder && (
                  <span
                    aria-hidden
                    className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-ink-faint opacity-0 transition group-hover/row:opacity-100"
                  >
                    <GripVertical size={13} />
                  </span>
                )}
                <button
                  onClick={() => {
                    setActiveId(h.id);
                    flashBlock(h.id);
                  }}
                  title={h.text}
                  className={cn(
                    'relative block min-w-0 flex-1 truncate rounded py-1 pr-2 text-left text-sm transition',
                    canReorder ? 'pl-1' : 'pl-2.5',
                    active ? 'text-ink' : 'text-ink-faint hover:text-ink-muted',
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-thread" />
                  )}
                  {h.text}
                </button>
              </li>
            </Fragment>
          );
        })}
        {canReorder && dropIndex === headings.length && <DropLine />}
      </ul>
    </nav>
  );
}
