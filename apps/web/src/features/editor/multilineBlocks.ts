// Imported from `prosemirror-state` directly. There is a single resolved copy in the
// workspace (1.4.4), the same one BlockNote uses, so these are the SAME classes
// BlockNote's editor state is built from — essential, since a Plugin/Selection from a
// second prosemirror copy would not interoperate with BlockNote's state.
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const multilineBlocksPluginKey = new PluginKey('weftMultilineBlocks');

/**
 * Notion-style multi-line behaviour for Weft's custom inline container blocks
 * (Highlight/`callout`, Quote/`quote`).
 *
 * WHY THIS EXISTS — these are custom React blocks and BlockNote marks every custom
 * block `isolating: true`. TipTap's hard-break command bails on exactly that flag
 * (`if (selection.$from.parent.type.spec.isolating) return false`), so Shift+Enter —
 * and any in-block line break — is a silent no-op, even though the block's schema
 * content is `inline*` and *does* allow `hardBreak`. The result: pressing Enter used
 * to split straight out of the block, so a callout/quote behaved as a single line.
 *
 * WHAT THIS DOES — a `handleKeyDown` plugin, positioned before BlockNote's own Enter
 * keymap, that for these block types implements the Notion rule:
 *   • Enter on a non-empty line          → insert a hard break (new line, same block)
 *   • Enter on an empty trailing line     → leave the block: drop the trailing break
 *     (if any) and create a normal paragraph after it, caret inside.
 * Shift+Enter is routed to the same "insert line" path so it also works (TipTap's
 * default refuses it here). Everything else falls through to BlockNote untouched.
 *
 * Scoped strictly to `MULTILINE_TYPES`; all other blocks keep their default Enter.
 */
const MULTILINE_TYPES = new Set(['callout', 'quote']);

export function createMultilineBlocksPlugin(editor: any): any {
  return new Plugin({
    key: multilineBlocksPluginKey,
    props: {
      handleKeyDown(view: any, event: KeyboardEvent) {
        if (event.key !== 'Enter' || event.isComposing) return false;
        if (event.ctrlKey || event.metaKey || event.altKey) return false;

        const { state } = view;
        const { selection } = state;
        if (!(selection instanceof TextSelection) || !selection.empty) return false;

        const $from = selection.$from;
        const parent = $from.parent;
        if (!MULTILINE_TYPES.has(parent.type.name)) return false;

        const hbType = state.schema.nodes.hardBreak;
        if (!hbType) return false;

        const atEnd = $from.parentOffset === parent.content.size;
        const nodeBefore = $from.nodeBefore;
        const prevIsBreak = !!nodeBefore && nodeBefore.type === hbType;
        const isEmpty = parent.content.size === 0;

        // Shift+Enter always means "new line in block" (TipTap refuses it here).
        // Plain Enter means "new line" too, EXCEPT on an empty trailing line, which
        // exits the block — that is the double-Enter-to-leave behaviour.
        const shouldExit = !event.shiftKey && (isEmpty || (atEnd && prevIsBreak));

        if (!shouldExit) {
          // Insert a hard break at the cursor (splits the current line).
          view.dispatch(state.tr.replaceSelectionWith(hbType.create(), false).scrollIntoView());
          return true;
        }

        // Exit the block. First drop the trailing hard break we're sitting after,
        // so the emptied last line doesn't linger as a blank row in the block.
        if (prevIsBreak && nodeBefore) {
          view.dispatch(state.tr.delete($from.pos - nodeBefore.nodeSize, $from.pos));
        }

        // Then add a normal paragraph as the next sibling and land the caret in it,
        // via BlockNote's own API (paragraph is a built-in block, so the caret syncs
        // synchronously — no custom-node-view caret dance needed here).
        try {
          const current = editor.getTextCursorPosition().block;
          const inserted = editor.insertBlocks([{ type: 'paragraph' }], current, 'after');
          const next = inserted?.[0];
          if (next) editor.setTextCursorPosition(next.id, 'start');
        } catch {
          // If BlockNote state moved under us, do nothing rather than throw in the
          // key handler.
        }
        return true;
      },
    },
  });
}
