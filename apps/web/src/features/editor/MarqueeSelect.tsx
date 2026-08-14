import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Box = { left: number; top: number; width: number; height: number };
type Rect2 = { left: number; top: number; right: number; bottom: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = any;

const THRESHOLD = 4; // px of movement before a click becomes a marquee drag

function intersects(a: Rect2, b: DOMRect) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

/**
 * Photoshop-style rubber-band selection of editor blocks.
 *
 * A drag that starts on empty canvas (a gutter, block padding, or below the last
 * block — NOT on inline text, the side-menu/drag-handle, or an interactive
 * control) draws a rectangle; every top-level block it intersects is highlighted
 * with an overlay. The selection persists after release so it can be deleted
 * (Delete/Backspace → `editor.removeBlocks`) or acted on as a group.
 *
 * Highlights are drawn as portalled overlays rather than classes on the block
 * DOM because BlockNote's React reconciler overwrites classes/attributes it owns.
 *
 * A plain click (no movement past THRESHOLD) clears any selection and is left
 * untouched, so caret placement, in-block text selection, and block-handle
 * dragging all keep working.
 */
export function MarqueeSelect({ editor }: { editor: AnyEditor }) {
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [highlights, setHighlights] = useState<Box[]>([]);
  const selectedIds = useRef<string[]>([]);
  const drag = useRef<{ startX: number; startY: number; active: boolean } | null>(null);

  useEffect(() => {
    const root = (editor.domElement ?? document.querySelector('.weft-page-content')) as HTMLElement | null;
    const container = (root?.closest('[data-page-scroll]') ?? root) as HTMLElement | null;
    if (!container) return;

    const topLevelBlocks = (): HTMLElement[] => {
      const group = container.querySelector('.bn-editor > .bn-block-group');
      if (!group) return [];
      return [...group.children]
        .map((outer) => outer.querySelector(':scope > .bn-block[data-id]') as HTMLElement | null)
        .filter((el): el is HTMLElement => !!el);
    };

    const clearSelection = () => {
      selectedIds.current = [];
      setHighlights([]);
    };

    const boxOf = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });

    const onMove = (e: MouseEvent) => {
      const s = drag.current;
      if (!s) return;
      if (!s.active && Math.hypot(e.clientX - s.startX, e.clientY - s.startY) < THRESHOLD) return;
      if (!s.active) {
        s.active = true;
        document.body.style.userSelect = 'none';
      }
      e.preventDefault();
      const m: Rect2 = {
        left: Math.min(s.startX, e.clientX),
        top: Math.min(s.startY, e.clientY),
        right: Math.max(s.startX, e.clientX),
        bottom: Math.max(s.startY, e.clientY),
      };
      setMarquee({ left: m.left, top: m.top, width: m.right - m.left, height: m.bottom - m.top });
      const ids: string[] = [];
      const boxes: Box[] = [];
      for (const el of topLevelBlocks()) {
        const r = el.getBoundingClientRect();
        if (intersects(m, r)) {
          const id = el.getAttribute('data-id');
          if (id) { ids.push(id); boxes.push(boxOf(r)); }
        }
      }
      selectedIds.current = ids;
      setHighlights(boxes);
    };

    const onUp = () => {
      const s = drag.current;
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      drag.current = null;
      document.body.style.userSelect = '';
      setMarquee(null);
      // Keep the highlight + selectedIds so the group can be deleted / acted on.
      // Hand BlockNote a matching native selection too (best-effort) so its
      // toolbar / group operations line up.
      if (s?.active && selectedIds.current.length) {
        try {
          editor.setSelection(selectedIds.current[0], selectedIds.current[selectedIds.current.length - 1]);
          editor.setForceSelectionVisible?.(true);
        } catch { /* older API — overlay + our own delete still work */ }
      }
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (
        t.closest(
          '.bn-inline-content, .bn-side-menu, .bn-button, [data-weft-plus], a, button, input, textarea, select',
        )
      ) {
        clearSelection();
        return;
      }
      clearSelection(); // a fresh interaction drops any prior marquee selection
      drag.current = { startX: e.clientX, startY: e.clientY, active: false };
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup', onUp, true);
    };

    const onKey = (e: KeyboardEvent) => {
      if (!selectedIds.current.length) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        e.stopPropagation();
        try {
          editor.removeBlocks(selectedIds.current);
        } catch { /* no-op */ }
        clearSelection();
      } else if (e.key === 'Escape') {
        clearSelection();
      }
    };

    const reposition = () => {
      if (!selectedIds.current.length) return;
      const byId = new Map(topLevelBlocks().map((el) => [el.getAttribute('data-id'), el]));
      const boxes: Box[] = [];
      for (const id of selectedIds.current) {
        const el = byId.get(id);
        if (el) boxes.push(boxOf(el.getBoundingClientRect()));
      }
      setHighlights(boxes);
    };

    container.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    container.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      container.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
      container.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      document.body.style.userSelect = '';
    };
  }, [editor]);

  return createPortal(
    <>
      {highlights.map((h, i) => (
        <div
          key={i}
          data-marquee-highlight
          className="pointer-events-none fixed z-[80] rounded-md"
          style={{
            left: h.left,
            top: h.top,
            width: h.width,
            height: h.height,
            background: 'color-mix(in srgb, var(--thread) 14%, transparent)',
            boxShadow: '0 0 0 2px color-mix(in srgb, var(--thread) 30%, transparent)',
          }}
        />
      ))}
      {marquee && (
        <div
          className="pointer-events-none fixed z-[90] rounded-sm border border-thread bg-thread/10"
          style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }}
        />
      )}
    </>,
    document.body,
  );
}
