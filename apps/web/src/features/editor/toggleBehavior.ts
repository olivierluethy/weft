// Same single resolved prosemirror-state copy BlockNote's editor state is built
// from (see multilineBlocks.ts for why this matters).
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const toggleBehaviorPluginKey = new PluginKey('weftToggleBehavior');

/**
 * Makes a Toggle behave like a real container (§1–7): pressing Enter in the
 * toggle *title* creates a block *inside* the toggle and moves the caret there,
 * instead of splitting out to a sibling below it. So content typed after a toggle
 * stays nested under it, and the user keeps working inside the toggle.
 *
 * A collapsed toggle expands first, so the new content is visible. Once the caret
 * is in a child block, BlockNote's own Enter takes over — new lines become
 * siblings at the same nesting level (still inside the toggle) — so this plugin
 * only needs to intercept Enter while the caret is in the toggle title itself.
 *
 * Registered before BlockNote's Enter keymap (like multilineBlocks) so it can
 * claim the key for toggles; a no-op for every other block type.
 */
export function createToggleBehaviorPlugin(editor: any): any {
  return new Plugin({
    key: toggleBehaviorPluginKey,
    props: {
      handleKeyDown(view: any, event: KeyboardEvent) {
        if (event.key !== 'Enter' || event.isComposing || event.shiftKey) return false;
        if (event.ctrlKey || event.metaKey || event.altKey) return false;

        const { selection } = view.state;
        if (!(selection instanceof TextSelection) || !selection.empty) return false;
        if (selection.$from.parent.type.name !== 'toggle') return false;

        try {
          let toggle = editor.getTextCursorPosition().block;
          if (!toggle || toggle.type !== 'toggle') return false;

          // Expand a collapsed toggle so the new child is actually visible, then
          // re-read it (its children reference is unchanged, but be safe).
          if (toggle.props?.open === false) {
            editor.updateBlock(toggle, { props: { open: true } });
            toggle = editor.getBlock(toggle.id) ?? toggle;
          }

          const children = toggle.children ?? [];
          if (children.length > 0) {
            // Insert as the new FIRST child (before the existing first child), so
            // Enter from the title adds content at the top of the toggle's body.
            const inserted = editor.insertBlocks([{ type: 'paragraph' }], children[0], 'before')?.[0];
            if (inserted?.id) editor.setTextCursorPosition(inserted.id, 'start');
          } else {
            // No children yet: create a sibling paragraph, then nest it under the
            // toggle so it becomes the toggle's first (and only) child.
            const inserted = editor.insertBlocks([{ type: 'paragraph' }], toggle, 'after')?.[0];
            if (inserted?.id) {
              editor.setTextCursorPosition(inserted.id, 'start');
              if (editor.canNestBlock()) editor.nestBlock();
            }
          }
        } catch {
          // BlockNote state shifted under us — swallow rather than throw inside
          // the key handler (that would break typing).
        }
        return true;
      },
    },
  });
}
