/** Editor content column width bounds (px). Persisted per page. */
export const PAGE_WIDTH = {
  min: 640,
  max: 1100,
  default: 720,
} as const;

/**
 * Valid `Page.fontFamily` keys — the persisted half of the page font library
 * (docs/STYLEGUIDE.md §3.3). The labels, CSS stacks and grouping live in the
 * web app's registry (`apps/web/src/features/editor/pageFonts.ts`), which is
 * compile-time checked against this list; only the keys need to be shared, so
 * the server can validate an update.
 *
 * `serif` / `sans` / `mono` are the original three and must never be renamed —
 * pages persist the key verbatim.
 */
export const PAGE_FONT_KEYS = [
  'serif',
  'lora',
  'merriweather',
  'source-serif',
  'playfair',
  'baskerville',
  'garamond',
  'sans',
  'roboto',
  'open-sans',
  'lato',
  'montserrat',
  'poppins',
  'nunito',
  'source-sans',
  'work-sans',
  'grotesk',
  'mono',
  'fira-code',
  'source-code',
  'plex-mono',
] as const;

export type PageFontKey = (typeof PAGE_FONT_KEYS)[number];

/** Page content-column width presets offered as one exclusive choice. */
export const PAGE_WIDTH_PRESETS = [
  { key: 'narrow', label: 'Narrower', width: 640 },
  { key: 'default', label: 'Default', width: 720 },
  { key: 'wide', label: 'Wider', width: 900 },
] as const;

export type PageWidthPreset = (typeof PAGE_WIDTH_PRESETS)[number]['key'] | 'full';

/** Words-per-minute used for reading-time estimates. */
export const READING_WPM = 220;

/** Cover image aspect (height in px at full width). */
export const COVER_HEIGHT = 240;

export const APP_NAME = 'Weft';
export const APP_TAGLINE = 'A woven web of connected notes.';
