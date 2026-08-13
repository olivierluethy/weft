import { InputRule } from '@tiptap/core';
import {
  type PropSchema,
  createBlockSpecFromStronglyTypedTiptapNode,
  createStronglyTypedTiptapNode,
  propsToAttributes,
  createDefaultBlockDOMOutputSpec,
  defaultProps,
  getBlockInfoFromSelection,
  updateBlockCommand,
} from '@blocknote/core';

/* Weft's heading block. BlockNote's built-in heading hard-caps `level` at
 * [1, 2, 3] (see @blocknote/core .../HeadingBlockContent.ts), which is *the*
 * reason levels 4–6 could never be stored or rendered. This is a faithful
 * re-implementation of that node with the full six-level range, keeping the
 * same block `type` ("heading") and prop shape so existing content, collab and
 * undo are untouched — only the set of allowed `level` values widens.
 *
 * Markdown shortcuts (`#`…`######`) and `Mod-Alt-1..6` are regenerated for all
 * six levels so replacing the default block does not regress the 1–3 behaviour. */

const LEVELS = [1, 2, 3, 4, 5, 6] as const;

export const headingPropSchema = {
  ...defaultProps,
  level: { default: 1, values: LEVELS },
} satisfies PropSchema;

const HeadingBlockContent = createStronglyTypedTiptapNode({
  name: 'heading',
  content: 'inline*',
  group: 'blockContent',

  addAttributes() {
    return propsToAttributes(headingPropSchema);
  },

  addInputRules() {
    // `#` + space → H1, `##` → H2, … `######` → H6.
    return LEVELS.map(
      (level) =>
        new InputRule({
          find: new RegExp(`^(#{${level}})\\s$`),
          handler: ({ state, chain, range }) => {
            const blockInfo = getBlockInfoFromSelection(state);
            if (
              !blockInfo.isBlockContainer ||
              blockInfo.blockContent.node.type.spec.content !== 'inline*'
            ) {
              return;
            }
            chain()
              .command(
                updateBlockCommand(this.options.editor, blockInfo.bnBlock.beforePos, {
                  type: 'heading',
                  props: { level: level as never },
                }),
              )
              // Remove the "#" character(s) used to set the heading.
              .deleteRange({ from: range.from, to: range.to })
              .run();
          },
        }),
    );
  },

  addKeyboardShortcuts() {
    // Mod-Alt-1 … Mod-Alt-6 set the corresponding heading level.
    return Object.fromEntries(
      LEVELS.map((level) => [
        `Mod-Alt-${level}`,
        () => {
          const blockInfo = getBlockInfoFromSelection(this.editor.state);
          if (
            !blockInfo.isBlockContainer ||
            blockInfo.blockContent.node.type.spec.content !== 'inline*'
          ) {
            return true;
          }
          return this.editor.commands.command(
            updateBlockCommand(this.options.editor, blockInfo.bnBlock.beforePos, {
              type: 'heading',
              props: { level: level as never },
            }),
          );
        },
      ]),
    );
  },

  parseHTML() {
    return [
      { tag: 'div[data-content-type=' + this.name + ']' },
      ...LEVELS.map((level) => ({ tag: `h${level}`, attrs: { level }, node: 'heading' })),
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return createDefaultBlockDOMOutputSpec(
      this.name,
      `h${node.attrs.level}`,
      {
        ...(this.options.domAttributes?.blockContent || {}),
        ...HTMLAttributes,
      },
      this.options.domAttributes?.inlineContent || {},
    );
  },
});

/** Six-level heading block spec — drop-in replacement for the default. */
export const Heading6 = createBlockSpecFromStronglyTypedTiptapNode(
  HeadingBlockContent,
  headingPropSchema,
);
