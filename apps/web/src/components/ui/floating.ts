import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export type Align = 'start' | 'end' | 'center';

interface AnchorOptions {
  open: boolean;
  triggerRef: RefObject<HTMLElement>;
  panelRef: RefObject<HTMLElement>;
  align?: Align;
  /** Gap between trigger and panel, px. */
  gap?: number;
  /** Minimum distance kept from the viewport edge, px. */
  margin?: number;
}

export interface Coords {
  top: number;
  left: number;
}

/** Viewport-aware anchored positioning shared by every floating overlay
 * (docs/STYLEGUIDE.md §6.1). The panel uses `position: fixed` and is placed
 * below the trigger, flips above when it would overflow (and there's room),
 * and shifts horizontally to stay on screen. Re-measures on scroll/resize so
 * it stays glued to the trigger. Returns `null` until the panel has been
 * measured, so callers can keep it `visibility: hidden` for the first frame. */
export function useAnchoredPosition({
  open,
  triggerRef,
  panelRef,
  align = 'start',
  gap = 6,
  margin = 8,
}: AnchorOptions): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(null);

  const compute = useCallback(() => {
    const t = triggerRef.current?.getBoundingClientRect();
    if (!t) return;
    const panel = panelRef.current;
    const pw = panel?.offsetWidth ?? 0;
    const ph = panel?.offsetHeight ?? 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Vertical: prefer below; flip above when it would overflow and there's room.
    let top = t.bottom + gap;
    if (ph && top + ph > vh - margin && t.top - gap - ph > margin) {
      top = t.top - gap - ph;
    }
    if (ph) top = Math.max(margin, Math.min(top, vh - ph - margin));

    // Horizontal: align to the trigger, then shift to stay within the viewport.
    let left =
      align === 'end' ? t.right - pw : align === 'center' ? t.left + t.width / 2 - pw / 2 : t.left;
    if (pw) left = Math.max(margin, Math.min(left, vw - pw - margin));

    setCoords({ top, left });
  }, [triggerRef, panelRef, align, gap, margin]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    compute();
    const raf = requestAnimationFrame(compute);
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open, compute]);

  return coords;
}

/** Shared dismissal: Escape and pointer-down outside every provided element
 * close the overlay. Used by all anchored overlays so closing behaves
 * identically everywhere (docs/STYLEGUIDE.md §6.1). */
export function useDismiss(
  open: boolean,
  close: () => void,
  refs: RefObject<HTMLElement>[],
) {
  // Keep the latest refs/close without re-subscribing every render.
  const refsRef = useRef(refs);
  refsRef.current = refs;
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // Decide inside/outside from the event's composed path, captured at dispatch
      // time. A menu item can re-render the panel *during* this same mousedown
      // (e.g. opening a sub-view synchronously unmounts the clicked row); by the
      // time this document-level listener runs, that row is already detached, so
      // `contains(e.target)` would wrongly report "outside" and close the overlay.
      // The composed path still holds the panel element itself (it never unmounts
      // while open), so we match against it first and fall back to `contains`.
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      const target = e.target as Node | null;
      const inside = refsRef.current.some((r) => {
        const el = r.current;
        if (!el) return false;
        return path.includes(el) || (target ? el.contains(target) : false);
      });
      if (inside) return;
      closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
}
