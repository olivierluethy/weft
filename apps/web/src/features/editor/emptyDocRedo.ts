/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Redo restoration for the "undo emptied the whole document" case.
 *
 * WHY THIS EXISTS — under Yjs collaboration, undoing every last bit of content
 * reconstructs the block group with fresh block ids, and the Yjs UndoManager can
 * no longer reapply its redo items: the content it would re-insert is gone. This
 * is a y-prosemirror limitation, not our bug — a *direct* `undoManager.redo()`
 * with the redo stack intact still yields an empty document. Redo works normally
 * for every non-empty state; only the final "empty ⇄ first content" step is lost.
 *
 * WHAT THIS DOES — keeps a snapshot of the last non-empty document. When the user
 * presses redo while the document is empty *because an undo emptied it*, we
 * restore that snapshot instead of letting the (no-op) native redo run. It is:
 *   • armed only by an undo keystroke — a manual delete-to-empty never arms it,
 *     so redo after manual deletion keeps its native behaviour;
 *   • disarmed by any other keystroke and cleared whenever the doc is non-empty,
 *     so a stale snapshot can never fire;
 *   • committed as its own undo step (`stopCapturing` on both sides) so undoing
 *     the restore — or a later edit — stays correct.
 *
 * Returns a cleanup function; call it on unmount.
 */
export function installEmptyDocRedoFallback(editor: any): () => void {
  const tt = editor?._tiptapEditor;
  const dom: HTMLElement | undefined = tt?.view?.dom;
  if (!dom || typeof editor?.onChange !== 'function') return () => {};

  // The reconstructed "blank document" is one or more empty paragraphs. A styled
  // empty block (e.g. an empty heading) is real content, so it does not count.
  const isEmptyDoc = (blocks: any[]): boolean =>
    blocks.length > 0 &&
    blocks.every(
      (b) =>
        b.type === 'paragraph' &&
        (!Array.isArray(b.content) || b.content.every((c: any) => !c.text)) &&
        (!b.children || b.children.length === 0),
    );

  const findUndoManager = (): any => {
    const state = tt?.view?.state;
    for (const p of state?.plugins ?? []) {
      const ps = p.getState?.(state);
      if (ps?.undoManager) return ps.undoManager;
    }
    return null;
  };

  let lastNonEmpty: any[] | null = null;
  let fallback: any[] | null = null;
  let undoArmed = false;

  const unsubscribe = editor.onChange(() => {
    // `editor.document` returns a fresh snapshot each call, so holding the
    // reference is a safe point-in-time copy.
    const doc = editor.document;
    if (isEmptyDoc(doc)) {
      if (undoArmed && lastNonEmpty) fallback = lastNonEmpty;
    } else {
      lastNonEmpty = doc;
      fallback = null;
    }
  });

  const isUndoKey = (e: KeyboardEvent) =>
    (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey;
  const isRedoKey = (e: KeyboardEvent) =>
    (e.ctrlKey || e.metaKey) &&
    ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y');

  const onKeyDown = (e: KeyboardEvent) => {
    if (isRedoKey(e)) {
      if (fallback && isEmptyDoc(editor.document)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const restore = fallback;
        fallback = null;
        undoArmed = false;
        const um = findUndoManager();
        um?.stopCapturing?.();
        editor.replaceBlocks(editor.document, restore);
        um?.stopCapturing?.();
      }
      return;
    }
    // Arm only immediately after an undo; any other key disarms so a manual
    // delete-to-empty (or unrelated typing) never triggers a restore.
    undoArmed = isUndoKey(e);
  };

  dom.addEventListener('keydown', onKeyDown, true);
  return () => {
    dom.removeEventListener('keydown', onKeyDown, true);
    if (typeof unsubscribe === 'function') unsubscribe();
  };
}
