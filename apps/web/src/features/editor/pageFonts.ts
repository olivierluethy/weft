/**
 * The page font library — the single source of truth for every face Weft
 * offers as a page-level typeface (docs/STYLEGUIDE.md §3.3).
 *
 * Everything that needs a face reads this list: the options-panel picker, the
 * page container (which publishes `--wf-body-font` / `--wf-title-font`), the
 * HTML/PDF exporter, the DOCX exporter, and the side peek. Nothing else may
 * hard-code a font stack — that was how the old three-face list drifted out of
 * sync with the exporters.
 *
 * **Every key here is self-hosted** via an `@fontsource` import in
 * `src/fonts.css`. That is the rule that keeps the picker honest: it must never
 * list a name that silently renders as something else (the reason plain
 * "Georgia" is not on the list — it isn't installed on most Linux desktops).
 * Adding a face means adding BOTH the import and the entry, plus the key to the
 * `fontFamily` enum in `packages/shared/src/dto.ts`.
 *
 * `serif`, `sans` and `mono` are the original three keys, kept verbatim so
 * pages saved before the library existed keep exactly the face they had.
 */

import { type PageFontKey } from '@weft/shared';

export type PageFontGroup = 'Serif' | 'Sans' | 'Mono';

export interface PageFontDef {
  /** Persisted on `Page.fontFamily`. Never rename an existing key. */
  key: PageFontKey;
  /** Shown in the picker. */
  label: string;
  /** One-line character sketch under the name in the picker. */
  desc: string;
  group: PageFontGroup;
  /** CSS font stack, with a generic fallback so text renders while loading. */
  stack: string;
  /** Name written into .docx (Word resolves it locally, or falls back). */
  docx: string;
  /** Extra search terms for the options-panel fuzzy search. */
  keywords?: readonly string[];
}

export const PAGE_FONTS = [
  // ── Serif ────────────────────────────────────────────────────────────────
  {
    key: 'serif',
    desc: 'Editorial, classic',
    label: 'Newsreader',
    group: 'Serif',
    stack: 'Newsreader, Georgia, serif',
    docx: 'Georgia',
    keywords: ['serif', 'default', 'editorial', 'classic'],
  },
  {
    key: 'lora',
    desc: 'Contemporary, brushed',
    label: 'Lora',
    group: 'Serif',
    stack: "Lora, Georgia, serif",
    docx: 'Georgia',
    keywords: ['serif', 'contemporary', 'brushed'],
  },
  {
    key: 'merriweather',
    desc: 'Sturdy, built for screens',
    label: 'Merriweather',
    group: 'Serif',
    stack: "Merriweather, Georgia, serif",
    docx: 'Georgia',
    keywords: ['serif', 'screen', 'sturdy'],
  },
  {
    key: 'source-serif',
    desc: 'Quiet workhorse text',
    label: 'Source Serif 4',
    group: 'Serif',
    stack: "'Source Serif 4', Georgia, serif",
    docx: 'Georgia',
    keywords: ['serif', 'adobe', 'text'],
  },
  {
    key: 'playfair',
    desc: 'High contrast, dramatic',
    label: 'Playfair Display',
    group: 'Serif',
    stack: "'Playfair Display', Georgia, serif",
    docx: 'Georgia',
    keywords: ['serif', 'display', 'high contrast', 'elegant'],
  },
  {
    key: 'baskerville',
    desc: 'Bookish, transitional',
    label: 'Libre Baskerville',
    group: 'Serif',
    stack: "'Libre Baskerville', Georgia, serif",
    docx: 'Georgia',
    keywords: ['serif', 'book', 'transitional'],
  },
  {
    key: 'garamond',
    desc: 'Old style, humanist',
    label: 'EB Garamond',
    group: 'Serif',
    stack: "'EB Garamond', Garamond, Georgia, serif",
    docx: 'Garamond',
    keywords: ['serif', 'old style', 'humanist', 'classic'],
  },

  // ── Sans ─────────────────────────────────────────────────────────────────
  {
    key: 'sans',
    desc: 'Clean, modern UI',
    label: 'Inter',
    group: 'Sans',
    stack: 'Inter, system-ui, sans-serif',
    docx: 'Calibri',
    keywords: ['sans', 'default', 'ui', 'clean', 'modern'],
  },
  {
    key: 'roboto',
    desc: 'Neutral, familiar',
    label: 'Roboto',
    group: 'Sans',
    stack: 'Roboto, system-ui, sans-serif',
    docx: 'Calibri',
    keywords: ['sans', 'neutral', 'android', 'google'],
  },
  {
    key: 'open-sans',
    desc: 'Humanist, very readable',
    label: 'Open Sans',
    group: 'Sans',
    stack: "'Open Sans', system-ui, sans-serif",
    docx: 'Calibri',
    keywords: ['sans', 'humanist', 'readable'],
  },
  {
    key: 'lato',
    desc: 'Warm, humanist',
    label: 'Lato',
    group: 'Sans',
    stack: 'Lato, system-ui, sans-serif',
    docx: 'Calibri',
    keywords: ['sans', 'warm', 'humanist'],
  },
  {
    key: 'montserrat',
    desc: 'Geometric, headline',
    label: 'Montserrat',
    group: 'Sans',
    stack: 'Montserrat, system-ui, sans-serif',
    docx: 'Calibri',
    keywords: ['sans', 'geometric', 'headline'],
  },
  {
    key: 'poppins',
    desc: 'Geometric, round',
    label: 'Poppins',
    group: 'Sans',
    stack: 'Poppins, system-ui, sans-serif',
    docx: 'Calibri',
    keywords: ['sans', 'geometric', 'round'],
  },
  {
    key: 'nunito',
    desc: 'Rounded, friendly',
    label: 'Nunito',
    group: 'Sans',
    stack: 'Nunito, system-ui, sans-serif',
    docx: 'Calibri',
    keywords: ['sans', 'rounded', 'friendly', 'soft'],
  },
  {
    key: 'source-sans',
    desc: 'Level, understated',
    label: 'Source Sans 3',
    group: 'Sans',
    stack: "'Source Sans 3', system-ui, sans-serif",
    docx: 'Calibri',
    keywords: ['sans', 'adobe', 'ui'],
  },
  {
    key: 'work-sans',
    desc: 'Grotesque, screen-first',
    label: 'Work Sans',
    group: 'Sans',
    stack: "'Work Sans', system-ui, sans-serif",
    docx: 'Calibri',
    keywords: ['sans', 'grotesque', 'screen'],
  },
  {
    key: 'grotesk',
    desc: 'Technical display — Weft\'s own',
    label: 'Space Grotesk',
    group: 'Sans',
    stack: "'Space Grotesk', system-ui, sans-serif",
    docx: 'Calibri',
    keywords: ['sans', 'display', 'technical', 'weft'],
  },

  // ── Mono ─────────────────────────────────────────────────────────────────
  {
    key: 'mono',
    desc: 'Fixed width, for code',
    label: 'JetBrains Mono',
    group: 'Mono',
    stack: "'JetBrains Mono', ui-monospace, monospace",
    docx: 'Consolas',
    keywords: ['mono', 'default', 'code', 'fixed width'],
  },
  {
    key: 'fira-code',
    desc: 'Code, with ligatures',
    label: 'Fira Code',
    group: 'Mono',
    stack: "'Fira Code', ui-monospace, monospace",
    docx: 'Consolas',
    keywords: ['mono', 'code', 'ligatures'],
  },
  {
    key: 'source-code',
    desc: 'Code, even colour',
    label: 'Source Code Pro',
    group: 'Mono',
    stack: "'Source Code Pro', ui-monospace, monospace",
    docx: 'Consolas',
    keywords: ['mono', 'code', 'adobe'],
  },
  {
    key: 'plex-mono',
    desc: 'Code, engineered',
    label: 'IBM Plex Mono',
    group: 'Mono',
    stack: "'IBM Plex Mono', ui-monospace, monospace",
    docx: 'Consolas',
    keywords: ['mono', 'code', 'ibm'],
  },
] as const satisfies readonly PageFontDef[];

