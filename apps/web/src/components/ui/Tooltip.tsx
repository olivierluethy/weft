import { useCallback, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/** Hover/focus tooltip. The bubble is rendered through a portal with
 * `position: fixed` (like Popover, docs/STYLEGUIDE.md §6) so no scrolling or
 * `overflow` ancestor can clip it. Appears after a short delay, below the
 * trigger by default, and stays within the viewport horizontally. */
export function Tooltip({
  label,
  children,
  side = 'bottom',
  delay = 300,
}: {
  label: ReactNode;
  children: ReactNode;
  side?: 'bottom' | 'top';
  delay?: number;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const GAP = 6;
  const MARGIN = 8;

  const place = useCallback(() => {
    const t = wrapRef.current?.getBoundingClientRect();
    if (!t) return;
    const bw = bubbleRef.current?.offsetWidth ?? 0;
    const bh = bubbleRef.current?.offsetHeight ?? 0;
    const vw = window.innerWidth;
    const top = side === 'top' ? t.top - GAP - bh : t.bottom + GAP;
    let left = t.left + t.width / 2 - bw / 2;
    if (bw) left = Math.max(MARGIN, Math.min(left, vw - bw - MARGIN));
    setCoords({ top, left });
  }, [side]);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      place();
      // Re-measure once mounted so width/height are known for centring.
      requestAnimationFrame(place);
    }, delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setCoords(null);
  };

  if (!label) return <>{children}</>;

  return (
    <span
      ref={wrapRef}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      {coords &&
        createPortal(
          <div
            ref={bubbleRef}
            role="tooltip"
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
            className={cn(
              'pointer-events-none z-tooltip max-w-[220px] animate-[fade_.1s_ease] rounded-md',
              'bg-ink px-2 py-1 text-2xs font-medium text-paper shadow-md',
            )}
          >
            {label}
          </div>,
          document.body,
        )}
    </span>
  );
}
