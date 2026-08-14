import { useEffect } from 'react';

/**
 * Global "an overlay is open" signal (docs/STYLEGUIDE.md §6.1).
 *
 * Z-order alone can't stop the editor's block handles from showing beside a
 * popup: the BlockNote side menu (＋ / ⠿) sits in the left margin gutter, which
 * is horizontally *outside* every popover's rectangle, so a higher-z overlay
 * never covers it. Instead, each shared overlay primitive registers here while
 * open; we reference-count and toggle `body.wf-overlay-open`, and `editor.css`
 * hides the side menu while that class is present.
 */
let openCount = 0;

function apply() {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('wf-overlay-open', openCount > 0);
}

/**
 * Register an overlay as open for the duration `open` is true. Pass
 * `enabled = false` to opt out (e.g. the side menu's own convert popover, which
 * is anchored to the handle and must keep it visible).
 */
export function useOverlayOpen(open: boolean, enabled = true) {
  useEffect(() => {
    if (!open || !enabled) return;
    openCount += 1;
    apply();
    return () => {
      openCount = Math.max(0, openCount - 1);
      apply();
    };
  }, [open, enabled]);
}
