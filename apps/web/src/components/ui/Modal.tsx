import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Portal } from './Portal';
import { useOverlayOpen } from '@/lib/overlaySignal';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Centred modal dialog — the base every Weft dialog is built on (Import, Move,
 * Custom CSS, Confirm, Unsaved changes, …), so they share one look and one set of
 * behaviours (docs/STYLEGUIDE.md §6). Portalled to `document.body`, dismissable on
 * Escape and backdrop click.
 *
 * Focus is managed so it behaves like a real modal (§36-37): opening moves focus
 * into the dialog (an element marked `data-autofocus`, else the panel itself), Tab
 * is trapped inside while it's open, and closing returns focus to whatever was
 * focused before it opened. `role="dialog"` + `aria-modal` announce it.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'md',
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Move focus into the dialog on open; restore it to the trigger on close.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const target =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>(FOCUSABLE) ??
      panel;
    // A frame late so CodeMirror / inputs have mounted their editable.
    const raf = requestAnimationFrame(() => target?.focus?.());
    return () => {
      cancelAnimationFrame(raf);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  useOverlayOpen(open);

  if (!open) return null;
  const widths = { sm: 'max-w-[420px]', md: 'max-w-[560px]', lg: 'max-w-[720px]' };

  // Keep Tab within the dialog.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-scrim flex items-start justify-center overflow-y-auto bg-[rgba(33,31,28,.36)] p-4 backdrop-blur-[2px] sm:items-center"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        onKeyDown={onKeyDown}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className={cn(
            'card w-full animate-[fade_.18s_ease] shadow-lg outline-none',
            widths[width],
            'my-8',
          )}
          role="dialog"
          aria-modal="true"
        >
          {title && (
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
              <button
                onClick={onClose}
                className="text-ink-faint transition hover:text-ink"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div className="px-5 py-4">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>
          )}
        </div>
      </div>
    </Portal>
  );
}