/**
 * Compile-time proof that the registry covers every persisted key. Add a key to
 * `PAGE_FONT_KEYS` in @weft/shared without adding it here (or without adding the
 * `@fontsource` import to fonts.css, which this documents) and `tsc` fails here
 * instead of the picker quietly rendering an unstyled page.
 */
type MissingFace = Exclude<PageFontKey, (typeof PAGE_FONTS)[number]['key']>;
const _everyKeyHasAFace: MissingFace extends never ? true : MissingFace = true;
void _everyKeyHasAFace;

/** The face used when a page has no (or an unknown) `fontFamily`. */
export const DEFAULT_PAGE_FONT: PageFontKey = 'serif';

const BY_KEY = new Map<string, PageFontDef>(PAGE_FONTS.map((f) => [f.key, f]));

/** Look a face up, falling back to the default for unknown/legacy values. */
export function pageFont(key: string | null | undefined): PageFontDef {
  return (key ? BY_KEY.get(key) : undefined) ?? BY_KEY.get(DEFAULT_PAGE_FONT)!;
}

/** CSS stack for a key (safe for any input). */
export function pageFontStack(key: string | null | undefined): string {
  return pageFont(key).stack;
}

/**
 * The CSS custom properties a page container publishes for its face.
 *
 * `--wf-body-font` re-faces title, headings and body. `--wf-title-font` exists
 * because the *default* face deliberately keeps the Space Grotesk display look
 * on the page title — every other choice re-faces the title too, otherwise
 * picking "Poppins" would leave the biggest text on the page unchanged.
 */
export function pageFontVars(key: string | null | undefined): Record<string, string> {
  const font = pageFont(key);
  return {
    '--wf-body-font': font.stack,
    '--wf-title-font':
      font.key === DEFAULT_PAGE_FONT ? "'Space Grotesk', system-ui, sans-serif" : font.stack,
  };
}

/** Faces grouped for the picker, in the registry's order. */
export function pageFontsByGroup(
  fonts: readonly PageFontDef[] = PAGE_FONTS,
): { group: PageFontGroup; fonts: PageFontDef[] }[] {
  const groups: PageFontGroup[] = ['Serif', 'Sans', 'Mono'];
  return groups
    .map((group) => ({ group, fonts: fonts.filter((f) => f.group === group) }))
    .filter((g) => g.fonts.length > 0);
}
