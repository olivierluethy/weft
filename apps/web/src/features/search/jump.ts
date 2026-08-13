/** Build a page URL that asks PageView to scroll to and flash a specific block.
 * A timestamp makes repeated jumps to the same block re-trigger the effect. */
export function jumpPath(pageId: string, blockId?: string | null): string {
  const params = new URLSearchParams();
  if (blockId) params.set('b', blockId);
  params.set('t', String(Date.now()));
  return `/p/${pageId}?${params.toString()}`;
}

/** Find a rendered block by id, scroll it into view and briefly flash it.
 * Retries while the editor is still mounting the content. */
export function flashBlock(blockId: string, attempt = 0): void {
  const el = document.querySelector<HTMLElement>(`[data-id="${CSS.escape(blockId)}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('weft-flash');
    // reflow so the animation restarts if the class was just removed
    void el.offsetWidth;
    el.classList.add('weft-flash');
    window.setTimeout(() => el.classList.remove('weft-flash'), 1700);
  } else if (attempt < 14) {
    window.setTimeout(() => flashBlock(blockId, attempt + 1), 150);
  }
}
