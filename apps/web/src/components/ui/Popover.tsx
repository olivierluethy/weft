import {
  useState,
  useRef,
  useEffect,
  cloneElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import { Portal } from './Portal';
import { useOverlayOpen } from '@/lib/overlaySignal';
import { useAnchoredPosition, useDismiss, type Align } from './floating';

/** Click-triggered floating panel.
 *
 * Rendered through a portal to `document.body` and positioned with
 * `position: fixed`, so no stacking context or `overflow` ancestor can clip or
 * trap it (docs/STYLEGUIDE.md §6.1). Positioning + dismissal are the shared
 * primitives (`useAnchoredPosition`, `useDismiss`) used by every overlay: opens
 * below the trigger, flips above when there isn't room, shifts to stay on
 * screen, closes on outside-click + Escape. */
export function Popover({
  trigger,
  children,
  align = 'start',
  className,
  onOpenChange,
  registerOverlay = true,
}: {
  trigger: ReactElement;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: Align;
  className?: string;
  /** Notified whenever the panel opens/closes (e.g. to freeze a parent menu). */
  onOpenChange?: (open: boolean) => void;
  /**
   * Whether to register with the global overlay-open signal (hides the editor's
   * block side menu while open — §6.1). Defaults to true; the side menu's own
   * convert popover sets this false so its handle stays visible.
   */
  registerOverlay?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useOverlayOpen(open, registerOverlay);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const coords = useAnchoredPosition({ open, triggerRef, panelRef, align });
  useDismiss(open, () => setOpen(false), [triggerRef, panelRef]);

  // Move focus into the panel once it's measured and visible. The panel's first
  // frame is `visibility: hidden` (until positioned), and browsers won't focus a
  // hidden element — so a child's `autoFocus` silently no-ops. Doing it here makes
  // type-ahead search and arrow-key navigation actually work, and — crucially —
  // keeps focus inside the portal so Escape reaches the shared dismiss handler
  // instead of being swallowed by the editor the trigger lives in.
  const focusedForOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      focusedForOpen.current = false;
      return;
    }
    if (focusedForOpen.current || !coords) return;
    const panel = panelRef.current;
    if (!panel) return;
    focusedForOpen.current = true;
    if (panel.contains(document.activeElement)) return;
    const field = panel.querySelector<HTMLElement>('input, textarea');
    (field ?? panel).focus?.({ preventScroll: true });
  }, [open, coords]);

  const triggerEl = cloneElement(trigger as ReactElement<any>, {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen((v) => !v);
    },
  });

  return (
    <span ref={triggerRef} className="inline-flex">
      {triggerEl}
      {open && (
        <Portal>
          <div
            ref={panelRef}
            tabIndex={-1}
            style={{
              position: 'fixed',
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              visibility: coords ? 'visible' : 'hidden',
            }}
            // `focus-visible:shadow-none` matters: the panel is a `tabIndex=-1`
            // container we focus programmatically, never a control, and the
            // app-wide `:focus-visible` ring is a *box-shadow* — `outline-none`
            // can't remove it, so a panel with no input of its own (a colour
            // grid, a swatch list) would otherwise wear a dark indigo frame.
            className={cn(
              'z-overlay animate-[fade_.12s_ease] outline-none focus-visible:shadow-none',
              className,
            )}
          >
            {typeof children === 'function' ? children(() => setOpen(false)) : children}
          </div>
        </Portal>
      )}
    </span>
  );
}
