import {
  FormattingToolbar,
  getFormattingToolbarItems,
  useBlockNoteEditor,
  useComponentsContext,
  useEditorContentOrSelectionChange,
} from '@blocknote/react';
import { useState } from 'react';
import { Type } from 'lucide-react';
import { FONT_CHOICES } from './fontStyle';

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

/** Weft's formatting toolbar = BlockNote defaults + the inline font-family picker. */
export function WeftFormattingToolbar() {
  return (
    <FormattingToolbar>
      {[...getFormattingToolbarItems(), <FontSelect key="font-family" />]}
    </FormattingToolbar>
  );
}
