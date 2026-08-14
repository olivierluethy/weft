// Imported from `prosemirror-state` directly — the SAME resolved copy BlockNote
// builds its state from (see multilineBlocks.ts for the why).
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const quoteShortcutPluginKey = new PluginKey('weftQuoteShortcut');

/**
 * Markdown shortcut for the Quote block: typing "> " at the start of an empty
 * paragraph turns it into a quote — the same muscle-memory Notion supports.
 *
 * WHY A PLUGIN — the built-in blocks register their markdown shortcuts as tiptap
 * input rules (`#` → heading, `-` → bullet, `1.` → numbered, `[]` → to-do; see
 * heading.ts). Quote is one of Weft's custom React block specs, which can't carry
 * `addInputRules`, so it had no shortcut and "> " stayed literal text — an obvious
 * gap next to every other basic block. This `handleKeyDown` fills it: on the space
 * that follows a lone ">" at a paragraph's start, it converts the block to a quote
 * and swallows the space, then lands the caret inside. Undo reverts it in one step
 * (the conversion is a single transaction), matching input-rule behaviour.
 */
export function createQuoteShortcutPlugin(editor: any): any {
  return new Plugin({
    key: quoteShortcutPluginKey,
    props: {
      handleKeyDown(view: any, event: KeyboardEvent) {
        if (event.key !== ' ' || event.isComposing) return false;
        if (event.ctrlKey || event.metaKey || event.altKey) return false;

        const { selection } = view.state;
        if (!(selection instanceof TextSelection) || !selection.empty) return false;
        // Caret must sit right after a single ">" at the very start of the block.
        if (selection.$from.parentOffset !== 1) return false;

        let block;
        try {
          block = editor.getTextCursorPosition()?.block;
        } catch {
          return false;
        }
        if (!block || block.type !== 'paragraph' || !Array.isArray(block.content)) return false;
        const text = block.content.map((c: any) => (c.type === 'text' ? c.text : '')).join('');
        if (text !== '>') return false;

        try {
          editor.updateBlock(block.id, { type: 'quote', content: [] });
          editor.setTextCursorPosition(block.id, 'start');
        } catch {
          return false;
        }
        return true; // swallow the space that triggered the conversion
      },
    },
  });
}
