import {
  FormattingToolbar,
  getFormattingToolbarItems,
  useBlockNoteEditor,
  useComponentsContext,
  useEditorContentOrSelectionChange,
} from '@blocknote/react';
import { useState } from 'react';
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
} from 'lucide-react';
import { FONT_CHOICES } from './fontStyle';
import { HEADING_LABELS, HEADING_LEVELS, type HeadingLevel } from './headingScale';

const HEADING_ICON: Record<HeadingLevel, typeof Heading1> = {
  1: Heading1,
  2: Heading2,
  3: Heading3,
  4: Heading4,
  5: Heading5,
  6: Heading6,
};

/** Heading-level switcher for the formatting toolbar.
 *
 * BlockNote's built-in `BlockTypeSelect` only offers Heading 1–3, and it hides
 * even those once the schema swaps in Weft's six-level heading block (its
 * `checkDefaultBlockTypeInSchema` is a reference-equality check). So we provide
 * the full Text + H1–H6 switch ourselves, mirroring the slash menu. It always
 * marks one option selected — `ToolbarSelect` renders nothing otherwise. */
function HeadingSelect() {
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext()!;
  const [active, setActive] = useState<string>('text');

  useEditorContentOrSelectionChange(() => {
    const block = editor.getTextCursorPosition().block;
    if (block?.type === 'heading') setActive('h' + (block.props as { level: number }).level);
    else setActive('text');
  }, editor);

  const apply = (value: string) => {
    editor.focus();
    const block = editor.getTextCursorPosition().block;
    if (!block) return;
    if (value === 'text') editor.updateBlock(block, { type: 'paragraph' });
    else editor.updateBlock(block, { type: 'heading', props: { level: Number(value.slice(1)) as never } });
  };

  const items = [
    { text: 'Text', value: 'text', icon: <Type size={16} /> },
    ...HEADING_LEVELS.map((level) => {
      const Icon = HEADING_ICON[level];
      return { text: HEADING_LABELS[level], value: 'h' + level, icon: <Icon size={16} /> };
    }),
  ].map((it) => ({
    text: it.text,
    icon: it.icon,
    isSelected: active === it.value,
    onClick: () => apply(it.value),
  }));

  return <Components.FormattingToolbar.Select items={items} />;
}

/** Per-selection font-family picker for the formatting toolbar. Reads/writes the
 * inline `font` style (docs/STYLEGUIDE.md §3.4): Default clears the mark, the
 * others override the page face for the selected characters only. */
function FontSelect() {
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext()!;
  const [active, setActive] = useState<string>('');

  useEditorContentOrSelectionChange(() => {
    const styles = editor.getActiveStyles() as Record<string, unknown>;
    setActive(typeof styles.font === 'string' ? styles.font : '');
  }, editor);

  const apply = (key: string) => {
    editor.focus();
    // Clear any existing font mark first so values don't stack.
    const current = (editor.getActiveStyles() as Record<string, unknown>).font;
    if (typeof current === 'string') editor.removeStyles({ font: current } as never);
    if (key) editor.addStyles({ font: key } as never);
  };

  return (
    <Components.FormattingToolbar.Select
      items={FONT_CHOICES.map((f) => ({
        text: f.label,
        icon: <Type size={16} />,
        isSelected: active === f.key,
        onClick: () => apply(f.key),
      }))}
    />
  );
}

/** Weft's formatting toolbar = the heading-level switch + BlockNote defaults +
 * the inline font-family picker. */
export function WeftFormattingToolbar() {
  return (
    <FormattingToolbar>
      {[
        <HeadingSelect key="heading-level" />,
        ...getFormattingToolbarItems(),
        <FontSelect key="font-family" />,
      ]}
    </FormattingToolbar>
  );
}
