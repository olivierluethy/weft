import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  cloneElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

type Align = 'start' | 'end' | 'center';

/** Click-triggered floating panel.
 *
 * The panel is rendered through a portal to `document.body` and positioned with
 * `position: fixed`, so no `overflow: hidden`/`overflow: auto` ancestor (sidebar,
 * scrolling page) can ever clip it (docs/STYLEGUIDE.md §6). Positioning is
 * viewport-aware: it opens below the trigger, flips above when there isn't room,
 * and shifts horizontally to stay on screen. Closes on outside click + Escape. */
export function Popover({
  trigger,
  children,
  align = 'start',
  className,
  onOpenChange,
}: {
  trigger: ReactElement;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: Align;
  className?: string;
  /** Notified whenever the panel opens/closes (e.g. to freeze a parent menu). */
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const GAP = 6;
  const MARGIN = 8;

  const compute = useCallback(() => {
    const t = triggerRef.current?.getBoundingClientRect();
    if (!t) return;
    const panel = panelRef.current;
    const pw = panel?.offsetWidth ?? 0;
    const ph = panel?.offsetHeight ?? 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Vertical: prefer below; flip above when it would overflow and there's room.
    let top = t.bottom + GAP;
    if (ph && top + ph > vh - MARGIN && t.top - GAP - ph > MARGIN) {
      top = t.top - GAP - ph;
    }
    if (ph) top = Math.max(MARGIN, Math.min(top, vh - ph - MARGIN));

    // Horizontal: align to the trigger, then shift to stay within the viewport.
    let left =
      align === 'end' ? t.right - pw : align === 'center' ? t.left + t.width / 2 - pw / 2 : t.left;
    if (pw) left = Math.max(MARGIN, Math.min(left, vw - pw - MARGIN));

    setCoords({ top, left });
  }, [align]);

  // Measure + position once the panel is in the DOM, and keep it anchored while
  // the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!open) return;
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

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Reset position when closing so the next open measures fresh.
  useEffect(() => {
    if (!open) setCoords(null);
  }, [open]);

  const triggerEl = cloneElement(trigger as ReactElement<any>, {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen((v) => !v);
    },
  });

  return (
    <span ref={triggerRef} className="inline-flex">
      {triggerEl}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              visibility: coords ? 'visible' : 'hidden',
            }}
            className={cn('z-[100] animate-[fade_.12s_ease]', className)}
          >
            {typeof children === 'function' ? children(() => setOpen(false)) : children}
          </div>,
          document.body,
        )}
    </span>
  );
}
