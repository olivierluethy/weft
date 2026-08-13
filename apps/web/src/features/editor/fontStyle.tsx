import { createReactStyleSpec } from '@blocknote/react';

/** Font-family stacks for the inline `font` mark. These match the page-level
 * faces (docs/STYLEGUIDE.md §3.3/§3.4) exactly, so an inline `mono` run reads
 * identically to a `mono` page. */
export const FONT_STACKS: Record<string, string> = {
  sans: 'Inter, system-ui, sans-serif',
  serif: 'Newsreader, Georgia, serif',
  mono: "'JetBrains Mono', ui-monospace, monospace",
};

/** Choices surfaced in the formatting-toolbar dropdown. `''` = Default (clears
 * the mark, so the text falls back to the page face). */
export const FONT_CHOICES: { key: string; label: string }[] = [
  { key: '', label: 'Default' },
  { key: 'sans', label: 'Sans' },
  { key: 'serif', label: 'Serif' },
  { key: 'mono', label: 'Mono' },
];

/** Inline font-family mark. Stored on the selected text range as
 * `{ styles: { font: 'sans' | 'serif' | 'mono' } }`; overrides the page default
 * for the marked characters only. */
export const FontStyle = createReactStyleSpec(
  { type: 'font', propSchema: 'string' },
  {
    render: (props) => (
      <span ref={props.contentRef} style={{ fontFamily: FONT_STACKS[props.value] ?? undefined }} />
    ),
  },
);
