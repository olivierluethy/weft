import { createReactStyleSpec } from '@blocknote/react';
import { PAGE_FONTS } from './pageFonts';

/** Font-family stacks for the inline `font` mark. Read straight out of the page
 * font registry (docs/STYLEGUIDE.md §3.3/§3.4) rather than restated here, so an
 * inline `mono` run is guaranteed to read identically to a `mono` page. */
export const FONT_STACKS: Record<string, string> = Object.fromEntries(
  PAGE_FONTS.map((f) => [f.key, f.stack]),
);

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
