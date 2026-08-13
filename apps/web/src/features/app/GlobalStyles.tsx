import { useEffect } from 'react';

/**
 * Injects user CSS live.
 * - `workspace` scope is global (can theme the whole app).
 * - `page` scope is wrapped in `.weft-page-content { … }` so it applies only to
 *   the editor content area, via native CSS nesting.
 */
export function GlobalStyles({ css, scope }: { css: string | null; scope: 'workspace' | 'page' }) {
  useEffect(() => {
    const id = `weft-css-${scope}`;
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!css || !css.trim()) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = scope === 'page' ? `.weft-page-content {\n${css}\n}` : css;
    return () => {
      if (scope === 'page') el?.remove();
    };
  }, [css, scope]);

  return null;
}
