import { createReactStyleSpec } from '@blocknote/react';
import { PAGE_FONTS } from './pageFonts';

/** Font-family stacks for the inline `font` mark. Read straight out of the page
 * font registry (docs/STYLEGUIDE.md §3.3/§3.4) rather than restated here, so an
 * inline `mono` run is guaranteed to read identically to a `mono` page. */
export const FONT_STACKS: Record<string, string> = Object.fromEntries(
  PAGE_FONTS.map((f) => [f.key, f.stack]),
);

/** Inline font-family mark. Stored on the selected text range as
 * `{ styles: { font: '<page font key>' } }`; overrides the page face for the
 * marked characters only. The choices are the whole library — the picker is
 * `FontList`, opened from the formatting toolbar (see FormattingToolbar.tsx);
 * there is no separate short list here to fall behind the registry. */
export const FontStyle = createReactStyleSpec(
  { type: 'font', propSchema: 'string' },
  {
    render: (props) => (
      <span ref={props.contentRef} style={{ fontFamily: FONT_STACKS[props.value] ?? undefined }} />
    ),
  },
);
