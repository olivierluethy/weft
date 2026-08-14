import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Renders `children` into `document.body`, lifting them out of every ancestor
 * stacking context (sticky bars, `backdrop-blur`, `transform`, `overflow`).
 * All Weft overlays portal through here so the documented z-scale
 * (docs/STYLEGUIDE.md §6.1) decides layering at the root — nothing local can
 * trap a menu/popover/panel below sibling chrome. */
export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
