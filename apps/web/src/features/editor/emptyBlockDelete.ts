// Imported from `prosemirror-state` directly — the SAME single resolved copy
// BlockNote builds its editor state from (see multilineBlocks.ts for the why).
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const emptyBlockDeletePluginKey = new PluginKey('weftEmptyBlockDelete');

/**
 * Notion-style forward-Delete inside an empty block.
 *
 * WHY THIS EXISTS — BlockNote's own `Delete` handler merges the next block into
 * the current one when the caret is at the end of the block, but it is a silent
 * no-op when the current block is *empty*: pressing Delete in an empty paragraph
 * leaves the following block stranded below a blank row instead of pulling it up.
 * (Backspace on an empty block already works — this only fixes forward-Delete.)
 *
 * WHAT THIS DOES — a `handleKeyDown` plugin, registered before BlockNote's Enter/
 * Delete keymap so it can claim the key. When the caret is in an empty, childless
 * block that has a following sibling:
 *   • next block carries inline content  → merge that content into the current
 *     block, keeping the current block's type (empty ¶ + "Text" → "Text"; empty
 *     H1 + "Text" → H1 "Text"), then remove the now-empty next block.
 *   • next block is structural (image, table, columns, has children) → simply
 *     remove the empty block so the next one flows up unchanged.
 * The caret lands at the start of the surviving block. Everything else — a
 * non-empty block, no next sibling, a modified key, a ranged selection — falls
 * through to BlockNote untouched, so the already-correct Delete-merge is intact.
 */
export function createEmptyBlockDeletePlugin(editor: any): any {
  const isInline = (block: any) => Array.isArray(block?.content);
  const isEmptyInline = (block: any) => isInline(block) && block.content.length === 0;
  const hasChildren = (block: any) => Array.isArray(block?.children) && block.children.length > 0;

  return new Plugin({
    key: emptyBlockDeletePluginKey,
    props: {
      handleKeyDown(view: any, event: KeyboardEvent) {
        if (event.key !== 'Delete' || event.isComposing) return false;
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;

        const { selection } = view.state;
        if (!(selection instanceof TextSelection) || !selection.empty) return false;

        let pos;
        try {
          pos = editor.getTextCursorPosition();
        } catch {
          return false;
        }
        const cur = pos?.block;
        const next = pos?.nextBlock;
        // Only act on an empty, childless block that has something to pull up.
        if (!cur || !next || !isEmptyInline(cur) || hasChildren(cur)) return false;

        try {
          if (isInline(next) && !hasChildren(next)) {
            // Merge the next block's content into the current one, keeping the
            // current block's type; then drop the emptied next block.
            editor.updateBlock(cur.id, { content: next.content });
            editor.removeBlocks([next.id]);
            editor.setTextCursorPosition(cur.id, 'start');
          } else {
            // Structural next block: remove the empty block so it flows up as-is.
            editor.removeBlocks([cur.id]);
            editor.setTextCursorPosition(next.id, 'start');
          }
        } catch {
          // If BlockNote's state moved under us, do nothing rather than throw.
          return false;
        }
        return true;
      },
    },
  });
}
