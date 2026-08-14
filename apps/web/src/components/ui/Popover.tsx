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
}: {
  trigger: ReactElement;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: Align;
  className?: string;
  /** Notified whenever the panel opens/closes (e.g. to freeze a parent menu). */
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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
            style={{
              position: 'fixed',
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              visibility: coords ? 'visible' : 'hidden',
            }}
            className={cn('z-overlay animate-[fade_.12s_ease]', className)}
          >
            {typeof children === 'function' ? children(() => setOpen(false)) : children}
          </div>
        </Portal>
      )}
    </span>
  );
}
