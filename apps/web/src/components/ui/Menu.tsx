import { useRef, useState, cloneElement, type ReactNode, type ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { Portal } from './Portal';
import { useOverlayOpen } from '@/lib/overlaySignal';
import { useAnchoredPosition, useDismiss, type Align } from './floating';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  checked?: boolean;
}

/** Dropdown menu anchored to a trigger.
 *
 * Portalled to `document.body` and positioned with the shared overlay
 * primitives (docs/STYLEGUIDE.md §6.1), so it can never be clipped by an
 * `overflow` ancestor (the sidebar scroll area) or trapped below sibling
 * chrome by a `sticky`/`backdrop-blur` stacking context (the page header).
 * Same positioning, dismissal and motion as Popover. */
export function Menu({
  trigger,
  items,
  align = 'start',
}: {
  trigger: ReactElement;
  items: MenuItem[];
  align?: Align;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useOverlayOpen(open);

  const coords = useAnchoredPosition({ open, triggerRef, panelRef, align });
  useDismiss(open, () => setOpen(false), [triggerRef, panelRef]);

  const triggerEl = cloneElement(trigger as ReactElement<any>, {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
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
            className="z-overlay min-w-[190px] animate-[fade_.12s_ease] overflow-hidden rounded-md border border-line bg-surface py-1 shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item, i) =>
              item.divider ? (
                <div key={i} className="my-1 h-px bg-line" />
              ) : (
                <button
                  key={i}
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition',
                    item.danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-sunk',
                    item.disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  {item.icon && (
                    <span className="flex h-4 w-4 items-center justify-center">{item.icon}</span>
                  )}
                  <span className="flex-1">{item.label}</span>
                  {item.checked && <span className="text-thread">✓</span>}
                </button>
              ),
            )}
          </div>
        </Portal>
      )}
    </span>
  );
}
